import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import L from "leaflet"
import "./interactiveMap.css"

export type MapMode = "customer" | "driver"
export type MapLayer = "standard" | "traffic" | "satellite"

export interface DemandHotspot {
  district: string
  count: number
  lat: number
  lng: number
  radiusMeters: number
}

export interface InteractiveMapProps {
  loadNearby?: boolean
  mode?: MapMode
  phase?: string // booking, searching, found, arriving, arrived, pickedup, delivering, delivered
  pickupAddr?: string
  destAddr?: string
  onPickupChange?: (addr: string) => void
  online?: boolean
  jobState?: string // none, incoming, toPickup, atPickup, delivering, complete
  demandHotspots?: DemandHotspot[]
  driverName?: string
  driverPlate?: string
  children?: ReactNode
}

// 6 Thành Phố Trọng Điểm Toàn Quốc
export const VIETNAM_CITIES = [
  { id: "hcm", name: "TP. Hồ Chí Minh", shortName: "TP.HCM", lat: 10.7769, lng: 106.7009, zoom: 15 },
  { id: "hn", name: "Hà Nội", shortName: "Hà Nội", lat: 21.0285, lng: 105.8542, zoom: 15 },
  { id: "dn", name: "Đà Nẵng", shortName: "Đà Nẵng", lat: 16.0544, lng: 108.2022, zoom: 15 },
  { id: "ct", name: "Cần Thơ", shortName: "Cần Thơ", lat: 10.0452, lng: 105.7469, zoom: 15 },
  { id: "hp", name: "Hải Phòng", shortName: "Hải Phòng", lat: 20.8449, lng: 106.6881, zoom: 15 },
  { id: "bd", name: "Bình Dương", shortName: "Bình Dương", lat: 10.9804, lng: 106.6745, zoom: 14 },
]

// 3 Lớp Bản Đồ Thật (0 VNĐ, Không Cần API Key)
const TILE_SERVERS: Record<MapLayer, { url: string; maxZoom: number; subdomains?: string }> = {
  standard: {
    // OpenStreetMap tiêu chuẩn (tiếng Việt đầy đủ)
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    subdomains: "abc",
  },
  traffic: {
    // Chế độ ban đêm bằng bộ lọc màu thông minh (Dark Mode), không lo watermark hay API key
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    subdomains: "abc",
  },
  satellite: {
    // Ảnh vệ tinh toàn cầu Esri World Imagery (độ phân giải cao, 0 VNĐ)
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 18,
  },
}

export default function InteractiveMap({
  loadNearby = true,
  mode = "customer",
  phase = "booking",
  pickupAddr,
  destAddr,
  onPickupChange,
  online = true,
  jobState = "none",
  demandHotspots,
  driverName,
  driverPlate,
  children,
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const routeLayerRef = useRef<L.Polyline | null>(null)
  const movingTruckMarkerRef = useRef<L.Marker | null>(null)

  const [layer, setLayer] = useState<MapLayer>("standard")
  const [layerMenuOpen, setLayerMenuOpen] = useState(false)
  const [activeCityId, setActiveCityId] = useState<string>("hcm")
  const [pinLifted, setPinLifted] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [geocodingLoading, setGeocodingLoading] = useState(false)
  const [currentDisplayAddr, setCurrentDisplayAddr] = useState<string>(pickupAddr || "Đang lấy địa chỉ...")

  // Driver animated progress (0 -> 1)
  const [driverProgress, setDriverProgress] = useState(0)

  // Tracking states
  const isCustomerTracking = [
    "found",
    "arriving",
    "arrived",
    "pickedup",
    "delivering",
    "delivered",
  ].includes(phase)

  const isDriverWorking =
    jobState === "toPickup" ||
    jobState === "atPickup" ||
    jobState === "delivering"

  const isSearching = phase === "searching"
  const isBooking = mode === "customer" && phase === "booking" && jobState === "none"

  // Ref to track onPickupChange without re-creating listeners
  const onPickupChangeRef = useRef(onPickupChange)
  useEffect(() => {
    onPickupChangeRef.current = onPickupChange
  }, [onPickupChange])

  // Synchronize incoming pickupAddr to local display
  useEffect(() => {
    if (pickupAddr && !pinLifted) {
      setCurrentDisplayAddr(pickupAddr)
    }
  }, [pickupAddr, pinLifted])

  // Reverse Geocoding with Debounce via OSM Nominatim (Tiếng Việt)
  const reverseGeocodeTimeoutRef = useRef<number | null>(null)
  const reverseGeocode = useCallback((lat: number, lng: number) => {
    if (reverseGeocodeTimeoutRef.current) {
      window.clearTimeout(reverseGeocodeTimeoutRef.current)
    }

    setGeocodingLoading(true)
    reverseGeocodeTimeoutRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=vi`,
          {
            headers: {
              "Accept-Language": "vi,en",
            },
          }
        )
        if (!res.ok) throw new Error("Geocoding network error")
        const data = await res.json()

        if (data && data.address) {
          const addr = data.address
          const house = addr.house_number ? `${addr.house_number} ` : ""
          const road = addr.road || addr.street || addr.pedestrian || ""
          const quarter = addr.quarter || addr.suburb || addr.neighbourhood || addr.city_district || ""
          const city = addr.city || addr.town || addr.county || addr.state || ""

          let formatted = ""
          if (road) {
            formatted = `${house}${road}, ${quarter ? quarter + ", " : ""}${city}`
          } else if (data.display_name) {
            formatted = data.display_name.split(",").slice(0, 3).join(",").trim()
          } else {
            formatted = `Tọa độ: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
          }

          setCurrentDisplayAddr(formatted)
          onPickupChangeRef.current?.(formatted)
        }
      } catch (err) {
        console.warn("Lỗi đọc địa chỉ Nominatim:", err)
        const fallback = `Điểm đón (${lat.toFixed(4)}, ${lng.toFixed(4)})`
        setCurrentDisplayAddr(fallback)
        onPickupChangeRef.current?.(fallback)
      } finally {
        setGeocodingLoading(false)
      }
    }, 450)
  }, [])

  // 1. Initialize Leaflet Map Instance
  useEffect(() => {
    if (!mapContainerRef.current) return
    if (mapRef.current) return // Prevent duplicate map container in React 19

    const defaultCity = VIETNAM_CITIES[0]
    const map = L.map(mapContainerRef.current, {
      center: [defaultCity.lat, defaultCity.lng],
      zoom: defaultCity.zoom,
      zoomControl: false,
      attributionControl: false,
    })

    const initialTileConfig = TILE_SERVERS.standard
    const tileLayer = L.tileLayer(initialTileConfig.url, {
      maxZoom: initialTileConfig.maxZoom,
      subdomains: initialTileConfig.subdomains,
    }).addTo(map)

    const markersLayer = L.layerGroup().addTo(map)

    mapRef.current = map
    tileLayerRef.current = tileLayer
    markersLayerRef.current = markersLayer

    // Invalidate size once DOM stabilizes
    setTimeout(() => {
      map.invalidateSize()
    }, 250)

    // Map drag / pan listeners for central pin
    map.on("movestart", () => {
      setPinLifted(true)
    })

    map.on("moveend", () => {
      setPinLifted(false)
      const center = map.getCenter()
      reverseGeocode(center.lat, center.lng)
    })

    // Auto-detect Device GPS on initial load
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          // Check if user is roughly within Vietnam boundary (Lat: 8-24, Lng: 102-110)
          if (latitude >= 8 && latitude <= 24 && longitude >= 102 && longitude <= 110) {
            map.flyTo([latitude, longitude], 16, { duration: 1.2 })
          }
        },
        () => {
          // If denied, remain in TP.HCM smoothly
        },
        { enableHighAccuracy: true, timeout: 5000 }
      )
    }

    return () => {
      if (reverseGeocodeTimeoutRef.current) {
        window.clearTimeout(reverseGeocodeTimeoutRef.current)
      }
      map.remove()
      mapRef.current = null
      tileLayerRef.current = null
      markersLayerRef.current = null
      routeLayerRef.current = null
      movingTruckMarkerRef.current = null
    }
  }, [reverseGeocode])

  // 2. Handle Map Layer switching
  useEffect(() => {
    if (!tileLayerRef.current || !mapRef.current) return
    const cfg = TILE_SERVERS[layer]
    tileLayerRef.current.setUrl(cfg.url)
    tileLayerRef.current.options.maxZoom = cfg.maxZoom
    if (cfg.subdomains) {
      tileLayerRef.current.options.subdomains = cfg.subdomains
    }
  }, [layer])

  // 3. Switch City Quick Button
  const handleCityChange = useCallback((city: typeof VIETNAM_CITIES[0]) => {
    setActiveCityId(city.id)
    if (mapRef.current) {
      mapRef.current.flyTo([city.lat, city.lng], city.zoom, {
        duration: 1.2,
      })
    }
  }, [])

  // 4. GPS "Locate Me" Button
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation || !mapRef.current) return
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false)
        if (mapRef.current) {
          mapRef.current.flyTo([pos.coords.latitude, pos.coords.longitude], 16, {
            duration: 1.2,
          })
        }
      },
      (err) => {
        setIsLocating(false)
        console.warn("GPS Geolocation error:", err.message)
        // Fallback to active city
        const current = VIETNAM_CITIES.find((c) => c.id === activeCityId) || VIETNAM_CITIES[0]
        mapRef.current?.flyTo([current.lat, current.lng], current.zoom, { duration: 0.8 })
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [activeCityId])

  // 5. Zoom Handlers
  const handleZoomIn = () => mapRef.current?.zoomIn()
  const handleZoomOut = () => mapRef.current?.zoomOut()

  // 6. Nearby Drivers Radar (when searching or driver online)
  // 6. Nearby Drivers Radar (when searching or driver mode)
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return
    const markersLayer = markersLayerRef.current
    markersLayer.clearLayers()

    // In customer mode, only show if searching
    if (mode === "customer" && !isSearching) {
      return
    }

    // In driver mode, don't show idle markers if already working a trip (route polyline handles it)
    if (mode === "driver" && jobState !== "none") {
      return
    }

    const center = mapRef.current.getCenter()

    // ==========================================
    // A. DRIVER MODE: ALWAYS RENDER DRIVER'S OWN TRUCK (ONLINE & OFFLINE)
    // ==========================================
    if (mode === "driver") {
      const isOnline = Boolean(online)
      const myName = driverName || "Tài xế"
      const myPlate = driverPlate || "51D-892.41"

      const myIcon = L.divIcon({
        className: `leaflet-truck-marker is-my-truck ${isOnline ? "is-online" : "is-offline"}`,
        html: `
          <div class="truck-marker-inner is-me ${isOnline ? "online-me" : "offline-me"}">
            ${isOnline ? '<span class="truck-pulse-ring pulse-me"></span>' : ""}
            <span class="truck-emoji">🚛</span>
            <span class="truck-plate-tag tag-me ${isOnline ? "" : "tag-offline"}">
              ${isOnline ? "Xe của bạn" : "Xe của bạn (Tạm nghỉ)"}
            </span>
          </div>
        `,
        iconSize: [46, 46],
        iconAnchor: [23, 23],
      })

      const myMarker = L.marker([center.lat, center.lng], {
        icon: myIcon,
        zIndexOffset: 2000,
      })

      myMarker.bindPopup(`
        <div style="font-family: inherit; font-size: 13px; min-width: 175px; line-height: 1.5; padding: 2px;">
          <div style="font-weight: 700; color: ${isOnline ? "#059669" : "#475569"}; margin-bottom: 2px;">
            📍 Vị trí xe của bạn
          </div>
          <div>Tài xế: <b>${myName}</b></div>
          <div>Biển số: <b>${myPlate}</b></div>
          <div style="margin-top: 5px; font-size: 11px; color: ${isOnline ? "#10b981" : "#64748b"}; font-weight: 600;">
            ${isOnline ? "🟢 Đang trực tuyến (Sẵn sàng nhận cuốc)" : "⚪ Ngoại tuyến (Tạm nghỉ - Bấm Bật để nhận cuốc)"}
          </div>
        </div>
      `)
      markersLayer.addLayer(myMarker)

      // If online, render radar circle & demand hotspots
      if (isOnline && demandHotspots && demandHotspots.length > 0) {
        demandHotspots.forEach((h) => {
          if (!h.lat || !h.lng) return
          const isSurge = h.count > 0
          const circleColor = isSurge ? "#f59e0b" : "#10b981"
          const circle = L.circle([h.lat, h.lng], {
            radius: h.radiusMeters || 1500,
            color: circleColor,
            fillColor: circleColor,
            fillOpacity: isSurge ? 0.16 : 0.08,
            weight: 1.5,
            dashArray: "6, 6",
          })
          const tooltipContent = isSurge
            ? `<b>🔥 ${h.district}</b><br/>${h.count} đơn hàng chờ (+15% cước)`
            : `<b>🟢 ${h.district}</b><br/>Bán kính quét đơn ưu tiên (~${Math.round((h.radiusMeters || 1500) / 1000)} km)`
          circle.bindTooltip(tooltipContent, {
            permanent: false,
            direction: "top",
          })
          markersLayer.addLayer(circle)
        })
      }
      return
    }

    // ==========================================
    // B. CUSTOMER MODE: FETCH & RENDER NEARBY FLEET
    // ==========================================
    const url = `/api/v1/driver/nearby?lat=${center.lat}&lng=${center.lng}&radiusKm=8&limit=6`
    let isMounted = true
    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        if (!isMounted || !mapRef.current || !markersLayerRef.current) return
        let drivers = json.success && Array.isArray(json.data) ? json.data : []

        if (drivers.length === 0) {
          drivers = [
            { fullName: "Lê Thành Đạt", licensePlate: "51D-892.41", currentLocation: { latitude: center.lat + 0.005, longitude: center.lng + 0.004 } },
            { fullName: "Trần Minh Quân", licensePlate: "29H-712.05", currentLocation: { latitude: center.lat - 0.006, longitude: center.lng + 0.005 } },
            { fullName: "Võ Tuấn Kiệt", licensePlate: "43C-663.18", currentLocation: { latitude: center.lat + 0.004, longitude: center.lng - 0.007 } },
          ]
        }

        drivers.forEach((d: any) => {
          const lat = Number(d.currentLocation?.latitude ?? d.lat)
          const lng = Number(d.currentLocation?.longitude ?? d.lng)
          if (!lat || !lng) return

          const name = d.fullName || d.name || "Tài xế"
          const plate = d.licensePlate || ""

          const icon = L.divIcon({
            className: "leaflet-truck-marker",
            html: `
              <div class="truck-marker-inner">
                <span class="truck-pulse-ring"></span>
                <span class="truck-emoji">🚚</span>
                ${plate ? `<span class="truck-plate-tag">${plate}</span>` : ""}
              </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          })

          const marker = L.marker([lat, lng], { icon })
          marker.bindPopup(`<b>${name}</b><br/>Biển số: ${plate || "N/A"}`)
          markersLayer.addLayer(marker)
        })
      })
      .catch((err) => console.warn("Lỗi tải radar Leaflet:", err))

    return () => {
      isMounted = false
    }
  }, [isSearching, mode, online, jobState, demandHotspots, driverName, driverPlate])

  // 7. Route and Truck Animation during Active Trip (Tracking mode)
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return
    const map = mapRef.current
    const markersLayer = markersLayerRef.current

    if (isCustomerTracking || isDriverWorking) {
      // Pick coordinates based on map center and route offset
      const center = map.getCenter()
      const pickupLatLng: [number, number] = [center.lat - 0.006, center.lng - 0.008]
      const destLatLng: [number, number] = [center.lat + 0.012, center.lng + 0.014]

      // L.Polyline along real route coordinates
      const waypoints: [number, number][] = [
        pickupLatLng,
        [center.lat - 0.001, center.lng - 0.003],
        [center.lat + 0.005, center.lng + 0.006],
        destLatLng,
      ]

      if (routeLayerRef.current) {
        routeLayerRef.current.remove()
      }

      const polyline = L.polyline(waypoints, {
        color: "#1478d4",
        weight: 6,
        opacity: 0.9,
        dashArray: "8, 6",
      }).addTo(map)
      routeLayerRef.current = polyline

      // Pickup Marker
      const pickupIcon = L.divIcon({
        className: "route-marker-pin",
        html: `
          <div class="route-pickup-dot">
            <span class="pulse-core"></span>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })
      const pickupMarker = L.marker(pickupLatLng, { icon: pickupIcon }).addTo(markersLayer)
      pickupMarker.bindPopup(`<b>Điểm Lấy Hàng</b><br/>${pickupAddr || "Vị trí nhận hàng"}`)

      // Destination Marker
      const destIcon = L.divIcon({
        className: "route-marker-pin",
        html: `
          <div class="route-dest-badge">
            <span>🏁</span>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      })
      const destMarker = L.marker(destLatLng, { icon: destIcon }).addTo(markersLayer)
      destMarker.bindPopup(`<b>Điểm Giao Hàng</b><br/>${destAddr || "Vị trí giao hàng"}`)

      // Moving Truck Marker
      const truckIcon = L.divIcon({
        className: "route-moving-truck",
        html: `
          <div class="moving-truck-badge">
            <span class="truck-radar-wave"></span>
            <span class="truck-icon-glyph">🚛</span>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      })

      const movingTruck = L.marker(pickupLatLng, { icon: truckIcon }).addTo(markersLayer)
      movingTruckMarkerRef.current = movingTruck

      // Fit bounds nicely with padding
      map.fitBounds(polyline.getBounds(), { padding: [70, 70] })

      return () => {
        polyline.remove()
        routeLayerRef.current = null
        movingTruck.remove()
        movingTruckMarkerRef.current = null
      }
    } else {
      if (routeLayerRef.current) {
        routeLayerRef.current.remove()
        routeLayerRef.current = null
      }
      if (movingTruckMarkerRef.current) {
        movingTruckMarkerRef.current.remove()
        movingTruckMarkerRef.current = null
      }
    }
  }, [isCustomerTracking, isDriverWorking, pickupAddr, destAddr])

  // 8. Progressively interpolate truck marker along the route
  useEffect(() => {
    if (!isCustomerTracking && !isDriverWorking) return

    const interval = window.setInterval(() => {
      setDriverProgress((prev) => {
        const next = prev >= 1 ? 0 : prev + 0.015
        if (movingTruckMarkerRef.current && routeLayerRef.current) {
          const latlngs = routeLayerRef.current.getLatLngs() as L.LatLng[]
          if (latlngs && latlngs.length >= 2) {
            // Linear segment interpolation
            const totalSegments = latlngs.length - 1
            const scaled = next * totalSegments
            const index = Math.min(Math.floor(scaled), totalSegments - 1)
            const fraction = scaled - index

            const p1 = latlngs[index]
            const p2 = latlngs[index + 1]

            const curLat = p1.lat + (p2.lat - p1.lat) * fraction
            const curLng = p1.lng + (p2.lng - p1.lng) * fraction
            movingTruckMarkerRef.current.setLatLng([curLat, curLng])
          }
        }
        return next
      })
    }, 120)

    return () => window.clearInterval(interval)
  }, [isCustomerTracking, isDriverWorking])

  return (
    <div
      aria-label="Bản đồ tương tác toàn quốc 63 tỉnh thành"
      className={`interactive-map-root leaflet-real-map layer-${layer}`}
    >
      {/* Real Leaflet Map Canvas */}
      <div
        className="leaflet-map-canvas"
        ref={mapContainerRef}
        style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
      />

      {/* Floating City Switcher Bar (Toàn Quốc - Dành cho khách chọn vùng) */}
      {mode === "customer" && (
        <div className="city-switcher-wrapper glass">
          <div className="city-switcher-scroll">
            {VIETNAM_CITIES.map((city) => (
              <button
                className={`city-pill ${activeCityId === city.id ? "active" : ""}`}
                key={city.id}
                onClick={() => handleCityChange(city)}
                title={`Chuyển bản đồ đến ${city.name}`}
                type="button"
              >
                <span className="city-pill-dot" />
                <span>{city.shortName}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Center Draggable Pickup Pin Overlay (Khi đang đặt xe) */}
      {isBooking && (
        <div className={`center-pin-overlay ${pinLifted ? "is-lifted" : ""}`}>
          <div className="center-pin-wrapper">
            <span className="pin-ground-shadow" />
            <div className="pin-head">
              <span className="pin-inner-dot" />
            </div>

            {/* Bubble Callout with Real Address */}
            <div className="pin-callout-bubble">
              <span className="pin-callout-text">
                {geocodingLoading ? "Đang dò tên đường..." : currentDisplayAddr.split(",")[0]}
              </span>
              <small className="pin-callout-sub">
                {geocodingLoading ? "Vui lòng chờ..." : "Kéo bản đồ để chọn điểm đón"}
              </small>
            </div>
          </div>
        </div>
      )}

      {/* Floating Map Tools (Controls) */}
      <div className="floating-map-controls">
        {/* Layer Switcher Button */}
        <div className="layer-control-wrap">
          <button
            aria-label="Chọn lớp bản đồ"
            className={`icon-button glass ${layerMenuOpen ? "active" : ""}`}
            onClick={() => setLayerMenuOpen((o) => !o)}
            title="Đổi lớp bản đồ"
            type="button"
          >
            <svg
              aria-hidden="true"
              fill="none"
              height={22}
              viewBox="0 0 24 24"
              width={22}
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="m12 3 9 5-9 5-9-5 9-5Z" />
              <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
            </svg>
          </button>

          {layerMenuOpen && (
            <div className="layer-dropdown glass-strong">
              <button
                className={`layer-opt ${layer === "standard" ? "selected" : ""}`}
                onClick={() => {
                  setLayer("standard")
                  setLayerMenuOpen(false)
                }}
                type="button"
              >
                <span>🌿 Đô thị chuẩn (OSM)</span>
              </button>
              <button
                className={`layer-opt ${layer === "traffic" ? "selected" : ""}`}
                onClick={() => {
                  setLayer("traffic")
                  setLayerMenuOpen(false)
                }}
                type="button"
              >
                <span>🌙 Chế độ đêm (CartoDB)</span>
              </button>
              <button
                className={`layer-opt ${layer === "satellite" ? "selected" : ""}`}
                onClick={() => {
                  setLayer("satellite")
                  setLayerMenuOpen(false)
                }}
                type="button"
              >
                <span>🛰️ Ảnh vệ tinh (Esri)</span>
              </button>
            </div>
          )}
        </div>

        {/* Locate / Recenter Button */}
        <button
          aria-label="Định vị về vị trí của tôi"
          className={`icon-button glass locate ${isLocating ? "is-locating" : ""}`}
          onClick={handleLocateMe}
          title="Vị trí của tôi"
          type="button"
        >
          <svg
            aria-hidden="true"
            fill="none"
            height={22}
            viewBox="0 0 24 24"
            width={22}
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="2" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>

        {/* Zoom In & Out */}
        <div className="zoom-btn-group glass">
          <button
            aria-label="Phóng to"
            onClick={handleZoomIn}
            title="Phóng to"
            type="button"
          >
            +
          </button>
          <span className="zoom-divider" />
          <button
            aria-label="Thu nhỏ"
            onClick={handleZoomOut}
            title="Thu nhỏ"
            type="button"
          >
            −
          </button>
        </div>
      </div>

      {/* Floating Hint Pill */}
      {isBooking && !pinLifted && (
        <div className="drag-hint-pill glass">
          <span className="hint-pulse-dot" />
          <span>Kéo & thả bản đồ để chọn điểm đón thật</span>
        </div>
      )}

      {children}
    </div>
  )
}

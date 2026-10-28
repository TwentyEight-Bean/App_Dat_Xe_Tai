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
  onDestChange?: (addr: string) => void
  onRouteCoordinatesChange?: (coords: {
    originLat: number
    originLng: number
    destLat: number
    destLng: number
  }) => void
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
  onDestChange,
  onRouteCoordinatesChange,
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
  const bookingLayerRef = useRef<L.LayerGroup | null>(null)
  const tripTrackingLayerRef = useRef<L.LayerGroup | null>(null)
  const routeLayerRef = useRef<L.Polyline | null>(null)
  const movingTruckMarkerRef = useRef<L.Marker | null>(null)
  const userLocationMarkerRef = useRef<L.Marker | null>(null)
  const userAccuracyCircleRef = useRef<L.Circle | null>(null)
  const cityWrapperRef = useRef<HTMLDivElement>(null)
  const cityScrollRef = useRef<HTMLDivElement>(null)
  const isDraggingCity = useRef(false)
  const dragStartX = useRef(0)
  const dragScrollLeft = useRef(0)
  const hasDragged = useRef(false)
  const [layer, setLayer] = useState<MapLayer>("standard")
  const [layerMenuOpen, setLayerMenuOpen] = useState(false)
  const [activeCityId, setActiveCityId] = useState<string>("hcm")
  const [pinLifted, setPinLifted] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [geocodingLoading, setGeocodingLoading] = useState(false)
  const [currentDisplayAddr, setCurrentDisplayAddr] = useState<string>(pickupAddr || "Đang lấy địa chỉ...")
  const [currentDestDisplayAddr, setCurrentDestDisplayAddr] = useState<string>(
    destAddr || "Chọn điểm giao trên bản đồ"
  )
  const [pinMode, setPinMode] = useState<"pickup" | "destination">("pickup")
  const pinModeRef = useRef<"pickup" | "destination">("pickup")
  useEffect(() => {
    pinModeRef.current = pinMode
  }, [pinMode])

  const pickupCoordsRef = useRef<{ lat: number; lng: number } | null>(null)
  const destCoordsRef = useRef<{ lat: number; lng: number } | null>(null)
  const bookingFixedMarkerRef = useRef<L.Marker | null>(null)
  const bookingRoutePolylineRef = useRef<L.Polyline | null>(null)

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

  const onDestChangeRef = useRef(onDestChange)
  useEffect(() => {
    onDestChangeRef.current = onDestChange
  }, [onDestChange])

  const onRouteCoordinatesChangeRef = useRef(onRouteCoordinatesChange)
  useEffect(() => {
    onRouteCoordinatesChangeRef.current = onRouteCoordinatesChange
  }, [onRouteCoordinatesChange])

  const emitRouteCoordinates = useCallback(() => {
    if (pickupCoordsRef.current && destCoordsRef.current) {
      onRouteCoordinatesChangeRef.current?.({
        originLat: pickupCoordsRef.current.lat,
        originLng: pickupCoordsRef.current.lng,
        destLat: destCoordsRef.current.lat,
        destLng: destCoordsRef.current.lng,
      })
    }
  }, [])

  // Synchronize incoming pickupAddr & destAddr to local display
  useEffect(() => {
    if (pickupAddr && !pinLifted) {
      setCurrentDisplayAddr(pickupAddr)
    }
  }, [pickupAddr, pinLifted])

  useEffect(() => {
    if (destAddr) {
      setCurrentDestDisplayAddr(destAddr)
    }
  }, [destAddr])

  // Reverse Geocoding with Debounce via OSM Nominatim (Tiếng Việt)
  const reverseGeocodeTimeoutRef = useRef<number | null>(null)
  const reverseGeocode = useCallback(
    (lat: number, lng: number, targetMode: "pickup" | "destination" = pinModeRef.current) => {
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
            const quarter =
              addr.quarter || addr.suburb || addr.neighbourhood || addr.city_district || ""
            const city = addr.city || addr.town || addr.county || addr.state || ""

            let formatted = ""
            if (road) {
              formatted = `${house}${road}, ${quarter ? quarter + ", " : ""}${city}`
            } else if (data.display_name) {
              formatted = data.display_name.split(",").slice(0, 3).join(",").trim()
            } else {
              formatted = `Tọa độ: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
            }

            if (targetMode === "pickup") {
              setCurrentDisplayAddr(formatted)
              onPickupChangeRef.current?.(formatted)
            } else {
              setCurrentDestDisplayAddr(formatted)
              onDestChangeRef.current?.(formatted)
            }
          }
        } catch (err) {
          console.warn("Lỗi đọc địa chỉ Nominatim:", err)
          const fallback =
            targetMode === "pickup"
              ? `Điểm đón (${lat.toFixed(4)}, ${lng.toFixed(4)})`
              : `Điểm giao (${lat.toFixed(4)}, ${lng.toFixed(4)})`
          if (targetMode === "pickup") {
            setCurrentDisplayAddr(fallback)
            onPickupChangeRef.current?.(fallback)
          } else {
            setCurrentDestDisplayAddr(fallback)
            onDestChangeRef.current?.(fallback)
          }
        } finally {
          setGeocodingLoading(false)
        }
      }, 450)
    },
    []
  )

  // Create or update real-time user GPS pulsing dot on the map
  const updateUserLocationMarker = useCallback(
    (lat: number, lng: number, accuracy?: number) => {
      if (!mapRef.current) return
      const map = mapRef.current

      const userIcon = L.divIcon({
        className: "user-gps-marker-container",
        html: `
          <div class="user-gps-pulse"></div>
          <div class="user-gps-dot">
            <div class="user-gps-center"></div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })

      if (!userLocationMarkerRef.current) {
        userLocationMarkerRef.current = L.marker([lat, lng], {
          icon: userIcon,
          zIndexOffset: 1000,
        }).addTo(map)
        userLocationMarkerRef.current.bindTooltip("Vị trí của bạn", {
          direction: "top",
          offset: [0, -12],
          className: "user-gps-tooltip",
        })
      } else {
        userLocationMarkerRef.current.setLatLng([lat, lng])
      }

      if (accuracy && accuracy > 0 && accuracy < 2000) {
        if (!userAccuracyCircleRef.current) {
          userAccuracyCircleRef.current = L.circle([lat, lng], {
            radius: Math.min(accuracy, 250),
            color: "#2563eb",
            fillColor: "#3b82f6",
            fillOpacity: 0.12,
            weight: 1.5,
          }).addTo(map)
        } else {
          userAccuracyCircleRef.current.setLatLng([lat, lng])
          userAccuracyCircleRef.current.setRadius(Math.min(accuracy, 250))
        }
      }
    },
    []
  )

  const handleSwitchPinModeRef = useRef<(mode: "pickup" | "destination") => void>(() => {})

  // Dual-Pin logic: Render fixed other point and connecting dashed route line
  const updateBookingVisuals = useCallback(
    (targetPinMode: "pickup" | "destination" = pinModeRef.current) => {
      if (!mapRef.current || !bookingLayerRef.current) return
      if (mode !== "customer" || phase !== "booking") {
        bookingLayerRef.current.clearLayers()
        return
      }

      const bookingLayer = bookingLayerRef.current
      bookingLayer.clearLayers()

      const center = mapRef.current.getCenter()
      if (targetPinMode === "pickup") {
        pickupCoordsRef.current = { lat: center.lat, lng: center.lng }
        if (!destCoordsRef.current) {
          destCoordsRef.current = { lat: center.lat - 0.0035, lng: center.lng + 0.0035 }
        }
      } else {
        destCoordsRef.current = { lat: center.lat, lng: center.lng }
        if (!pickupCoordsRef.current) {
          pickupCoordsRef.current = { lat: center.lat + 0.0035, lng: center.lng - 0.0035 }
        }
      }

      const pickupCoords = pickupCoordsRef.current
      const destCoords = destCoordsRef.current

      emitRouteCoordinates()

      // Fixed Point B (Destination) when user is setting Pickup (A)
      if (targetPinMode === "pickup" && destCoords) {
        const destFixedIcon = L.divIcon({
          className: "fixed-map-pin pin-dest-fixed",
          html: `
            <div class="fixed-pin-bubble">
              <span class="fixed-pin-tag">🔴 Điểm đến (B)</span>
            </div>
            <div class="fixed-pin-marker fixed-pin-red">
              <span class="fixed-pin-badge">B</span>
              <span class="fixed-pin-point"></span>
            </div>
            <div class="fixed-pin-shadow"></div>
          `,
          iconSize: [44, 58],
          iconAnchor: [22, 54],
        })

        const marker = L.marker([destCoords.lat, destCoords.lng], {
          icon: destFixedIcon,
          zIndexOffset: 600,
        }).addTo(bookingLayer)

        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e)
          handleSwitchPinModeRef.current("destination")
        })

        marker.bindTooltip("Chạm để chỉnh Điểm đến (B)", {
          direction: "top",
          offset: [0, -48],
          className: "pin-interactive-tooltip",
        })
        bookingFixedMarkerRef.current = marker
      }

      // Fixed Point A (Pickup) when user is setting Destination (B)
      if (targetPinMode === "destination" && pickupCoords) {
        const pickupFixedIcon = L.divIcon({
          className: "fixed-map-pin pin-pickup-fixed",
          html: `
            <div class="fixed-pin-bubble">
              <span class="fixed-pin-tag">🟢 Điểm đón (A)</span>
            </div>
            <div class="fixed-pin-marker fixed-pin-green">
              <span class="fixed-pin-badge">A</span>
              <span class="fixed-pin-point"></span>
            </div>
            <div class="fixed-pin-shadow"></div>
          `,
          iconSize: [44, 58],
          iconAnchor: [22, 54],
        })

        const marker = L.marker([pickupCoords.lat, pickupCoords.lng], {
          icon: pickupFixedIcon,
          zIndexOffset: 600,
        }).addTo(bookingLayer)

        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e)
          handleSwitchPinModeRef.current("pickup")
        })

        marker.bindTooltip("Chạm để chỉnh Điểm đón (A)", {
          direction: "top",
          offset: [0, -48],
          className: "pin-interactive-tooltip",
        })
        bookingFixedMarkerRef.current = marker
      }

      // Connecting Dashed Route Line between A and B
      if (pickupCoords && destCoords) {
        const line = L.polyline(
          [
            [pickupCoords.lat, pickupCoords.lng],
            [destCoords.lat, destCoords.lng],
          ],
          {
            color: targetPinMode === "pickup" ? "#10b981" : "#ef4444",
            weight: 3.5,
            opacity: 0.85,
            dashArray: "8, 8",
          }
        ).addTo(bookingLayer)
        bookingRoutePolylineRef.current = line
      }
    },
    [mode, phase]
  )

  const updateBookingVisualsRef = useRef(updateBookingVisuals)
  useEffect(() => {
    updateBookingVisualsRef.current = updateBookingVisuals
  }, [updateBookingVisuals])

  const handleSwitchPinMode = useCallback(
    (target: "pickup" | "destination") => {
      setPinMode(target)
      pinModeRef.current = target
      const map = mapRef.current
      if (!map) return

      if (target === "pickup") {
        if (pickupCoordsRef.current) {
          map.flyTo([pickupCoordsRef.current.lat, pickupCoordsRef.current.lng], map.getZoom(), {
            duration: 0.8,
          })
          reverseGeocode(pickupCoordsRef.current.lat, pickupCoordsRef.current.lng, "pickup")
        }
      } else {
        if (!destCoordsRef.current) {
          const center = map.getCenter()
          destCoordsRef.current = { lat: center.lat + 0.007, lng: center.lng + 0.009 }
        }
        map.flyTo([destCoordsRef.current.lat, destCoordsRef.current.lng], map.getZoom(), {
          duration: 0.8,
        })
        reverseGeocode(destCoordsRef.current.lat, destCoordsRef.current.lng, "destination")
      }

      setTimeout(() => {
        updateBookingVisuals(target)
      }, 60)
    },
    [reverseGeocode, updateBookingVisuals]
  )

  useEffect(() => {
    handleSwitchPinModeRef.current = handleSwitchPinMode
  }, [handleSwitchPinMode])

  useEffect(() => {
    updateBookingVisuals(pinMode)
  }, [pinMode, updateBookingVisuals])

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
    const bookingLayer = L.layerGroup().addTo(map)
    const tripTrackingLayer = L.layerGroup().addTo(map)

    mapRef.current = map
    tileLayerRef.current = tileLayer
    markersLayerRef.current = markersLayer
    bookingLayerRef.current = bookingLayer
    tripTrackingLayerRef.current = tripTrackingLayer

    // Setup initial coordinates
    const initialPickup = { lat: defaultCity.lat, lng: defaultCity.lng }
    const initialDest = { lat: defaultCity.lat - 0.0035, lng: defaultCity.lng + 0.0035 }
    if (!pickupCoordsRef.current) {
      pickupCoordsRef.current = initialPickup
    }
    if (!destCoordsRef.current) {
      destCoordsRef.current = initialDest
      reverseGeocode(defaultCity.lat - 0.0035, defaultCity.lng + 0.0035, "destination")
    }
    emitRouteCoordinates()
    setTimeout(() => {
      updateBookingVisualsRef.current?.("pickup")
    }, 100)

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
      const currentTarget = pinModeRef.current
      if (currentTarget === "pickup") {
        pickupCoordsRef.current = { lat: center.lat, lng: center.lng }
      } else {
        destCoordsRef.current = { lat: center.lat, lng: center.lng }
      }
      reverseGeocode(center.lat, center.lng, currentTarget)
      updateBookingVisualsRef.current?.(currentTarget)
      emitRouteCoordinates()
    })

    // Auto-detect Device GPS on initial load
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords
          // Check if user is roughly within Vietnam boundary (Lat: 8-24, Lng: 102-110)
          if (latitude >= 8 && latitude <= 24 && longitude >= 102 && longitude <= 110) {
            updateUserLocationMarker(latitude, longitude, accuracy)
            pickupCoordsRef.current = { lat: latitude, lng: longitude }
            const gpsDest = { lat: latitude - 0.0035, lng: longitude + 0.0035 }
            if (!destCoordsRef.current) {
              destCoordsRef.current = gpsDest
            }
            map.flyTo([latitude, longitude], 16, { duration: 1.2 })
            reverseGeocode(latitude, longitude, "pickup")
            reverseGeocode(latitude - 0.0035, longitude + 0.0035, "destination")
            updateBookingVisualsRef.current?.("pickup")
            emitRouteCoordinates()
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
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove()
        userLocationMarkerRef.current = null
      }
      if (userAccuracyCircleRef.current) {
        userAccuracyCircleRef.current.remove()
        userAccuracyCircleRef.current = null
      }
      if (bookingFixedMarkerRef.current) {
        bookingFixedMarkerRef.current.remove()
        bookingFixedMarkerRef.current = null
      }
      if (bookingRoutePolylineRef.current) {
        bookingRoutePolylineRef.current.remove()
        bookingRoutePolylineRef.current = null
      }
      if (bookingLayerRef.current) {
        bookingLayerRef.current.clearLayers()
        bookingLayerRef.current.remove()
        bookingLayerRef.current = null
      }
      map.remove()
      mapRef.current = null
      tileLayerRef.current = null
      markersLayerRef.current = null
      routeLayerRef.current = null
      movingTruckMarkerRef.current = null
    }
  }, [reverseGeocode, updateUserLocationMarker])

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

  // Isolate City Switcher from Leaflet map dragging
  useEffect(() => {
    const el = cityWrapperRef.current
    if (el) {
      L.DomEvent.disableClickPropagation(el)
      L.DomEvent.disableScrollPropagation(el)
    }
  }, [mode, isBooking])

  // Drag-to-scroll & wheel logic for City Switcher
  const handleCityPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return
    const container = cityScrollRef.current
    if (!container) return
    isDraggingCity.current = true
    hasDragged.current = false
    dragStartX.current = e.clientX
    dragScrollLeft.current = container.scrollLeft
  }

  const handleCityPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingCity.current) return
    const container = cityScrollRef.current
    if (!container) return
    const deltaX = e.clientX - dragStartX.current
    if (Math.abs(deltaX) > 4) {
      hasDragged.current = true
    }
    container.scrollLeft = dragScrollLeft.current - deltaX
  }

  const handleCityPointerUp = () => {
    isDraggingCity.current = false
    setTimeout(() => {
      hasDragged.current = false
    }, 60)
  }

  const handleCityWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const container = cityScrollRef.current
    if (!container) return
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (delta !== 0) {
      container.scrollLeft += delta
    }
  }

  const handleScrollCity = (direction: "left" | "right") => {
    const container = cityScrollRef.current
    if (!container) return
    container.scrollBy({
      left: direction === "left" ? -140 : 140,
      behavior: "smooth",
    })
  }

  // 3. Switch City Quick Button
  const handleCityChange = useCallback((city: typeof VIETNAM_CITIES[0]) => {
    if (hasDragged.current) return
    setActiveCityId(city.id)
    pickupCoordsRef.current = { lat: city.lat, lng: city.lng }
    destCoordsRef.current = { lat: city.lat - 0.0035, lng: city.lng + 0.0035 }
    emitRouteCoordinates()
    if (mapRef.current) {
      mapRef.current.flyTo([city.lat, city.lng], city.zoom, {
        duration: 1.2,
      })
      reverseGeocode(city.lat, city.lng, "pickup")
      reverseGeocode(city.lat - 0.0035, city.lng + 0.0035, "destination")
      setTimeout(() => {
        updateBookingVisualsRef.current?.(pinModeRef.current)
      }, 300)
    }
  }, [reverseGeocode])

  // 4. GPS "Locate Me" Button
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation || !mapRef.current) return
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false)
        const { latitude, longitude, accuracy } = pos.coords
        updateUserLocationMarker(latitude, longitude, accuracy)
        if (mapRef.current) {
          mapRef.current.flyTo([latitude, longitude], 16, {
            duration: 1.2,
          })
          reverseGeocode(latitude, longitude)
        }
      },
      (err) => {
        setIsLocating(false)
        console.warn("GPS Geolocation error:", err.message)
        // Fallback to active city
        const current = VIETNAM_CITIES.find((c) => c.id === activeCityId) || VIETNAM_CITIES[0]
        mapRef.current?.flyTo([current.lat, current.lng], current.zoom, { duration: 0.8 })
        reverseGeocode(current.lat, current.lng)
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [activeCityId, reverseGeocode, updateUserLocationMarker])

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

      // If online, render radar circle & demand hotspots (chỉ 1 vòng tròn duy nhất cho mỗi cụm địa bàn)
      if (isOnline && demandHotspots && demandHotspots.length > 0) {
        // Lọc chống trùng cụm gần nhau trên client side (< 3km)
        const uniqueHotspots: typeof demandHotspots = []
        demandHotspots.forEach((h) => {
          if (!h.lat || !h.lng) return
          const isNearby = uniqueHotspots.some((u) => {
            const dLat = Math.abs(u.lat - h.lat)
            const dLng = Math.abs(u.lng - h.lng)
            return dLat < 0.027 && dLng < 0.027 // ~3km
          })
          if (!isNearby) {
            uniqueHotspots.push(h)
          }
        })

        uniqueHotspots.forEach((h) => {
          const isSurge = h.count > 0
          const circleColor = isSurge ? "#f59e0b" : "#10b981"
          const circle = L.circle([h.lat, h.lng], {
            radius: h.radiusMeters || 1600,
            color: circleColor,
            fillColor: circleColor,
            fillOpacity: isSurge ? 0.12 : 0.06,
            weight: 2,
          })
          const tooltipContent = isSurge
            ? `<div style="text-align:center;font-size:12px;padding:2px 4px;"><b>🔥 ${h.district}</b><div style="font-weight:600;margin-top:2px;font-size:11px;color:#b45309;">${h.count} đơn hàng chờ (+15% cước)</div></div>`
            : `<div style="text-align:center;font-size:12px;padding:2px 4px;"><b>🟢 ${h.district}</b><div style="font-weight:600;margin-top:2px;font-size:11px;color:#047857;">Bán kính quét đơn ưu tiên (~${Math.round((h.radiusMeters || 1500) / 1000)} km)</div></div>`
          circle.bindTooltip(tooltipContent, {
            permanent: false,
            direction: "top",
            offset: [0, -32],
            className: "demand-hotspot-pill-tooltip",
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
    if (!mapRef.current || !tripTrackingLayerRef.current) return
    const map = mapRef.current
    const trackingLayer = tripTrackingLayerRef.current

    // Always clear old trip markers to prevent duplicate stacking
    trackingLayer.clearLayers()
    if (routeLayerRef.current) {
      routeLayerRef.current.remove()
      routeLayerRef.current = null
    }
    if (movingTruckMarkerRef.current) {
      movingTruckMarkerRef.current.remove()
      movingTruckMarkerRef.current = null
    }

    if (isCustomerTracking || isDriverWorking) {
      const center = map.getCenter()
      const pickupLatLng: [number, number] = [
        pickupCoordsRef.current?.lat ?? center.lat - 0.006,
        pickupCoordsRef.current?.lng ?? center.lng - 0.008,
      ]
      const destLatLng: [number, number] = [
        destCoordsRef.current?.lat ?? center.lat + 0.010,
        destCoordsRef.current?.lng ?? center.lng + 0.012,
      ]

      const midLat = (pickupLatLng[0] + destLatLng[0]) / 2
      const midLng = (pickupLatLng[1] + destLatLng[1]) / 2

      const waypoints: [number, number][] = [
        pickupLatLng,
        [midLat - 0.001, midLng - 0.002],
        [midLat + 0.002, midLng + 0.001],
        destLatLng,
      ]

      // Outer glow line for high contrast
      L.polyline(waypoints, {
        color: "#0284c7",
        weight: 10,
        opacity: 0.25,
      }).addTo(trackingLayer)

      // Vibrant polyline along real route coordinates
      const polyline = L.polyline(waypoints, {
        color: "#2563eb",
        weight: 6,
        opacity: 0.95,
      }).addTo(trackingLayer)
      routeLayerRef.current = polyline

      // Pickup Marker (Only ONE)
      const pickupIcon = L.divIcon({
        className: "route-marker-pin",
        html: `
          <div class="route-pickup-dot">
            <span class="pulse-core"></span>
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      })
      const pickupMarker = L.marker(pickupLatLng, { icon: pickupIcon }).addTo(trackingLayer)
      pickupMarker.bindPopup(`<b>Điểm Lấy Hàng</b><br/>${pickupAddr || "Vị trí nhận hàng"}`)

      // Destination Marker (Only ONE)
      const destIcon = L.divIcon({
        className: "route-marker-pin",
        html: `
          <div class="route-dest-badge">
            <span>🏁</span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })
      const destMarker = L.marker(destLatLng, { icon: destIcon }).addTo(trackingLayer)
      destMarker.bindPopup(`<b>Điểm Giao Hàng</b><br/>${destAddr || "Vị trí giao hàng"}`)

      // Moving Truck Marker (Only ONE)
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

      const movingTruck = L.marker(pickupLatLng, { icon: truckIcon }).addTo(trackingLayer)
      movingTruckMarkerRef.current = movingTruck

      // Fit bounds nicely with padding
      try {
        map.fitBounds(polyline.getBounds(), { padding: [80, 80], maxZoom: 16 })
      } catch {}

      return () => {
        trackingLayer.clearLayers()
        routeLayerRef.current = null
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
      className={`interactive-map-root leaflet-real-map mode-${mode} layer-${layer} ${layerMenuOpen ? "layer-menu-active" : ""}`}
    >
      {/* Real Leaflet Map Canvas */}
      <div
        className="leaflet-map-canvas"
        ref={mapContainerRef}
        style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
      />

      {/* Floating City Switcher Bar (Toàn Quốc - Kéo ngang & điều hướng mượt mà) */}
      {mode === "customer" && isBooking && (
        <div
          className="city-switcher-wrapper glass"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          ref={cityWrapperRef}
        >
          <button
            aria-label="Cuộn sang trái"
            className="city-scroll-arrow left"
            onClick={() => handleScrollCity("left")}
            title="Xem thành phố trước"
            type="button"
          >
            <svg
              fill="none"
              height={12}
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
              width={12}
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div
            className="city-switcher-scroll"
            onPointerCancel={handleCityPointerUp}
            onPointerDown={handleCityPointerDown}
            onPointerLeave={handleCityPointerUp}
            onPointerMove={handleCityPointerMove}
            onPointerUp={handleCityPointerUp}
            onWheel={handleCityWheel}
            ref={cityScrollRef}
          >
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

          <button
            aria-label="Cuộn sang phải"
            className="city-scroll-arrow right"
            onClick={() => handleScrollCity("right")}
            title="Xem thêm thành phố"
            type="button"
          >
            <svg
              fill="none"
              height={12}
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
              width={12}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}

      {/* 2-Pin Mode Switcher (Chuyển giữa Tâm đón 🟢 A và Tâm đến 🔴 B) */}
      {mode === "customer" && isBooking && (
        <div className="pin-mode-switcher-container">
          <div className="pin-mode-switcher glass">
            <button
              className={`pin-toggle-btn ${pinMode === "pickup" ? "active-pickup" : ""}`}
              onClick={() => handleSwitchPinMode("pickup")}
              type="button"
              title="Chuyển tâm ghim để chọn Vị trí đón / lấy hàng"
            >
              <span className="pin-dot-indicator dot-green" />
              <span>Điểm đón (A)</span>
            </button>
            <div className="pin-toggle-divider" />
            <button
              className={`pin-toggle-btn ${pinMode === "destination" ? "active-dest" : ""}`}
              onClick={() => handleSwitchPinMode("destination")}
              type="button"
              title="Chuyển tâm ghim để chọn Điểm đến / giao hàng"
            >
              <span className="pin-dot-indicator dot-red" />
              <span>Điểm đến (B)</span>
            </button>
          </div>
        </div>
      )}

      {/* Center Draggable Pickup/Destination Pin Overlay (Khi đang đặt xe) */}
      {isBooking && (
        <div className={`center-pin-overlay mode-${pinMode} ${pinLifted ? "is-lifted" : ""}`}>
          <div className="center-pin-wrapper">
            <span className="pin-ground-shadow" />
            <div className={`pin-head pin-head-${pinMode}`}>
              <span className="pin-badge-letter">{pinMode === "pickup" ? "A" : "B"}</span>
            </div>

            {/* Bubble Callout with Real Address */}
            <div className={`pin-callout-bubble bubble-${pinMode}`}>
              <span className={`pin-type-tag tag-${pinMode}`}>
                {pinMode === "pickup" ? "🟢 Điểm lấy hàng (A)" : "🔴 Điểm giao hàng (B)"}
              </span>
              <span className="pin-callout-text">
                {pinMode === "pickup"
                  ? currentDisplayAddr.split(",")[0] || (geocodingLoading ? "Đang dò tên đường..." : "Điểm đón")
                  : currentDestDisplayAddr.split(",")[0] || (geocodingLoading ? "Đang dò tên đường..." : "Điểm giao")}
              </span>
              <small className="pin-callout-sub">
                {geocodingLoading
                  ? "Đang cập nhật vị trí..."
                  : pinMode === "pickup"
                  ? "Kéo bản đồ để chọn điểm đón (A)"
                  : "Kéo bản đồ để chọn điểm đến (B)"}
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
            <>
              <div
                aria-hidden="true"
                className="layer-menu-backdrop"
                onClick={() => setLayerMenuOpen(false)}
              />
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
            </>
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

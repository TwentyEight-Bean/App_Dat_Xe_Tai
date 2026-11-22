import { useEffect, useRef, useState, useCallback, type ReactNode } from "react"

import L from "leaflet"

import { subscribeRealtime } from "./lib/pusherClient"

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

  manualCoords?: {
    kind: "pickup" | "destination"
    lat: number
    lng: number
    address?: string
  } | null

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

  bookingId?: string

  onNearbyCountChange?: (count: number) => void

  children?: ReactNode
}

// 6 Thành Phố Trọng Điểm Toàn Quốc

export const VIETNAM_CITIES = [
  {
    id: "hcm",
    name: "TP. Hồ Chí Minh",
    shortName: "TP.HCM",
    lat: 10.7769,
    lng: 106.7009,
    zoom: 15,
  },

  {
    id: "hn",
    name: "Hà Nội",
    shortName: "Hà Nội",
    lat: 21.0285,
    lng: 105.8542,
    zoom: 15,
  },

  {
    id: "dn",
    name: "Đà Nẵng",
    shortName: "Đà Nẵng",
    lat: 16.0544,
    lng: 108.2022,
    zoom: 15,
  },

  {
    id: "ct",
    name: "Cần Thơ",
    shortName: "Cần Thơ",
    lat: 10.0452,
    lng: 105.7469,
    zoom: 15,
  },

  {
    id: "hp",
    name: "Hải Phòng",
    shortName: "Hải Phòng",
    lat: 20.8449,
    lng: 106.6881,
    zoom: 15,
  },

  {
    id: "bd",
    name: "Bình Dương",
    shortName: "Bình Dương",
    lat: 10.9804,
    lng: 106.6745,
    zoom: 14,
  },
]

// 3 Lớp Bản Đồ Thật (0 VNĐ, Không Cần API Key)

const TILE_SERVERS: Record<MapLayer, {
  url: string
  maxZoom: number
  subdomains?: string
}> = {
  standard: {
    // Google Maps tiêu chuẩn (hiển thị đầy đủ tên đường tiếng Việt, không watermark)
    url: "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=vi",
    maxZoom: 20,
    subdomains: "0123",
  },

  traffic: {
    // Chế độ ban đêm bằng bộ lọc màu thông minh (Dark Mode) + lớp giao thông
    url: "https://mt{s}.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}&hl=vi",
    maxZoom: 20,
    subdomains: "0123",
  },

  satellite: {
    // Ảnh vệ tinh toàn cầu Esri World Imagery (độ phân giải cao, 0 VNĐ)

    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",

    maxZoom: 18,
  },
}

export interface RoadRouteResult {
  coordinates: [number, number][]
  distanceMeters: number
  durationSeconds: number
}

// Bộ nhớ đệm lộ trình đường sá thực tế (bám sát lòng đường như Google Maps)
const roadRouteCache = new Map<string, RoadRouteResult>()

export async function fetchRoadRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  signal?: AbortSignal
): Promise<RoadRouteResult | null> {
  const key = `${startLat.toFixed(4)},${startLng.toFixed(4)}_${endLat.toFixed(4)},${endLng.toFixed(4)}`
  if (roadRouteCache.has(key)) {
    return roadRouteCache.get(key)!
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const data = await res.json()
    if (data.code === "Ok" && data.routes?.[0]?.geometry?.coordinates) {
      const coords: [number, number][] = data.routes[0].geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]]
      )
      const result: RoadRouteResult = {
        coordinates: coords,
        distanceMeters: data.routes[0].distance || 0,
        durationSeconds: data.routes[0].duration || 0,
      }
      roadRouteCache.set(key, result)
      return result
    }
  } catch {
    // Không làm gián đoạn UI khi hủy fetch hoặc mạng chậm
  }
  return null
}

export default function InteractiveMap({
  loadNearby = true,

  mode = "customer",

  phase = "booking",

  pickupAddr,

  destAddr,

  manualCoords,

  onPickupChange,

  onDestChange,

  onRouteCoordinatesChange,

  online = true,

  jobState = "none",

  demandHotspots,

  driverName,

  driverPlate,

  bookingId,

  onNearbyCountChange,

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

  const [gpsToast, setGpsToast] = useState<{
    message: string

    type: "info" | "success" | "error"
  } | null>(null)

  const [showPermissionGuide, setShowPermissionGuide] = useState(false)

  const gpsToastTimerRef = useRef<number | null>(null)

  const showGpsNotification = useCallback(
    (
      message: string,
      type: "info" | "success" | "error" = "info",
      duration = 3500,
    ) => {
      if (gpsToastTimerRef.current)
        window.clearTimeout(gpsToastTimerRef.current)

      setGpsToast({ message, type })

      gpsToastTimerRef.current = window.setTimeout(() => {
        setGpsToast(null)
      }, duration)
    },

    [],
  )

  useEffect(() => {
    return () => {
      if (gpsToastTimerRef.current)
        window.clearTimeout(gpsToastTimerRef.current)
    }
  }, [])

  const [currentDisplayAddr, setCurrentDisplayAddr] = useState<string>(
    pickupAddr || "Đang lấy địa chỉ...",
  )

  const [currentDestDisplayAddr, setCurrentDestDisplayAddr] = useState<string>(
    destAddr || "Chọn điểm giao trên bản đồ",
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
  const bookingRouteCasingRef = useRef<L.Polyline | null>(null)
  const bookingEtaBadgeRef = useRef<L.Marker | null>(null)
  const routeFetchAbortRef = useRef<AbortController | null>(null)
  const routeFetchTimeoutRef = useRef<number | null>(null)

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

  const isBooking =
    mode === "customer" && phase === "booking" && jobState === "none"

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
    (
      lat: number,
      lng: number,
      targetMode: "pickup" | "destination" = pinModeRef.current,
    ) => {
      if (reverseGeocodeTimeoutRef.current) {
        window.clearTimeout(reverseGeocodeTimeoutRef.current)
      }

      setGeocodingLoading(true)

      reverseGeocodeTimeoutRef.current = window.setTimeout(async () => {
        try {
          let formatted = ""

          // 1. Thử Photon Geocoder (cực nhanh, hỗ trợ đầy đủ tiếng Việt không lỗi DNS)
          try {
            const photonRes = await fetch(
              `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`
            )
            if (photonRes.ok) {
              const photonData = await photonRes.json()
              const props = photonData?.features?.[0]?.properties
              if (props) {
                const street = props.street || ""
                const house = props.housenumber ? `${props.housenumber} ` : ""
                const place = props.name && props.name !== street ? `${props.name}, ` : ""
                const district = props.district || props.locality || ""
                const city = props.city || ""
                if (street) {
                  formatted = `${place}${house}${street}${district ? ", " + district : ""}${city ? ", " + city : ""}`
                } else if (props.name) {
                  formatted = `${props.name}${district ? ", " + district : ""}${city ? ", " + city : ""}`
                }
              }
            }
          } catch {}

          // 2. Dự phòng Nominatim nếu có kết nối
          if (!formatted) {
            try {
              const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=vi`,
                { headers: { "Accept-Language": "vi,en" } }
              )
              if (res.ok) {
                const data = await res.json()
                if (data && data.address) {
                  const addr = data.address
                  const house = addr.house_number ? `${addr.house_number} ` : ""
                  const road = addr.road || addr.street || addr.pedestrian || ""
                  const quarter = addr.quarter || addr.suburb || addr.neighbourhood || addr.city_district || ""
                  const city = addr.city || addr.town || addr.county || addr.state || ""
                  if (road) {
                    formatted = `${house}${road}, ${quarter ? quarter + ", " : ""}${city}`
                  } else if (data.display_name) {
                    formatted = data.display_name.split(",").slice(0, 3).join(",").trim()
                  }
                }
              }
            } catch {}
          }

          if (!formatted) {
            formatted =
              targetMode === "pickup"
                ? `Điểm đón (${lat.toFixed(4)}, ${lng.toFixed(4)})`
                : `Điểm giao (${lat.toFixed(4)}, ${lng.toFixed(4)})`
          }

          if (targetMode === "pickup") {
            setCurrentDisplayAddr(formatted)
            onPickupChangeRef.current?.(formatted)
          } else {
            setCurrentDestDisplayAddr(formatted)
            onDestChangeRef.current?.(formatted)
          }
        } catch (err) {
          console.warn("Lỗi đọc địa chỉ:", err)
        } finally {
          setGeocodingLoading(false)
        }
      }, 400)
    },

    [],
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

    [],
  )

  const handleSwitchPinModeRef = useRef<(
    mode: "pickup" | "destination",
  ) => void>(() => {})

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
          destCoordsRef.current = {
            lat: center.lat - 0.0035,
            lng: center.lng + 0.0035,
          }
        }
      } else {
        destCoordsRef.current = { lat: center.lat, lng: center.lng }

        if (!pickupCoordsRef.current) {
          pickupCoordsRef.current = {
            lat: center.lat + 0.0035,
            lng: center.lng - 0.0035,
          }
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

      // Helper vẽ tuyến đường bám sát lòng đường giao thông chuẩn Google Maps
      const renderRoadRoute = (
        rawCoords: [number, number][],
        durationSec: number,
        distMeters: number,
        layer: L.LayerGroup,
        startPt?: { lat: number; lng: number } | null,
        endPt?: { lat: number; lng: number } | null
      ) => {
        if (bookingRouteCasingRef.current) {
          bookingRouteCasingRef.current.remove()
          bookingRouteCasingRef.current = null
        }
        if (bookingRoutePolylineRef.current) {
          bookingRoutePolylineRef.current.remove()
          bookingRoutePolylineRef.current = null
        }
        if (bookingEtaBadgeRef.current) {
          bookingEtaBadgeRef.current.remove()
          bookingEtaBadgeRef.current = null
        }

        const coords: [number, number][] = [...rawCoords]
        if (startPt && coords.length > 0) {
          coords.unshift([startPt.lat, startPt.lng])
        }
        if (endPt && coords.length > 0) {
          coords.push([endPt.lat, endPt.lng])
        }

        // 1. Lớp viền phát sáng làm nổi bật đường đi
        const casing = L.polyline(coords, {
          color: "#1e3a8a",
          weight: 8.5,
          opacity: 0.28,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(layer)
        bookingRouteCasingRef.current = casing

        // 2. Lộ trình uốn lượn chính màu xanh dương đậm nét (như Google Maps hình 2)
        const line = L.polyline(coords, {
          color: "#2563eb",
          weight: 5.5,
          opacity: 0.96,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(layer)
        bookingRoutePolylineRef.current = line

        // 3. Nút thời gian & khoảng cách nổi giữa cung đường (như nút '3 min' trong hình 2)
        if (coords.length > 0 && durationSec > 0) {
          const midIdx = Math.floor(coords.length / 2)
          const midPoint = coords[midIdx]
          const mins = Math.max(1, Math.round(durationSec / 60))
          const km = (distMeters / 1000).toFixed(1)

          const etaIcon = L.divIcon({
            className: "route-eta-badge",
            html: `
              <div class="route-eta-pill">
                <span class="route-eta-time">${mins} min</span>
                <span class="route-eta-dot">•</span>
                <span class="route-eta-dist">${km} km</span>
              </div>
            `,
            iconSize: [84, 26],
            iconAnchor: [42, 13],
          })
          const etaMarker = L.marker(midPoint, {
            icon: etaIcon,
            zIndexOffset: 700,
            interactive: false,
          }).addTo(layer)
          bookingEtaBadgeRef.current = etaMarker
        }
      }

      // Connecting Real Road Route between A and B
      if (pickupCoords && destCoords) {
        // Nếu 2 điểm đón và giao trùng nhau, dọn sạch polyline và badge lộ trình
        if (
          Math.abs(pickupCoords.lat - destCoords.lat) < 0.0001 &&
          Math.abs(pickupCoords.lng - destCoords.lng) < 0.0001
        ) {
          if (bookingRouteCasingRef.current) {
            bookingRouteCasingRef.current.remove()
            bookingRouteCasingRef.current = null
          }
          if (bookingRoutePolylineRef.current) {
            bookingRoutePolylineRef.current.remove()
            bookingRoutePolylineRef.current = null
          }
          if (bookingEtaBadgeRef.current) {
            bookingEtaBadgeRef.current.remove()
            bookingEtaBadgeRef.current = null
          }
          return
        }

        const cacheKey = `${pickupCoords.lat.toFixed(4)},${pickupCoords.lng.toFixed(4)}_${destCoords.lat.toFixed(4)},${destCoords.lng.toFixed(4)}`
        const cached = roadRouteCache.get(cacheKey)

        if (cached) {
          renderRoadRoute(cached.coordinates, cached.durationSeconds, cached.distanceMeters, bookingLayer, pickupCoords, destCoords)
        } else {
          // Bỏ hoàn toàn đường chim bay - Chỉ vẽ lộ trình giao thông thực tế từ OSRM
          if (routeFetchTimeoutRef.current) {
            window.clearTimeout(routeFetchTimeoutRef.current)
          }
          if (routeFetchAbortRef.current) {
            routeFetchAbortRef.current.abort()
          }

          const curPLat = pickupCoords.lat
          const curPLng = pickupCoords.lng
          const curDLat = destCoords.lat
          const curDLng = destCoords.lng

          routeFetchTimeoutRef.current = window.setTimeout(() => {
            const controller = new AbortController()
            routeFetchAbortRef.current = controller
            fetchRoadRoute(curPLat, curPLng, curDLat, curDLng, controller.signal).then((res) => {
              if (!res || !mapRef.current || !bookingLayerRef.current) return
              const p = pickupCoordsRef.current
              const d = destCoordsRef.current
              if (!p || !d) return
              if (
                Math.abs(p.lat - curPLat) > 0.0001 ||
                Math.abs(p.lng - curPLng) > 0.0001 ||
                Math.abs(d.lat - curDLat) > 0.0001 ||
                Math.abs(d.lng - curDLng) > 0.0001
              ) {
                return
              }
              renderRoadRoute(res.coordinates, res.durationSeconds, res.distanceMeters, bookingLayerRef.current, p, d)
            })
          }, 120)
        }
      }
    },

    [mode, phase],
  )

  const updateBookingVisualsRef = useRef(updateBookingVisuals)

  useEffect(() => {
    updateBookingVisualsRef.current = updateBookingVisuals
  }, [updateBookingVisuals])

  // Đồng bộ tức thì khi 2 địa chỉ điểm lấy và điểm giao trùng khớp (như người dùng copy từ A sang B)
  useEffect(() => {
    if (
      pickupAddr &&
      destAddr &&
      pickupAddr.trim() !== "" &&
      pickupAddr.trim().toLowerCase() === destAddr.trim().toLowerCase()
    ) {
      if (pickupCoordsRef.current) {
        destCoordsRef.current = { ...pickupCoordsRef.current }
        setCurrentDestDisplayAddr(pickupAddr)
        updateBookingVisualsRef.current(pinModeRef.current)
        emitRouteCoordinates()
      }
    }
  }, [pickupAddr, destAddr, emitRouteCoordinates])

  // Cập nhật tọa độ khi người dùng chọn từ gợi ý hoặc dán địa chỉ
  useEffect(() => {
    if (!manualCoords || !mapRef.current) return
    const { kind, lat, lng, address } = manualCoords

    if (kind === "pickup") {
      pickupCoordsRef.current = { lat, lng }
      if (address) setCurrentDisplayAddr(address)
    } else {
      destCoordsRef.current = { lat, lng }
      if (address) setCurrentDestDisplayAddr(address)
    }

    updateBookingVisualsRef.current(pinModeRef.current)
    emitRouteCoordinates()

    const p = pickupCoordsRef.current
    const d = destCoordsRef.current
    if (
      p &&
      d &&
      (Math.abs(p.lat - d.lat) > 0.0001 || Math.abs(p.lng - d.lng) > 0.0001)
    ) {
      try {
        mapRef.current.fitBounds(
          L.latLngBounds([
            [p.lat, p.lng],
            [d.lat, d.lng],
          ]),
          { padding: [50, 50], maxZoom: 16 },
        )
      } catch {}
    } else {
      mapRef.current.flyTo([lat, lng], 16, { duration: 0.8 })
    }
  }, [manualCoords, emitRouteCoordinates])

  const handleSwitchPinMode = useCallback(
    (target: "pickup" | "destination") => {
      setPinMode(target)

      pinModeRef.current = target

      const map = mapRef.current

      if (!map) return

      if (target === "pickup") {
        if (pickupCoordsRef.current) {
          map.flyTo(
            [pickupCoordsRef.current.lat, pickupCoordsRef.current.lng],
            map.getZoom(),
            {
              duration: 0.8,
            },
          )

          reverseGeocode(
            pickupCoordsRef.current.lat,
            pickupCoordsRef.current.lng,
            "pickup",
          )
        }
      } else {
        if (!destCoordsRef.current) {
          const center = map.getCenter()

          destCoordsRef.current = {
            lat: center.lat + 0.007,
            lng: center.lng + 0.009,
          }
        }

        map.flyTo(
          [destCoordsRef.current.lat, destCoordsRef.current.lng],
          map.getZoom(),
          {
            duration: 0.8,
          },
        )

        reverseGeocode(
          destCoordsRef.current.lat,
          destCoordsRef.current.lng,
          "destination",
        )
      }

      setTimeout(() => {
        updateBookingVisuals(target)
      }, 60)
    },

    [reverseGeocode, updateBookingVisuals],
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

    const initialDest = {
      lat: defaultCity.lat - 0.0035,
      lng: defaultCity.lng + 0.0035,
    }

    if (!pickupCoordsRef.current) {
      pickupCoordsRef.current = initialPickup
    }

    if (!destCoordsRef.current) {
      destCoordsRef.current = initialDest

      reverseGeocode(
        defaultCity.lat - 0.0035,
        defaultCity.lng + 0.0035,
        "destination",
      )
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

          if (
            latitude >= 8 &&
            latitude <= 24 &&
            longitude >= 102 &&
            longitude <= 110
          ) {
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

        { enableHighAccuracy: true, timeout: 5000 },
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
      if (routeFetchTimeoutRef.current) {
        window.clearTimeout(routeFetchTimeoutRef.current)
      }
      if (routeFetchAbortRef.current) {
        routeFetchAbortRef.current.abort()
      }
      if (bookingRouteCasingRef.current) {
        bookingRouteCasingRef.current.remove()
        bookingRouteCasingRef.current = null
      }
      if (bookingEtaBadgeRef.current) {
        bookingEtaBadgeRef.current.remove()
        bookingEtaBadgeRef.current = null
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

  const handleCityChange = useCallback(
    (city: typeof VIETNAM_CITIES[0]) => {
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
    },
    [reverseGeocode],
  )

  // 4. GPS "Locate Me" Button with Permission Handling & Fallbacks

  const handleLocateMe = useCallback(() => {
    if (typeof window === "undefined") return

    if (!navigator.geolocation) {
      showGpsNotification(
        "Trình duyệt không hỗ trợ dịch vụ vị trí GPS",
        "error",
        4000,
      )

      return
    }

    if (
      window.isSecureContext === false &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      showGpsNotification(
        "Định vị GPS yêu cầu kết nối bảo mật HTTPS hoặc localhost",
        "error",
        4500,
      )

      return
    }

    setIsLocating(true)

    showGpsNotification(
      "Đang yêu cầu quyền và tìm vị trí GPS của bạn...",
      "info",
      5000,
    )

    const applyLocationSuccess = (coords: GeolocationCoordinates) => {
      setIsLocating(false)

      const { latitude, longitude, accuracy } = coords

      updateUserLocationMarker(latitude, longitude, accuracy)

      const target = pinModeRef.current

      if (target === "pickup") {
        pickupCoordsRef.current = { lat: latitude, lng: longitude }
      } else {
        destCoordsRef.current = { lat: latitude, lng: longitude }
      }

      if (mapRef.current) {
        mapRef.current.flyTo([latitude, longitude], 17, {
          duration: 1.2,
        })
      }

      reverseGeocode(latitude, longitude, target)

      updateBookingVisualsRef.current?.(target)

      emitRouteCoordinates()

      showGpsNotification(
        "Đã định vị thành công vị trí hiện tại của bạn!",
        "success",
        3000,
      )
    }

    // Lần 1: Yêu cầu định vị GPS chính xác cao

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyLocationSuccess(pos.coords)
      },

      (err) => {
        console.warn("GPS High-accuracy error:", err.code, err.message)

        // Lỗi 1: Người dùng đã chặn quyền vị trí (PERMISSION_DENIED)

        if (err.code === 1) {
          setIsLocating(false)

          setGpsToast(null)

          setShowPermissionGuide(true)

          return
        }

        // Lỗi 2/3 (TIMEOUT hoặc POSITION_UNAVAILABLE):

        // Thử lại lần 2 không dùng high accuracy (dùng định vị qua WiFi/IP mạng)

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            applyLocationSuccess(pos.coords)
          },

          (fallbackErr) => {
            setIsLocating(false)

            console.warn(
              "GPS Fallback error:",
              fallbackErr.code,
              fallbackErr.message,
            )

            if (fallbackErr.code === 1) {
              setGpsToast(null)

              setShowPermissionGuide(true)
            } else if (fallbackErr.code === 2) {
              showGpsNotification(
                "Không thể bắt được tín hiệu vị trí từ thiết bị",
                "error",
                4000,
              )
            } else {
              showGpsNotification(
                "Định vị hết thời gian chờ. Vui lòng bấm thử lại",
                "error",
                4000,
              )
            }

            // Nếu chưa có tọa độ nào thì lùi về tâm thành phố đang chọn

            if (!pickupCoordsRef.current && mapRef.current) {
              const current =
                VIETNAM_CITIES.find((c) => c.id === activeCityId) ||
                VIETNAM_CITIES[0]

              mapRef.current.flyTo([current.lat, current.lng], current.zoom, {
                duration: 0.8,
              })

              reverseGeocode(current.lat, current.lng, pinModeRef.current)
            }
          },

          { enableHighAccuracy: false, timeout: 8000 },
        )
      },

      { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 },
    )
  }, [
    activeCityId,
    emitRouteCoordinates,
    reverseGeocode,
    showGpsNotification,
    updateUserLocationMarker,
  ])

  // 5. Zoom Handlers

  const handleZoomIn = () => mapRef.current?.zoomIn()

  const handleZoomOut = () => mapRef.current?.zoomOut()

  // 6. Nearby Drivers Radar (when searching or driver online)

  // 6. Nearby Drivers Radar (when searching or driver mode)

  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return

    const markersLayer = markersLayerRef.current

    markersLayer.clearLayers()

    // In customer mode: load if searching OR if loadNearby is enabled (e.g. browsing in booking phase)
    if (mode === "customer" && !isSearching && !loadNearby) {
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
        className: `leaflet-truck-marker is-my-truck ${
          isOnline ? "is-online" : "is-offline"
        }`,

        html: `
          <div class="truck-marker-inner is-me ${
            isOnline ? "online-me" : "offline-me"
          }">
            ${isOnline ? '<span class="truck-pulse-ring pulse-me"></span>' : ""}
            <span class="truck-emoji">🚛</span>
            <span class="truck-plate-tag tag-me ${
              isOnline ? "" : "tag-offline"
            }">
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
          <div style="font-weight: 700; color: ${
            isOnline ? "#059669" : "#475569"
          }; margin-bottom: 2px;">
            📍 Vị trí xe của bạn
          </div>
          <div>Tài xế: <b>${myName}</b></div>
          <div>Biển số: <b>${myPlate}</b></div>
          <div style="margin-top: 5px; font-size: 11px; color: ${
            isOnline ? "#10b981" : "#64748b"
          }; font-weight: 600;">
            ${
              isOnline
                ? "🟢 Đang trực tuyến (Sẵn sàng nhận cuốc)"
                : "⚪ Ngoại tuyến (Tạm nghỉ - Bấm Bật để nhận cuốc)"
            }
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

        const drivers =
          json.success && Array.isArray(json.data) ? json.data : []

        if (onNearbyCountChange) {
          onNearbyCountChange(drivers.length)
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
  }, [
    isSearching,
    loadNearby,
    mode,
    online,
    jobState,
    demandHotspots,
    driverName,
    driverPlate,
  ])

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
        destCoordsRef.current?.lat ?? center.lat + 0.01,

        destCoordsRef.current?.lng ?? center.lng + 0.012,
      ]

      let trackingCasing: L.Polyline | null = null
      let trackingPolyline: L.Polyline | null = null

      const drawTrackingPolylines = (coords: [number, number][]) => {
        if (!mapRef.current || !tripTrackingLayerRef.current) return
        if (trackingCasing) trackingCasing.remove()
        if (trackingPolyline) trackingPolyline.remove()

        trackingCasing = L.polyline(coords, {
          color: "#1e3a8a",
          weight: 9,
          opacity: 0.28,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(trackingLayer)

        trackingPolyline = L.polyline(coords, {
          color: "#2563eb",
          weight: 5.5,
          opacity: 0.96,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(trackingLayer)

        routeLayerRef.current = trackingPolyline

        try {
          map.fitBounds(trackingPolyline.getBounds(), { padding: [80, 80], maxZoom: 16 })
        } catch {}
      }

      const trackingCacheKey = `${pickupLatLng[0].toFixed(4)},${pickupLatLng[1].toFixed(4)}_${destLatLng[0].toFixed(4)},${destLatLng[1].toFixed(4)}`
      const cachedTrackingRoute = roadRouteCache.get(trackingCacheKey)
      if (cachedTrackingRoute) {
        drawTrackingPolylines(cachedTrackingRoute.coordinates)
      } else {
        fetchRoadRoute(pickupLatLng[0], pickupLatLng[1], destLatLng[0], destLatLng[1]).then((res) => {
          if (res && res.coordinates.length > 0) {
            drawTrackingPolylines(res.coordinates)
          }
        })
      }

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

      const pickupMarker = L.marker(pickupLatLng, { icon: pickupIcon }).addTo(
        trackingLayer,
      )

      pickupMarker.bindPopup(
        `<b>Điểm Lấy Hàng</b><br/>${pickupAddr || "Vị trí nhận hàng"}`,
      )

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

      const destMarker = L.marker(destLatLng, { icon: destIcon }).addTo(
        trackingLayer,
      )

      destMarker.bindPopup(
        `<b>Điểm Giao Hàng</b><br/>${destAddr || "Vị trí giao hàng"}`,
      )

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

      const movingTruck = L.marker(pickupLatLng, { icon: truckIcon }).addTo(
        trackingLayer,
      )

      movingTruckMarkerRef.current = movingTruck

      return () => {
        trackingLayer.clearLayers()

        routeLayerRef.current = null

        movingTruckMarkerRef.current = null
      }
    }
  }, [isCustomerTracking, isDriverWorking, pickupAddr, destAddr])

  // 8. CẬP NHẬT TỌA ĐỘ XE TẢI BẰNG GPS THỜI GIAN THỰC (KHÔNG CHẠY DEMO ẢO)
  // - Khi ở chế độ Tài xế: Dùng GPS thực tế của thiết bị (watchPosition) để định vị và cập nhật vị trí xe
  // - Khi ở chế độ Khách hàng: Nhận luồng GPS thời gian thực từ tài xế qua WebSocket Pusher hoặc định kỳ lấy từ backend
  useEffect(() => {
    if (!isCustomerTracking && !isDriverWorking) return

    // TRƯỜNG HỢP 1: Chế độ TÀI XẾ -> Lấy trực tiếp GPS thực tế của điện thoại/thiết bị
    if (mode === "driver") {
      if (typeof navigator === "undefined" || !navigator.geolocation) return

      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const realLat = pos.coords.latitude
          const realLng = pos.coords.longitude
          if (movingTruckMarkerRef.current) {
            movingTruckMarkerRef.current.setLatLng([realLat, realLng])
          }
        },
        (err) => {
          console.warn("⚠️ [Driver GPS] Lỗi đọc GPS thực tế thiết bị:", err.message)
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 8000 }
      )

      return () => {
        navigator.geolocation.clearWatch(watchId)
      }
    }

    // TRƯỜNG HỢP 2: Chế độ KHÁCH HÀNG -> Nhận stream GPS realtime từ tài xế
    if (mode === "customer" && bookingId) {
      // A. Lắng nghe qua kênh Pusher Realtime (driver:location-update)
      const unsub = subscribeRealtime(
        `private-trip-${bookingId}`,
        "driver:location-update",
        (data: any) => {
          if (data && data.latitude && data.longitude && movingTruckMarkerRef.current) {
            movingTruckMarkerRef.current.setLatLng([Number(data.latitude), Number(data.longitude)])
          }
        }
      )

      // B. Polling dự phòng mỗi 3 giây nếu WebSocket có độ trễ
      const pollTimer = window.setInterval(async () => {
        try {
          const res = await fetch(`/api/v1/customer/bookings/${bookingId}/tracking`)
          if (res.ok) {
            const trackData = await res.json()
            if (trackData.data?.driverLocation && movingTruckMarkerRef.current) {
              const { latitude, longitude } = trackData.data.driverLocation
              movingTruckMarkerRef.current.setLatLng([Number(latitude), Number(longitude)])
            }
          }
        } catch {
          // Bỏ qua lỗi polling mạng ngầm
        }
      }, 3000)

      return () => {
        unsub()
        window.clearInterval(pollTimer)
      }
    }
  }, [isCustomerTracking, isDriverWorking, mode, bookingId])

  return (
    <div
      aria-label="Bản đồ tương tác toàn quốc 63 tỉnh thành"
      className={`interactive-map-root leaflet-real-map mode-${mode} layer-${layer} ${
        layerMenuOpen ? "layer-menu-active" : ""
      }`}
    >
      {/* Real Leaflet Map Canvas */}
      <div
        className="leaflet-map-canvas"
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          inset: 0,
        }}
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
                className={`city-pill ${
                  activeCityId === city.id ? "active" : ""
                }`}
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
              className={`pin-toggle-btn ${
                pinMode === "pickup" ? "active-pickup" : ""
              }`}
              onClick={() => handleSwitchPinMode("pickup")}
              type="button"
              title="Chuyển tâm ghim để chọn Vị trí đón / lấy hàng"
            >
              <span className="pin-dot-indicator dot-green" />
              <span>Điểm đón (A)</span>
            </button>
            <div className="pin-toggle-divider" />
            <button
              className={`pin-toggle-btn ${
                pinMode === "destination" ? "active-dest" : ""
              }`}
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
        <div
          className={`center-pin-overlay mode-${pinMode} ${
            pinLifted ? "is-lifted" : ""
          }`}
        >
          <div className="center-pin-wrapper">
            <span className="pin-ground-shadow" />
            <div className={`pin-head pin-head-${pinMode}`}>
              <span className="pin-badge-letter">
                {pinMode === "pickup" ? "A" : "B"}
              </span>
            </div>

            {/* Bubble Callout with Real Address */}
            <div className={`pin-callout-bubble bubble-${pinMode}`}>
              <span className={`pin-type-tag tag-${pinMode}`}>
                {pinMode === "pickup"
                  ? "🟢 Điểm lấy hàng (A)"
                  : "🔴 Điểm giao hàng (B)"}
              </span>
              <span className="pin-callout-text">
                {pinMode === "pickup"
                  ? currentDisplayAddr.split(",")[0] ||
                    (geocodingLoading ? "Đang dò tên đường..." : "Điểm đón")
                  : currentDestDisplayAddr.split(",")[0] ||
                    (geocodingLoading ? "Đang dò tên đường..." : "Điểm giao")}
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
                  className={`layer-opt ${
                    layer === "standard" ? "selected" : ""
                  }`}
                  onClick={() => {
                    setLayer("standard")

                    setLayerMenuOpen(false)
                  }}
                  type="button"
                >
                  <span>🌿 Đô thị chuẩn (OSM)</span>
                </button>
                <button
                  className={`layer-opt ${
                    layer === "traffic" ? "selected" : ""
                  }`}
                  onClick={() => {
                    setLayer("traffic")

                    setLayerMenuOpen(false)
                  }}
                  type="button"
                >
                  <span>🌙 Chế độ đêm (CartoDB)</span>
                </button>
                <button
                  className={`layer-opt ${
                    layer === "satellite" ? "selected" : ""
                  }`}
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
          className={`icon-button glass locate ${
            isLocating ? "is-locating" : ""
          }`}
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

      {/* GPS Floating Notification Toast */}
      {gpsToast && (
        <div className={`gps-floating-toast toast-${gpsToast.type}`}>
          <span className="gps-toast-icon">
            {gpsToast.type === "info" && (
              <svg
                className="toast-spinner"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            )}
            {gpsToast.type === "success" && "📍"}
            {gpsToast.type === "error" && "⚠️"}
          </span>
          <span className="gps-toast-text">{gpsToast.message}</span>
        </div>
      )}

      {/* GPS Permission Guide Modal */}
      {showPermissionGuide && (
        <div
          className="gps-permission-modal-backdrop"
          onClick={() => setShowPermissionGuide(false)}
        >
          <div
            className="gps-permission-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gps-modal-icon-wrap">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="gps-modal-icon"
              >
                <circle cx="12" cy="12" r="7" />
                <circle cx="12" cy="12" r="2" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
            </div>

            <h3 className="gps-modal-title">Cần quyền truy cập vị trí</h3>
            <p className="gps-modal-desc">
              Trình duyệt đang chặn truy cập vị trí. Để ứng dụng tự động nhận
              diện điểm đón chính xác và hiển thị tài xế gần bạn nhất:
            </p>

            <div className="gps-modal-steps">
              <div className="gps-modal-step">
                <span className="step-num">1</span>
                <span>
                  Bấm vào biểu tượng <strong>🔒 ổ khóa</strong> hoặc{" "}
                  <strong>⚙️ cài đặt</strong> trên thanh địa chỉ trình duyệt.
                </span>
              </div>
              <div className="gps-modal-step">
                <span className="step-num">2</span>
                <span>
                  Tìm mục <strong>Vị trí (Location)</strong> và chuyển sang{" "}
                  <strong>Cho phép (Allow)</strong>.
                </span>
              </div>
              <div className="gps-modal-step">
                <span className="step-num">3</span>
                <span>
                  Nhấn nút <strong>Thử lại ngay</strong> bên dưới.
                </span>
              </div>
            </div>

            <div className="gps-modal-actions">
              <button
                type="button"
                className="gps-modal-btn-retry"
                onClick={() => {
                  setShowPermissionGuide(false)

                  handleLocateMe()
                }}
              >
                🔄 Thử lại ngay
              </button>
              <button
                type="button"
                className="gps-modal-btn-close"
                onClick={() => setShowPermissionGuide(false)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {children}
    </div>
  )
}

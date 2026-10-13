/**
 * pusherClient.ts
 * Module quản lý kết nối Realtime phía Client (Browser).
 * Hỗ trợ đa chế độ:
 * 1. BroadcastChannel: Truyền thông điệp tức thì giữa các Tab trong trình duyệt (Khách hàng <-> Tài xế)
 * 2. API Polling Event: Đồng bộ với máy chủ thông qua /api/v1/pusher/events
 * 3. Window CustomEvent: Cho phép các component cùng trang nhận tín hiệu ngay lập tức
 */

interface RealtimeMessage {
  channel: string
  event: string
  data: any
  timestamp: number
}

// Khởi tạo BroadcastChannel nếu môi trường trình duyệt hỗ trợ
const broadcastChannel: BroadcastChannel | null =
  typeof window !== "undefined" && "BroadcastChannel" in window
    ? new BroadcastChannel("truck_booking_realtime")
    : null

type EventCallback = (data: any) => void
const listeners = new Map<string, Set<EventCallback>>()

function getListenerKey(channel: string, event: string): string {
  // Chuẩn hóa tên kênh (bỏ tiền tố private- nếu có để bắt đúng)
  const cleanChannel = channel.replace(/^private-/, "")
  return `${cleanChannel}::${event}`
}

function dispatchToListeners(channel: string, event: string, data: any) {
  const cleanChannel = channel.replace(/^private-/, "")
  const key = `${cleanChannel}::${event}`
  const callbacks = listeners.get(key)
  if (callbacks && callbacks.size > 0) {
    callbacks.forEach((cb) => {
      try {
        cb(data)
      } catch (err) {
        console.error(`[PusherClient] Error in listener callback for ${key}:`, err)
      }
    })
  }
}

// Lắng nghe sự kiện từ BroadcastChannel (Cross-tab)
if (broadcastChannel) {
  broadcastChannel.onmessage = (e: MessageEvent<RealtimeMessage>) => {
    if (e.data && e.data.channel && e.data.event) {
      dispatchToListeners(e.data.channel, e.data.event, e.data.data)
    }
  }
}

// Lắng nghe sự kiện từ Window CustomEvent
if (typeof window !== "undefined") {
  window.addEventListener("truck_booking_realtime", ((e: CustomEvent<RealtimeMessage>) => {
    if (e.detail && e.detail.channel && e.detail.event) {
      dispatchToListeners(e.detail.channel, e.detail.event, e.detail.data)
    }
  }) as EventListener)
}

// Polling ngầm để đồng bộ sự kiện từ Server
let pollTimer: any = null
let lastPolledTimestamp = Date.now() - 5000
const activeChannels = new Set<string>()

async function pollServerEvents() {
  if (activeChannels.size === 0) return

  try {
    const res = await fetch(`/api/v1/pusher/events?since=${lastPolledTimestamp}`)
    if (!res.ok) return
    const json = await res.json()
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      for (const item of json.data) {
        if (item.timestamp > lastPolledTimestamp) {
          lastPolledTimestamp = item.timestamp
        }
        dispatchToListeners(item.channel, item.event, item.data)
      }
    }
  } catch {
    // Bỏ qua lỗi mạng chập chờn khi polling
  }
}

function ensurePolling() {
  if (typeof window === "undefined") return
  if (!pollTimer && activeChannels.size > 0) {
    pollTimer = setInterval(pollServerEvents, 1500)
    // Gọi ngay một lượt
    pollServerEvents()
  }
}

function checkStopPolling() {
  if (activeChannels.size === 0 && pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

/**
 * Xác thực bảo mật khi kết nối Pusher Private Channel (POST /api/v1/pusher/auth)
 */
export async function authenticatePrivateChannel(
  channelName: string,
  socketId: string = "browser_socket_" + Math.random().toString(36).substring(2, 9),
): Promise<{ auth: string; channel_data?: string } | null> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("auth_token") ||
        localStorage.getItem("driver_auth_token") ||
        localStorage.getItem("admin_auth_token")
      : null

  if (!token) return null

  try {
    const res = await fetch("/api/v1/pusher/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel_name: channelName,
        socket_id: socketId,
      }),
    })
    const data = await res.json()
    return data
  } catch (err) {
    console.warn("[PusherClient] Lỗi xác thực Private Channel:", err)
    return null
  }
}

/**
 * Đăng ký nhận sự kiện realtime từ một kênh
 * @param channel Tên kênh (vd: "driver-xxx", "private-trip-yyy")
 * @param event Tên sự kiện (vd: "booking:new-offer", "booking:accepted")
 * @param callback Hàm xử lý khi nhận được dữ liệu
 * @returns Hàm unsubscribe để hủy lắng nghe khi component unmount
 */
export function subscribeRealtime(
  channel: string,
  event: string,
  callback: EventCallback,
): () => void {
  // Tự động kích hoạt xác thực bảo mật nếu là Private Channel
  if (channel.startsWith("private-")) {
    authenticatePrivateChannel(channel)
  }

  const key = getListenerKey(channel, event)
  if (!listeners.has(key)) {
    listeners.set(key, new Set())
  }
  listeners.get(key)!.add(callback)

  const cleanChannel = channel.replace(/^private-/, "")
  activeChannels.add(cleanChannel)
  ensurePolling()

  return () => {
    const set = listeners.get(key)
    if (set) {
      set.delete(callback)
      if (set.size === 0) {
        listeners.delete(key)
      }
    }

    // Kiểm tra xem còn listener nào trên channel này không
    let channelStillActive = false
    for (const k of listeners.keys()) {
      if (k.startsWith(`${cleanChannel}::`)) {
        channelStillActive = true
        break
      }
    }
    if (!channelStillActive) {
      activeChannels.delete(cleanChannel)
      checkStopPolling()
    }
  }
}

/**
 * Phát sự kiện client-side tức thì (Cross-tab và in-page)
 */
export function emitLocalRealtime(channel: string, event: string, data: any) {
  const payload: RealtimeMessage = {
    channel,
    event,
    data,
    timestamp: Date.now(),
  }

  // 1. Gửi qua BroadcastChannel cho các tab khác
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(payload)
    } catch (e) {
      // ignore
    }
  }

  // 2. Gửi in-page cho các component trên cùng tab
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("truck_booking_realtime", { detail: payload }))
  }

  // 3. Phân phối trực tiếp cho listeners cục bộ
  dispatchToListeners(channel, event, data)
}

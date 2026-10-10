export type Tone = "blue" | "green" | "amber" | "red" | "sky"
export type Pt = [number, number]

export type Order = {
  id: string
  customer: string
  phone: string
  driver: string
  driverPhone: string
  from: string
  to: string
  fromAddr: string
  toAddr: string
  vehicle: string
  status: string
  tone: Tone
  value: number
  time: string
  eta?: number
  late?: number
  t: number
  p: Pt
  d: Pt
  km: number
  stage: number
  cancelled?: boolean
}

export const vnd = (n: number) => `${n.toLocaleString("vi-VN")}đ`

export const orders: Order[] = [
  {
    id: "DH1024",
    customer: "Nguyễn Thu Hà",
    phone: "090 812 2940",
    driver: "Anh Minh",
    driverPhone: "093 312 4486",
    from: "Quận 3",
    to: "Thủ Đức",
    fromAddr: "21 Nguyễn Đình Chiểu, P. Võ Thị Sáu, Quận 3",
    toAddr: "128 Đặng Văn Bi, P. Bình Thọ, TP. Thủ Đức",
    vehicle: "Xe van",
    status: "Đang giao",
    tone: "blue",
    value: 149000,
    time: "10:42",
    eta: 8,
    late: 18,
    t: 0.62,
    p: [36, 44],
    d: [82, 22],
    km: 11.4,
    stage: 3,
  },
  {
    id: "DH1023",
    customer: "Phạm Đức Long",
    phone: "091 455 7102",
    driver: "Anh Kiệt",
    driverPhone: "098 745 2201",
    from: "Bình Thạnh",
    to: "Quận 7",
    fromAddr: "45 Xô Viết Nghệ Tĩnh, P. 21, Bình Thạnh",
    toAddr: "Crescent Mall, 101 Tôn Dật Tiên, Quận 7",
    vehicle: "Xe tải 500kg",
    status: "Đang giao",
    tone: "blue",
    value: 182000,
    time: "10:35",
    eta: 14,
    t: 0.35,
    p: [56, 30],
    d: [60, 84],
    km: 9.8,
    stage: 3,
  },
  {
    id: "DH1022",
    customer: "Lê Minh Thư",
    phone: "093 220 1188",
    driver: "—",
    driverPhone: "",
    from: "Quận 1",
    to: "Bình Chánh",
    fromAddr: "72 Lê Thánh Tôn, P. Bến Nghé, Quận 1",
    toAddr: "KCN Vĩnh Lộc, Bình Chánh",
    vehicle: "Xe bán tải",
    status: "Chờ tài xế",
    tone: "amber",
    value: 320000,
    time: "10:31",
    t: 0,
    p: [47, 54],
    d: [14, 78],
    km: 21.3,
    stage: 0,
  },
  {
    id: "DH1021",
    customer: "Hoàng Gia Bảo",
    phone: "097 634 8832",
    driver: "Anh Nam",
    driverPhone: "091 634 8832",
    from: "Phú Nhuận",
    to: "Tân Bình",
    fromAddr: "15 Phan Xích Long, P. 2, Phú Nhuận",
    toAddr: "60 Cộng Hòa, P. 12, Tân Bình",
    vehicle: "Xe máy",
    status: "Hoàn thành",
    tone: "green",
    value: 78000,
    time: "10:12",
    t: 1,
    p: [40, 34],
    d: [22, 40],
    km: 6.2,
    stage: 4,
  },
  {
    id: "DH1020",
    customer: "Trương Hải Yến",
    phone: "090 118 5624",
    driver: "Anh Huy",
    driverPhone: "090 881 5624",
    from: "Quận 5",
    to: "Quận 2",
    fromAddr: "210 Trần Hưng Đạo, P. 10, Quận 5",
    toAddr: "Thảo Điền, TP. Thủ Đức",
    vehicle: "Xe van",
    status: "Đã hủy",
    tone: "red",
    value: 210000,
    time: "09:58",
    t: 0,
    p: [40, 66],
    d: [70, 48],
    km: 10.1,
    stage: 1,
    cancelled: true,
  },
  {
    id: "DH1019",
    customer: "Vũ Khánh Linh",
    phone: "098 301 7745",
    driver: "Chú Hải",
    driverPhone: "092 410 3391",
    from: "Gò Vấp",
    to: "Quận 10",
    fromAddr: "88 Quang Trung, P. 10, Gò Vấp",
    toAddr: "402 Ba Tháng Hai, P. 12, Quận 10",
    vehicle: "Xe tải 500kg",
    status: "Đang giao",
    tone: "blue",
    value: 265000,
    time: "09:50",
    eta: 12,
    late: 11,
    t: 0.8,
    p: [34, 14],
    d: [36, 58],
    km: 8.7,
    stage: 3,
  },
  {
    id: "DH1018",
    customer: "Đỗ Bảo Ngọc",
    phone: "096 772 0094",
    driver: "Anh Đạt",
    driverPhone: "091 772 6610",
    from: "Quận 4",
    to: "Quận 8",
    fromAddr: "33 Khánh Hội, P. 3, Quận 4",
    toAddr: "19 Phạm Thế Hiển, P. 4, Quận 8",
    vehicle: "Xe máy",
    status: "Đã nhận",
    tone: "sky",
    value: 64000,
    time: "09:44",
    eta: 19,
    t: 0.15,
    p: [52, 70],
    d: [40, 84],
    km: 4.9,
    stage: 2,
  },
  {
    id: "DH1011",
    customer: "Lý Quốc Bảo",
    phone: "093 540 8821",
    driver: "Anh Tuấn",
    driverPhone: "094 118 2275",
    from: "Tân Phú",
    to: "Quận 12",
    fromAddr: "Celadon City, P. Sơn Kỳ, Tân Phú",
    toAddr: "12 Nguyễn Ảnh Thủ, Quận 12",
    vehicle: "Xe van",
    status: "Đang giao",
    tone: "blue",
    value: 238000,
    time: "09:12",
    eta: 15,
    late: 7,
    t: 0.55,
    p: [12, 52],
    d: [22, 10],
    km: 13.6,
    stage: 3,
  },
]

export const idleDrivers: Pt[] = [
  [28, 30],
  [62, 46],
  [72, 62],
  [48, 20],
  [20, 68],
  [84, 40],
  [54, 88],
  [30, 80],
  [66, 16],
  [44, 60],
  [76, 80],
  [12, 30],
  [90, 60],
  [58, 56],
]

const add = (t: string, m: number) => {
  const [h, mi] = t.split(":").map(Number)
  const x = h * 60 + mi + m
  return `${String(Math.floor(x / 60) % 24).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`
}

export const stepNames = [
  "Đã đặt",
  "Tài xế nhận",
  "Đã lấy hàng",
  "Đang giao",
  "Đã giao",
]
export const stamps = (o: Order) =>
  [0, 5, 17, 23, 46].map((m, i) =>
    i <= o.stage ? add(o.time, m) : `Dự kiến ${add(o.time, m)}`,
  )

export type DocState = "none" | "ok" | "review"
export type Pending = {
  id: string
  name: string
  initials: string
  phone: string
  area: string
  dob: string
  email: string
  vehicle: string
  plate: string
  brand: string
  submitted: string
  docNums: [string, string, string, string]
  docs0: DocState[]
}

export const pending: Pending[] = [
  {
    id: "HS-1291",
    name: "Nguyễn Văn Minh",
    initials: "VM",
    phone: "093 822 1094",
    area: "TP. Hồ Chí Minh",
    dob: "18/09/1991",
    email: "vanminh91@gmail.com",
    vehicle: "Xe tải 500kg",
    plate: "50H-218.56",
    brand: "THACO Towner 800",
    submitted: "2 phút trước",
    docNums: [
      "079091004821",
      "790228184695 · B2",
      "50H-218.56",
      "Khớp khuôn mặt 97%",
    ],
    docs0: ["none", "none", "none", "none"],
  },
  {
    id: "HS-1290",
    name: "Phan Anh Tuấn",
    initials: "AT",
    phone: "090 455 2318",
    area: "Bình Dương",
    dob: "02/03/1988",
    email: "anhtuan88@gmail.com",
    vehicle: "Xe van",
    plate: "61A-337.90",
    brand: "Suzuki Blind Van",
    submitted: "38 phút trước",
    docNums: [
      "074088003317",
      "740119226641 · B2",
      "61A-337.90",
      "Khớp khuôn mặt 94%",
    ],
    docs0: ["ok", "ok", "none", "none"],
  },
  {
    id: "HS-1288",
    name: "Vũ Tiến Dũng",
    initials: "TD",
    phone: "098 117 6630",
    area: "TP. Hồ Chí Minh",
    dob: "27/11/1994",
    email: "tiendung94@gmail.com",
    vehicle: "Xe bán tải",
    plate: "51K-882.14",
    brand: "Ford Ranger",
    submitted: "1 giờ trước",
    docNums: [
      "079094011920",
      "790331507712 · B2",
      "51K-882.14",
      "Khớp khuôn mặt 99%",
    ],
    docs0: ["ok", "ok", "ok", "review"],
  },
  {
    id: "HS-1285",
    name: "Lê Hoài Phong",
    initials: "HP",
    phone: "091 902 4471",
    area: "TP. Hồ Chí Minh",
    dob: "09/06/1996",
    email: "hoaiphong96@gmail.com",
    vehicle: "Xe máy",
    plate: "59X2-471.08",
    brand: "Honda Wave Alpha",
    submitted: "2 giờ trước",
    docNums: [
      "079096008855",
      "790440219083 · A1",
      "59X2-471.08",
      "Khớp khuôn mặt 92%",
    ],
    docs0: ["ok", "none", "none", "none"],
  },
  {
    id: "HS-1281",
    name: "Đinh Công Sơn",
    initials: "CS",
    phone: "094 603 1127",
    area: "Đồng Nai",
    dob: "14/01/1990",
    email: "congson90@gmail.com",
    vehicle: "Xe van",
    plate: "60C-144.72",
    brand: "Hyundai H100",
    submitted: "3 giờ trước",
    docNums: [
      "075090002764",
      "750218843350 · B2",
      "60C-144.72",
      "Khớp khuôn mặt 95%",
    ],
    docs0: ["ok", "ok", "ok", "ok"],
  },
]

export type ActiveDriver = {
  name: string
  initials: string
  phone: string
  vehicle: string
  rating: string
  trips: string
  status: string
  tone: Tone
  date: string
  id: string
}
export const activeDrivers: ActiveDriver[] = [
  {
    id: "TX-1204",
    name: "Trần Minh Quân",
    initials: "MQ",
    phone: "090 312 4486",
    vehicle: "Xe van · 51D-482.19",
    rating: "4,9",
    trips: "1.284",
    status: "Đang hoạt động",
    tone: "green",
    date: "12/08/2023",
  },
  {
    id: "TX-1187",
    name: "Võ Tuấn Kiệt",
    initials: "TK",
    phone: "098 745 2201",
    vehicle: "Xe tải 500kg · 51C-903.47",
    rating: "4,8",
    trips: "842",
    status: "Đang hoạt động",
    tone: "green",
    date: "04/11/2023",
  },
  {
    id: "TX-1102",
    name: "Ngô Hoàng Nam",
    initials: "HN",
    phone: "091 634 8832",
    vehicle: "Xe máy · 59P2-184.20",
    rating: "4,9",
    trips: "2.106",
    status: "Đang hoạt động",
    tone: "green",
    date: "22/05/2023",
  },
  {
    id: "TX-1251",
    name: "Lê Thành Đạt",
    initials: "TĐ",
    phone: "090 881 5624",
    vehicle: "Xe bán tải · 51D-721.08",
    rating: "4,3",
    trips: "316",
    status: "Cần xác minh",
    tone: "amber",
    date: "16/01/2024",
  },
  {
    id: "TX-1233",
    name: "Đặng Quốc Huy",
    initials: "QH",
    phone: "092 118 7745",
    vehicle: "Xe van · 51D-120.33",
    rating: "4,1",
    trips: "198",
    status: "Tạm khóa",
    tone: "red",
    date: "03/03/2024",
  },
]

export type UserRow = {
  id: string
  name: string
  initials: string
  phone: string
  email: string
  orders: number
  spent: number
  last: string
  lastId: string
  status: string
  tone: Tone
  joined: string
  recent: {
    id: string
    route: string
    value: number
    status: string
    tone: Tone
    when: string
  }[]
  support: { id: string title: string status: string when: string }[]
}

export const users: UserRow[] = [
  {
    id: "KH-2041",
    name: "Nguyễn Thu Hà",
    initials: "TH",
    phone: "090 812 2940",
    email: "thuha.nguyen@gmail.com",
    orders: 27,
    spent: 4820000,
    last: "Hôm nay, 10:42",
    lastId: "DH1024",
    status: "Hoạt động",
    tone: "green",
    joined: "03/2024",
    recent: [
      {
        id: "DH1024",
        route: "Quận 3 → Thủ Đức",
        value: 149000,
        status: "Đang giao",
        tone: "blue",
        when: "10:42",
      },
      {
        id: "DH0962",
        route: "Quận 3 → Quận 1",
        value: 78000,
        status: "Hoàn thành",
        tone: "green",
        when: "20/05",
      },
      {
        id: "DH0911",
        route: "Quận 3 → Phú Nhuận",
        value: 96000,
        status: "Hoàn thành",
        tone: "green",
        when: "17/05",
      },
    ],
    support: [
      {
        id: "KN-0198",
        title: "Tài xế đến trễ 15 phút",
        status: "Đã giải quyết",
        when: "02/05",
      },
    ],
  },
  {
    id: "KH-1988",
    name: "Phạm Đức Long",
    initials: "ĐL",
    phone: "091 455 7102",
    email: "duclong.pham@outlook.com",
    orders: 64,
    spent: 11350000,
    last: "Hôm nay, 10:35",
    lastId: "DH1023",
    status: "Hoạt động",
    tone: "green",
    joined: "11/2023",
    recent: [
      {
        id: "DH1023",
        route: "Bình Thạnh → Quận 7",
        value: 182000,
        status: "Đang giao",
        tone: "blue",
        when: "10:35",
      },
      {
        id: "DH0990",
        route: "Bình Thạnh → Quận 2",
        value: 134000,
        status: "Hoàn thành",
        tone: "green",
        when: "21/05",
      },
    ],
    support: [],
  },
  {
    id: "KH-2210",
    name: "Lê Minh Thư",
    initials: "MT",
    phone: "093 220 1188",
    email: "minhthu.le@gmail.com",
    orders: 9,
    spent: 1760000,
    last: "Hôm nay, 10:31",
    lastId: "DH1022",
    status: "Hoạt động",
    tone: "green",
    joined: "01/2025",
    recent: [
      {
        id: "DH1022",
        route: "Quận 1 → Bình Chánh",
        value: 320000,
        status: "Chờ tài xế",
        tone: "amber",
        when: "10:31",
      },
      {
        id: "DH0987",
        route: "Quận 1 → Quận 7",
        value: 215000,
        status: "Hoàn thành",
        tone: "green",
        when: "21/05",
      },
    ],
    support: [
      {
        id: "KN-0231",
        title: "Hàng bị trầy xước khi giao",
        status: "Mới",
        when: "Hôm nay",
      },
    ],
  },
  {
    id: "KH-2305",
    name: "Hoàng Gia Bảo",
    initials: "GB",
    phone: "097 634 8832",
    email: "giabao.hoang@gmail.com",
    orders: 3,
    spent: 312000,
    last: "Hôm nay, 10:12",
    lastId: "DH1021",
    status: "Mới",
    tone: "sky",
    joined: "05/2025",
    recent: [
      {
        id: "DH1021",
        route: "Phú Nhuận → Tân Bình",
        value: 78000,
        status: "Hoàn thành",
        tone: "green",
        when: "10:12",
      },
    ],
    support: [],
  },
  {
    id: "KH-1764",
    name: "Trương Hải Yến",
    initials: "HY",
    phone: "090 118 5624",
    email: "haiyen.truong@gmail.com",
    orders: 41,
    spent: 7240000,
    last: "Hôm nay, 09:58",
    lastId: "DH1020",
    status: "Hoạt động",
    tone: "green",
    joined: "08/2023",
    recent: [
      {
        id: "DH1020",
        route: "Quận 5 → Quận 2",
        value: 210000,
        status: "Đã hủy",
        tone: "red",
        when: "09:58",
      },
      {
        id: "DH0975",
        route: "Quận 5 → Quận 10",
        value: 88000,
        status: "Hoàn thành",
        tone: "green",
        when: "19/05",
      },
    ],
    support: [
      {
        id: "KN-0229",
        title: "Bị tính phụ phí ngoài dự kiến",
        status: "Mới",
        when: "Hôm nay",
      },
      {
        id: "KN-0175",
        title: "Tài xế không nghe máy",
        status: "Đã giải quyết",
        when: "14/04",
      },
    ],
  },
  {
    id: "KH-1502",
    name: "Vũ Khánh Linh",
    initials: "KL",
    phone: "098 301 7745",
    email: "khanhlinh.vu@gmail.com",
    orders: 112,
    spent: 21480000,
    last: "Hôm nay, 09:50",
    lastId: "DH1019",
    status: "Hoạt động",
    tone: "green",
    joined: "02/2023",
    recent: [
      {
        id: "DH1019",
        route: "Gò Vấp → Quận 10",
        value: 265000,
        status: "Đang giao",
        tone: "blue",
        when: "09:50",
      },
    ],
    support: [],
  },
  {
    id: "KH-0877",
    name: "Bùi Thanh Tùng",
    initials: "TT",
    phone: "094 266 1903",
    email: "thanhtung.bui@gmail.com",
    orders: 18,
    spent: 2960000,
    last: "12/05/2025",
    lastId: "DH0801",
    status: "Tạm khóa",
    tone: "red",
    joined: "06/2024",
    recent: [
      {
        id: "DH0801",
        route: "Quận 7 → Nhà Bè",
        value: 142000,
        status: "Đã hủy",
        tone: "red",
        when: "12/05",
      },
    ],
    support: [
      {
        id: "KN-0204",
        title: "Hủy đơn liên tục sau khi tài xế nhận",
        status: "Đang xử lý",
        when: "13/05",
      },
    ],
  },
]

export type Complaint = {
  id: string
  order: string
  customer: string
  driver: string
  cat: string
  title: string
  body: string
  status: string
  time: string
  messages: { from: "customer" | "admin" text: string at: string }[]
  events: { text: string at: string }[]
}

export const complaints0: Complaint[] = [
  {
    id: "KN-0231",
    order: "DH0987",
    customer: "Lê Minh Thư",
    driver: "Anh Nam",
    cat: "Hàng hóa",
    title: "Hàng bị trầy xước khi giao",
    body: "Tủ gỗ nhỏ bị trầy một góc, không có lớp bảo vệ khi vận chuyển. Khách đã chụp ảnh khi nhận hàng.",
    status: "Mới",
    time: "4 phút trước",
    messages: [
      {
        from: "customer",
        text: "Tủ của tôi bị trầy xước ở góc phải. Tôi đã chụp ảnh lúc nhận hàng, nhờ bên mình kiểm tra giúp.",
        at: "10:38",
      },
    ],
    events: [
      { text: "Khiếu nại được tạo", at: "10:38" },
      { text: "Đơn DH0987 hoàn thành", at: "21/05 15:20" },
    ],
  },
  {
    id: "KN-0229",
    order: "DH0975",
    customer: "Trương Hải Yến",
    driver: "Anh Huy",
    cat: "Thanh toán",
    title: "Bị tính phụ phí ngoài dự kiến",
    body: "Giá hiển thị khi đặt là 88.000đ nhưng thanh toán 113.000đ do phụ phí giờ cao điểm.",
    status: "Mới",
    time: "22 phút trước",
    messages: [
      {
        from: "customer",
        text: "Lúc đặt đơn app báo 88.000đ nhưng cuối cùng tôi phải trả 113.000đ. Phụ phí này không được báo trước.",
        at: "10:20",
      },
    ],
    events: [{ text: "Khiếu nại được tạo", at: "10:20" }],
  },
  {
    id: "KN-0225",
    order: "DH0961",
    customer: "Phạm Đức Long",
    driver: "Anh Kiệt",
    cat: "Giao chậm",
    title: "Giao trễ 40 phút so với dự kiến",
    body: "Đơn giao hàng cho khách hàng doanh nghiệp bị trễ, ảnh hưởng lịch nhận hàng.",
    status: "Đang xử lý",
    time: "1 giờ trước",
    messages: [
      {
        from: "customer",
        text: "Đơn trễ 40 phút, bên nhận đã rời đi. Tôi cần được giải thích.",
        at: "09:30",
      },
      {
        from: "admin",
        text: "Chào anh Long, bên em đang liên hệ tài xế để xác minh nguyên nhân và sẽ phản hồi trong 30 phút.",
        at: "09:41",
      },
    ],
    events: [
      { text: "Khiếu nại được tạo", at: "09:30" },
      { text: "Admin tiếp nhận", at: "09:41" },
    ],
  },
  {
    id: "KN-0219",
    order: "DH0944",
    customer: "Đỗ Bảo Ngọc",
    driver: "Anh Đạt",
    cat: "Thái độ tài xế",
    title: "Tài xế trả lời thiếu lịch sự",
    body: "Khách phản ánh tài xế nói chuyện cộc lốc khi được nhờ dời điểm giao vài mét.",
    status: "Đang xử lý",
    time: "3 giờ trước",
    messages: [
      {
        from: "customer",
        text: "Tài xế nói chuyện không lịch sự khi tôi nhờ dời điểm giao.",
        at: "07:55",
      },
    ],
    events: [
      { text: "Khiếu nại được tạo", at: "07:55" },
      { text: "Admin tiếp nhận", at: "08:10" },
    ],
  },
  {
    id: "KN-0204",
    order: "DH0801",
    customer: "Bùi Thanh Tùng",
    driver: "Anh Huy",
    cat: "Giao chậm",
    title: "Tài xế đến điểm lấy trễ",
    body: "Tài xế đến trễ 25 phút, khách đã hủy đơn.",
    status: "Đã giải quyết",
    time: "Hôm qua",
    messages: [
      {
        from: "customer",
        text: "Tài xế tới trễ quá nên tôi hủy đơn.",
        at: "12/05 14:10",
      },
      {
        from: "admin",
        text: "Bên em đã ghi nhận và gửi mã giảm giá cho lần đặt tiếp theo.",
        at: "12/05 14:40",
      },
    ],
    events: [
      { text: "Khiếu nại được tạo", at: "14:10" },
      { text: "Đã giải quyết", at: "14:40" },
    ],
  },
  {
    id: "KN-0198",
    order: "DH0921",
    customer: "Nguyễn Thu Hà",
    driver: "Anh Minh",
    cat: "Giao chậm",
    title: "Tài xế đến trễ 15 phút",
    body: "Đã liên hệ tài xế, nguyên nhân do kẹt xe.",
    status: "Đã giải quyết",
    time: "2 ngày trước",
    messages: [
      { from: "customer", text: "Tài xế đến trễ 15 phút.", at: "02/05 09:00" },
    ],
    events: [
      { text: "Khiếu nại được tạo", at: "09:00" },
      { text: "Đã giải quyết", at: "11:30" },
    ],
  },
]

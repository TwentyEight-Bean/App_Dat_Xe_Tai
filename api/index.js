var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lib/pusher.ts
var pusher_exports = {};
__export(pusher_exports, {
  getRecentEvents: () => getRecentEvents,
  pusherServer: () => pusherServer,
  triggerBookingAccepted: () => triggerBookingAccepted,
  triggerBookingCancelled: () => triggerBookingCancelled,
  triggerBookingStatusChange: () => triggerBookingStatusChange,
  triggerDriverLocationUpdate: () => triggerDriverLocationUpdate,
  triggerDriverNewOffer: () => triggerDriverNewOffer,
  triggerEvent: () => triggerEvent,
  triggerMessagesRead: () => triggerMessagesRead,
  triggerNewChatMessage: () => triggerNewChatMessage,
  triggerOfferCancelled: () => triggerOfferCancelled
});
import Pusher from "pusher";
import * as dotenv3 from "dotenv";
function getRecentEvents(channel, sinceTimestamp) {
  let list = eventBuffer;
  if (channel) {
    list = list.filter(
      (e) => e.channel === channel || e.channel === `private-${channel}` || channel === `private-${e.channel}`
    );
  }
  if (sinceTimestamp) {
    list = list.filter((e) => e.timestamp > sinceTimestamp);
  }
  return list;
}
async function triggerEvent(channel, event, data) {
  try {
    const record = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      channel,
      event,
      data,
      timestamp: Date.now()
    };
    eventBuffer.push(record);
    if (eventBuffer.length > MAX_BUFFER_SIZE) {
      eventBuffer.shift();
    }
    if (pusherServer) {
      await pusherServer.trigger(channel, event, data);
      console.log(
        `\u{1F4E1} [Pusher Event] [${channel}] -> "${event}":`,
        JSON.stringify(data)
      );
      return true;
    } else {
      console.log(
        `\u{1F4E1} [Pusher Mock] [${channel}] -> "${event}":`,
        JSON.stringify(data)
      );
      return true;
    }
  } catch (err) {
    console.error(
      `\u274C [Pusher Error] Kh\xF4ng th\u1EC3 g\u1EEDi s\u1EF1 ki\u1EC7n [${channel}] -> "${event}":`,
      err.message
    );
    return false;
  }
}
async function triggerDriverNewOffer(driverId, offerData) {
  const channel = `private-driver-${driverId}`;
  const event = "booking:new-offer";
  const payload = {
    bookingId: offerData.bookingId,
    bookingCode: offerData.bookingCode,
    originAddress: offerData.originAddress,
    destinationAddress: offerData.destinationAddress,
    distanceKm: offerData.distanceKm,
    totalPrice: offerData.totalPrice,
    vehicleTypeName: offerData.vehicleTypeName || null,
    expiresInSeconds: offerData.expiresInSeconds || 20,
    timestamp: Date.now()
  };
  return await triggerEvent(channel, event, payload);
}
async function triggerBookingAccepted(bookingId, driverInfo) {
  const channel = `private-trip-${bookingId}`;
  const event = "booking:accepted";
  const payload = {
    bookingId,
    status: "ACCEPTED",
    driver: {
      id: driverInfo.driverId,
      name: driverInfo.driverName,
      phone: driverInfo.driverPhone,
      avatarUrl: driverInfo.avatarUrl || null,
      licensePlate: driverInfo.licensePlate || null,
      vehicleTypeName: driverInfo.vehicleTypeName || null,
      ratingAvg: driverInfo.ratingAvg || 5
    },
    timestamp: Date.now()
  };
  return await triggerEvent(channel, event, payload);
}
async function triggerOfferCancelled(driverId, bookingId, reason = "TAKEN") {
  const channel = `private-driver-${driverId}`;
  const event = "offer:cancelled";
  const payload = {
    bookingId,
    reason,
    // 'TAKEN' (Đã có người nhận) hoặc 'EXPIRED' (Hết thời gian chờ)
    timestamp: Date.now()
  };
  return await triggerEvent(channel, event, payload);
}
async function triggerBookingStatusChange(bookingId, newStatus, extra = {}) {
  const channel = `private-trip-${bookingId}`;
  const event = "booking:status-change";
  const payload = {
    bookingId,
    status: newStatus,
    message: extra.message || `Chuy\u1EBFn xe \u0111\xE3 c\u1EADp nh\u1EADt tr\u1EA1ng th\xE1i: ${newStatus}`,
    driverId: extra.driverId || null,
    note: extra.note || null,
    timestamp: Date.now()
  };
  return await triggerEvent(channel, event, payload);
}
async function triggerBookingCancelled(bookingId, cancelledBy, reason, driverId, driverUserId, bookingCode) {
  const payload = {
    bookingId,
    bookingCode: bookingCode || null,
    status: "CANCELLED",
    cancelledBy,
    reason: reason || "Chuy\u1EBFn xe \u0111\xE3 b\u1ECB h\u1EE7y",
    timestamp: Date.now()
  };
  await triggerEvent(`private-trip-${bookingId}`, "booking:cancelled", payload);
  if (driverId) {
    await triggerEvent(`private-driver-${driverId}`, "booking:cancelled", payload);
  }
  if (driverUserId && driverUserId !== driverId) {
    await triggerEvent(`private-driver-${driverUserId}`, "booking:cancelled", payload);
  }
  return true;
}
async function triggerDriverLocationUpdate(bookingId, location) {
  const channel = `private-trip-${bookingId}`;
  const event = "driver:location-update";
  const payload = {
    bookingId,
    driverId: location.driverId,
    latitude: location.latitude,
    longitude: location.longitude,
    heading: location.heading !== void 0 ? location.heading : null,
    speed: location.speed !== void 0 ? location.speed : null,
    timestamp: Date.now()
  };
  return await triggerEvent(channel, event, payload);
}
async function triggerNewChatMessage(bookingId, message) {
  const payload = {
    messageId: message.messageId,
    bookingId: message.bookingId,
    senderId: message.senderId,
    senderRole: message.senderRole,
    senderName: message.senderName,
    senderAvatar: message.senderAvatar || null,
    messageType: message.messageType,
    content: message.content,
    mediaUrl: message.mediaUrl || null,
    createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt,
    timestamp: Date.now()
  };
  await triggerEvent(`private-chat-${bookingId}`, "chat:new-message", payload);
  await triggerEvent(`private-trip-${bookingId}`, "chat:new-message", payload);
  return true;
}
async function triggerMessagesRead(bookingId, readByUserId) {
  const payload = {
    bookingId,
    readByUserId,
    timestamp: Date.now()
  };
  return await triggerEvent(`private-chat-${bookingId}`, "chat:messages-read", payload);
}
var isPusherConfigured, pusherServer, eventBuffer, MAX_BUFFER_SIZE;
var init_pusher = __esm({
  "src/lib/pusher.ts"() {
    "use strict";
    dotenv3.config();
    isPusherConfigured = Boolean(
      process.env.PUSHER_APP_ID && !process.env.PUSHER_APP_ID.startsWith("your_") && process.env.PUSHER_KEY && !process.env.PUSHER_KEY.startsWith("your_") && process.env.PUSHER_SECRET && !process.env.PUSHER_SECRET.startsWith("your_")
    );
    pusherServer = isPusherConfigured ? new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.PUSHER_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.PUSHER_CLUSTER || "ap1",
      useTLS: process.env.PUSHER_USE_TLS !== "false"
    }) : null;
    if (isPusherConfigured) {
      console.log(
        "\u{1F4E1} [Pusher] K\u1EBFt n\u1ED1i d\u1ECBch v\u1EE5 Pusher th\xE0nh c\xF4ng (Cluster:",
        process.env.PUSHER_CLUSTER || "ap1",
        ")"
      );
    } else {
      console.log(
        "\u{1F4E1} [Pusher] Ch\u1EBF \u0111\u1ED9 DEV MOCK: Ch\u01B0a c\u1EA5u h\xECnh Pusher Key. S\u1EF1 ki\u1EC7n Realtime s\u1EBD \u0111\u01B0\u1EE3c m\xF4 ph\u1ECFng log console."
      );
    }
    eventBuffer = [];
    MAX_BUFFER_SIZE = 200;
  }
});

// src/api/router.ts
import express from "express";

// src/api/routes/auth.ts
import { Router } from "express";
import { eq as eq2, or, ilike } from "drizzle-orm";

// src/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as dotenv from "dotenv";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  accountStatusEnum: () => accountStatusEnum,
  b2bCustomers: () => b2bCustomers,
  bookingMessages: () => bookingMessages,
  bookingStatusEnum: () => bookingStatusEnum,
  bookings: () => bookings,
  callLogs: () => callLogs,
  complaintStatusEnum: () => complaintStatusEnum,
  complaints: () => complaints,
  customerAddresses: () => customerAddresses,
  driverDocTypeEnum: () => driverDocTypeEnum,
  driverDocuments: () => driverDocuments,
  driverLocations: () => driverLocations,
  driverProfiles: () => driverProfiles,
  driverRatings: () => driverRatings,
  kycStatusEnum: () => kycStatusEnum,
  notificationTypeEnum: () => notificationTypeEnum,
  notifications: () => notifications,
  otpVerifications: () => otpVerifications,
  paymentMethodEnum: () => paymentMethodEnum,
  paymentStatusEnum: () => paymentStatusEnum,
  paymentTransactions: () => paymentTransactions,
  pricingRules: () => pricingRules,
  surchargeServices: () => surchargeServices,
  userDevices: () => userDevices,
  userRoleEnum: () => userRoleEnum,
  users: () => users,
  vehicleTypes: () => vehicleTypes,
  walletTransactions: () => walletTransactions,
  wallets: () => wallets
});
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  decimal,
  integer,
  pgEnum,
  jsonb,
  geometry,
  index
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
var userRoleEnum = pgEnum("user_role", ["CUSTOMER", "DRIVER", "ADMIN"]);
var accountStatusEnum = pgEnum("account_status", [
  "ACTIVE",
  "BLOCKED",
  "PENDING"
]);
var kycStatusEnum = pgEnum("kyc_status", [
  "PENDING",
  "APPROVED",
  "REJECTED"
]);
var bookingStatusEnum = pgEnum("booking_status", [
  "PENDING",
  "SEARCHING",
  "ACCEPTED",
  "ARRIVED_AT_PICKUP",
  "IN_TRANSIT",
  "COMPLETED",
  "CANCELLED"
]);
var paymentMethodEnum = pgEnum("payment_method", [
  "CASH",
  "WALLET",
  "VNPAY",
  "MOMO"
]);
var paymentStatusEnum = pgEnum("payment_status", [
  "UNPAID",
  "PAID",
  "REFUNDED"
]);
var driverDocTypeEnum = pgEnum("driver_doc_type", [
  "CCCD_FRONT",
  "CCCD_BACK",
  "DRIVER_LICENSE",
  "VEHICLE_REGISTRATION",
  "PORTRAIT"
]);
var complaintStatusEnum = pgEnum("complaint_status", [
  "PENDING",
  "PROCESSING",
  "RESOLVED",
  "REJECTED"
]);
var notificationTypeEnum = pgEnum("notification_type", [
  "order",
  "chat",
  "promo",
  "system"
]);
var users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  email: varchar("email", { length: 100 }).unique(),
  passwordHash: varchar("password_hash", { length: 255 }),
  pinHash: varchar("pin_hash", { length: 255 }),
  fullName: varchar("full_name", { length: 100 }),
  avatarUrl: text("avatar_url"),
  role: userRoleEnum("role").notNull().default("CUSTOMER"),
  status: accountStatusEnum("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});
var vehicleTypes = pgTable("vehicle_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  payloadCapacityKg: decimal("payload_capacity_kg", {
    precision: 10,
    scale: 2
  }).notNull(),
  dimensionsLxwxh: jsonb("dimensions_lxwxh"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});
var driverProfiles = pgTable("driver_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  vehicleTypeId: uuid("vehicle_type_id").references(() => vehicleTypes.id),
  licensePlate: varchar("license_plate", { length: 20 }).unique(),
  driverLicenseNo: varchar("driver_license_no", { length: 50 }).unique(),
  kycStatus: kycStatusEnum("kyc_status").default("PENDING"),
  rejectionReason: text("rejection_reason"),
  ratingAvg: decimal("rating_avg", { precision: 3, scale: 2 }).default("5.00"),
  isOnline: boolean("is_online").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});
var driverDocuments = pgTable(
  "driver_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    driverId: uuid("driver_id").notNull().references(() => driverProfiles.id, { onDelete: "cascade" }),
    docType: driverDocTypeEnum("doc_type").notNull(),
    fileUrl: text("file_url").notNull(),
    docNumber: varchar("doc_number", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
  },
  (table) => {
    return {
      driverDocIdx: index("idx_driver_documents_driver_id").on(table.driverId)
    };
  }
);
var customerAddresses = pgTable("customer_addresses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 100 }),
  addressText: text("address_text").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  contactName: varchar("contact_name", { length: 100 }),
  contactPhone: varchar("contact_phone", { length: 20 }),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});
var otpVerifications = pgTable(
  "otp_verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phone: varchar("phone", { length: 20 }).notNull(),
    otpCode: varchar("otp_code", { length: 10 }).notNull(),
    attempts: integer("attempts").default(0).notNull(),
    isUsed: boolean("is_used").default(false).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
  },
  (table) => {
    return {
      phoneIdx: index("idx_otp_verifications_phone").on(table.phone),
      ipCreatedIdx: index("idx_otp_verifications_ip_created").on(
        table.ipAddress,
        table.createdAt
      ),
      phoneCreatedIdx: index("idx_otp_verifications_phone_created").on(
        table.phone,
        table.createdAt
      )
    };
  }
);
var driverLocations = pgTable(
  "driver_locations",
  {
    driverId: uuid("driver_id").primaryKey().references(() => driverProfiles.id, { onDelete: "cascade" }),
    locationPoint: geometry("location_point", {
      type: "point",
      mode: "xy",
      srid: 4326
    }).notNull(),
    heading: decimal("heading", { precision: 5, scale: 2 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
  },
  (table) => {
    return {
      locationPointIdx: index("idx_driver_locations_point").using(
        "gist",
        table.locationPoint
      )
    };
  }
);
var pricingRules = pgTable("pricing_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  vehicleTypeId: uuid("vehicle_type_id").notNull().unique().references(() => vehicleTypes.id),
  basePrice: decimal("base_price", { precision: 12, scale: 2 }).notNull(),
  baseDistanceKm: decimal("base_distance_km", {
    precision: 5,
    scale: 2
  }).notNull(),
  pricePerKm: decimal("price_per_km", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});
var surchargeServices = pgTable("surcharge_services", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});
var b2bCustomers = pgTable(
  "b2b_customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    companyName: varchar("company_name", { length: 200 }).notNull(),
    taxCode: varchar("tax_code", { length: 50 }).notNull().unique(),
    businessAddress: text("business_address").notNull(),
    contactName: varchar("contact_name", { length: 100 }).notNull(),
    contactPhone: varchar("contact_phone", { length: 20 }).notNull(),
    invoiceEmail: varchar("invoice_email", { length: 100 }),
    creditLimit: decimal("credit_limit", { precision: 15, scale: 2 }).default(
      "0"
    ),
    currentDebt: decimal("current_debt", { precision: 15, scale: 2 }).default(
      "0"
    ),
    paymentTermDays: integer("payment_term_days").default(30),
    discountPercent: decimal("discount_percent", {
      precision: 5,
      scale: 2
    }).default("0"),
    status: varchar("status", { length: 20 }).default("ACTIVE"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
  },
  (table) => {
    return {
      taxCodeIdx: index("idx_b2b_customers_tax_code").on(table.taxCode),
      statusIdx: index("idx_b2b_customers_status").on(table.status)
    };
  }
);
var bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingCode: varchar("booking_code", { length: 50 }).notNull().unique(),
    customerId: uuid("customer_id").notNull().references(() => users.id),
    driverId: uuid("driver_id").references(() => driverProfiles.id),
    vehicleTypeId: uuid("vehicle_type_id").notNull().references(() => vehicleTypes.id),
    status: bookingStatusEnum("status").default("PENDING"),
    originAddress: text("origin_address").notNull(),
    originPoint: geometry("origin_point", {
      type: "point",
      mode: "xy",
      srid: 4326
    }).notNull(),
    destinationAddress: text("destination_address").notNull(),
    destinationPoint: geometry("destination_point", {
      type: "point",
      mode: "xy",
      srid: 4326
    }).notNull(),
    distanceKm: decimal("distance_km", { precision: 10, scale: 2 }).notNull(),
    basePrice: decimal("base_price", { precision: 12, scale: 2 }).notNull(),
    surchargePrice: decimal("surcharge_price", {
      precision: 12,
      scale: 2
    }).default("0"),
    totalPrice: decimal("total_price", { precision: 12, scale: 2 }).notNull(),
    driverCommission: decimal("driver_commission", {
      precision: 12,
      scale: 2
    }).notNull(),
    paymentMethod: paymentMethodEnum("payment_method").default("CASH"),
    paymentStatus: paymentStatusEnum("payment_status").default("UNPAID"),
    // Sprint 3: Lưu vết hủy đơn & Bằng chứng giao hàng POD
    cancelledBy: varchar("cancelled_by", { length: 20 }),
    cancellationReason: text("cancellation_reason"),
    cancellationFee: decimal("cancellation_fee", {
      precision: 12,
      scale: 2
    }).default("0"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    pickupProofImage: text("pickup_proof_image"),
    deliveryProofImage: text("delivery_proof_image"),
    // Chính sách hủy chuyến mới: Ghi nhận thời điểm nhận đơn và khoảng cách ban đầu
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    initialDistanceToPickup: decimal("initial_distance_to_pickup", { precision: 10, scale: 2 }),
    // Sprint 3.5: Chống gian lận hoàn thành cuốc (Anti-Fraud)
    deliveryOtp: varchar("delivery_otp", { length: 10 }),
    completedLat: decimal("completed_lat", { precision: 10, scale: 7 }),
    completedLng: decimal("completed_lng", { precision: 10, scale: 7 }),
    inTransitAt: timestamp("in_transit_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
  },
  (table) => {
    return {
      originPointIdx: index("idx_bookings_origin_point").using(
        "gist",
        table.originPoint
      )
    };
  }
);
var wallets = pgTable("wallets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0"),
  lockedBalance: decimal("locked_balance", { precision: 15, scale: 2 }).default(
    "0"
  ),
  minDepositLimit: decimal("min_deposit_limit", {
    precision: 15,
    scale: 2
  }).default("200000"),
  currency: varchar("currency", { length: 10 }).default("VND"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});
var walletTransactions = pgTable("wallet_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  walletId: uuid("wallet_id").notNull().references(() => wallets.id),
  bookingId: uuid("booking_id").references(() => bookings.id),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  balanceBefore: decimal("balance_before", { precision: 15, scale: 2 }),
  balanceAfter: decimal("balance_after", { precision: 15, scale: 2 }),
  type: varchar("type", { length: 50 }).notNull(),
  description: text("description"),
  referenceCode: varchar("reference_code", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});
var userDevices = pgTable(
  "user_devices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    fcmToken: text("fcm_token").notNull(),
    deviceType: varchar("device_type", { length: 20 }).default("WEB"),
    deviceName: varchar("device_name", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
  },
  (table) => {
    return {
      userIdIdx: index("idx_user_devices_user_id").on(table.userId),
      fcmTokenIdx: index("idx_user_devices_fcm_token").on(table.fcmToken)
    };
  }
);
var paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id").references(() => bookings.id),
    walletId: uuid("wallet_id").references(() => wallets.id),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    gateway: varchar("gateway", { length: 20 }).notNull(),
    // 'VNPAY', 'MOMO'
    transactionCode: varchar("transaction_code", { length: 100 }).notNull().unique(),
    gatewayRefId: varchar("gateway_ref_id", { length: 100 }),
    status: varchar("status", { length: 20 }).default("PENDING"),
    // 'PENDING', 'SUCCESS', 'FAILED'
    paymentUrl: text("payment_url"),
    description: text("description"),
    rawResponse: jsonb("raw_response"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
  },
  (table) => {
    return {
      txCodeIdx: index("idx_payment_transactions_code").on(
        table.transactionCode
      ),
      userIdIdx: index("idx_payment_transactions_user_id").on(table.userId),
      bookingIdIdx: index("idx_payment_transactions_booking_id").on(
        table.bookingId
      )
    };
  }
);
var bookingMessages = pgTable(
  "booking_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    messageType: varchar("message_type", { length: 20 }).default("TEXT"),
    // 'TEXT', 'IMAGE', 'LOCATION'
    content: text("content"),
    mediaUrl: text("media_url"),
    isRead: boolean("is_read").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
  },
  (table) => {
    return {
      bookingIdx: index("idx_booking_messages_booking_id").on(table.bookingId),
      senderIdx: index("idx_booking_messages_sender_id").on(table.senderId)
    };
  }
);
var callLogs = pgTable(
  "call_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    callerId: uuid("caller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    receiverId: uuid("receiver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    stringeeCallId: varchar("stringee_call_id", { length: 100 }),
    callStatus: varchar("call_status", { length: 30 }).default("STARTED"),
    // 'STARTED', 'RINGING', 'ANSWERED', 'ENDED', 'BUSY', 'MISSED', 'FAILED'
    durationSeconds: integer("duration_seconds").default(0),
    recordUrl: text("record_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
  },
  (table) => {
    return {
      bookingIdx: index("idx_call_logs_booking_id").on(table.bookingId),
      callerIdx: index("idx_call_logs_caller_id").on(table.callerId),
      receiverIdx: index("idx_call_logs_receiver_id").on(table.receiverId),
      callIdIdx: index("idx_call_logs_stringee_call_id").on(
        table.stringeeCallId
      )
    };
  }
);
var driverRatings = pgTable(
  "driver_ratings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    driverId: uuid("driver_id").notNull().references(() => driverProfiles.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => users.id, {
      onDelete: "set null"
    }),
    rating: integer("rating").notNull(),
    tags: text("tags").array().default(sql`'{}'::text[]`),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
  },
  (table) => {
    return {
      driverIdx: index("idx_driver_ratings_driver_id").on(table.driverId),
      customerIdx: index("idx_driver_ratings_customer_id").on(table.customerId),
      ratingIdx: index("idx_driver_ratings_rating").on(table.rating),
      createdIdx: index("idx_driver_ratings_created_at").on(table.createdAt)
    };
  }
);
var complaints = pgTable(
  "complaints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id").references(() => bookings.id, {
      onDelete: "set null"
    }),
    driverId: uuid("driver_id").references(() => driverProfiles.id, {
      onDelete: "set null"
    }),
    category: varchar("category", { length: 50 }).notNull(),
    description: text("description").notNull(),
    estimatedLoss: varchar("estimated_loss", { length: 100 }),
    proofImageUrls: text("proof_image_urls").array().default(sql`'{}'::text[]`),
    status: complaintStatusEnum("status").default("PENDING").notNull(),
    adminNotes: text("admin_notes"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
  },
  (table) => {
    return {
      userIdx: index("idx_complaints_user_id").on(table.userId),
      bookingIdx: index("idx_complaints_booking_id").on(table.bookingId),
      statusIdx: index("idx_complaints_status").on(table.status),
      createdIdx: index("idx_complaints_created_at").on(table.createdAt)
    };
  }
);
var notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    type: notificationTypeEnum("type").default("system").notNull(),
    data: jsonb("data"),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
  },
  (table) => {
    return {
      userIdx: index("idx_notifications_user_id").on(table.userId),
      userUnreadIdx: index("idx_notifications_user_unread").on(
        table.userId,
        table.isRead
      ),
      createdIdx: index("idx_notifications_created_at").on(table.createdAt)
    };
  }
);

// src/db/index.ts
dotenv.config();
var connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres";
var client = postgres(connectionString, { prepare: false });
var db = drizzle(client, { schema: schema_exports });

// src/lib/hash.ts
import bcrypt from "bcryptjs";
var SALT_ROUNDS = 10;
var hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
};
var comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

// src/lib/auth.ts
import jwt from "jsonwebtoken";
import * as dotenv2 from "dotenv";
dotenv2.config();
function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "FATAL: JWT_SECRET ch\u01B0a \u0111\u01B0\u1EE3c c\u1EA5u h\xECnh trong bi\u1EBFn m\xF4i tr\u01B0\u1EDDng (.env) cho production"
    );
  }
  return "super-secret-key-for-truck-booking-app";
}
var JWT_SECRET = process.env.JWT_SECRET?.trim() || "super-secret-key-for-truck-booking-app";
var JWT_EXPIRES_IN = "7d";
var generateToken = (payload) => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
};
var verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    return decoded;
  } catch (error) {
    throw new Error("Token kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c \u0111\xE3 h\u1EBFt h\u1EA1n");
  }
};

// src/lib/otpService.ts
import { eq, and, desc, gt } from "drizzle-orm";

// src/lib/sms/types.ts
function validateAndNormalizePhone(rawPhone) {
  if (!rawPhone || typeof rawPhone !== "string") {
    return {
      valid: false,
      standardPhone: "",
      e164Phone: "",
      error: "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng"
    };
  }
  let clean = rawPhone.replace(/[\s\-\.\(\)]/g, "");
  if (clean.startsWith("+84")) {
    clean = "0" + clean.slice(3);
  } else if (clean.startsWith("84") && clean.length === 11) {
    clean = "0" + clean.slice(2);
  }
  const vnPhoneRegex = /^(0)(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/;
  if (!vnPhoneRegex.test(clean)) {
    return {
      valid: false,
      standardPhone: "",
      e164Phone: "",
      error: "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i kh\xF4ng \u0111\xFAng \u0111\u1ECBnh d\u1EA1ng di \u0111\u1ED9ng Vi\u1EC7t Nam (g\u1ED3m 10 ch\u1EEF s\u1ED1, \u0111\u1EA7u 03, 05, 07, 08, 09)"
    };
  }
  const e164 = "+84" + clean.slice(1);
  return {
    valid: true,
    standardPhone: clean,
    e164Phone: e164
  };
}

// src/lib/sms/mock.ts
var MockSmsProvider = class {
  name = "MockSmsProvider";
  async sendOtp(phone, otp) {
    const timestamp2 = (/* @__PURE__ */ new Date()).toLocaleTimeString("vi-VN");
    console.log(
      "\n================== [MOCK SMS OTP GATEWAY] =================="
    );
    console.log(`\u23F0 Th\u1EDDi gian: ${timestamp2}`);
    console.log(`\u{1F4F1} Ng\u01B0\u1EDDi nh\u1EADn (S\u0110T): ${phone}`);
    console.log(`\u{1F511} M\xE3 OTP x\xE1c th\u1EF1c: [ ${otp} ]`);
    console.log(
      `\u{1F4AC} N\u1ED9i dung: [DATXETAI] Ma xac thuc OTP cua ban la ${otp}. Hieu luc trong 5 phut.`
    );
    console.log(
      "============================================================\n"
    );
    return {
      success: true,
      messageId: `mock-msg-${Date.now()}`
    };
  }
};

// src/lib/sms/esms.ts
var EsmsProvider = class {
  name = "EsmsProvider";
  apiKey;
  secretKey;
  brandname;
  constructor() {
    this.apiKey = process.env.ESMS_API_KEY || "";
    this.secretKey = process.env.ESMS_SECRET_KEY || "";
    this.brandname = process.env.ESMS_BRANDNAME || "Baotam";
  }
  async sendOtp(phone, otp) {
    if (!this.apiKey || !this.secretKey) {
      console.warn("[eSMS] Thi\u1EBFu ESMS_API_KEY ho\u1EB7c ESMS_SECRET_KEY trong .env");
      return {
        success: false,
        error: "Ch\u01B0a c\u1EA5u h\xECnh t\xE0i kho\u1EA3n eSMS tr\xEAn h\u1EC7 th\u1ED1ng"
      };
    }
    try {
      const content = `Ma xac thuc OTP cua ban la ${otp}. Ma co hieu luc trong 5 phut. Khong chia se ma nay cho bat ky ai.`;
      const url = "https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json";
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ApiKey: this.apiKey,
          SecretKey: this.secretKey,
          Phone: phone,
          Content: content,
          SmsType: "2",
          // 2: Tin nhắn Brandname CSKH / OTP
          Brandname: this.brandname,
          IsUnicode: "0",
          Sandbox: process.env.NODE_ENV === "production" ? "0" : "1"
        })
      });
      const data = await response.json();
      if (data.CodeResult === "100") {
        return {
          success: true,
          messageId: data.SMSID
        };
      } else {
        console.error("[eSMS Error]", data);
        return {
          success: false,
          error: data.ErrorMessage || `eSMS tr\u1EA3 v\u1EC1 m\xE3 l\u1ED7i: ${data.CodeResult}`
        };
      }
    } catch (error) {
      console.error("[eSMS Network Error]", error);
      return {
        success: false,
        error: error.message || "L\u1ED7i k\u1EBFt n\u1ED1i t\u1EDBi c\u1ED5ng eSMS"
      };
    }
  }
};

// src/lib/sms/vietguys.ts
var VietGuysProvider = class {
  name = "VietGuysProvider";
  username;
  password;
  brandname;
  constructor() {
    this.username = process.env.VIETGUYS_USERNAME || "";
    this.password = process.env.VIETGUYS_PASSWORD || "";
    this.brandname = process.env.VIETGUYS_BRANDNAME || "DATXETAI";
  }
  async sendOtp(phone, otp) {
    if (!this.username || !this.password) {
      console.warn(
        "[VietGuys] Thi\u1EBFu VIETGUYS_USERNAME ho\u1EB7c VIETGUYS_PASSWORD trong .env"
      );
      return {
        success: false,
        error: "Ch\u01B0a c\u1EA5u h\xECnh t\xE0i kho\u1EA3n VietGuys tr\xEAn h\u1EC7 th\u1ED1ng"
      };
    }
    try {
      const content = `Ma xac thuc OTP cua ban la ${otp}. Hieu luc trong 5 phut. Khong chia se ma nay.`;
      const url = "https://cloudsms.vietguys.biz:4438/api/index.php";
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          u: this.username,
          pwd: this.password,
          from: this.brandname,
          phone,
          sms: content,
          json: "1"
        }).toString()
      });
      const data = await response.json();
      if (data.error === 0) {
        return {
          success: true,
          messageId: data.log_id
        };
      } else {
        console.error("[VietGuys Error]", data);
        return {
          success: false,
          error: data.message || `VietGuys tr\u1EA3 v\u1EC1 m\xE3 l\u1ED7i: ${data.error}`
        };
      }
    } catch (error) {
      console.error("[VietGuys Network Error]", error);
      return {
        success: false,
        error: error.message || "L\u1ED7i k\u1EBFt n\u1ED1i t\u1EDBi c\u1ED5ng VietGuys"
      };
    }
  }
};

// src/lib/sms/index.ts
var cachedProvider = null;
function getSmsProvider() {
  if (cachedProvider) {
    return cachedProvider;
  }
  const providerType = (process.env.SMS_PROVIDER || "mock").toLowerCase().trim();
  switch (providerType) {
    case "esms":
      cachedProvider = new EsmsProvider();
      break;
    case "vietguys":
      cachedProvider = new VietGuysProvider();
      break;
    case "mock":
    default:
      cachedProvider = new MockSmsProvider();
      break;
  }
  return cachedProvider;
}

// src/lib/geoIp.ts
import geoip from "geoip-lite";

// src/lib/ipUtils.ts
function getClientIp(req) {
  const cfIp = req.headers["cf-connecting-ip"];
  if (typeof cfIp === "string" && cfIp.trim()) {
    return normalizeIp(cfIp.trim());
  }
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (typeof xForwardedFor === "string" && xForwardedFor.trim()) {
    const firstIp = xForwardedFor.split(",")[0].trim();
    if (firstIp) {
      return normalizeIp(firstIp);
    }
  }
  const xRealIp = req.headers["x-real-ip"];
  if (typeof xRealIp === "string" && xRealIp.trim()) {
    return normalizeIp(xRealIp.trim());
  }
  const socketIp = req.ip || req.socket?.remoteAddress || "127.0.0.1";
  return normalizeIp(socketIp);
}
function normalizeIp(ip) {
  let clean = ip.trim();
  if (clean.startsWith("::ffff:")) {
    clean = clean.replace("::ffff:", "");
  }
  return clean;
}
function isPrivateOrLocalIp(ip) {
  const normalized = normalizeIp(ip);
  if (normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost") {
    return true;
  }
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)) {
    return true;
  }
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(normalized)) {
    return true;
  }
  const match172 = normalized.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (match172) {
    const secondOctet = parseInt(match172[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }
  return false;
}

// src/lib/geoIp.ts
function checkVietnamIp(ip, options = {}) {
  const cleanIp = normalizeIp(ip);
  const { bypassPrivateIps = true, forceStrictCheck = false } = options;
  if (isPrivateOrLocalIp(cleanIp)) {
    if (forceStrictCheck) {
      return {
        allowed: false,
        country: "PRIVATE",
        ip: cleanIp,
        reason: "IP n\u1ED9i b\u1ED9 kh\xF4ng \u0111\u01B0\u1EE3c ch\u1EA5p nh\u1EADn trong ch\u1EBF \u0111\u1ED9 ki\u1EC3m tra nghi\xEAm ng\u1EB7t"
      };
    }
    if (bypassPrivateIps) {
      return {
        allowed: true,
        country: "VN",
        ip: cleanIp
      };
    }
  }
  const geo = geoip.lookup(cleanIp);
  const country = geo?.country || null;
  if (country === "VN") {
    return {
      allowed: true,
      country: "VN",
      ip: cleanIp
    };
  }
  return {
    allowed: false,
    country,
    ip: cleanIp,
    reason: `D\u1ECBch v\u1EE5 ch\u1EC9 ph\u1EE5c v\u1EE5 t\u1EA1i Vi\u1EC7t Nam. \u0110\u1ECBa ch\u1EC9 IP c\u1EE7a b\u1EA1n thu\u1ED9c qu\u1ED1c gia: ${country || "Kh\xF4ng x\xE1c \u0111\u1ECBnh"}`
  };
}

// src/lib/otpService.ts
function generateOtpCode() {
  if (process.env.NODE_ENV !== "production" && process.env.ENABLE_OTP_MOCK === "true") {
    return "123456";
  }
  const randomNum = Math.floor(1e5 + Math.random() * 9e5);
  return randomNum.toString();
}
async function requestOtp(rawPhone, clientIp, options) {
  const phoneValidation = validateAndNormalizePhone(rawPhone);
  if (!phoneValidation.valid) {
    throw new Error(phoneValidation.error || "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i kh\xF4ng h\u1EE3p l\u1EC7");
  }
  const phone = phoneValidation.standardPhone;
  const now = /* @__PURE__ */ new Date();
  if (options?.purpose === "register") {
    const [existing] = await db.select({ id: users.id, passwordHash: users.passwordHash }).from(users).where(eq(users.phone, phone)).limit(1);
    if (existing && existing.passwordHash) {
      throw new Error(
        "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c \u0111\u0103ng k\xFD t\xE0i kho\u1EA3n. Vui l\xF2ng chuy\u1EC3n sang tab \u0110\u0103ng nh\u1EADp."
      );
    }
  }
  if (clientIp) {
    const geoCheck = checkVietnamIp(clientIp, {
      forceStrictCheck: options?.forceStrictGeoIp
    });
    if (!geoCheck.allowed) {
      throw new Error(
        "FORBIDDEN: D\u1ECBch v\u1EE5 ch\u1EC9 ph\u1EE5c v\u1EE5 t\u1EA1i Vi\u1EC7t Nam. Kh\xF4ng h\u1ED7 tr\u1EE3 g\u1EEDi OTP t\u1EEB \u0111\u1ECBa ch\u1EC9 IP qu\u1ED1c t\u1EBF."
      );
    }
  }
  if (clientIp) {
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1e3);
    const recentIpOtps = await db.select({ phone: otpVerifications.phone }).from(otpVerifications).where(
      and(
        eq(otpVerifications.ipAddress, clientIp),
        gt(otpVerifications.createdAt, fifteenMinutesAgo)
      )
    );
    const uniquePhonesForIp = new Set(recentIpOtps.map((r) => r.phone));
    if (uniquePhonesForIp.size >= 3 && !uniquePhonesForIp.has(phone)) {
      throw new Error(
        "\u0110\u1ECBa ch\u1EC9 m\u1EA1ng c\u1EE7a b\u1EA1n \u0111ang y\xEAu c\u1EA7u m\xE3 OTP cho qu\xE1 nhi\u1EC1u s\u1ED1 \u0111i\u1EC7n tho\u1EA1i. Vui l\xF2ng th\u1EED l\u1EA1i sau 15 ph\xFAt."
      );
    }
  }
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
  const dailyOtps = await db.select().from(otpVerifications).where(
    and(
      eq(otpVerifications.phone, phone),
      gt(otpVerifications.createdAt, twentyFourHoursAgo)
    )
  );
  if (dailyOtps.length >= 5) {
    throw new Error(
      "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i n\xE0y \u0111\xE3 \u0111\u1EA1t gi\u1EDBi h\u1EA1n 5 l\u1EA7n nh\u1EADn m\xE3 OTP trong 24 gi\u1EDD. Vui l\xF2ng th\u1EED l\u1EA1i v\xE0o ng\xE0y mai \u0111\u1EC3 \u0111\u1EA3m b\u1EA3o an to\xE0n."
    );
  }
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1e3);
  const recentOtps = dailyOtps.filter(
    (otp) => otp.createdAt && otp.createdAt > tenMinutesAgo
  );
  if (recentOtps.length >= 3) {
    throw new Error(
      "B\u1EA1n \u0111\xE3 y\xEAu c\u1EA7u g\u1EEDi m\xE3 qu\xE1 3 l\u1EA7n trong 10 ph\xFAt. Vui l\xF2ng \u0111\u1EE3i th\xEAm tr\u01B0\u1EDBc khi th\u1EED l\u1EA1i."
    );
  }
  if (recentOtps.length > 0) {
    const sorted = [...recentOtps].sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
    const lastOtp = sorted[0];
    if (lastOtp.createdAt) {
      const elapsedSeconds = Math.floor(
        (now.getTime() - lastOtp.createdAt.getTime()) / 1e3
      );
      if (elapsedSeconds < 60) {
        const waitSeconds = 60 - elapsedSeconds;
        throw new Error(
          `Vui l\xF2ng \u0111\u1EE3i th\xEAm ${waitSeconds} gi\xE2y n\u1EEFa \u0111\u1EC3 g\u1EEDi l\u1EA1i m\xE3 OTP.`
        );
      }
    }
  }
  const otpCode = generateOtpCode();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1e3);
  const smsProvider = getSmsProvider();
  const sendResult = await smsProvider.sendOtp(phone, otpCode);
  if (!sendResult.success) {
    console.error(
      `[OTP Error] Kh\xF4ng th\u1EC3 g\u1EEDi SMS t\u1EDBi ${phone}:`,
      sendResult.error
    );
    throw new Error(
      sendResult.error || "Kh\xF4ng th\u1EC3 g\u1EEDi tin nh\u1EAFn OTP. Vui l\xF2ng th\u1EED l\u1EA1i sau."
    );
  }
  await db.insert(otpVerifications).values({
    phone,
    otpCode,
    attempts: 0,
    isUsed: false,
    expiresAt,
    ipAddress: clientIp || null
  });
  return {
    success: true,
    message: "M\xE3 OTP x\xE1c th\u1EF1c \u0111\xE3 \u0111\u01B0\u1EE3c g\u1EEDi th\xE0nh c\xF4ng.",
    phone,
    retryAfterSeconds: 60
  };
}
async function verifyOtpCodeOnly(rawPhone, inputOtp) {
  const phoneValidation = validateAndNormalizePhone(rawPhone);
  if (!phoneValidation.valid) {
    throw new Error(phoneValidation.error || "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i kh\xF4ng h\u1EE3p l\u1EC7");
  }
  const phone = phoneValidation.standardPhone;
  const cleanOtp = (inputOtp || "").trim();
  if (!cleanOtp) {
    throw new Error("Vui l\xF2ng nh\u1EADp m\xE3 OTP 6 ch\u1EEF s\u1ED1");
  }
  const now = /* @__PURE__ */ new Date();
  const records = await db.select().from(otpVerifications).where(
    and(
      eq(otpVerifications.phone, phone),
      eq(otpVerifications.isUsed, false)
    )
  ).orderBy(desc(otpVerifications.createdAt)).limit(1);
  if (records.length === 0) {
    throw new Error(
      "Kh\xF4ng t\xECm th\u1EA5y y\xEAu c\u1EA7u OTP ho\u1EB7c m\xE3 \u0111\xE3 \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng. Vui l\xF2ng b\u1EA5m g\u1EEDi l\u1EA1i m\xE3."
    );
  }
  const otpRecord = records[0];
  if (otpRecord.expiresAt < now) {
    throw new Error(
      "M\xE3 OTP \u0111\xE3 h\u1EBFt h\u1EA1n (ch\u1EC9 c\xF3 hi\u1EC7u l\u1EF1c trong 5 ph\xFAt). Vui l\xF2ng y\xEAu c\u1EA7u m\xE3 m\u1EDBi."
    );
  }
  if (otpRecord.attempts >= 5) {
    throw new Error(
      "B\u1EA1n \u0111\xE3 nh\u1EADp sai m\xE3 qu\xE1 5 l\u1EA7n. M\xE3 n\xE0y \u0111\xE3 b\u1ECB kh\xF3a v\xEC l\xFD do an to\xE0n, vui l\xF2ng y\xEAu c\u1EA7u m\xE3 m\u1EDBi."
    );
  }
  if (cleanOtp !== otpRecord.otpCode) {
    const nextAttempts = otpRecord.attempts + 1;
    await db.update(otpVerifications).set({ attempts: nextAttempts }).where(eq(otpVerifications.id, otpRecord.id));
    const remaining = 5 - nextAttempts;
    if (remaining > 0) {
      throw new Error(
        `M\xE3 OTP kh\xF4ng ch\xEDnh x\xE1c. B\u1EA1n c\xF2n ${remaining} l\u1EA7n th\u1EED l\u1EA1i.`
      );
    } else {
      throw new Error(
        "B\u1EA1n \u0111\xE3 nh\u1EADp sai qu\xE1 5 l\u1EA7n. M\xE3 OTP n\xE0y \u0111\xE3 b\u1ECB v\xF4 hi\u1EC7u h\xF3a."
      );
    }
  }
  await db.update(otpVerifications).set({ isUsed: true }).where(eq(otpVerifications.id, otpRecord.id));
  return { phone };
}
async function verifyOtp(rawPhone, inputOtp, desiredRole, fullName) {
  const { phone } = await verifyOtpCodeOnly(rawPhone, inputOtp);
  const existingUsers = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  let userRecord;
  let isNewUser = false;
  const targetRole = desiredRole === "DRIVER" ? "DRIVER" : "CUSTOMER";
  if (existingUsers.length === 0) {
    const insertedUsers = await db.insert(users).values({
      phone,
      fullName: fullName?.trim() || null,
      role: targetRole,
      status: "ACTIVE"
    }).returning();
    userRecord = insertedUsers[0];
    isNewUser = true;
  } else {
    userRecord = existingUsers[0];
    if (fullName?.trim() && !userRecord.fullName) {
      const [updated] = await db.update(users).set({ fullName: fullName.trim(), updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, userRecord.id)).returning();
      if (updated) userRecord = updated;
    }
    if (userRecord.status === "BLOCKED") {
      throw new Error(
        "T\xE0i kho\u1EA3n c\u1EE7a b\u1EA1n \u0111\xE3 b\u1ECB kh\xF3a. Vui l\xF2ng li\xEAn h\u1EC7 b\u1ED9 ph\u1EADn h\u1ED7 tr\u1EE3 kh\xE1ch h\xE0ng."
      );
    }
  }
  if (userRecord.role === "DRIVER") {
    const existingProfiles = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, userRecord.id)).limit(1);
    if (existingProfiles.length === 0) {
      await db.insert(driverProfiles).values({
        userId: userRecord.id,
        kycStatus: "PENDING",
        isOnline: false,
        isActive: true
      });
    }
  }
  const token = generateToken({
    userId: userRecord.id,
    role: userRecord.role,
    phone: userRecord.phone
  });
  return {
    success: true,
    message: isNewUser ? "\u0110\u0103ng k\xFD t\xE0i kho\u1EA3n th\xE0nh c\xF4ng!" : "\u0110\u0103ng nh\u1EADp th\xE0nh c\xF4ng!",
    token,
    isNewUser,
    user: {
      id: userRecord.id,
      phone: userRecord.phone,
      fullName: userRecord.fullName,
      role: userRecord.role,
      avatarUrl: userRecord.avatarUrl
    }
  };
}

// src/lib/phoneValidation.ts
function validateVietnamesePhone(rawPhone) {
  if (!rawPhone || typeof rawPhone !== "string" || !rawPhone.trim()) {
    return {
      valid: false,
      phone: "",
      e164: "",
      error: "Vui l\xF2ng nh\u1EADp s\u1ED1 \u0111i\u1EC7n tho\u1EA1i"
    };
  }
  let clean = rawPhone.trim().replace(/[\s\-\.\(\)]/g, "");
  if (clean.startsWith("+84")) {
    clean = "0" + clean.slice(3);
  } else if (clean.startsWith("84") && clean.length === 11) {
    clean = "0" + clean.slice(2);
  }
  if (!/^\d+$/.test(clean)) {
    return {
      valid: false,
      phone: clean,
      e164: "",
      error: "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i ch\u1EC9 \u0111\u01B0\u1EE3c ch\u1EE9a c\xE1c ch\u1EEF s\u1ED1 (0-9)"
    };
  }
  if (clean.length < 10) {
    return {
      valid: false,
      phone: clean,
      e164: "",
      error: `S\u1ED1 \u0111i\u1EC7n tho\u1EA1i c\xF2n thi\u1EBFu (${clean.length}/10 s\u1ED1). Vui l\xF2ng nh\u1EADp \u0111\u1EE7 10 s\u1ED1.`
    };
  }
  if (clean.length > 10) {
    return {
      valid: false,
      phone: clean,
      e164: "",
      error: `S\u1ED1 \u0111i\u1EC7n tho\u1EA1i qu\xE1 d\xE0i (${clean.length} s\u1ED1). S\u1ED1 di \u0111\u1ED9ng Vi\u1EC7t Nam chu\u1EA9n g\u1ED3m 10 ch\u1EEF s\u1ED1.`
    };
  }
  const vnMobileRegex = /^0(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])\d{7}$/;
  if (!vnMobileRegex.test(clean)) {
    return {
      valid: false,
      phone: clean,
      e164: "",
      error: "\u0110\u1EA7u s\u1ED1 kh\xF4ng \u0111\xFAng m\u1EA1ng di \u0111\u1ED9ng Vi\u1EC7t Nam (h\u1EE3p l\u1EC7 g\u1ED3m \u0111\u1EA7u 03, 05, 07, 08, 09)"
    };
  }
  return {
    valid: true,
    phone: clean,
    e164: "+84" + clean.slice(1)
  };
}

// src/lib/errors.ts
var ApiError = class extends Error {
  statusCode;
  code;
  constructor(statusCode, message, code) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
};

// src/lib/walletService.ts
var DEFAULT_MIN_DEPOSIT_LIMIT = 2e5;
var DEFAULT_COMMISSION_RATE = 0.2;
var DEFAULT_DRIVER_WELCOME_BONUS = 2e5;
async function getOrCreateWallet(userId) {
  if (!userId) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin userId");
  }
  const existing = await client.unsafe(
    `
    SELECT id, user_id, balance, locked_balance, min_deposit_limit, currency, updated_at
    FROM wallets
    WHERE user_id = $1::uuid
    LIMIT 1
    `,
    [userId]
  );
  if (existing.length > 0) {
    return existing[0];
  }
  let initialBalance = 0;
  const userRows = await client.unsafe(
    `SELECT role FROM users WHERE id = $1::uuid LIMIT 1`,
    [userId]
  );
  const isDriver = userRows.length > 0 && userRows[0].role === "DRIVER";
  if (isDriver) {
    initialBalance = DEFAULT_DRIVER_WELCOME_BONUS;
  }
  const created = await client.unsafe(
    `
    INSERT INTO wallets (
      user_id,
      balance,
      locked_balance,
      min_deposit_limit,
      currency,
      updated_at
    ) VALUES (
      $1::uuid,
      $2::numeric,
      0.00,
      $3::numeric,
      'VND',
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
    RETURNING id, user_id, balance, locked_balance, min_deposit_limit, currency, updated_at
    `,
    [userId, initialBalance, DEFAULT_MIN_DEPOSIT_LIMIT]
  );
  const newWallet = created[0];
  if (isDriver && initialBalance > 0 && newWallet) {
    try {
      await client.unsafe(
        `
        INSERT INTO wallet_transactions (
          wallet_id,
          amount,
          balance_before,
          balance_after,
          type,
          description,
          reference_code,
          created_at
        ) VALUES (
          $1::uuid,
          $2::numeric,
          0.00,
          $2::numeric,
          'BONUS',
          $3,
          $4,
          NOW()
        )
        `,
        [
          newWallet.id,
          initialBalance,
          "T\u1EB7ng 200.000\u0111 v\xED k\xFD qu\u1EF9 ch\u1EA1y th\u1EED cho t\xE0i x\u1EBF m\u1EDBi",
          `WELCOME_BONUS_${Date.now()}`
        ]
      );
    } catch (txErr) {
      console.warn("Could not record welcome bonus transaction:", txErr);
    }
  }
  return newWallet;
}
async function getWalletDetails(userId) {
  const wallet = await getOrCreateWallet(userId);
  const balance = Number(wallet.balance || 0);
  const lockedBalance = Number(wallet.locked_balance || 0);
  const availableBalance = balance - lockedBalance;
  const minDepositLimit = Number(
    wallet.min_deposit_limit || DEFAULT_MIN_DEPOSIT_LIMIT
  );
  const topupRows = await client.unsafe(
    `SELECT id FROM wallet_transactions WHERE wallet_id = $1::uuid AND type = 'TOPUP' LIMIT 1`,
    [wallet.id]
  );
  const hasToppedUp = topupRows.length > 0;
  const isTrialBonusPhase = !hasToppedUp && balance > 0;
  const isDepositQualified = isTrialBonusPhase ? availableBalance > 0 : availableBalance >= minDepositLimit;
  const shortfall = isDepositQualified ? 0 : isTrialBonusPhase ? 1 : Math.max(0, minDepositLimit - availableBalance);
  return {
    walletId: wallet.id,
    userId: wallet.user_id,
    balance,
    lockedBalance,
    availableBalance,
    minDepositLimit,
    isDepositQualified,
    isTrialBonusPhase,
    hasToppedUp,
    shortfall,
    currency: wallet.currency || "VND",
    updatedAt: wallet.updated_at
  };
}
async function checkDriverDepositEligibility(driverUserId) {
  const wallet = await getWalletDetails(driverUserId);
  if (!wallet.isDepositQualified) {
    const errorMsg = wallet.isTrialBonusPhase ? `B\u1EA1n \u0111\xE3 s\u1EED d\u1EE5ng h\u1EBFt h\u1EA1n m\u1EE9c v\u1ED1n k\xFD qu\u1EF9 ch\u1EA1y th\u1EED \u0111\u01B0\u1EE3c t\u1EB7ng (S\u1ED1 d\u01B0 hi\u1EC7n t\u1EA1i: ${wallet.availableBalance.toLocaleString("vi-VN")} \u0111). Vui l\xF2ng n\u1EA1p t\u1ED1i thi\u1EC3u ${wallet.minDepositLimit.toLocaleString("vi-VN")} \u0111 \u0111\u1EC3 duy tr\xEC \u0111i\u1EC1u ki\u1EC7n ho\u1EA1t \u0111\u1ED9ng ch\xEDnh th\u1EE9c.` : `S\u1ED1 d\u01B0 v\xED k\xFD qu\u1EF9 kh\u1EA3 d\u1EE5ng (${wallet.availableBalance.toLocaleString("vi-VN")} \u0111) ch\u01B0a \u0111\u1EA1t h\u1EA1n m\u1EE9c t\u1ED1i thi\u1EC3u (${wallet.minDepositLimit.toLocaleString("vi-VN")} \u0111). Vui l\xF2ng n\u1EA1p th\xEAm t\u1ED1i thi\u1EC3u ${wallet.shortfall.toLocaleString("vi-VN")} \u0111 \u0111\u1EC3 nh\u1EADn chuy\u1EBFn.`;
    return {
      eligible: false,
      availableBalance: wallet.availableBalance,
      minDepositLimit: wallet.minDepositLimit,
      shortfall: wallet.shortfall,
      isTrialBonusPhase: wallet.isTrialBonusPhase,
      message: errorMsg
    };
  }
  return {
    eligible: true,
    availableBalance: wallet.availableBalance,
    minDepositLimit: wallet.minDepositLimit,
    shortfall: 0,
    isTrialBonusPhase: wallet.isTrialBonusPhase,
    message: wallet.isTrialBonusPhase ? "\u0110ang s\u1EED d\u1EE5ng v\u1ED1n k\xFD qu\u1EF9 ch\u1EA1y th\u1EED \u0111\u01B0\u1EE3c t\u1EB7ng. Vui l\xF2ng n\u1EA1p th\xEAm khi s\u1ED1 d\u01B0 v\u1EC1 0\u0111." : "V\xED k\xFD qu\u1EF9 \u0111\u1EE7 \u0111i\u1EC1u ki\u1EC7n ho\u1EA1t \u0111\u1ED9ng v\xE0 nh\u1EADn chuy\u1EBFn."
  };
}
async function topUpWallet(dto) {
  const { userId, amount, description, referenceCode } = dto;
  if (!userId) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin userId");
  }
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new ApiError(400, "S\u1ED1 ti\u1EC1n n\u1EA1p ph\u1EA3i l\xE0 s\u1ED1 d\u01B0\u01A1ng l\u1EDBn h\u01A1n 0");
  }
  await getOrCreateWallet(userId);
  return await client.begin(async (sql6) => {
    const walletRows = await sql6`
      SELECT id, user_id, balance, locked_balance, min_deposit_limit
      FROM wallets
      WHERE user_id = ${userId}::uuid
      FOR UPDATE
    `;
    if (walletRows.length === 0) {
      throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y v\xED ng\u01B0\u1EDDi d\xF9ng");
    }
    const currentWallet = walletRows[0];
    const balanceBefore = Number(currentWallet.balance || 0);
    const balanceAfter = balanceBefore + numAmount;
    const updatedWallet = await sql6`
      UPDATE wallets
      SET 
        balance = ${balanceAfter}::numeric,
        updated_at = NOW()
      WHERE id = ${currentWallet.id}::uuid
      RETURNING id, balance, locked_balance, min_deposit_limit, updated_at
    `;
    const refCode = referenceCode || `TOPUP_${Date.now()}_${Math.floor(1e3 + Math.random() * 9e3)}`;
    const desc7 = description || `N\u1EA1p ${numAmount.toLocaleString("vi-VN")} \u0111 v\xE0o v\xED k\xFD qu\u1EF9`;
    const txRows = await sql6`
      INSERT INTO wallet_transactions (
        wallet_id,
        booking_id,
        amount,
        balance_before,
        balance_after,
        type,
        description,
        reference_code,
        created_at
      ) VALUES (
        ${currentWallet.id}::uuid,
        NULL,
        ${numAmount}::numeric,
        ${balanceBefore}::numeric,
        ${balanceAfter}::numeric,
        'TOPUP',
        ${desc7},
        ${refCode},
        NOW()
      )
      RETURNING id, amount, balance_before, balance_after, type, description, reference_code, created_at
    `;
    return {
      success: true,
      transaction: txRows[0],
      wallet: {
        walletId: updatedWallet[0].id,
        balance: Number(updatedWallet[0].balance),
        lockedBalance: Number(updatedWallet[0].locked_balance),
        availableBalance: Number(updatedWallet[0].balance) - Number(updatedWallet[0].locked_balance),
        minDepositLimit: Number(updatedWallet[0].min_deposit_limit)
      },
      message: `N\u1EA1p th\xE0nh c\xF4ng ${numAmount.toLocaleString("vi-VN")} \u0111 v\xE0o v\xED k\xFD qu\u1EF9`
    };
  });
}
async function deductTripCommission(bookingId) {
  if (!bookingId) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin bookingId");
  }
  const bookingRows = await client.unsafe(
    `
    SELECT 
      b.id,
      b.booking_code,
      b.status,
      b.total_price,
      b.driver_commission,
      b.payment_method,
      b.payment_status,
      b.driver_id,
      dp.user_id as driver_user_id,
      u.full_name as driver_name
    FROM bookings b
    JOIN driver_profiles dp ON dp.id = b.driver_id
    JOIN users u ON u.id = dp.user_id
    WHERE b.id = $1::uuid
    LIMIT 1
    `,
    [bookingId]
  );
  if (bookingRows.length === 0) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y chuy\u1EBFn xe ho\u1EB7c t\xE0i x\u1EBF ph\u1EE5 tr\xE1ch");
  }
  const booking = bookingRows[0];
  const driverUserId = booking.driver_user_id;
  const existingTx = await client.unsafe(
    `
    SELECT id, amount, type, created_at, balance_before, balance_after
    FROM wallet_transactions
    WHERE booking_id = $1::uuid AND type IN ('COMMISSION_DEDUCTION', 'TRIP_INCOME')
    LIMIT 1
    `,
    [bookingId]
  );
  if (existingTx.length > 0) {
    return {
      alreadyProcessed: true,
      message: "Hoa h\u1ED3ng chuy\u1EBFn xe n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c x\u1EED l\xFD tr\u01B0\u1EDBc \u0111\xF3.",
      transaction: existingTx[0],
      bookingId: booking.id,
      bookingCode: booking.booking_code
    };
  }
  const totalPrice = Number(booking.total_price);
  let commission = Number(booking.driver_commission);
  if (!commission || commission <= 0) {
    commission = Math.round(totalPrice * DEFAULT_COMMISSION_RATE);
  }
  await getOrCreateWallet(driverUserId);
  return await client.begin(async (sql6) => {
    const walletRows = await sql6`
      SELECT id, balance, locked_balance, min_deposit_limit
      FROM wallets
      WHERE user_id = ${driverUserId}::uuid
      FOR UPDATE
    `;
    if (walletRows.length === 0) {
      throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y v\xED t\xE0i x\u1EBF \u0111\u1EC3 tr\u1EEB hoa h\u1ED3ng");
    }
    const currentWallet = walletRows[0];
    const balanceBefore = Number(currentWallet.balance || 0);
    const paymentMethod = String(booking.payment_method || "CASH").toUpperCase();
    let balanceAfter;
    let txAmount;
    let txType;
    let txDescription;
    txAmount = -commission;
    balanceAfter = balanceBefore - commission;
    txType = "COMMISSION_DEDUCTION";
    const isCash = paymentMethod === "CASH";
    const methodDesc = isCash ? "ti\u1EC1n m\u1EB7t" : "chuy\u1EC3n kho\u1EA3n VietQR";
    txDescription = `Kh\u1EA5u tr\u1EEB ${commission.toLocaleString("vi-VN")} \u0111 hoa h\u1ED3ng (${Math.round(commission / totalPrice * 100)}%) chuy\u1EBFn xe ${booking.booking_code} (Kh\xE1ch tr\u1EA3 ${methodDesc} tr\u1EF1c ti\u1EBFp cho t\xE0i x\u1EBF)`;
    const updatedWallet = await sql6`
      UPDATE wallets
      SET 
        balance = ${balanceAfter}::numeric,
        updated_at = NOW()
      WHERE id = ${currentWallet.id}::uuid
      RETURNING id, balance, locked_balance, min_deposit_limit
    `;
    const refCode = `COMM_${booking.booking_code}`;
    const txRows = await sql6`
      INSERT INTO wallet_transactions (
        wallet_id,
        booking_id,
        amount,
        balance_before,
        balance_after,
        type,
        description,
        reference_code,
        created_at
      ) VALUES (
        ${currentWallet.id}::uuid,
        ${bookingId}::uuid,
        ${txAmount}::numeric,
        ${balanceBefore}::numeric,
        ${balanceAfter}::numeric,
        ${txType},
        ${txDescription},
        ${refCode},
        NOW()
      )
      RETURNING id, amount, balance_before, balance_after, type, description, reference_code, created_at
    `;
    await sql6`
      UPDATE bookings
      SET 
        payment_status = 'PAID'::payment_status,
        updated_at = NOW()
      WHERE id = ${bookingId}::uuid
    `;
    const finalAvailableBalance = Number(updatedWallet[0].balance) - Number(updatedWallet[0].locked_balance);
    const minLimit = Number(updatedWallet[0].min_deposit_limit);
    return {
      alreadyProcessed: false,
      bookingId: booking.id,
      bookingCode: booking.booking_code,
      paymentMethod,
      totalPrice,
      commission,
      netEarnings: 0,
      // Tài xế đã tự thu 100% tiền cước từ khách
      transaction: txRows[0],
      driverWallet: {
        walletId: updatedWallet[0].id,
        balance: Number(updatedWallet[0].balance),
        availableBalance: finalAvailableBalance,
        minDepositLimit: minLimit,
        isDepositQualified: finalAvailableBalance >= minLimit
      },
      message: `\u0110\xE3 kh\u1EA5u tr\u1EEB ${commission.toLocaleString("vi-VN")} \u0111 hoa h\u1ED3ng v\xE0o v\xED t\xE0i x\u1EBF (${isCash ? "Ti\u1EC1n m\u1EB7t" : "Chuy\u1EC3n kho\u1EA3n"} tr\u1EF1c ti\u1EBFp)`
    };
  });
}
async function getWalletTransactions(userId, options) {
  const wallet = await getOrCreateWallet(userId);
  const page = Math.max(1, Number(options?.page || 1));
  const limit = Math.min(100, Math.max(1, Number(options?.limit || 20)));
  const offset = (page - 1) * limit;
  const typeFilter = options?.type ? String(options.type).trim() : null;
  let countQuery = `SELECT count(*) as total FROM wallet_transactions WHERE wallet_id = $1::uuid`;
  const countParams = [wallet.id];
  if (typeFilter) {
    countQuery += ` AND type = $2`;
    countParams.push(typeFilter);
  }
  const countRes = await client.unsafe(countQuery, countParams);
  const total = parseInt(countRes[0]?.total || "0", 10);
  let dataQuery = `
    SELECT 
      wt.id,
      wt.wallet_id,
      wt.booking_id,
      wt.amount,
      wt.balance_before,
      wt.balance_after,
      wt.type,
      wt.description,
      wt.reference_code,
      wt.created_at,
      b.booking_code,
      b.total_price as booking_total_price,
      b.payment_method as booking_payment_method
    FROM wallet_transactions wt
    LEFT JOIN bookings b ON b.id = wt.booking_id
    WHERE wt.wallet_id = $1::uuid
  `;
  const dataParams = [wallet.id];
  if (typeFilter) {
    dataQuery += ` AND wt.type = $2`;
    dataParams.push(typeFilter);
    dataQuery += ` ORDER BY wt.created_at DESC LIMIT $3 OFFSET $4`;
    dataParams.push(limit, offset);
  } else {
    dataQuery += ` ORDER BY wt.created_at DESC LIMIT $2 OFFSET $3`;
    dataParams.push(limit, offset);
  }
  const rows = await client.unsafe(dataQuery, dataParams);
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    transactions: rows.map((r) => ({
      id: r.id,
      bookingId: r.booking_id,
      bookingCode: r.booking_code || null,
      amount: Number(r.amount),
      balanceBefore: r.balance_before !== null ? Number(r.balance_before) : null,
      balanceAfter: r.balance_after !== null ? Number(r.balance_after) : null,
      type: r.type,
      description: r.description,
      referenceCode: r.reference_code,
      createdAt: r.created_at,
      bookingInfo: r.booking_code ? {
        code: r.booking_code,
        totalPrice: Number(r.booking_total_price || 0),
        paymentMethod: r.booking_payment_method
      } : null
    }))
  };
}
async function adminAdjustWallet(dto) {
  const {
    targetUserId,
    amount,
    type,
    description,
    referenceCode,
    adminUserId
  } = dto;
  if (!targetUserId) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin targetUserId");
  }
  if (!description) {
    throw new ApiError(400, "Vui l\xF2ng nh\u1EADp l\xFD do \u0111i\u1EC1u ch\u1EC9nh s\u1ED1 d\u01B0 v\xED");
  }
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount === 0) {
    throw new ApiError(400, "S\u1ED1 ti\u1EC1n \u0111i\u1EC1u ch\u1EC9nh ph\u1EA3i kh\xE1c 0");
  }
  await getOrCreateWallet(targetUserId);
  return await client.begin(async (sql6) => {
    const walletRows = await sql6`
      SELECT id, balance, locked_balance, min_deposit_limit
      FROM wallets
      WHERE user_id = ${targetUserId}::uuid
      FOR UPDATE
    `;
    if (walletRows.length === 0) {
      throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y v\xED ng\u01B0\u1EDDi d\xF9ng");
    }
    const currentWallet = walletRows[0];
    const balanceBefore = Number(currentWallet.balance || 0);
    const balanceAfter = balanceBefore + numAmount;
    const updated = await sql6`
      UPDATE wallets
      SET 
        balance = ${balanceAfter}::numeric,
        updated_at = NOW()
      WHERE id = ${currentWallet.id}::uuid
      RETURNING id, balance, locked_balance, min_deposit_limit, updated_at
    `;
    const refCode = referenceCode || `ADMIN_ADJ_${Date.now()}`;
    const txRows = await sql6`
      INSERT INTO wallet_transactions (
        wallet_id,
        booking_id,
        amount,
        balance_before,
        balance_after,
        type,
        description,
        reference_code,
        created_at
      ) VALUES (
        ${currentWallet.id}::uuid,
        NULL,
        ${numAmount}::numeric,
        ${balanceBefore}::numeric,
        ${balanceAfter}::numeric,
        ${type || "ADMIN_ADJUSTMENT"},
        ${description},
        ${refCode},
        NOW()
      )
      RETURNING id, amount, balance_before, balance_after, type, description, reference_code, created_at
    `;
    return {
      success: true,
      transaction: txRows[0],
      wallet: {
        walletId: updated[0].id,
        balance: Number(updated[0].balance),
        availableBalance: Number(updated[0].balance) - Number(updated[0].locked_balance)
      },
      message: `Admin \u0111\xE3 \u0111i\u1EC1u ch\u1EC9nh ${numAmount > 0 ? "+" : ""}${numAmount.toLocaleString("vi-VN")} \u0111 v\xE0o v\xED ng\u01B0\u1EDDi d\xF9ng`
    };
  });
}
async function getAllDriverWallets(options) {
  const page = Math.max(1, Number(options?.page || 1));
  const limit = Math.min(100, Math.max(1, Number(options?.limit || 20)));
  const offset = (page - 1) * limit;
  const search = options?.search ? `%${options.search.trim()}%` : null;
  let countQuery = `
    SELECT count(*) as total
    FROM driver_profiles dp
    JOIN users u ON u.id = dp.user_id
    LEFT JOIN wallets w ON w.user_id = u.id
    WHERE 1=1
  `;
  const countParams = [];
  if (search) {
    countQuery += ` AND (u.full_name ILIKE $1 OR u.phone ILIKE $1 OR dp.license_plate ILIKE $1)`;
    countParams.push(search);
  }
  const countRes = await client.unsafe(countQuery, countParams);
  const total = parseInt(countRes[0]?.total || "0", 10);
  let dataQuery = `
    SELECT 
      dp.id as driver_id,
      dp.user_id,
      u.full_name,
      u.phone,
      u.avatar_url,
      dp.license_plate,
      dp.kyc_status,
      dp.is_online,
      dp.is_active,
      COALESCE(w.id, NULL) as wallet_id,
      COALESCE(w.balance, 0) as balance,
      COALESCE(w.locked_balance, 0) as locked_balance,
      COALESCE(w.min_deposit_limit, 200000) as min_deposit_limit,
      w.updated_at as wallet_updated_at
    FROM driver_profiles dp
    JOIN users u ON u.id = dp.user_id
    LEFT JOIN wallets w ON w.user_id = u.id
    WHERE 1=1
  `;
  const dataParams = [];
  if (search) {
    dataQuery += ` AND (u.full_name ILIKE $1 OR u.phone ILIKE $1 OR dp.license_plate ILIKE $1)`;
    dataParams.push(search);
    dataQuery += ` ORDER BY dp.created_at DESC LIMIT $2 OFFSET $3`;
    dataParams.push(limit, offset);
  } else {
    dataQuery += ` ORDER BY dp.created_at DESC LIMIT $1 OFFSET $2`;
    dataParams.push(limit, offset);
  }
  const rows = await client.unsafe(dataQuery, dataParams);
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    drivers: rows.map((r) => {
      const balance = Number(r.balance || 0);
      const lockedBalance = Number(r.locked_balance || 0);
      const availableBalance = balance - lockedBalance;
      const minDepositLimit = Number(
        r.min_deposit_limit || DEFAULT_MIN_DEPOSIT_LIMIT
      );
      const isDepositQualified = availableBalance >= minDepositLimit;
      return {
        driverId: r.driver_id,
        userId: r.user_id,
        fullName: r.full_name || `T\xE0i x\u1EBF ${r.phone ? `(${r.phone})` : ""}`,
        phone: r.phone,
        avatarUrl: r.avatar_url,
        licensePlate: r.license_plate,
        kycStatus: r.kyc_status,
        isOnline: r.is_online,
        isActive: r.is_active,
        wallet: {
          walletId: r.wallet_id,
          balance,
          lockedBalance,
          availableBalance,
          minDepositLimit,
          isDepositQualified,
          updatedAt: r.wallet_updated_at
        }
      };
    })
  };
}
async function grantKycWelcomeDeposit(driverUserId, driverId) {
  if (!driverUserId) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin driverUserId");
  }
  const welcomeAmount = 2e5;
  const refCode = `KYC_WELCOME_BONUS_${driverId}`;
  const existing = await client.unsafe(
    `SELECT id FROM wallet_transactions WHERE user_id = $1::uuid AND reference_code = $2 LIMIT 1`,
    [driverUserId, refCode]
  );
  if (existing.length > 0) {
    return { alreadyGranted: true, message: "T\xE0i x\u1EBF \u0111\xE3 nh\u1EADn v\u1ED1n k\xFD qu\u1EF9 kh\u1EDFi nghi\u1EC7p tr\u01B0\u1EDBc \u0111\xF3" };
  }
  await getOrCreateWallet(driverUserId);
  return await client.begin(async (sql6) => {
    const walletRows = await sql6`
      SELECT id, balance, min_deposit_limit
      FROM wallets
      WHERE user_id = ${driverUserId}::uuid
      FOR UPDATE
    `;
    if (walletRows.length === 0) {
      throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y v\xED t\xE0i x\u1EBF");
    }
    const currentBal = Number(walletRows[0].balance || 0);
    const newBal = currentBal + welcomeAmount;
    await sql6`
      UPDATE wallets
      SET balance = ${newBal}, updated_at = NOW()
      WHERE user_id = ${driverUserId}::uuid
    `;
    await sql6`
      INSERT INTO wallet_transactions (
        wallet_id,
        user_id,
        amount,
        balance_before,
        balance_after,
        type,
        status,
        description,
        reference_code,
        created_at
      ) VALUES (
        ${walletRows[0].id}::uuid,
        ${driverUserId}::uuid,
        ${welcomeAmount},
        ${currentBal},
        ${newBal},
        'BONUS',
        'SUCCESS',
        'Tặng 200.000đ vốn ký quỹ khởi nghiệp (Duyệt hồ sơ KYC thành công)',
        ${refCode},
        NOW()
      )
    `;
    return {
      success: true,
      amount: welcomeAmount,
      balanceAfter: newBal,
      message: `\u0110\xE3 t\u1EB7ng th\xE0nh c\xF4ng ${welcomeAmount.toLocaleString("vi-VN")} \u0111 v\u1ED1n k\xFD qu\u1EF9 cho t\xE0i x\u1EBF`
    };
  });
}

// src/lib/notificationService.ts
import admin from "firebase-admin";
async function saveNotificationToDb(userId, title, message, type, data) {
  try {
    await db.insert(notifications).values({
      userId,
      title,
      message,
      type,
      data: data || null
    });
  } catch (err) {
    console.error("Failed to save notification to DB:", err);
  }
}
var firebaseApp = null;
var isFirebaseConfigured = false;
function initFirebaseAdmin() {
  if (firebaseApp) return firebaseApp;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") : void 0;
  const isConfigured = Boolean(
    projectId && !projectId.startsWith("your_") && clientEmail && !clientEmail.startsWith("your_") && !clientEmail.includes("your_project") && privateKey
  );
  if (isConfigured) {
    try {
      const certFn = admin.cert || admin.credential?.cert;
      if (!certFn) {
        throw new Error("Kh\xF4ng t\xECm th\u1EA5y h\xE0m cert() trong Firebase Admin SDK");
      }
      firebaseApp = admin.initializeApp({
        credential: certFn({
          projectId,
          clientEmail,
          privateKey
        })
      });
      isFirebaseConfigured = true;
      console.log("\u{1F525} [Firebase] \u0110\xE3 k\u1EBFt n\u1ED1i Firebase Admin SDK th\xE0nh c\xF4ng.");
      return firebaseApp;
    } catch (err) {
      console.warn(
        "\u26A0\uFE0F [Firebase] Kh\u1EDFi t\u1EA1o Firebase Admin th\u1EA5t b\u1EA1i:",
        err.message
      );
    }
  }
  isFirebaseConfigured = false;
  console.log(
    "\u{1F4F1} [Firebase FCM] Ch\u1EBF \u0111\u1ED9 DEV MOCK: Ch\u01B0a c\u1EA5u h\xECnh Firebase Service Account Credentials. Th\xF4ng b\xE1o \u0111\u1EA9y s\u1EBD \u0111\u01B0\u1EE3c m\xF4 ph\u1ECFng log console an to\xE0n."
  );
  return null;
}
initFirebaseAdmin();
async function registerDeviceToken(userId, dto) {
  if (!userId) {
    throw new ApiError(401, "Y\xEAu c\u1EA7u \u0111\u0103ng nh\u1EADp \u0111\u1EC3 \u0111\u0103ng k\xFD thi\u1EBFt b\u1ECB");
  }
  if (!dto.fcmToken || !dto.fcmToken.trim()) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin fcmToken");
  }
  const cleanToken = dto.fcmToken.trim();
  const cleanType = (dto.deviceType || "WEB").toUpperCase();
  const cleanName = dto.deviceName ? dto.deviceName.trim() : null;
  const rows = await client.unsafe(
    `
    INSERT INTO user_devices (user_id, fcm_token, device_type, device_name, updated_at)
    VALUES ($1::uuid, $2, $3, $4, NOW())
    ON CONFLICT (user_id, fcm_token) DO UPDATE
    SET 
      device_type = EXCLUDED.device_type,
      device_name = EXCLUDED.device_name,
      updated_at = NOW()
    RETURNING id, user_id, fcm_token, device_type, device_name, updated_at
    `,
    [userId, cleanToken, cleanType, cleanName]
  );
  return rows[0];
}
async function removeDeviceToken(userId, fcmToken) {
  if (!userId || !fcmToken) {
    return { success: false, removedCount: 0 };
  }
  const rows = await client.unsafe(
    `
    DELETE FROM user_devices
    WHERE user_id = $1::uuid AND fcm_token = $2
    RETURNING id
    `,
    [userId, fcmToken.trim()]
  );
  return { success: true, removedCount: rows.length };
}
async function getUserDeviceTokens(userId) {
  if (!userId) return [];
  const rows = await client.unsafe(
    `
    SELECT fcm_token FROM user_devices
    WHERE user_id = $1::uuid
    ORDER BY updated_at DESC
    `,
    [userId]
  );
  return rows.map((r) => r.fcm_token);
}
async function getUsersDeviceTokens(userIds) {
  if (!userIds || userIds.length === 0) return [];
  const rows = await client.unsafe(
    `
    SELECT fcm_token FROM user_devices
    WHERE user_id = ANY($1::uuid[])
    `,
    [userIds]
  );
  return rows.map((r) => r.fcm_token);
}
async function sendPushNotificationToTokens(tokens, payload) {
  const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));
  if (uniqueTokens.length === 0) {
    return {
      success: true,
      deliveredCount: 0,
      failureCount: 0,
      messageIds: []
    };
  }
  if (!isFirebaseConfigured || !firebaseApp) {
    console.log(
      `\u{1F4F1} [FCM Mock] Push Notification (${uniqueTokens.length} thi\u1EBFt b\u1ECB):`
    );
    console.log(`   \u{1F514} Ti\xEAu \u0111\u1EC1: "${payload.title}"`);
    console.log(`   \u{1F4DD} N\u1ED9i dung: "${payload.body}"`);
    if (payload.data) {
      console.log(`   \u{1F4E6} Data payload:`, payload.data);
    }
    return {
      success: true,
      deliveredCount: uniqueTokens.length,
      failureCount: 0,
      messageIds: uniqueTokens.map((_, i) => `mock-msg-${Date.now()}-${i}`)
    };
  }
  try {
    const messaging = firebaseApp.messaging();
    const message = {
      tokens: uniqueTokens,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl
      },
      data: payload.data || {},
      webpush: {
        notification: {
          icon: "/favicon.ico",
          badge: "/favicon.ico"
        }
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "booking_updates"
        }
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1
          }
        }
      }
    };
    const response = await messaging.sendEachForMulticast(message);
    const staleTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        const errCode = resp.error.code;
        if (errCode === "messaging/registration-token-not-registered" || errCode === "messaging/invalid-registration-token") {
          staleTokens.push(uniqueTokens[idx]);
        }
      }
    });
    if (staleTokens.length > 0) {
      await client.unsafe(
        `DELETE FROM user_devices WHERE fcm_token = ANY($1::text[])`,
        [staleTokens]
      );
      console.log(
        `\u{1F9F9} [FCM] \u0110\xE3 t\u1EF1 \u0111\u1ED9ng d\u1ECDn d\u1EB9p ${staleTokens.length} token h\u1EBFt h\u1EA1n.`
      );
    }
    const messageIds = response.responses.filter((r) => r.success && r.messageId).map((r) => r.messageId);
    return {
      success: response.successCount > 0,
      deliveredCount: response.successCount,
      failureCount: response.failureCount,
      messageIds
    };
  } catch (error) {
    console.error("\u274C [FCM] L\u1ED7i ph\xE1t th\xF4ng b\xE1o \u0111\u1EA9y Firebase:", error.message);
    return {
      success: false,
      deliveredCount: 0,
      failureCount: uniqueTokens.length,
      messageIds: []
    };
  }
}
async function sendPushNotificationToUser(userId, payload) {
  const tokens = await getUserDeviceTokens(userId);
  return await sendPushNotificationToTokens(tokens, payload);
}
async function sendPushNotificationToUsers(userIds, payload) {
  const tokens = await getUsersDeviceTokens(userIds);
  return await sendPushNotificationToTokens(tokens, payload);
}
async function notifyDriverNewBookingOffer(driverUserIds, offer) {
  const title = "\u{1F69A} C\xF3 chuy\u1EBFn h\xE0ng m\u1EDBi g\u1EA7n b\u1EA1n!";
  const body = `\u0110\u01A1n h\xE0ng c\xE1ch b\u1EA1n ${offer.distanceKm}km (${offer.bookingCode}) - C\u01B0\u1EDBc ph\xED: ${offer.totalPrice.toLocaleString("vi-VN")}\u0111. Nh\u1EADn ngay trong 20s!`;
  await Promise.all(
    driverUserIds.map(
      (driverUserId) => saveNotificationToDb(driverUserId, title, body, "order", {
        bookingId: offer.bookingId
      })
    )
  );
  return await sendPushNotificationToUsers(driverUserIds, {
    title,
    body,
    data: {
      type: "NEW_OFFER",
      bookingId: offer.bookingId,
      bookingCode: offer.bookingCode,
      distanceKm: String(offer.distanceKm),
      totalPrice: String(offer.totalPrice)
    }
  });
}
async function notifyCustomerBookingAccepted(customerUserId, info) {
  const plateText = info.licensePlate ? ` (Bi\u1EC3n s\u1ED1: ${info.licensePlate})` : "";
  const title = "\u2705 T\xE0i x\u1EBF \u0111\xE3 nh\u1EADn chuy\u1EBFn xe c\u1EE7a b\u1EA1n!";
  const body = `T\xE0i x\u1EBF ${info.driverName}${plateText} \u0111\xE3 nh\u1EADn \u0111\u01A1n ${info.bookingCode} v\xE0 \u0111ang di chuy\u1EC3n \u0111\u1EBFn \u0111i\u1EC3m l\u1EA5y h\xE0ng.`;
  await saveNotificationToDb(customerUserId, title, body, "order", {
    bookingId: info.bookingId
  });
  return await sendPushNotificationToUser(customerUserId, {
    title,
    body,
    data: {
      type: "BOOKING_ACCEPTED",
      bookingId: info.bookingId,
      bookingCode: info.bookingCode,
      driverName: info.driverName,
      driverPhone: info.driverPhone
    }
  });
}
async function notifyCustomerDriverArrived(customerUserId, info) {
  const title = "\u{1F4CD} Xe \u0111\xE3 t\u1EDBi \u0111i\u1EC3m l\u1EA5y h\xE0ng!";
  const body = `T\xE0i x\u1EBF ${info.driverName} \u0111\xE3 \u0111\u1EBFn \u0111i\u1EC3m h\u1EB9n l\u1EA5y h\xE0ng (${info.bookingCode}). Vui l\xF2ng chu\u1EA9n b\u1ECB h\xE0ng h\xF3a!`;
  await saveNotificationToDb(customerUserId, title, body, "order", {
    bookingId: info.bookingId
  });
  return await sendPushNotificationToUser(customerUserId, {
    title,
    body,
    data: {
      type: "DRIVER_ARRIVED",
      bookingId: info.bookingId,
      bookingCode: info.bookingCode
    }
  });
}
async function notifyCustomerBookingInTransit(customerUserId, info) {
  const title = "\u{1F69A} H\xE0ng h\xF3a \u0111ang tr\xEAn \u0111\u01B0\u1EDDng v\u1EADn chuy\u1EC3n!";
  const body = `\u0110\u01A1n h\xE0ng ${info.bookingCode} \u0111\xE3 \u0111\u01B0\u1EE3c b\u1ED1c l\xEAn xe v\xE0 \u0111ang tr\xEAn \u0111\u01B0\u1EDDng giao \u0111\u1EBFn ng\u01B0\u1EDDi nh\u1EADn.`;
  await saveNotificationToDb(customerUserId, title, body, "order", {
    bookingId: info.bookingId
  });
  return await sendPushNotificationToUser(customerUserId, {
    title,
    body,
    data: {
      type: "IN_TRANSIT",
      bookingId: info.bookingId,
      bookingCode: info.bookingCode
    }
  });
}
async function notifyCustomerBookingCompleted(customerUserId, info) {
  const title = "\u{1F389} Giao h\xE0ng ho\xE0n t\u1EA5t!";
  const body = `Chuy\u1EBFn h\xE0ng ${info.bookingCode} \u0111\xE3 \u0111\u01B0\u1EE3c giao th\xE0nh c\xF4ng. C\u1EA3m \u01A1n b\u1EA1n \u0111\xE3 tin t\u01B0\u1EDFng d\u1ECBch v\u1EE5!`;
  await saveNotificationToDb(customerUserId, title, body, "order", {
    bookingId: info.bookingId
  });
  return await sendPushNotificationToUser(customerUserId, {
    title,
    body,
    data: {
      type: "BOOKING_COMPLETED",
      bookingId: info.bookingId,
      bookingCode: info.bookingCode
    }
  });
}
async function notifyTripCancelled(targetUserId, info) {
  const who = info.cancelledBy === "CUSTOMER" ? "Kh\xE1ch h\xE0ng" : info.cancelledBy === "DRIVER" ? "T\xE0i x\u1EBF" : "H\u1EC7 th\u1ED1ng";
  const reasonText = info.reason ? ` L\xFD do: ${info.reason}` : "";
  const title = "\u274C Chuy\u1EBFn xe \u0111\xE3 b\u1ECB h\u1EE7y";
  const body = `Chuy\u1EBFn xe ${info.bookingCode} \u0111\xE3 b\u1ECB h\u1EE7y b\u1EDFi ${who}.${reasonText}`;
  await saveNotificationToDb(targetUserId, title, body, "order", {
    bookingId: info.bookingId
  });
  return await sendPushNotificationToUser(targetUserId, {
    title,
    body,
    data: {
      type: "BOOKING_CANCELLED",
      bookingId: info.bookingId,
      bookingCode: info.bookingCode,
      cancelledBy: info.cancelledBy
    }
  });
}

// src/lib/pinSecurity.ts
var WEAK_PIN_PATTERNS = /* @__PURE__ */ new Set([
  "000000",
  "111111",
  "222222",
  "333333",
  "444444",
  "555555",
  "666666",
  "777777",
  "888888",
  "999999",
  "123456",
  "654321",
  "123123",
  "121212",
  "112233",
  "665544",
  "987654",
  "456789",
  "012345",
  "543210"
]);
function validatePinStrength(pin, phone) {
  const cleanPin = (pin || "").trim();
  if (!/^\d{6}$/.test(cleanPin)) {
    return {
      valid: false,
      error: "M\xE3 PIN ph\u1EA3i g\u1ED3m \u0111\xFAng 6 ch\u1EEF s\u1ED1 (0-9)."
    };
  }
  if (WEAK_PIN_PATTERNS.has(cleanPin)) {
    return {
      valid: false,
      error: "M\xE3 PIN qu\xE1 \u0111\u01A1n gi\u1EA3n v\xE0 d\u1EC5 \u0111o\xE1n (v\xED d\u1EE5: 123456, 000000). Vui l\xF2ng ch\u1ECDn d\xE3y 6 s\u1ED1 kh\xE1c an to\xE0n h\u01A1n."
    };
  }
  if (/^(\d)\1{5}$/.test(cleanPin)) {
    return {
      valid: false,
      error: "M\xE3 PIN kh\xF4ng \u0111\u01B0\u1EE3c g\u1ED3m 6 ch\u1EEF s\u1ED1 tr\xF9ng nhau."
    };
  }
  const isAscending = "0123456789".includes(cleanPin);
  const isDescending = "9876543210".includes(cleanPin);
  if (isAscending || isDescending) {
    return {
      valid: false,
      error: "M\xE3 PIN kh\xF4ng \u0111\u01B0\u1EE3c l\xE0 d\xE3y s\u1ED1 t\u0103ng d\u1EA7n ho\u1EB7c gi\u1EA3m d\u1EA7n li\xEAn ti\u1EBFp."
    };
  }
  if (phone) {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length >= 6 && cleanPhone.endsWith(cleanPin)) {
      return {
        valid: false,
        error: "M\xE3 PIN kh\xF4ng \u0111\u01B0\u1EE3c tr\xF9ng v\u1EDBi 6 ch\u1EEF s\u1ED1 cu\u1ED1i c\u1EE7a s\u1ED1 \u0111i\u1EC7n tho\u1EA1i."
      };
    }
  }
  return { valid: true };
}
var loginAttemptsMap = /* @__PURE__ */ new Map();
var MAX_FAILED_ATTEMPTS = 5;
var LOCKOUT_DURATION_MS = 15 * 60 * 1e3;
function recordFailedAttempt(key) {
  const now = Date.now();
  let record = loginAttemptsMap.get(key);
  if (!record || record.lockedUntil && now > record.lockedUntil) {
    record = {
      failedCount: 1,
      lastAttemptAt: now
    };
  } else {
    record.failedCount += 1;
    record.lastAttemptAt = now;
  }
  if (record.failedCount >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    loginAttemptsMap.set(key, record);
    return {
      remainingAttempts: 0,
      isLocked: true,
      lockRemainingMinutes: Math.ceil(LOCKOUT_DURATION_MS / 6e4)
    };
  }
  loginAttemptsMap.set(key, record);
  return {
    remainingAttempts: MAX_FAILED_ATTEMPTS - record.failedCount,
    isLocked: false
  };
}
function checkLoginLockout(key) {
  const now = Date.now();
  const record = loginAttemptsMap.get(key);
  if (!record || !record.lockedUntil) {
    return { isLocked: false };
  }
  if (now > record.lockedUntil) {
    loginAttemptsMap.delete(key);
    return { isLocked: false };
  }
  const remainingMinutes = Math.ceil((record.lockedUntil - now) / 6e4);
  return {
    isLocked: true,
    lockRemainingMinutes: remainingMinutes > 0 ? remainingMinutes : 1
  };
}
function resetLoginAttempts(key) {
  loginAttemptsMap.delete(key);
}

// src/middleware/authMiddleware.ts
var extractTokenFromHeader = (authHeader) => {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.split(" ")[1];
};
var authenticate = (authHeader) => {
  const token = extractTokenFromHeader(authHeader);
  if (!token) {
    throw new Error(
      "UNAUTHORIZED: Kh\xF4ng t\xECm th\u1EA5y Token x\xE1c th\u1EF1c (Missing Bearer Token)"
    );
  }
  if (process.env.NODE_ENV !== "production" && (process.env.NODE_ENV === "test" || process.env.ALLOW_DEV_TOKENS === "true")) {
    if (token === "DEV_ADMIN_TOKEN") {
      return { userId: "dev-admin", role: "ADMIN", phone: "0000" };
    }
    if (token === "DEV_DRIVER_TOKEN") {
      return { userId: "dev-driver", role: "DRIVER", phone: "0900000002" };
    }
    if (token === "DEV_CUSTOMER_TOKEN") {
      return { userId: "dev-customer", role: "CUSTOMER", phone: "0900000001" };
    }
  }
  return verifyToken(token);
};
var authorizeRoles = (payload, allowedRoles) => {
  if (!allowedRoles.includes(payload.role)) {
    throw new Error(
      `Quy\u1EC1n truy c\u1EADp b\u1ECB t\u1EEB ch\u1ED1i. API n\xE0y ch\u1EC9 d\xE0nh cho: ${allowedRoles.join(", ")}`
    );
  }
};

// src/api/middleware.ts
var requireAuth = (req, res, next) => {
  try {
    const user = authenticate(req.headers.authorization);
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
var requireRoles = (roles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new Error("UNAUTHORIZED: User not authenticated");
      }
      authorizeRoles(req.user, roles);
      next();
    } catch (err) {
      next(err);
    }
  };
};
var errorHandler = (err, req, res, next) => {
  const message = err.message || "L\u1ED7i h\u1EC7 th\u1ED1ng";
  const isAuthError = message.includes("UNAUTHORIZED") || message.includes("Token kh\xF4ng h\u1EE3p l\u1EC7");
  const isForbidden = message.includes("FORBIDDEN") || err.statusCode === 403;
  const statusCode = err.statusCode || (isAuthError ? 401 : isForbidden ? 403 : 400);
  res.status(statusCode).json({
    success: false,
    code: err.code,
    message
  });
};

// src/api/routes/auth.ts
var router = Router();
router.post("/admin/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui l\xF2ng nh\u1EADp \u0111\u1EA7y \u0111\u1EE7 Email v\xE0 M\u1EADt kh\u1EA9u qu\u1EA3n tr\u1ECB"
      });
    }
    const input = (email || "").trim();
    const [foundUser] = await db.select().from(users).where(or(eq2(users.email, input), eq2(users.phone, input))).limit(1);
    if (!foundUser) {
      return res.status(401).json({
        success: false,
        message: "T\xE0i kho\u1EA3n qu\u1EA3n tr\u1ECB vi\xEAn kh\xF4ng t\u1ED3n t\u1EA1i tr\xEAn h\u1EC7 th\u1ED1ng"
      });
    }
    if (foundUser.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "T\xE0i kho\u1EA3n n\xE0y kh\xF4ng c\xF3 quy\u1EC1n truy c\u1EADp Qu\u1EA3n tr\u1ECB vi\xEAn (ADMIN)"
      });
    }
    if (foundUser.status === "BLOCKED") {
      return res.status(403).json({
        success: false,
        message: "T\xE0i kho\u1EA3n qu\u1EA3n tr\u1ECB vi\xEAn n\xE0y \u0111\xE3 b\u1ECB kh\xF3a"
      });
    }
    if (!foundUser.passwordHash) {
      return res.status(401).json({
        success: false,
        message: "T\xE0i kho\u1EA3n ch\u01B0a thi\u1EBFt l\u1EADp m\u1EADt kh\u1EA9u b\u1EA3o m\u1EADt"
      });
    }
    const isMatch = await comparePassword(password, foundUser.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "M\u1EADt kh\u1EA9u kh\xF4ng ch\xEDnh x\xE1c. Vui l\xF2ng th\u1EED l\u1EA1i."
      });
    }
    const token = generateToken({
      userId: foundUser.id,
      role: "ADMIN",
      phone: foundUser.phone || "0900000000"
    });
    return res.json({
      success: true,
      message: "\u0110\u0103ng nh\u1EADp Qu\u1EA3n tr\u1ECB vi\xEAn th\xE0nh c\xF4ng!",
      token,
      user: {
        id: foundUser.id,
        email: foundUser.email,
        fullName: foundUser.fullName || "Qu\u1EA3n tr\u1ECB vi\xEAn",
        role: foundUser.role
      }
    });
  } catch (err) {
    next(err);
  }
});
router.post("/request-otp", async (req, res, next) => {
  try {
    const rawPhone = req.body?.phone;
    if (!rawPhone || typeof rawPhone !== "string") {
      return res.status(400).json({
        success: false,
        message: "Vui l\xF2ng cung c\u1EA5p s\u1ED1 \u0111i\u1EC7n tho\u1EA1i nh\u1EADn m\xE3 OTP"
      });
    }
    const clientIp = getClientIp(req);
    const result = await requestOtp(rawPhone, clientIp, {
      purpose: req.body?.purpose
    });
    return res.json(result);
  } catch (err) {
    next(err);
  }
});
router.post("/verify-otp", async (req, res, next) => {
  try {
    const { phone, otp, role, fullName } = req.body || {};
    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Vui l\xF2ng nh\u1EADp \u0111\u1EA7y \u0111\u1EE7 S\u1ED1 \u0111i\u1EC7n tho\u1EA1i v\xE0 M\xE3 OTP 6 ch\u1EEF s\u1ED1"
      });
    }
    const result = await verifyOtp(phone, otp, role, fullName);
    return res.status(result.isNewUser ? 201 : 200).json(result);
  } catch (err) {
    next(err);
  }
});
router.post("/register", async (req, res, next) => {
  try {
    const { phone: rawPhone, password, pin, fullName, role, otp } = req.body;
    if (!rawPhone || !password && !pin) {
      return res.status(400).json({
        success: false,
        message: "Vui l\xF2ng nh\u1EADp \u0111\u1EA7y \u0111\u1EE7 S\u1ED1 \u0111i\u1EC7n tho\u1EA1i v\xE0 M\u1EADt kh\u1EA9u ho\u1EB7c M\xE3 PIN"
      });
    }
    const phoneValidation = validateVietnamesePhone(rawPhone);
    if (!phoneValidation.valid) {
      return res.status(400).json({
        success: false,
        message: phoneValidation.error || "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i kh\xF4ng h\u1EE3p l\u1EC7"
      });
    }
    const phone = phoneValidation.phone;
    if (otp && typeof otp === "string" && otp.trim().length === 6) {
      await verifyOtpCodeOnly(phone, otp.trim());
    }
    if (password && (typeof password !== "string" || password.trim().length < 6)) {
      return res.status(400).json({
        success: false,
        message: "M\u1EADt kh\u1EA9u ph\u1EA3i c\xF3 t\u1ED1i thi\u1EC3u 6 k\xFD t\u1EF1"
      });
    }
    if (pin) {
      if (typeof pin !== "string" || !/^\d{6}$/.test(pin.trim())) {
        return res.status(400).json({
          success: false,
          message: "M\xE3 PIN ph\u1EA3i g\u1ED3m \u0111\xFAng 6 ch\u1EEF s\u1ED1 (0-9)"
        });
      }
      const pinStrength = validatePinStrength(pin.trim(), phone);
      if (!pinStrength.valid) {
        return res.status(400).json({
          success: false,
          message: pinStrength.error || "M\xE3 PIN kh\xF4ng \u0111\u1EE7 an to\xE0n"
        });
      }
    }
    const [existingUser] = await db.select().from(users).where(eq2(users.phone, phone)).limit(1);
    const targetRole = role === "DRIVER" ? "DRIVER" : "CUSTOMER";
    const passwordHash = password ? await hashPassword(password.trim()) : null;
    const pinHash = pin ? await hashPassword(pin.trim()) : null;
    let userRecord;
    if (existingUser) {
      if (existingUser.passwordHash || existingUser.pinHash) {
        return res.status(409).json({
          success: false,
          message: "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c \u0111\u0103ng k\xFD. Vui l\xF2ng chuy\u1EC3n sang \u0110\u0103ng nh\u1EADp."
        });
      }
      const [updated] = await db.update(users).set({
        passwordHash: passwordHash || existingUser.passwordHash,
        pinHash: pinHash || existingUser.pinHash,
        fullName: fullName?.trim() || existingUser.fullName,
        role: targetRole,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(users.id, existingUser.id)).returning();
      userRecord = updated;
    } else {
      const [created] = await db.insert(users).values({
        phone,
        passwordHash,
        pinHash,
        fullName: fullName?.trim() || (targetRole === "DRIVER" ? "T\xE0i x\u1EBF m\u1EDBi" : "Kh\xE1ch h\xE0ng"),
        role: targetRole,
        status: "ACTIVE"
      }).returning();
      userRecord = created;
    }
    if (userRecord.role === "DRIVER") {
      const [prof] = await db.select().from(driverProfiles).where(eq2(driverProfiles.userId, userRecord.id)).limit(1);
      if (!prof) {
        await db.insert(driverProfiles).values({
          userId: userRecord.id,
          kycStatus: "PENDING",
          isOnline: false,
          isActive: true
        });
      }
    }
    await getOrCreateWallet(userRecord.id);
    const token = generateToken({
      userId: userRecord.id,
      role: userRecord.role,
      phone: userRecord.phone
    });
    return res.status(201).json({
      success: true,
      message: "\u0110\u0103ng k\xFD t\xE0i kho\u1EA3n th\xE0nh c\xF4ng!",
      token,
      isNewUser: true,
      user: {
        id: userRecord.id,
        phone: userRecord.phone,
        fullName: userRecord.fullName,
        role: userRecord.role,
        avatarUrl: userRecord.avatarUrl
      }
    });
  } catch (err) {
    next(err);
  }
});
router.post("/login", async (req, res, next) => {
  try {
    const rawInput = (req.body.phone || req.body.username || req.body.name || req.body.fullName || "").trim();
    const password = req.body.password;
    if (!rawInput || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui l\xF2ng nh\u1EADp T\xEAn \u0111\u0103ng nh\u1EADp (ho\u1EB7c S\u1ED1 \u0111i\u1EC7n tho\u1EA1i) v\xE0 M\u1EADt kh\u1EA9u"
      });
    }
    const clientIp = getClientIp(req);
    const lockoutKey = `${clientIp}_${rawInput.toLowerCase()}`;
    const lockoutStatus = checkLoginLockout(lockoutKey);
    if (lockoutStatus.isLocked) {
      return res.status(429).json({
        success: false,
        message: `B\u1EA1n \u0111\xE3 nh\u1EADp sai qu\xE1 5 l\u1EA7n. \u0110\u1EC3 b\u1EA3o v\u1EC7 t\xE0i kho\u1EA3n, h\u1EC7 th\u1ED1ng t\u1EA1m kh\xF3a \u0111\u0103ng nh\u1EADp trong ${lockoutStatus.lockRemainingMinutes} ph\xFAt n\u1EEFa.`
      });
    }
    const phoneValidation = validateVietnamesePhone(rawInput);
    let candidateUsers = [];
    if (phoneValidation.valid) {
      candidateUsers = await db.select().from(users).where(
        or(
          eq2(users.phone, phoneValidation.phone),
          ilike(users.fullName, rawInput)
        )
      ).limit(10);
    } else {
      candidateUsers = await db.select().from(users).where(
        or(
          eq2(users.phone, rawInput),
          ilike(users.fullName, rawInput)
        )
      ).limit(10);
    }
    if (!candidateUsers.length) {
      return res.status(404).json({
        success: false,
        message: "Kh\xF4ng t\xECm th\u1EA5y t\xE0i kho\u1EA3n v\u1EDBi T\xEAn ho\u1EB7c S\u1ED1 \u0111i\u1EC7n tho\u1EA1i n\xE0y. Vui l\xF2ng ki\u1EC3m tra l\u1EA1i."
      });
    }
    let foundUser = null;
    const cleanSecret = password.trim();
    for (const u of candidateUsers) {
      if (u.passwordHash && await comparePassword(cleanSecret, u.passwordHash)) {
        foundUser = u;
        break;
      }
      if (u.pinHash && await comparePassword(cleanSecret, u.pinHash)) {
        foundUser = u;
        break;
      }
    }
    if (!foundUser) {
      const failInfo = recordFailedAttempt(lockoutKey);
      let msg = "M\u1EADt kh\u1EA9u ho\u1EB7c M\xE3 PIN kh\xF4ng ch\xEDnh x\xE1c.";
      if (failInfo.isLocked) {
        msg = `B\u1EA1n \u0111\xE3 nh\u1EADp sai 5 l\u1EA7n li\xEAn ti\u1EBFp. T\xE0i kho\u1EA3n b\u1ECB t\u1EA1m kh\xF3a \u0111\u0103ng nh\u1EADp trong ${failInfo.lockRemainingMinutes} ph\xFAt \u0111\u1EC3 ch\u1ED1ng d\xF2 m\xE3.`;
      } else {
        msg += ` B\u1EA1n c\xF2n ${failInfo.remainingAttempts} l\u1EA7n th\u1EED tr\u01B0\u1EDBc khi b\u1ECB t\u1EA1m kh\xF3a.`;
      }
      return res.status(401).json({
        success: false,
        message: msg,
        remainingAttempts: failInfo.remainingAttempts,
        isLocked: failInfo.isLocked
      });
    }
    resetLoginAttempts(lockoutKey);
    if (foundUser.status === "BLOCKED") {
      return res.status(403).json({
        success: false,
        message: "T\xE0i kho\u1EA3n c\u1EE7a b\u1EA1n \u0111\xE3 b\u1ECB t\u1EA1m kh\xF3a. Vui l\xF2ng li\xEAn h\u1EC7 b\u1ED9 ph\u1EADn h\u1ED7 tr\u1EE3."
      });
    }
    if (foundUser.role === "DRIVER") {
      const [prof] = await db.select().from(driverProfiles).where(eq2(driverProfiles.userId, foundUser.id)).limit(1);
      if (!prof) {
        await db.insert(driverProfiles).values({
          userId: foundUser.id,
          kycStatus: "PENDING",
          isOnline: false,
          isActive: true
        });
      }
    }
    await getOrCreateWallet(foundUser.id);
    const token = generateToken({
      userId: foundUser.id,
      role: foundUser.role,
      phone: foundUser.phone
    });
    return res.json({
      success: true,
      message: "\u0110\u0103ng nh\u1EADp th\xE0nh c\xF4ng!",
      token,
      isNewUser: false,
      user: {
        id: foundUser.id,
        phone: foundUser.phone,
        fullName: foundUser.fullName,
        role: foundUser.role,
        avatarUrl: foundUser.avatarUrl
      }
    });
  } catch (err) {
    next(err);
  }
});
router.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: "M\u1EADt kh\u1EA9u m\u1EDBi ph\u1EA3i c\xF3 t\u1ED1i thi\u1EC3u 6 k\xFD t\u1EF1"
      });
    }
    const [user] = await db.select().from(users).where(eq2(users.id, req.user.userId)).limit(1);
    if (!user) {
      return res.status(404).json({ success: false, message: "Kh\xF4ng t\xECm th\u1EA5y ng\u01B0\u1EDDi d\xF9ng" });
    }
    if (user.passwordHash && currentPassword) {
      const isMatch = await comparePassword(currentPassword.trim(), user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: "M\u1EADt kh\u1EA9u hi\u1EC7n t\u1EA1i kh\xF4ng ch\xEDnh x\xE1c" });
      }
    }
    const newHash = await hashPassword(newPassword.trim());
    await db.update(users).set({ passwordHash: newHash, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(users.id, user.id));
    return res.json({
      success: true,
      message: "\u0110\u1ED5i m\u1EADt kh\u1EA9u th\xE0nh c\xF4ng!"
    });
  } catch (err) {
    next(err);
  }
});
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const [foundUser] = await db.select({
      userId: users.id,
      phone: users.phone,
      email: users.email,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      status: users.status
    }).from(users).where(eq2(users.id, req.user.userId)).limit(1);
    res.json({
      success: true,
      user: foundUser || req.user
    });
  } catch (err) {
    next(err);
  }
});
router.put("/me", requireAuth, async (req, res, next) => {
  try {
    const { fullName, email, avatarUrl } = req.body;
    const updateData = {
      updatedAt: /* @__PURE__ */ new Date()
    };
    if (fullName !== void 0) updateData.fullName = typeof fullName === "string" ? fullName.trim() : null;
    if (email !== void 0) updateData.email = typeof email === "string" && email.trim() ? email.trim() : null;
    if (avatarUrl !== void 0) updateData.avatarUrl = avatarUrl;
    const [updatedUser] = await db.update(users).set(updateData).where(eq2(users.id, req.user.userId)).returning();
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "Kh\xF4ng t\xECm th\u1EA5y ng\u01B0\u1EDDi d\xF9ng"
      });
    }
    res.json({
      success: true,
      message: "C\u1EADp nh\u1EADt th\xF4ng tin th\xE0nh c\xF4ng",
      user: {
        userId: updatedUser.id,
        phone: updatedUser.phone,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        avatarUrl: updatedUser.avatarUrl,
        role: updatedUser.role,
        status: updatedUser.status
      }
    });
  } catch (err) {
    next(err);
  }
});
router.post(
  "/device-token",
  requireAuth,
  async (req, res, next) => {
    try {
      const device = await registerDeviceToken(req.user.userId, req.body);
      res.json({
        success: true,
        message: "\u0110\u0103ng k\xFD thi\u1EBFt b\u1ECB nh\u1EADn th\xF4ng b\xE1o \u0111\u1EA9y th\xE0nh c\xF4ng",
        data: device
      });
    } catch (err) {
      next(err);
    }
  }
);
router.delete(
  "/device-token",
  requireAuth,
  async (req, res, next) => {
    try {
      const { fcmToken } = req.body;
      const result = await removeDeviceToken(req.user.userId, fcmToken);
      res.json({
        success: true,
        message: "H\u1EE7y \u0111\u0103ng k\xFD thi\u1EBFt b\u1ECB th\xE0nh c\xF4ng",
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
);
var auth_default = router;

// src/api/routes/customer.ts
import { Router as Router2 } from "express";
import { eq as eq4, desc as desc3, and as and3, sql as sql3 } from "drizzle-orm";

// src/lib/addressService.ts
import { eq as eq3, and as and2, desc as desc2, ne, sql as sql2 } from "drizzle-orm";
function validateCoordinates(lat, lng) {
  if (lat !== void 0 && lat !== null && lat !== "") {
    const latNum = Number(lat);
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      throw new Error("V\u0129 \u0111\u1ED9 (Latitude) kh\xF4ng h\u1EE3p l\u1EC7 (ph\u1EA3i t\u1EEB -90 \u0111\u1EBFn 90)");
    }
  }
  if (lng !== void 0 && lng !== null && lng !== "") {
    const lngNum = Number(lng);
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      throw new Error("Kinh \u0111\u1ED9 (Longitude) kh\xF4ng h\u1EE3p l\u1EC7 (ph\u1EA3i t\u1EEB -180 \u0111\u1EBFn 180)");
    }
  }
}
async function getCustomerAddresses(userId, options) {
  if (!userId) {
    throw new Error("Thi\u1EBFu ID ng\u01B0\u1EDDi d\xF9ng");
  }
  if (!options?.page && !options?.limit) {
    const list2 = await db.select().from(customerAddresses).where(eq3(customerAddresses.userId, userId)).orderBy(
      desc2(customerAddresses.isDefault),
      desc2(customerAddresses.createdAt)
    );
    return list2;
  }
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
  const offset = (page - 1) * limit;
  const countResult = await db.select({ count: sql2`count(*)::int` }).from(customerAddresses).where(eq3(customerAddresses.userId, userId));
  const total = countResult[0]?.count || 0;
  const list = await db.select().from(customerAddresses).where(eq3(customerAddresses.userId, userId)).orderBy(
    desc2(customerAddresses.isDefault),
    desc2(customerAddresses.createdAt)
  ).limit(limit).offset(offset);
  return {
    addresses: list,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}
async function createCustomerAddress(userId, input) {
  if (!userId) {
    throw new Error("Thi\u1EBFu ID ng\u01B0\u1EDDi d\xF9ng");
  }
  if (!input.addressText || !input.addressText.trim()) {
    throw new Error("\u0110\u1ECBa ch\u1EC9 chi ti\u1EBFt (addressText) kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng");
  }
  validateCoordinates(input.latitude, input.longitude);
  let contactPhone = input.contactPhone?.trim();
  if (contactPhone) {
    const phoneCheck = validateAndNormalizePhone(contactPhone);
    if (phoneCheck.valid) {
      contactPhone = phoneCheck.standardPhone;
    }
  }
  const existingList = await db.select({ id: customerAddresses.id }).from(customerAddresses).where(eq3(customerAddresses.userId, userId));
  let shouldBeDefault = input.isDefault ?? false;
  if (existingList.length === 0) {
    shouldBeDefault = true;
  }
  if (shouldBeDefault) {
    await db.update(customerAddresses).set({ isDefault: false }).where(eq3(customerAddresses.userId, userId));
  }
  const inserted = await db.insert(customerAddresses).values({
    userId,
    title: input.title?.trim() || null,
    addressText: input.addressText.trim(),
    latitude: input.latitude !== void 0 && input.latitude !== null && input.latitude !== "" ? String(input.latitude) : null,
    longitude: input.longitude !== void 0 && input.longitude !== null && input.longitude !== "" ? String(input.longitude) : null,
    contactName: input.contactName?.trim() || null,
    contactPhone: contactPhone || null,
    isDefault: shouldBeDefault
  }).returning();
  return inserted[0];
}
async function updateCustomerAddress(userId, addressId, input) {
  if (!userId || !addressId) {
    throw new Error("Thi\u1EBFu ID ng\u01B0\u1EDDi d\xF9ng ho\u1EB7c ID \u0111\u1ECBa ch\u1EC9");
  }
  const existing = await db.select().from(customerAddresses).where(
    and2(
      eq3(customerAddresses.id, addressId),
      eq3(customerAddresses.userId, userId)
    )
  ).limit(1);
  if (existing.length === 0) {
    throw new Error(
      "\u0110\u1ECBa ch\u1EC9 kh\xF4ng t\u1ED3n t\u1EA1i ho\u1EB7c b\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n ch\u1EC9nh s\u1EEDa \u0111\u1ECBa ch\u1EC9 n\xE0y"
    );
  }
  validateCoordinates(input.latitude, input.longitude);
  let contactPhone = input.contactPhone !== void 0 ? input.contactPhone?.trim() : existing[0].contactPhone;
  if (contactPhone) {
    const phoneCheck = validateAndNormalizePhone(contactPhone);
    if (phoneCheck.valid) {
      contactPhone = phoneCheck.standardPhone;
    }
  }
  if (input.isDefault === true) {
    await db.update(customerAddresses).set({ isDefault: false }).where(
      and2(
        eq3(customerAddresses.userId, userId),
        ne(customerAddresses.id, addressId)
      )
    );
  }
  const updated = await db.update(customerAddresses).set({
    title: input.title !== void 0 ? input.title?.trim() || null : existing[0].title,
    addressText: input.addressText !== void 0 ? input.addressText.trim() : existing[0].addressText,
    latitude: input.latitude !== void 0 ? input.latitude !== null && input.latitude !== "" ? String(input.latitude) : null : existing[0].latitude,
    longitude: input.longitude !== void 0 ? input.longitude !== null && input.longitude !== "" ? String(input.longitude) : null : existing[0].longitude,
    contactName: input.contactName !== void 0 ? input.contactName?.trim() || null : existing[0].contactName,
    contactPhone: contactPhone || null,
    isDefault: input.isDefault !== void 0 ? input.isDefault : existing[0].isDefault
  }).where(eq3(customerAddresses.id, addressId)).returning();
  return updated[0];
}
async function deleteCustomerAddress(userId, addressId) {
  if (!userId || !addressId) {
    throw new Error("Thi\u1EBFu ID ng\u01B0\u1EDDi d\xF9ng ho\u1EB7c ID \u0111\u1ECBa ch\u1EC9");
  }
  const existing = await db.select().from(customerAddresses).where(
    and2(
      eq3(customerAddresses.id, addressId),
      eq3(customerAddresses.userId, userId)
    )
  ).limit(1);
  if (existing.length === 0) {
    throw new Error(
      "\u0110\u1ECBa ch\u1EC9 kh\xF4ng t\u1ED3n t\u1EA1i ho\u1EB7c b\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n x\xF3a \u0111\u1ECBa ch\u1EC9 n\xE0y"
    );
  }
  const wasDefault = existing[0].isDefault;
  await db.delete(customerAddresses).where(eq3(customerAddresses.id, addressId));
  if (wasDefault) {
    const remaining = await db.select().from(customerAddresses).where(eq3(customerAddresses.userId, userId)).orderBy(desc2(customerAddresses.createdAt)).limit(1);
    if (remaining.length > 0) {
      await db.update(customerAddresses).set({ isDefault: true }).where(eq3(customerAddresses.id, remaining[0].id));
    }
  }
  return {
    success: true,
    message: "\u0110\xE3 x\xF3a \u0111\u1ECBa ch\u1EC9 th\xE0nh c\xF4ng"
  };
}
async function setDefaultCustomerAddress(userId, addressId) {
  if (!userId || !addressId) {
    throw new Error("Thi\u1EBFu ID ng\u01B0\u1EDDi d\xF9ng ho\u1EB7c ID \u0111\u1ECBa ch\u1EC9");
  }
  const existing = await db.select().from(customerAddresses).where(
    and2(
      eq3(customerAddresses.id, addressId),
      eq3(customerAddresses.userId, userId)
    )
  ).limit(1);
  if (existing.length === 0) {
    throw new Error(
      "\u0110\u1ECBa ch\u1EC9 kh\xF4ng t\u1ED3n t\u1EA1i ho\u1EB7c b\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n s\u1EEDa \u0111\u1ECBa ch\u1EC9 n\xE0y"
    );
  }
  await db.update(customerAddresses).set({ isDefault: false }).where(eq3(customerAddresses.userId, userId));
  const updated = await db.update(customerAddresses).set({ isDefault: true }).where(eq3(customerAddresses.id, addressId)).returning();
  return updated[0];
}

// src/api/routes/customer.ts
var router2 = Router2();
router2.use(requireAuth, requireRoles(["CUSTOMER", "ADMIN"]));
router2.get("/wallet", async (req, res, next) => {
  try {
    const wallet = await getWalletDetails(req.user.userId);
    res.json({
      success: true,
      data: wallet
    });
  } catch (err) {
    next(err);
  }
});
router2.post("/wallet/topup", async (req, res, next) => {
  try {
    const { amount, description, referenceCode } = req.body;
    const result = await topUpWallet({
      userId: req.user.userId,
      amount: Number(amount),
      description: description || `Kh\xE1ch h\xE0ng n\u1EA1p ${Number(amount).toLocaleString("vi-VN")} \u0111 v\xE0o v\xED`,
      referenceCode,
      performedByUserId: req.user.userId
    });
    res.json({
      success: true,
      message: result.message,
      data: result.wallet
    });
  } catch (err) {
    next(err);
  }
});
router2.get("/wallet/transactions", async (req, res, next) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const type = req.query.type ? String(req.query.type) : void 0;
    const result = await getWalletTransactions(req.user.userId, {
      page,
      limit,
      type
    });
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
});
router2.get("/addresses", async (req, res, next) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : void 0;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : void 0;
    const result = await getCustomerAddresses(req.user.userId, { page, limit });
    if (page !== void 0 || limit !== void 0) {
      const paginated = result;
      res.json({
        success: true,
        data: paginated.addresses,
        pagination: paginated.pagination
      });
    } else {
      res.json({ success: true, data: result });
    }
  } catch (err) {
    next(err);
  }
});
router2.post("/addresses", async (req, res, next) => {
  try {
    const newAddress = await createCustomerAddress(req.user.userId, req.body);
    res.status(201).json({
      success: true,
      message: "Th\xEAm \u0111\u1ECBa ch\u1EC9 v\xE0o s\u1ED5 th\xE0nh c\xF4ng",
      data: newAddress
    });
  } catch (err) {
    next(err);
  }
});
router2.patch("/addresses/:id/default", async (req, res, next) => {
  try {
    const updated = await setDefaultCustomerAddress(
      req.user.userId,
      req.params.id
    );
    res.json({
      success: true,
      message: "\u0110\xE3 \u0111\u1EB7t l\xE0m \u0111\u1ECBa ch\u1EC9 m\u1EB7c \u0111\u1ECBnh",
      data: updated
    });
  } catch (err) {
    next(err);
  }
});
router2.put("/addresses/:id", async (req, res, next) => {
  try {
    const updated = await updateCustomerAddress(
      req.user.userId,
      req.params.id,
      req.body
    );
    res.json({
      success: true,
      message: "C\u1EADp nh\u1EADt \u0111\u1ECBa ch\u1EC9 th\xE0nh c\xF4ng",
      data: updated
    });
  } catch (err) {
    next(err);
  }
});
router2.delete("/addresses/:id", async (req, res, next) => {
  try {
    const result = await deleteCustomerAddress(
      req.user.userId,
      req.params.id
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});
router2.get("/notifications", requireAuth, async (req, res, next) => {
  try {
    const result = await db.select().from(notifications).where(eq4(notifications.userId, req.user.userId)).orderBy(desc3(notifications.createdAt)).limit(50);
    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});
router2.patch("/notifications/read-all", requireAuth, async (req, res, next) => {
  try {
    await db.update(notifications).set({ isRead: true }).where(
      and3(
        eq4(notifications.userId, req.user.userId),
        eq4(notifications.isRead, false)
      )
    );
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
router2.get("/notifications/unread-count", requireAuth, async (req, res, next) => {
  try {
    const result = await db.select({ count: sql3`count(*)::int` }).from(notifications).where(
      and3(
        eq4(notifications.userId, req.user.userId),
        eq4(notifications.isRead, false)
      )
    );
    return res.json({ success: true, count: result[0]?.count || 0 });
  } catch (err) {
    next(err);
  }
});
router2.post("/complaints", requireAuth, async (req, res, next) => {
  try {
    const { bookingId, driverId, category, description, estimatedLoss, proofImageUrls } = req.body;
    if (!category || !description?.trim()) {
      return res.status(400).json({ success: false, message: "Vui l\xF2ng ch\u1ECDn danh m\u1EE5c v\xE0 m\xF4 t\u1EA3 chi ti\u1EBFt s\u1EF1 c\u1ED1." });
    }
    const isValidUuid = (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const [complaint] = await db.insert(complaints).values({
      userId: req.user.userId,
      bookingId: isValidUuid(bookingId) ? bookingId : null,
      driverId: isValidUuid(driverId) ? driverId : null,
      category,
      description: description.trim(),
      estimatedLoss: estimatedLoss || null,
      proofImageUrls: Array.isArray(proofImageUrls) ? proofImageUrls : proofImageUrls ? [proofImageUrls] : []
    }).returning();
    return res.json({ success: true, data: complaint });
  } catch (err) {
    next(err);
  }
});
router2.get("/complaints", requireAuth, async (req, res, next) => {
  try {
    const result = await db.select().from(complaints).where(eq4(complaints.userId, req.user.userId)).orderBy(desc3(complaints.createdAt)).limit(50);
    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});
var customer_default = router2;

// src/api/routes/driver.ts
import { Router as Router3 } from "express";

// src/lib/driverService.ts
import { eq as eq5, and as and4, ne as ne2 } from "drizzle-orm";
var REQUIRED_KYC_DOC_TYPES = [
  "CCCD_FRONT",
  "CCCD_BACK",
  "DRIVER_LICENSE",
  "VEHICLE_REGISTRATION"
];
async function getVehicleTypes() {
  return await db.select().from(vehicleTypes).where(eq5(vehicleTypes.isActive, true));
}
async function getOrCreateDriverProfile(userId) {
  if (!userId) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin ng\u01B0\u1EDDi d\xF9ng (userId)");
  }
  const userList = await db.select().from(users).where(eq5(users.id, userId)).limit(1);
  if (userList.length === 0) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y ng\u01B0\u1EDDi d\xF9ng trong h\u1EC7 th\u1ED1ng");
  }
  let profile = await db.select().from(driverProfiles).where(eq5(driverProfiles.userId, userId)).limit(1);
  if (profile.length > 0) {
    return profile[0];
  }
  const inserted = await db.insert(driverProfiles).values({
    userId,
    kycStatus: "PENDING",
    isOnline: false,
    isActive: true
  }).returning();
  if (userList[0].role !== "DRIVER") {
    await db.update(users).set({ role: "DRIVER" }).where(eq5(users.id, userId));
  }
  return inserted[0];
}
async function getDriverProfile(userId) {
  if (!userId) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin ng\u01B0\u1EDDi d\xF9ng (userId)");
  }
  const profile = await db.select().from(driverProfiles).where(eq5(driverProfiles.userId, userId)).limit(1);
  if (profile.length === 0) {
    return null;
  }
  const p = profile[0];
  let vehicleType = null;
  if (p.vehicleTypeId) {
    const vList = await db.select().from(vehicleTypes).where(eq5(vehicleTypes.id, p.vehicleTypeId)).limit(1);
    if (vList.length > 0) {
      vehicleType = vList[0];
    }
  }
  const uList = await db.select({
    id: users.id,
    phone: users.phone,
    fullName: users.fullName,
    avatarUrl: users.avatarUrl,
    role: users.role,
    status: users.status
  }).from(users).where(eq5(users.id, userId)).limit(1);
  const docs = await db.select().from(driverDocuments).where(eq5(driverDocuments.driverId, p.id));
  return {
    ...p,
    user: uList[0] || null,
    vehicleType,
    documents: docs
  };
}
async function submitDriverKyc(userId, data) {
  if (!userId) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin ng\u01B0\u1EDDi d\xF9ng");
  }
  if (!data || !Array.isArray(data.documents) || data.documents.length === 0) {
    throw new ApiError(400, "Danh s\xE1ch gi\u1EA5y t\u1EDD (documents) kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng");
  }
  const validDocTypes = [
    "CCCD_FRONT",
    "CCCD_BACK",
    "DRIVER_LICENSE",
    "VEHICLE_REGISTRATION",
    "PORTRAIT"
  ];
  for (const doc of data.documents) {
    if (!validDocTypes.includes(doc.docType)) {
      throw new ApiError(
        400,
        `Lo\u1EA1i t\xE0i li\u1EC7u "${doc.docType}" kh\xF4ng h\u1EE3p l\u1EC7. Cho ph\xE9p: ${validDocTypes.join(", ")}`
      );
    }
    if (!doc.fileUrl || typeof doc.fileUrl !== "string" || !doc.fileUrl.trim()) {
      throw new ApiError(
        400,
        `\u0110\u01B0\u1EDDng d\u1EABn \u1EA3nh/t\xE0i li\u1EC7u "${doc.docType}" kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng`
      );
    }
  }
  const profile = await getOrCreateDriverProfile(userId);
  if (data.vehicleTypeId) {
    const vCheck = await db.select().from(vehicleTypes).where(eq5(vehicleTypes.id, data.vehicleTypeId)).limit(1);
    if (vCheck.length === 0) {
      throw new ApiError(400, "M\xE3 lo\u1EA1i xe (vehicleTypeId) kh\xF4ng t\u1ED3n t\u1EA1i");
    }
  }
  if (data.licensePlate) {
    const cleanPlate = data.licensePlate.trim().toUpperCase();
    const existingPlate = await db.select().from(driverProfiles).where(
      and4(
        eq5(driverProfiles.licensePlate, cleanPlate),
        ne2(driverProfiles.id, profile.id)
      )
    ).limit(1);
    if (existingPlate.length > 0) {
      throw new ApiError(
        400,
        `Bi\u1EC3n s\u1ED1 xe "${cleanPlate}" \u0111\xE3 \u0111\u01B0\u1EE3c \u0111\u0103ng k\xFD b\u1EDFi t\xE0i x\u1EBF kh\xE1c`
      );
    }
    data.licensePlate = cleanPlate;
  }
  if (data.driverLicenseNo) {
    const cleanLicense = data.driverLicenseNo.trim();
    const existingLicense = await db.select().from(driverProfiles).where(
      and4(
        eq5(driverProfiles.driverLicenseNo, cleanLicense),
        ne2(driverProfiles.id, profile.id)
      )
    ).limit(1);
    if (existingLicense.length > 0) {
      throw new ApiError(
        400,
        `S\u1ED1 gi\u1EA5y ph\xE9p l\xE1i xe "${cleanLicense}" \u0111\xE3 \u0111\u01B0\u1EE3c \u0111\u0103ng k\xFD b\u1EDFi t\xE0i x\u1EBF kh\xE1c`
      );
    }
    data.driverLicenseNo = cleanLicense;
  }
  const updateFields = {
    kycStatus: "PENDING",
    rejectionReason: null,
    // Reset lý do từ chối cũ
    updatedAt: /* @__PURE__ */ new Date()
  };
  if (data.vehicleTypeId) updateFields.vehicleTypeId = data.vehicleTypeId;
  if (data.licensePlate) updateFields.licensePlate = data.licensePlate;
  if (data.driverLicenseNo) updateFields.driverLicenseNo = data.driverLicenseNo;
  await db.update(driverProfiles).set(updateFields).where(eq5(driverProfiles.id, profile.id));
  for (const doc of data.documents) {
    await db.delete(driverDocuments).where(
      and4(
        eq5(driverDocuments.driverId, profile.id),
        eq5(driverDocuments.docType, doc.docType)
      )
    );
    await db.insert(driverDocuments).values({
      driverId: profile.id,
      docType: doc.docType,
      fileUrl: doc.fileUrl.trim(),
      docNumber: doc.docNumber ? doc.docNumber.trim() : null
    });
  }
  const allDocs = await db.select({ docType: driverDocuments.docType }).from(driverDocuments).where(eq5(driverDocuments.driverId, profile.id));
  const submittedTypes = new Set(allDocs.map((d) => d.docType));
  const missingDocs = REQUIRED_KYC_DOC_TYPES.filter(
    (reqDoc) => !submittedTypes.has(reqDoc)
  );
  if (missingDocs.length > 0) {
    throw new ApiError(
      400,
      `H\u1ED3 s\u01A1 ch\u01B0a \u0111\u1EE7 gi\u1EA5y t\u1EDD b\u1EAFt bu\u1ED9c. Vui l\xF2ng n\u1ED9p b\u1ED5 sung: ${missingDocs.join(", ")}`,
      "MISSING_REQUIRED_DOCUMENTS"
    );
  }
  return await getDriverProfile(userId);
}
async function getDriverKycStatus(userId) {
  const profile = await getDriverProfile(userId);
  if (!profile) {
    return {
      hasProfile: false,
      kycStatus: null,
      isOnline: false,
      isActive: false,
      canGoOnline: false,
      missingDocuments: REQUIRED_KYC_DOC_TYPES,
      message: "Ch\u01B0a c\xF3 h\u1ED3 s\u01A1 t\xE0i x\u1EBF"
    };
  }
  const submittedDocTypes = (profile.documents || []).map(
    (d) => d.docType
  );
  const missingDocuments = REQUIRED_KYC_DOC_TYPES.filter(
    (reqDoc) => !submittedDocTypes.includes(reqDoc)
  );
  const wallet = await getWalletDetails(userId);
  const canGoOnline = profile.kycStatus === "APPROVED" && profile.isActive === true && wallet.isDepositQualified;
  return {
    hasProfile: true,
    driverId: profile.id,
    kycStatus: profile.kycStatus,
    rejectionReason: profile.rejectionReason,
    isOnline: profile.isOnline,
    isActive: profile.isActive,
    canGoOnline,
    licensePlate: profile.licensePlate,
    driverLicenseNo: profile.driverLicenseNo,
    vehicleType: profile.vehicleType,
    documentsCount: profile.documents.length,
    missingDocuments,
    wallet: {
      balance: wallet.balance,
      availableBalance: wallet.availableBalance,
      minDepositLimit: wallet.minDepositLimit,
      isDepositQualified: wallet.isDepositQualified,
      shortfall: wallet.shortfall
    }
  };
}
async function setDriverOnlineStatus(userId, isOnline) {
  if (!userId) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin ng\u01B0\u1EDDi d\xF9ng");
  }
  if (typeof isOnline !== "boolean") {
    throw new ApiError(
      400,
      "Tr\u1EA1ng th\xE1i isOnline ph\u1EA3i l\xE0 gi\xE1 tr\u1ECB boolean (true/false)"
    );
  }
  const profile = await db.select().from(driverProfiles).where(eq5(driverProfiles.userId, userId)).limit(1);
  if (profile.length === 0) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y h\u1ED3 s\u01A1 t\xE0i x\u1EBF");
  }
  const p = profile[0];
  if (isOnline) {
    if (p.kycStatus !== "APPROVED") {
      const statusText = p.kycStatus === "PENDING" ? "H\u1ED3 s\u01A1 \u0111ang ch\u1EDD Qu\u1EA3n tr\u1ECB vi\xEAn x\xE9t duy\u1EC7t" : p.kycStatus === "REJECTED" ? `H\u1ED3 s\u01A1 \u0111\xE3 b\u1ECB t\u1EEB ch\u1ED1i (${p.rejectionReason || "Vui l\xF2ng n\u1ED9p l\u1EA1i gi\u1EA5y t\u1EDD"})` : "Ch\u01B0a ho\xE0n t\u1EA5t n\u1ED9p h\u1ED3 s\u01A1 KYC";
      throw new ApiError(
        403,
        `B\u1EA1n ch\u01B0a th\u1EC3 b\u1EADt tr\u1EF1c tuy\u1EBFn. ${statusText}. Ch\u1EC9 t\xE0i x\u1EBF c\xF3 h\u1ED3 s\u01A1 \u0110\xC3 \u0110\u01AF\u1EE2C PH\xCA DUY\u1EC6T m\u1EDBi c\xF3 th\u1EC3 nh\u1EADn chuy\u1EBFn.`,
        "KYC_NOT_APPROVED"
      );
    }
    if (!p.isActive) {
      throw new ApiError(
        403,
        "T\xE0i kho\u1EA3n t\xE0i x\u1EBF c\u1EE7a b\u1EA1n \u0111ang b\u1ECB t\u1EA1m ng\u01B0ng ho\u1EB7c v\xF4 hi\u1EC7u h\xF3a. Vui l\xF2ng li\xEAn h\u1EC7 t\u1ED5ng \u0111\xE0i h\u1ED7 tr\u1EE3.",
        "DRIVER_INACTIVE"
      );
    }
    const depositEligibility = await checkDriverDepositEligibility(userId);
    if (!depositEligibility.eligible) {
      throw new ApiError(
        403,
        `Vui l\xF2ng n\u1EA1p t\u1ED1i thi\u1EC3u ${depositEligibility.shortfall.toLocaleString("vi-VN")} \u0111 v\xE0o V\xED K\xFD Qu\u1EF9 \u0111\u1EC3 k\xEDch ho\u1EA1t ch\u1EBF \u0111\u1ED9 Tr\u1EF1c tuy\u1EBFn (H\u1EA1n m\u1EE9c t\u1ED1i thi\u1EC3u y\xEAu c\u1EA7u: ${depositEligibility.minDepositLimit.toLocaleString("vi-VN")} \u0111, s\u1ED1 d\u01B0 kh\u1EA3 d\u1EE5ng hi\u1EC7n t\u1EA1i: ${depositEligibility.availableBalance.toLocaleString("vi-VN")} \u0111).`,
        "REQUIRE_WALLET_DEPOSIT"
      );
    }
  }
  const updated = await db.update(driverProfiles).set({
    isOnline,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq5(driverProfiles.id, p.id)).returning();
  return {
    driverId: p.id,
    isOnline: updated[0].isOnline,
    kycStatus: updated[0].kycStatus,
    message: isOnline ? "\u0110\xE3 b\u1EADt tr\u1EA1ng th\xE1i tr\u1EF1c tuy\u1EBFn th\xE0nh c\xF4ng. B\u1EA1n \u0111\xE3 s\u1EB5n s\xE0ng nh\u1EADn chuy\u1EBFn!" : "\u0110\xE3 t\u1EAFt tr\u1EA1ng th\xE1i tr\u1EF1c tuy\u1EBFn. B\u1EA1n \u0111ang \u1EDF ch\u1EBF \u0111\u1ED9 ngh\u1EC9 (Ngo\u1EA1i tuy\u1EBFn)."
  };
}

// src/lib/dispatchService.ts
init_pusher();
var driverLastUpdateMap = /* @__PURE__ */ new Map();
var MIN_UPDATE_INTERVAL_MS = 2e3;
async function updateDriverLocation(driverId, coords) {
  if (!driverId) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin driverId");
  }
  const now = Date.now();
  const lastTime = driverLastUpdateMap.get(driverId) || 0;
  if (!coords.bypassRateLimit && now - lastTime < MIN_UPDATE_INTERVAL_MS) {
    const remainingSeconds = ((MIN_UPDATE_INTERVAL_MS - (now - lastTime)) / 1e3).toFixed(1);
    throw new ApiError(
      429,
      `T\u1EA7n su\u1EA5t c\u1EADp nh\u1EADt v\u1ECB tr\xED qu\xE1 nhanh. T\u1ED1i \u0111a 1 l\u1EA7n m\u1ED7i 2 gi\xE2y (Vui l\xF2ng ch\u1EDD ${remainingSeconds}s).`,
      "RATE_LIMIT_EXCEEDED"
    );
  }
  const rawLat = coords.lat !== void 0 ? coords.lat : coords.latitude;
  const rawLng = coords.lng !== void 0 ? coords.lng : coords.longitude;
  if (rawLat === void 0 || rawLat === null) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin v\u0129 \u0111\u1ED9 (lat ho\u1EB7c latitude)");
  }
  if (rawLng === void 0 || rawLng === null) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin kinh \u0111\u1ED9 (lng ho\u1EB7c longitude)");
  }
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  const heading = coords.heading !== void 0 && coords.heading !== null ? Number(coords.heading) : null;
  const speed = coords.speed !== void 0 && coords.speed !== null ? Number(coords.speed) : null;
  if (isNaN(lat) || lat < -90 || lat > 90) {
    throw new ApiError(400, "V\u0129 \u0111\u1ED9 (lat) kh\xF4ng h\u1EE3p l\u1EC7 (-90 \u0111\u1EBFn 90)");
  }
  if (isNaN(lng) || lng < -180 || lng > 180) {
    throw new ApiError(400, "Kinh \u0111\u1ED9 (lng) kh\xF4ng h\u1EE3p l\u1EC7 (-180 \u0111\u1EBFn 180)");
  }
  const rows = await client.unsafe(
    `
    INSERT INTO driver_locations (driver_id, location_point, heading, updated_at)
    VALUES (
      $1::uuid,
      ST_SetSRID(ST_MakePoint($2::double precision, $3::double precision), 4326),
      $4::numeric,
      NOW()
    )
    ON CONFLICT (driver_id) DO UPDATE
    SET 
      location_point = EXCLUDED.location_point,
      heading = EXCLUDED.heading,
      updated_at = NOW()
    RETURNING 
      driver_id,
      ST_Y(location_point) as latitude,
      ST_X(location_point) as longitude,
      heading,
      updated_at
    `,
    [driverId, lng, lat, heading]
  );
  driverLastUpdateMap.set(driverId, now);
  const updated = rows[0];
  const activeBookings = await client.unsafe(
    `
    SELECT id, booking_code, status
    FROM bookings
    WHERE driver_id = $1::uuid
      AND status IN ('ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT')
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [driverId]
  );
  let activeBooking = null;
  if (activeBookings.length > 0) {
    const ab = activeBookings[0];
    activeBooking = {
      id: ab.id,
      bookingCode: ab.booking_code,
      status: ab.status
    };
    await triggerDriverLocationUpdate(ab.id, {
      driverId,
      latitude: Number(updated.latitude),
      longitude: Number(updated.longitude),
      heading,
      speed
    });
  }
  return {
    driverId: updated.driver_id,
    latitude: Number(updated.latitude),
    longitude: Number(updated.longitude),
    heading: updated.heading !== null ? Number(updated.heading) : null,
    speed: speed !== null ? Number(speed) : null,
    updatedAt: updated.updated_at,
    activeBooking
  };
}
async function getDriverLocation(driverId) {
  if (!driverId) return null;
  const rows = await client.unsafe(
    `
    SELECT 
      driver_id,
      ST_Y(location_point) as latitude,
      ST_X(location_point) as longitude,
      heading,
      updated_at
    FROM driver_locations
    WHERE driver_id = $1::uuid
    LIMIT 1
    `,
    [driverId]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    driverId: row.driver_id,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    heading: row.heading !== null ? Number(row.heading) : null,
    updatedAt: row.updated_at
  };
}
async function findNearbyDrivers(options) {
  const originLat = Number(options.originLat);
  const originLng = Number(options.originLng);
  if (isNaN(originLat) || originLat < -90 || originLat > 90) {
    throw new ApiError(
      400,
      "T\u1ECDa \u0111\u1ED9 \u0111i\u1EC3m \u0111\xF3n (originLat) kh\xF4ng h\u1EE3p l\u1EC7 (-90 \u0111\u1EBFn 90)"
    );
  }
  if (isNaN(originLng) || originLng < -180 || originLng > 180) {
    throw new ApiError(
      400,
      "T\u1ECDa \u0111\u1ED9 \u0111i\u1EC3m \u0111\xF3n (originLng) kh\xF4ng h\u1EE3p l\u1EC7 (-180 \u0111\u1EBFn 180)"
    );
  }
  let radiusMeters = 5e3;
  if (options.radiusMeters && options.radiusMeters > 0) {
    radiusMeters = Number(options.radiusMeters);
  } else if (options.radiusKm && options.radiusKm > 0) {
    radiusMeters = Number(options.radiusKm) * 1e3;
  }
  const limit = options.limit && options.limit > 0 ? Math.min(Number(options.limit), 50) : 10;
  const vehicleTypeId = options.vehicleTypeId ? String(options.vehicleTypeId).trim() : null;
  const excludeDriverIds = Array.isArray(options.excludeDriverIds) ? options.excludeDriverIds.filter(Boolean) : [];
  const maxAgeMinutes = options.maxAgeMinutes !== void 0 ? Number(options.maxAgeMinutes) : null;
  const conditions = [
    `dp.is_online = true`,
    `dp.kyc_status = 'APPROVED'`,
    `dp.is_active = true`,
    `u.status = 'ACTIVE'`,
    // PostGIS ST_DWithin trên geography (chuẩn bán cầu WGS84, khoảng cách tính bằng mét)
    `ST_DWithin(
      dl.location_point::geography,
      ST_SetSRID(ST_MakePoint($1::double precision, $2::double precision), 4326)::geography,
      $3::double precision
    )`
  ];
  const params = [originLng, originLat, radiusMeters];
  let paramIndex = 4;
  if (vehicleTypeId) {
    conditions.push(`dp.vehicle_type_id = $${paramIndex}::uuid`);
    params.push(vehicleTypeId);
    paramIndex++;
  }
  if (excludeDriverIds.length > 0) {
    conditions.push(`dp.id NOT IN (SELECT unnest($${paramIndex}::uuid[]))`);
    params.push(excludeDriverIds);
    paramIndex++;
  }
  conditions.push(`
    NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.driver_id = dp.id
        AND b.status IN ('ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT')
    )
  `);
  if (maxAgeMinutes && maxAgeMinutes > 0) {
    conditions.push(
      `dl.updated_at >= NOW() - ($${paramIndex}::integer * INTERVAL '1 minute')`
    );
    params.push(maxAgeMinutes);
    paramIndex++;
  }
  const requireMinDeposit = options.requireMinDeposit !== false;
  if (requireMinDeposit) {
    conditions.push(
      `(w.id IS NOT NULL AND w.balance >= COALESCE(w.min_deposit_limit, 200000))`
    );
  }
  params.push(limit);
  const limitParam = `$${paramIndex}`;
  const query = `
    SELECT 
      dp.id AS driver_id,
      dp.user_id,
      u.full_name,
      u.phone,
      u.avatar_url,
      dp.license_plate,
      dp.rating_avg,
      dp.vehicle_type_id,
      vt.code AS vehicle_type_code,
      vt.name AS vehicle_type_name,
      ST_Y(dl.location_point) AS latitude,
      ST_X(dl.location_point) AS longitude,
      dl.heading,
      dl.updated_at AS last_updated_at,
      ROUND(
        ST_Distance(
          dl.location_point::geography,
          ST_SetSRID(ST_MakePoint($1::double precision, $2::double precision), 4326)::geography
        )::numeric, 1
      ) AS distance_meters
    FROM driver_profiles dp
    JOIN users u ON u.id = dp.user_id
    JOIN driver_locations dl ON dl.driver_id = dp.id
    LEFT JOIN vehicle_types vt ON vt.id = dp.vehicle_type_id
    LEFT JOIN wallets w ON w.user_id = dp.user_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY distance_meters ASC
    LIMIT ${limitParam}
  `;
  const rows = await client.unsafe(query, params);
  return rows.map((r) => {
    const distMeters = Number(r.distance_meters);
    return {
      driverId: r.driver_id,
      userId: r.user_id,
      fullName: r.full_name || "T\xE0i x\u1EBF",
      phone: r.phone,
      avatarUrl: r.avatar_url || null,
      licensePlate: r.license_plate || null,
      ratingAvg: Number(r.rating_avg || 5),
      vehicleTypeId: r.vehicle_type_id || null,
      vehicleTypeCode: r.vehicle_type_code || null,
      vehicleTypeName: r.vehicle_type_name || null,
      currentLocation: {
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        heading: r.heading !== null ? Number(r.heading) : null,
        lastUpdatedAt: r.last_updated_at
      },
      distanceMeters: distMeters,
      distanceKm: Math.round(distMeters / 1e3 * 100) / 100
    };
  });
}
async function getDemandHotspots(options) {
  const currentLat = options?.lat || 10.7769;
  const currentLng = options?.lng || 106.7009;
  const radiusKm = options?.radiusKm || 25;
  try {
    const query = `
      SELECT 
        b.id,
        b.origin_address,
        ST_X(b.origin_point::geometry) AS lng,
        ST_Y(b.origin_point::geometry) AS lat,
        b.status,
        b.created_at,
        ROUND(
          ST_Distance(
            b.origin_point::geography,
            ST_SetSRID(ST_MakePoint($1::double precision, $2::double precision), 4326)::geography
          )::numeric, 1
        ) AS distance_meters
      FROM bookings b
      WHERE (
        b.status IN ('PENDING', 'SEARCHING')
        OR (b.created_at >= NOW() - INTERVAL '4 hours' AND b.status IN ('ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT'))
      )
      AND ST_DWithin(
        b.origin_point::geography,
        ST_SetSRID(ST_MakePoint($1::double precision, $2::double precision), 4326)::geography,
        $3
      )
      ORDER BY b.created_at DESC
      LIMIT 50
    `;
    const rows = await client.unsafe(query, [currentLng, currentLat, radiusKm * 1e3]);
    const calcDistanceKm = (lat1, lon1, lat2, lon2) => {
      const p = 0.017453292519943295;
      const c = Math.cos;
      const a = 0.5 - c((lat2 - lat1) * p) / 2 + c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p)) / 2;
      return 12742 * Math.asin(Math.sqrt(a));
    };
    const extractDistrict = (addr) => {
      if (!addr) return "Khu v\u1EF1c Trung t\xE2m";
      if (/(Bến Nghé|Bến Thành|Đa Kao|Tân Định|Phường Sài Gòn|Nguyễn Thái Bình|Phạm Ngũ Lão|Cầu Ông Lãnh|Cô Giang|Cầu Kho|Quận 1\b|Q\.?\s*1\b)/i.test(addr)) {
        return "Khu v\u1EF1c Trung t\xE2m (Q.1)";
      }
      const match = addr.match(
        /(Quận\s+\w+|Q\.\s*\w+|Huyện\s+\w+|TP\.\s*\w+|Thị xã\s+\w+|Bình Thạnh|Gò Vấp|Tân Bình|Tân Phú|Phú Nhuận|Bình Tân|Củ Chi|Hóc Môn|Nhà Bè|Cần Giờ|Thủ Đức|Sóng Thần|Tân Tạo|Cát Lái|Hoàn Kiếm|Ba Đình|Đống Đa|Hai Bà Trưng|Cầu Giấy|Thanh Xuân|Hải Châu|Sơn Trà|Ngũ Hành Sơn|Ninh Kiều)/i
      );
      if (match) {
        let name = match[0].trim();
        if (/^Q\.\s*(\d+)$/i.test(name)) name = `Qu\u1EADn ${name.replace(/^Q\.\s*/i, "")}`;
        return name;
      }
      const parts = addr.split(",");
      if (parts.length >= 2) return parts[parts.length - 2].trim();
      return "Khu v\u1EF1c Trung t\xE2m";
    };
    const districtMap = {};
    rows.forEach((r) => {
      const distName = extractDistrict(r.origin_address);
      if (!districtMap[distName]) {
        districtMap[distName] = { count: 0, lats: [], lngs: [] };
      }
      districtMap[distName].count += 1;
      districtMap[distName].lats.push(Number(r.lat));
      districtMap[distName].lngs.push(Number(r.lng));
    });
    const initialDistricts = Object.entries(districtMap).map(([name, val]) => ({
      district: name,
      count: val.count,
      lat: val.lats.reduce((a, b) => a + b, 0) / val.lats.length,
      lng: val.lngs.reduce((a, b) => a + b, 0) / val.lngs.length,
      radiusMeters: Math.min(2200, Math.max(1200, val.count * 450))
    }));
    const mergedHotspots = [];
    for (const item of initialDistricts) {
      const nearby = mergedHotspots.find((existing) => {
        return calcDistanceKm(existing.lat, existing.lng, item.lat, item.lng) < 3.5;
      });
      if (nearby) {
        const total = nearby.count + item.count;
        nearby.lat = (nearby.lat * nearby.count + item.lat * item.count) / total;
        nearby.lng = (nearby.lng * nearby.count + item.lng * item.count) / total;
        nearby.count = total;
        nearby.radiusMeters = Math.min(2400, Math.max(1400, total * 500));
        if (item.district.includes("Trung t\xE2m") || item.district.includes("Q.1")) {
          nearby.district = item.district;
        }
      } else {
        mergedHotspots.push({ ...item });
      }
    }
    const sortedDistricts = mergedHotspots.sort((a, b) => b.count - a.count);
    const totalOrders = rows.length;
    if (sortedDistricts.length > 0 && totalOrders >= 2) {
      const topNames = sortedDistricts.slice(0, 2).map((d) => d.district).join(" & ");
      return {
        isHighDemand: true,
        badge: "\u{1F525} Nhu c\u1EA7u cao:",
        text: `${topNames} \u0111ang c\xF3 ${totalOrders} \u0111\u01A1n \u0111\u1EB7t xe (+15% c\u01B0\u1EDBc)`,
        surgeBonusPercent: 15,
        hotspots: sortedDistricts.slice(0, 3)
      };
    }
    if (sortedDistricts.length === 1) {
      const d = sortedDistricts[0];
      return {
        isHighDemand: false,
        badge: "\u26A1 \u0110ang c\xF3 \u0111\u01A1n:",
        text: `${d.district} \u0111ang c\xF3 \u0111\u01A1n \u0111\u1EB7t xe ch\u1EDD t\xE0i x\u1EBF ti\u1EBFp nh\u1EADn`,
        surgeBonusPercent: 0,
        hotspots: [d]
      };
    }
    return {
      isHighDemand: false,
      badge: "\u{1F7E2} Nhu c\u1EA7u \u1ED5n \u0111\u1ECBnh:",
      text: "H\u1EC7 th\u1ED1ng \u0111ang qu\xE9t \u0111\u01A1n h\xE0ng ph\xF9 h\u1EE3p g\u1EA7n v\u1ECB tr\xED b\u1EA1n",
      surgeBonusPercent: 0,
      hotspots: [
        {
          district: "Khu v\u1EF1c c\u1EE7a b\u1EA1n",
          count: 1,
          lat: currentLat,
          lng: currentLng,
          radiusMeters: 1200
        }
      ]
    };
  } catch (err) {
    console.warn("L\u1ED7i ph\xE2n t\xEDch \u0111i\u1EC3m n\xF3ng nhu c\u1EA7u:", err);
    return {
      isHighDemand: false,
      badge: "\u{1F7E2} Nhu c\u1EA7u \u1ED5n \u0111\u1ECBnh:",
      text: "\u0110ang s\u1EB5n s\xE0ng k\u1EBFt n\u1ED1i c\xE1c cu\u1ED1c xe quanh b\u1EA1n",
      surgeBonusPercent: 0,
      hotspots: []
    };
  }
}

// src/lib/bookingService.ts
init_pusher();

// src/lib/distanceService.ts
function calculateHaversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightDistanceKm = R * c;
  const detourFactor = 1.28;
  const actualRoadDistanceKm = Math.max(
    0.5,
    Number((straightDistanceKm * detourFactor).toFixed(1))
  );
  const avgTruckSpeedKmh = 24;
  const durationMinutes = Math.max(
    5,
    Math.round(actualRoadDistanceKm / avgTruckSpeedKmh * 60) + 5
  );
  return {
    distanceKm: actualRoadDistanceKm,
    durationMinutes
  };
}
async function calculateSingleLeg(originLat, originLng, destLat, destLng) {
  if (Math.abs(originLat - destLat) < 1e-4 && Math.abs(originLng - destLng) < 1e-4) {
    return {
      distanceKm: 0.1,
      durationMinutes: 3,
      routingSource: "HAVERSINE_LOCAL"
    };
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800);
    const goongUrl = `https://rsapi.goong.io/Direction?origin=${originLat},${originLng}&destination=${destLat},${destLng}&vehicle=truck&api_key=${process.env.GOONG_API_KEY || ""}`;
    const res = await fetch(goongUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "TruckBookingApp/1.0"
      }
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const leg = data.routes[0].legs[0];
        const distanceMeters = leg?.distance?.value || 0;
        const durationSeconds = leg?.duration?.value || 0;
        const distanceKm = Math.max(
          0.5,
          Number((distanceMeters / 1e3).toFixed(1))
        );
        const durationMinutes = Math.max(5, Math.round(durationSeconds / 60));
        return {
          distanceKm,
          durationMinutes,
          routingSource: "GOONG_API"
        };
      }
    }
  } catch (error) {
  }
  const fallback = calculateHaversineDistance(
    originLat,
    originLng,
    destLat,
    destLng
  );
  return {
    distanceKm: fallback.distanceKm,
    durationMinutes: fallback.durationMinutes,
    routingSource: "HAVERSINE_LOCAL"
  };
}
async function calculateRouteDistance(originLat, originLng, destLat, destLng, waypoints) {
  if (typeof originLat !== "number" || typeof originLng !== "number" || typeof destLat !== "number" || typeof destLng !== "number" || isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
    throw new Error("T\u1ECDa \u0111\u1ED9 GPS \u0111i\u1EC3m \u0111i ho\u1EB7c \u0111i\u1EC3m \u0111\u1EBFn kh\xF4ng h\u1EE3p l\u1EC7");
  }
  if (originLat < -90 || originLat > 90 || destLat < -90 || destLat > 90) {
    throw new Error("V\u0129 \u0111\u1ED9 (Latitude) ph\u1EA3i n\u1EB1m trong ph\u1EA1m vi [-90, 90]");
  }
  if (originLng < -180 || originLng > 180 || destLng < -180 || destLng > 180) {
    throw new Error("Kinh \u0111\u1ED9 (Longitude) ph\u1EA3i n\u1EB1m trong ph\u1EA1m vi [-180, 180]");
  }
  if (!waypoints || waypoints.length === 0) {
    return await calculateSingleLeg(originLat, originLng, destLat, destLng);
  }
  const allStops = [
    { lat: originLat, lng: originLng },
    ...waypoints,
    { lat: destLat, lng: destLng }
  ];
  let totalDistanceKm = 0;
  let totalDurationMinutes = 0;
  let usedGoong = false;
  for (let i = 0; i < allStops.length - 1; i++) {
    const legRes = await calculateSingleLeg(
      allStops[i].lat,
      allStops[i].lng,
      allStops[i + 1].lat,
      allStops[i + 1].lng
    );
    totalDistanceKm += legRes.distanceKm;
    totalDurationMinutes += legRes.durationMinutes;
    if (legRes.routingSource === "GOONG_API") usedGoong = true;
  }
  return {
    distanceKm: Number(totalDistanceKm.toFixed(1)),
    durationMinutes: totalDurationMinutes,
    routingSource: usedGoong ? "GOONG_API" : "HAVERSINE_LOCAL"
  };
}

// src/lib/bookingService.ts
function generateBookingCode() {
  const d = /* @__PURE__ */ new Date();
  const dateStr = `${d.getFullYear().toString().slice(-2)}${(d.getMonth() + 1).toString().padStart(2, "0")}${d.getDate().toString().padStart(2, "0")}`;
  const randomNum = Math.floor(1e3 + Math.random() * 9e3);
  return `BK${dateStr}-${randomNum}`;
}
async function createBooking(customerId, data) {
  if (!customerId) {
    throw new ApiError(401, "Y\xEAu c\u1EA7u \u0111\u0103ng nh\u1EADp t\xE0i kho\u1EA3n kh\xE1ch h\xE0ng");
  }
  if (!data.vehicleTypeId) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin lo\u1EA1i xe (vehicleTypeId)");
  }
  if (!data.originAddress || data.originLat === void 0 || data.originLng === void 0) {
    throw new ApiError(
      400,
      "Thi\u1EBFu th\xF4ng tin ho\u1EB7c t\u1ECDa \u0111\u1ED9 \u0111i\u1EC3m l\u1EA5y h\xE0ng (originAddress, originLat, originLng)"
    );
  }
  if (!data.destinationAddress || data.destLat === void 0 || data.destLng === void 0) {
    throw new ApiError(
      400,
      "Thi\u1EBFu th\xF4ng tin ho\u1EB7c t\u1ECDa \u0111\u1ED9 \u0111i\u1EC3m giao h\xE0ng (destinationAddress, destLat, destLng)"
    );
  }
  const originLat = Number(data.originLat);
  const originLng = Number(data.originLng);
  const destLat = Number(data.destLat);
  const destLng = Number(data.destLng);
  const route = await calculateRouteDistance(
    originLat,
    originLng,
    destLat,
    destLng
  );
  const distanceKm = route.distanceKm;
  let totalPrice = Number(data.estimatedPrice || 0);
  let basePrice = totalPrice;
  const surchargePrice = Number(data.surchargePrice || 0);
  if (totalPrice <= 0) {
    const rules = await client.unsafe(
      `SELECT base_price, base_distance_km, price_per_km FROM pricing_rules WHERE vehicle_type_id = $1::uuid LIMIT 1`,
      [data.vehicleTypeId]
    );
    if (rules.length > 0) {
      const rule = rules[0];
      const bPrice = Number(rule.base_price);
      const bDist = Number(rule.base_distance_km);
      const pPerKm = Number(rule.price_per_km);
      if (distanceKm <= bDist) {
        basePrice = bPrice;
      } else {
        basePrice = bPrice + (distanceKm - bDist) * pPerKm;
      }
      totalPrice = Math.round(basePrice + surchargePrice);
    } else {
      basePrice = Math.round(15e4 + distanceKm * 15e3);
      totalPrice = basePrice + surchargePrice;
    }
  }
  const customerWallet = await getOrCreateWallet(customerId);
  const custBalance = Number(customerWallet?.balance || 0);
  if (custBalance < 0) {
    const debtFormatted = Math.abs(custBalance).toLocaleString("vi-VN");
    throw new ApiError(
      400,
      `T\xE0i kho\u1EA3n c\u1EE7a b\u1EA1n \u0111ang c\xF3 kho\u1EA3n n\u1EE3 ph\xED h\u1EE7y chuy\u1EBFn ch\u01B0a thanh to\xE1n (${debtFormatted}\u0111). Vui l\xF2ng thanh to\xE1n kho\u1EA3n n\u1EE3 v\xE0o v\xED tr\u01B0\u1EDBc khi ti\u1EBFp t\u1EE5c \u0111\u1EB7t chuy\u1EBFn m\u1EDBi.`
    );
  }
  const paymentMethod = data.paymentMethod || "CASH";
  if (paymentMethod === "WALLET" && custBalance < totalPrice) {
    const balanceFormatted = custBalance.toLocaleString("vi-VN");
    const priceFormatted = totalPrice.toLocaleString("vi-VN");
    throw new ApiError(
      400,
      `S\u1ED1 d\u01B0 v\xED (${balanceFormatted}\u0111) kh\xF4ng \u0111\u1EE7 \u0111\u1EC3 thanh to\xE1n c\u01B0\u1EDBc chuy\u1EBFn (${priceFormatted}\u0111). Vui l\xF2ng n\u1EA1p th\xEAm ti\u1EC1n ho\u1EB7c ch\u1ECDn ph\u01B0\u01A1ng th\u1EE9c Ti\u1EC1n m\u1EB7t / Chuy\u1EC3n kho\u1EA3n.`
    );
  }
  const driverCommission = Math.round(totalPrice * 0.2);
  const bookingCode = generateBookingCode();
  const deliveryOtp = Math.floor(1e3 + Math.random() * 9e3).toString();
  const inserted = await client.unsafe(
    `
    INSERT INTO bookings (
      booking_code,
      customer_id,
      vehicle_type_id,
      status,
      origin_address,
      origin_point,
      destination_address,
      destination_point,
      distance_km,
      base_price,
      surcharge_price,
      total_price,
      driver_commission,
      payment_method,
      payment_status,
      delivery_otp,
      created_at,
      updated_at
    ) VALUES (
      $1,
      $2::uuid,
      $3::uuid,
      'SEARCHING',
      $4,
      ST_SetSRID(ST_MakePoint($5::double precision, $6::double precision), 4326),
      $7,
      ST_SetSRID(ST_MakePoint($8::double precision, $9::double precision), 4326),
      $10::numeric,
      $11::numeric,
      $12::numeric,
      $13::numeric,
      $14::numeric,
      $15,
      'UNPAID',
      $16,
      NOW(),
      NOW()
    )
    RETURNING 
      id,
      booking_code,
      customer_id,
      vehicle_type_id,
      status,
      origin_address,
      destination_address,
      distance_km,
      total_price,
      delivery_otp,
      created_at
    `,
    [
      bookingCode,
      customerId,
      data.vehicleTypeId,
      data.originAddress,
      originLng,
      originLat,
      data.destinationAddress,
      destLng,
      destLat,
      distanceKm,
      basePrice,
      surchargePrice,
      totalPrice,
      driverCommission,
      paymentMethod,
      deliveryOtp
    ]
  );
  const booking = inserted[0];
  let nearbyDrivers = await findNearbyDrivers({
    originLat,
    originLng,
    radiusKm: 5,
    // Bán kính vòng 1: quét đến 5km
    vehicleTypeId: data.vehicleTypeId,
    limit: 10
  });
  let dispatchRound = 1;
  if (nearbyDrivers.length === 0) {
    nearbyDrivers = await findNearbyDrivers({
      originLat,
      originLng,
      radiusKm: 8,
      // Bán kính vòng 2 mở rộng
      vehicleTypeId: data.vehicleTypeId,
      limit: 15
    });
    if (nearbyDrivers.length > 0) {
      dispatchRound = 2;
    }
  }
  for (const driver of nearbyDrivers) {
    await triggerDriverNewOffer(driver.driverId, {
      bookingId: booking.id,
      bookingCode: booking.booking_code,
      originAddress: booking.origin_address,
      destinationAddress: booking.destination_address,
      distanceKm: Number(booking.distance_km),
      totalPrice: Number(booking.total_price),
      vehicleTypeName: driver.vehicleTypeName,
      expiresInSeconds: 20
      // Đếm ngược 20 giây để tài xế nhận cuốc
    });
  }
  const driverUserIds = nearbyDrivers.map((d) => d.userId).filter(Boolean);
  if (driverUserIds.length > 0) {
    notifyDriverNewBookingOffer(driverUserIds, {
      bookingId: booking.id,
      bookingCode: booking.booking_code,
      originAddress: booking.origin_address,
      destinationAddress: booking.destination_address,
      distanceKm: Number(booking.distance_km),
      totalPrice: Number(booking.total_price),
      vehicleTypeName: nearbyDrivers[0]?.vehicleTypeName || void 0
    }).catch((err) => console.warn("FCM new offer error:", err.message));
  }
  return {
    bookingId: booking.id,
    bookingCode: booking.booking_code,
    status: booking.status,
    distanceKm: Number(booking.distance_km),
    totalPrice: Number(booking.total_price),
    deliveryOtp: booking.delivery_otp,
    dispatchRound,
    matchedDriversCount: nearbyDrivers.length,
    matchedDrivers: nearbyDrivers.map((d) => ({
      driverId: d.driverId,
      name: d.fullName,
      distanceKm: d.distanceKm
    }))
  };
}
async function acceptBooking(driverUserId, bookingId) {
  if (!driverUserId) {
    throw new ApiError(401, "Y\xEAu c\u1EA7u \u0111\u0103ng nh\u1EADp t\xE0i kho\u1EA3n t\xE0i x\u1EBF");
  }
  if (!bookingId) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin bookingId");
  }
  const driverRows = await client.unsafe(
    `
    SELECT dp.id, dp.user_id, dp.kyc_status, dp.is_online, dp.is_active, dp.license_plate,
           u.full_name, u.phone, u.avatar_url,
           vt.name as vehicle_type_name
    FROM driver_profiles dp
    JOIN users u ON u.id = dp.user_id
    LEFT JOIN vehicle_types vt ON vt.id = dp.vehicle_type_id
    WHERE dp.user_id = $1::uuid
    LIMIT 1
    `,
    [driverUserId]
  );
  if (driverRows.length === 0) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y h\u1ED3 s\u01A1 t\xE0i x\u1EBF");
  }
  const driver = driverRows[0];
  if (driver.kyc_status !== "APPROVED") {
    throw new ApiError(403, "T\xE0i x\u1EBF ch\u01B0a \u0111\u01B0\u1EE3c duy\u1EC7t KYC, kh\xF4ng th\u1EC3 nh\u1EADn cu\u1ED1c");
  }
  if (!driver.is_active) {
    throw new ApiError(403, "T\xE0i kho\u1EA3n t\xE0i x\u1EBF \u0111ang b\u1ECB t\u1EA1m ng\u01B0ng");
  }
  if (!driver.is_online) {
    throw new ApiError(
      400,
      "Vui l\xF2ng b\u1EADt tr\u1EA1ng th\xE1i Tr\u1EF1c tuy\u1EBFn (Online) tr\u01B0\u1EDBc khi nh\u1EADn cu\u1ED1c"
    );
  }
  const depositEligibility = await checkDriverDepositEligibility(driverUserId);
  if (!depositEligibility.eligible) {
    throw new ApiError(
      403,
      depositEligibility.message,
      "INSUFFICIENT_WALLET_DEPOSIT"
    );
  }
  const busyRows = await client.unsafe(
    `
    SELECT id, booking_code FROM bookings
    WHERE driver_id = $1::uuid AND status IN ('ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT')
    LIMIT 1
    `,
    [driver.id]
  );
  if (busyRows.length > 0) {
    throw new ApiError(
      400,
      `B\u1EA1n \u0111ang c\xF3 chuy\u1EBFn xe "${busyRows[0].booking_code}" ch\u01B0a ho\xE0n th\xE0nh. Kh\xF4ng th\u1EC3 nh\u1EADn th\xEAm cu\u1ED1c m\u1EDBi.`
    );
  }
  const updated = await client.unsafe(
    `
    UPDATE bookings
    SET 
      driver_id = $1::uuid,
      status = 'ACCEPTED',
      accepted_at = NOW(),
      initial_distance_to_pickup = (
        SELECT ST_Distance(dl.location_point::geography, b.origin_point::geography)
        FROM bookings b
        LEFT JOIN driver_locations dl ON dl.driver_id = $1::uuid
        WHERE b.id = $2::uuid
        LIMIT 1
      ),
      updated_at = NOW()
    WHERE id = $2::uuid
      AND status = 'SEARCHING'
    RETURNING *
    `,
    [driver.id, bookingId]
  );
  if (updated.length === 0) {
    const currentBooking = await client.unsafe(
      `SELECT status, driver_id FROM bookings WHERE id = $1::uuid LIMIT 1`,
      [bookingId]
    );
    if (currentBooking.length === 0) {
      throw new ApiError(404, "Chuy\u1EBFn xe kh\xF4ng t\u1ED3n t\u1EA1i");
    }
    if (currentBooking[0].driver_id && currentBooking[0].driver_id !== driver.id) {
      throw new ApiError(
        409,
        "R\u1EA5t ti\u1EBFc! Chuy\u1EBFn xe n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c m\u1ED9t t\xE0i x\u1EBF kh\xE1c nhanh tay ti\u1EBFp nh\u1EADn.",
        "BOOKING_ALREADY_TAKEN"
      );
    }
    if (currentBooking[0].status === "CANCELLED") {
      throw new ApiError(
        400,
        "Chuy\u1EBFn xe \u0111\xE3 b\u1ECB h\u1EE7y b\u1EDFi kh\xE1ch h\xE0ng.",
        "BOOKING_CANCELLED"
      );
    }
    throw new ApiError(
      400,
      `Chuy\u1EBFn xe kh\xF4ng \u1EDF tr\u1EA1ng th\xE1i s\u1EB5n s\xE0ng \u0111\u1EC3 nh\u1EADn (Tr\u1EA1ng th\xE1i hi\u1EC7n t\u1EA1i: ${currentBooking[0].status})`
    );
  }
  const acceptedBooking = updated[0];
  await triggerBookingAccepted(bookingId, {
    driverId: driver.id,
    driverName: driver.full_name,
    driverPhone: driver.phone,
    avatarUrl: driver.avatar_url,
    licensePlate: driver.license_plate,
    vehicleTypeName: driver.vehicle_type_name,
    ratingAvg: 5
  });
  notifyCustomerBookingAccepted(acceptedBooking.customer_id, {
    bookingId,
    bookingCode: acceptedBooking.booking_code,
    driverName: driver.full_name,
    driverPhone: driver.phone,
    licensePlate: driver.license_plate,
    vehicleTypeName: driver.vehicle_type_name
  }).catch((err) => console.warn("FCM accept booking error:", err.message));
  const otherDrivers = await client.unsafe(
    `
    SELECT id FROM driver_profiles
    WHERE is_online = true AND kyc_status = 'APPROVED' AND id != $1::uuid
    `,
    [driver.id]
  );
  for (const d of otherDrivers) {
    await triggerOfferCancelled(d.id, bookingId, "TAKEN");
  }
  return {
    id: acceptedBooking.id,
    bookingId: acceptedBooking.id,
    bookingCode: acceptedBooking.booking_code,
    status: "ACCEPTED",
    originAddress: acceptedBooking.origin_address,
    destinationAddress: acceptedBooking.destination_address,
    distanceKm: Number(acceptedBooking.distance_km),
    totalPrice: Number(acceptedBooking.total_price),
    driverCommission: Number(acceptedBooking.driver_commission),
    message: "Nh\u1EADn chuy\u1EBFn th\xE0nh c\xF4ng! Vui l\xF2ng di chuy\u1EC3n \u0111\u1EBFn \u0111i\u1EC3m l\u1EA5y h\xE0ng."
  };
}
async function getBookingById(bookingId) {
  if (!bookingId) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin bookingId");
  }
  const rows = await client.unsafe(
    `
    SELECT 
      b.id,
      b.customer_id,
      b.booking_code,
      b.status,
      b.origin_address,
      ST_Y(b.origin_point) as origin_lat,
      ST_X(b.origin_point) as origin_lng,
      b.destination_address,
      ST_Y(b.destination_point) as dest_lat,
      ST_X(b.destination_point) as dest_lng,
      b.distance_km,
      b.base_price,
      b.surcharge_price,
      b.total_price,
      b.driver_commission,
      b.payment_method,
      b.payment_status,
      b.cancelled_by,
      b.cancellation_reason,
      b.cancellation_fee,
      b.cancelled_at,
      b.pickup_proof_image,
      b.delivery_proof_image,
      b.delivery_otp,
      b.completed_lat,
      b.completed_lng,
      b.in_transit_at,
      b.completed_at,
      b.created_at,
      b.updated_at,
      b.accepted_at,
      b.initial_distance_to_pickup,
      ST_Distance(dl.location_point::geography, b.origin_point::geography) as current_driver_distance,
      u.full_name as customer_name,
      u.phone as customer_phone,
      u.avatar_url as customer_avatar,
      b.driver_id,
      dp.user_id as driver_user_id,
      du.full_name as driver_name,
      du.phone as driver_phone,
      du.avatar_url as driver_avatar,
      dp.license_plate,
      vt.name as vehicle_type_name,
      ST_Y(dl.location_point) as driver_lat,
      ST_X(dl.location_point) as driver_lng,
      dl.heading as driver_heading,
      dl.updated_at as driver_loc_updated_at
    FROM bookings b
    JOIN users u ON u.id = b.customer_id
    LEFT JOIN driver_profiles dp ON dp.id = b.driver_id
    LEFT JOIN users du ON du.id = dp.user_id
    LEFT JOIN vehicle_types vt ON vt.id = b.vehicle_type_id
    LEFT JOIN driver_locations dl ON dl.driver_id = dp.id
    WHERE b.id = $1::uuid
    LIMIT 1
    `,
    [bookingId]
  );
  if (rows.length === 0) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y chuy\u1EBFn xe");
  }
  const r = rows[0];
  return {
    id: r.id,
    customerId: r.customer_id,
    driverId: r.driver_id,
    driverUserId: r.driver_user_id || null,
    bookingCode: r.booking_code,
    status: r.status,
    origin: {
      address: r.origin_address,
      latitude: Number(r.origin_lat),
      longitude: Number(r.origin_lng)
    },
    destination: {
      address: r.destination_address,
      latitude: Number(r.dest_lat),
      longitude: Number(r.dest_lng)
    },
    distanceKm: Number(r.distance_km),
    pricing: {
      basePrice: Number(r.base_price),
      surchargePrice: Number(r.surcharge_price),
      totalPrice: Number(r.total_price),
      driverCommission: Number(r.driver_commission),
      paymentMethod: r.payment_method,
      paymentStatus: r.payment_status
    },
    customer: {
      name: r.customer_name,
      phone: r.customer_phone,
      avatarUrl: r.customer_avatar
    },
    driver: r.driver_name ? {
      id: r.driver_id,
      name: r.driver_name,
      phone: r.driver_phone,
      avatarUrl: r.driver_avatar,
      licensePlate: r.license_plate,
      vehicleTypeName: r.vehicle_type_name,
      currentLocation: r.driver_lat !== null ? {
        latitude: Number(r.driver_lat),
        longitude: Number(r.driver_lng),
        heading: r.driver_heading !== null ? Number(r.driver_heading) : null,
        updatedAt: r.driver_loc_updated_at
      } : null
    } : null,
    cancellation: r.cancelled_by ? {
      cancelledBy: r.cancelled_by,
      reason: r.cancellation_reason,
      fee: Number(r.cancellation_fee || 0),
      cancelledAt: r.cancelled_at
    } : null,
    proofImages: {
      pickup: r.pickup_proof_image || null,
      delivery: r.delivery_proof_image || null
    },
    deliveryOtp: r.delivery_otp || null,
    completedLat: r.completed_lat !== null ? Number(r.completed_lat) : null,
    completedLng: r.completed_lng !== null ? Number(r.completed_lng) : null,
    inTransitAt: r.in_transit_at || null,
    completedAt: r.completed_at || null,
    acceptedAt: r.accepted_at || null,
    canCustomerCancel: (() => {
      if (r.status === "SEARCHING" || r.status === "PENDING") return true;
      if (r.status === "IN_TRANSIT" || r.status === "COMPLETED" || r.status === "CANCELLED") return false;
      if (r.status === "ACCEPTED" || r.status === "ARRIVED_AT_PICKUP") {
        const acceptedTime = r.accepted_at ? new Date(r.accepted_at).getTime() : new Date(r.updated_at || r.created_at).getTime();
        const elapsedMinutes = (Date.now() - acceptedTime) / (1e3 * 60);
        if (elapsedMinutes > 15) return false;
        if (elapsedMinutes <= 2) return true;
        if (r.status === "ARRIVED_AT_PICKUP") return false;
        const initialDist = r.initial_distance_to_pickup != null ? Number(r.initial_distance_to_pickup) : null;
        const currentDist = r.current_driver_distance != null ? Number(r.current_driver_distance) : null;
        if (initialDist != null && currentDist != null && initialDist - currentDist >= 250) return false;
        return true;
      }
      return true;
    })(),
    customerCancelBlockReason: (() => {
      if (r.status === "IN_TRANSIT") return "H\xE0ng h\xF3a \u0111ang \u0111\u01B0\u1EE3c v\u1EADn chuy\u1EC3n, kh\xF4ng th\u1EC3 h\u1EE7y chuy\u1EBFn.";
      if (r.status === "ACCEPTED" || r.status === "ARRIVED_AT_PICKUP") {
        const acceptedTime = r.accepted_at ? new Date(r.accepted_at).getTime() : new Date(r.updated_at || r.created_at).getTime();
        const elapsedMinutes = (Date.now() - acceptedTime) / (1e3 * 60);
        if (elapsedMinutes > 15) return "\u0110\xE3 qu\xE1 15 ph\xFAt k\u1EC3 t\u1EEB khi t\xE0i x\u1EBF nh\u1EADn cu\u1ED1c. Ch\u1EC9 t\xE0i x\u1EBF m\u1EDBi c\xF3 th\u1EC3 h\u1EE7y cu\u1ED1c l\xFAc n\xE0y.";
        if (r.status === "ARRIVED_AT_PICKUP") return "T\xE0i x\u1EBF \u0111\xE3 c\xF3 m\u1EB7t t\u1EA1i \u0111i\u1EC3m l\u1EA5y h\xE0ng. Vui l\xF2ng li\xEAn h\u1EC7 t\xE0i x\u1EBF n\u1EBFu c\u1EA7n h\u1EE7y.";
        const initialDist = r.initial_distance_to_pickup != null ? Number(r.initial_distance_to_pickup) : null;
        const currentDist = r.current_driver_distance != null ? Number(r.current_driver_distance) : null;
        if (initialDist != null && currentDist != null && initialDist - currentDist >= 250) {
          return "T\xE0i x\u1EBF \u0111\xE3 di chuy\u1EC3n \u0111\xFAng \u0111\u01B0\u1EDDng v\u1EC1 ph\xEDa b\u1EA1n. N\xFAt h\u1EE7y \u0111\xE3 b\u1ECB kh\xF3a \u0111\u1EC3 b\u1EA3o v\u1EC7 t\xE0i x\u1EBF.";
        }
      }
      return null;
    })(),
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}
async function getCustomerBookings(customerId, limit = 20) {
  const rows = await client.unsafe(
    `
    SELECT 
      b.id,
      b.booking_code,
      b.status,
      b.origin_address,
      b.destination_address,
      b.distance_km,
      b.total_price,
      b.payment_method,
      b.created_at
    FROM bookings b
    WHERE b.customer_id = $1::uuid
    ORDER BY b.created_at DESC
    LIMIT $2
    `,
    [customerId, limit]
  );
  return rows.map((r) => ({
    id: r.id,
    bookingCode: r.booking_code,
    status: r.status,
    originAddress: r.origin_address,
    destinationAddress: r.destination_address,
    distanceKm: Number(r.distance_km),
    totalPrice: Number(r.total_price),
    paymentMethod: r.payment_method,
    createdAt: r.created_at
  }));
}
async function getDriverActiveBooking(driverId) {
  const rows = await client.unsafe(
    `
    SELECT 
      b.id,
      b.booking_code,
      b.status,
      b.origin_address,
      ST_Y(b.origin_point) as origin_lat,
      ST_X(b.origin_point) as origin_lng,
      b.destination_address,
      ST_Y(b.destination_point) as dest_lat,
      ST_X(b.destination_point) as dest_lng,
      b.distance_km,
      b.total_price,
      b.driver_commission,
      b.payment_method,
      b.payment_status,
      b.created_at,
      b.updated_at,
      u.full_name as customer_name,
      u.phone as customer_phone,
      u.avatar_url as customer_avatar
    FROM bookings b
    JOIN users u ON u.id = b.customer_id
    WHERE b.driver_id = $1::uuid 
      AND b.status IN ('ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT')
    ORDER BY b.created_at DESC
    LIMIT 1
    `,
    [driverId]
  );
  if (rows.length === 0) {
    return null;
  }
  const r = rows[0];
  return {
    id: r.id,
    bookingCode: r.booking_code,
    status: r.status,
    origin: {
      address: r.origin_address,
      latitude: Number(r.origin_lat),
      longitude: Number(r.origin_lng)
    },
    destination: {
      address: r.destination_address,
      latitude: Number(r.dest_lat),
      longitude: Number(r.dest_lng)
    },
    distanceKm: Number(r.distance_km),
    totalPrice: Number(r.total_price),
    driverCommission: Number(r.driver_commission),
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    customer: {
      name: r.customer_name,
      phone: r.customer_phone,
      avatarUrl: r.customer_avatar
    },
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}
async function getAvailableBookings(driverUserId) {
  const rows = await client.unsafe(
    `
    SELECT 
      b.id,
      b.booking_code,
      b.status,
      b.origin_address,
      ST_Y(b.origin_point) as origin_lat,
      ST_X(b.origin_point) as origin_lng,
      b.destination_address,
      ST_Y(b.destination_point) as dest_lat,
      ST_X(b.destination_point) as dest_lng,
      b.distance_km,
      b.base_price,
      b.surcharge_price,
      b.total_price,
      b.driver_commission,
      b.payment_method,
      b.payment_status,
      b.created_at,
      u.full_name as customer_name,
      u.phone as customer_phone,
      u.avatar_url as customer_avatar,
      vt.name as vehicle_type_name
    FROM bookings b
    JOIN users u ON u.id = b.customer_id
    LEFT JOIN vehicle_types vt ON vt.id = b.vehicle_type_id
    WHERE b.status = 'SEARCHING'
      AND b.driver_id IS NULL
    ORDER BY b.created_at DESC
    LIMIT 10
    `
  );
  return rows.map((r) => ({
    bookingId: r.id,
    id: r.id,
    bookingCode: r.booking_code,
    status: r.status,
    originAddress: r.origin_address,
    originLat: Number(r.origin_lat),
    originLng: Number(r.origin_lng),
    destinationAddress: r.destination_address,
    destLat: Number(r.dest_lat),
    destLng: Number(r.dest_lng),
    distanceKm: Number(r.distance_km),
    totalPrice: Number(r.total_price),
    driverEarning: Math.round(Number(r.total_price) * 0.8),
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    vehicleTypeName: r.vehicle_type_name || "Xe t\u1EA3i",
    customerName: r.customer_name || "Kh\xE1ch h\xE0ng",
    customerPhone: r.customer_phone || "",
    customerAvatar: r.customer_avatar || null,
    receiverName: "Ng\u01B0\u1EDDi nh\u1EADn h\xE0ng",
    expiresInSeconds: 30,
    createdAt: r.created_at
  }));
}
var VALID_TRANSITIONS = {
  SEARCHING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["ARRIVED_AT_PICKUP", "CANCELLED"],
  ARRIVED_AT_PICKUP: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: []
};
var STATUS_MESSAGES = {
  ARRIVED_AT_PICKUP: "T\xE0i x\u1EBF \u0111\xE3 \u0111\u1EBFn \u0111i\u1EC3m l\u1EA5y h\xE0ng. Vui l\xF2ng chu\u1EA9n b\u1ECB h\xE0ng h\xF3a!",
  IN_TRANSIT: "H\xE0ng h\xF3a \u0111\xE3 \u0111\u01B0\u1EE3c b\u1ED1c l\xEAn xe v\xE0 \u0111ang tr\xEAn \u0111\u01B0\u1EDDng v\u1EADn chuy\u1EC3n.",
  COMPLETED: "Chuy\u1EBFn h\xE0ng \u0111\xE3 \u0111\u01B0\u1EE3c giao th\xE0nh c\xF4ng! C\u1EA3m \u01A1n b\u1EA1n \u0111\xE3 s\u1EED d\u1EE5ng d\u1ECBch v\u1EE5."
};
async function updateBookingStatus(driverUserId, bookingId, newStatus, note, proofImageUrl, options) {
  if (!driverUserId) {
    throw new ApiError(401, "Y\xEAu c\u1EA7u \u0111\u0103ng nh\u1EADp t\xE0i kho\u1EA3n t\xE0i x\u1EBF");
  }
  if (!bookingId) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin bookingId");
  }
  if (!newStatus) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin tr\u1EA1ng th\xE1i m\u1EDBi (status)");
  }
  const cleanStatus = String(newStatus).trim().toUpperCase();
  const allowedStatuses = ["ARRIVED_AT_PICKUP", "IN_TRANSIT", "COMPLETED"];
  if (!allowedStatuses.includes(cleanStatus)) {
    throw new ApiError(
      400,
      `Tr\u1EA1ng th\xE1i "${newStatus}" kh\xF4ng h\u1EE3p l\u1EC7. C\xE1c tr\u1EA1ng th\xE1i cho ph\xE9p: ${allowedStatuses.join(", ")}`
    );
  }
  const driverProfile = await client.unsafe(
    `SELECT dp.id, u.full_name FROM driver_profiles dp JOIN users u ON u.id = dp.user_id WHERE dp.user_id = $1::uuid LIMIT 1`,
    [driverUserId]
  );
  if (driverProfile.length === 0) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y h\u1ED3 s\u01A1 t\xE0i x\u1EBF");
  }
  const driverId = driverProfile[0].id;
  const bookingRows = await client.unsafe(
    `SELECT id, booking_code, status, driver_id, customer_id, total_price, payment_method, delivery_otp,
            ST_Y(destination_point) as dest_lat, ST_X(destination_point) as dest_lng
     FROM bookings WHERE id = $1::uuid LIMIT 1`,
    [bookingId]
  );
  if (bookingRows.length === 0) {
    throw new ApiError(404, "Chuy\u1EBFn xe kh\xF4ng t\u1ED3n t\u1EA1i");
  }
  const booking = bookingRows[0];
  if (booking.driver_id !== driverId) {
    throw new ApiError(403, "B\u1EA1n kh\xF4ng ph\u1EA3i l\xE0 t\xE0i x\u1EBF ph\u1EE5 tr\xE1ch chuy\u1EBFn xe n\xE0y");
  }
  const currentStatus = String(booking.status);
  if (currentStatus === cleanStatus) {
    return {
      bookingId: booking.id,
      bookingCode: booking.booking_code,
      status: currentStatus,
      message: `Chuy\u1EBFn xe \u0111\xE3 \u1EDF tr\u1EA1ng th\xE1i ${cleanStatus}`
    };
  }
  const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(cleanStatus)) {
    throw new ApiError(
      400,
      `Kh\xF4ng th\u1EC3 chuy\u1EC3n tr\u1EA1ng th\xE1i t\u1EEB "${currentStatus}" sang "${cleanStatus}". Lu\u1ED3ng h\u1EE3p l\u1EC7: ${allowedNext.join(" ho\u1EB7c ")}`
    );
  }
  const cleanProof = proofImageUrl ? String(proofImageUrl).trim() : null;
  const opts = typeof options === "boolean" ? { requireProof: options } : options || {};
  if (cleanStatus === "IN_TRANSIT") {
    if (opts.requireProof && !cleanProof) {
      throw new ApiError(
        400,
        "Vui l\xF2ng ch\u1EE5p ho\u1EB7c t\u1EA3i \u1EA3nh ki\u1EC7n h\xE0ng b\u1ED1c l\xEAn xe tr\u01B0\u1EDBc khi b\u1EAFt \u0111\u1EA7u v\u1EADn chuy\u1EC3n.",
        "MISSING_PICKUP_PROOF"
      );
    }
  }
  if (cleanStatus === "COMPLETED") {
    if (opts.requireProof && !cleanProof) {
      throw new ApiError(
        400,
        "Vui l\xF2ng ch\u1EE5p ho\u1EB7c t\u1EA3i \u1EA3nh b\u1EB1ng ch\u1EE9ng giao h\xE0ng (Proof of Delivery) tr\u01B0\u1EDBc khi ho\xE0n t\u1EA5t cu\u1ED1c xe.",
        "MISSING_DELIVERY_PROOF"
      );
    }
    if (opts.requireOtp && booking.delivery_otp) {
      const providedOtp = opts.deliveryOtp ? String(opts.deliveryOtp).trim() : "";
      const expectedOtp = String(booking.delivery_otp).trim();
      if (!providedOtp || providedOtp !== expectedOtp) {
        throw new ApiError(
          400,
          "M\xE3 x\xE1c nh\u1EADn giao h\xE0ng (OTP) kh\xF4ng ch\xEDnh x\xE1c. Vui l\xF2ng h\u1ECFi ng\u01B0\u1EDDi nh\u1EADn h\xE0ng.",
          "INVALID_DELIVERY_OTP"
        );
      }
    }
    if (opts.driverLat !== void 0 && opts.driverLng !== void 0 && booking.dest_lat !== null && booking.dest_lng !== null && !opts.bypassGeofence) {
      const destLat = Number(booking.dest_lat);
      const destLng = Number(booking.dest_lng);
      const dLat = Number(opts.driverLat);
      const dLng = Number(opts.driverLng);
      const R = 6371e3;
      const radLat1 = destLat * Math.PI / 180;
      const radLat2 = dLat * Math.PI / 180;
      const deltaLat = (dLat - destLat) * Math.PI / 180;
      const deltaLng = (dLng - destLng) * Math.PI / 180;
      const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) + Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distanceMeters = Math.round(R * c);
      if (distanceMeters > 500) {
        const distText = distanceMeters >= 1e3 ? `${(distanceMeters / 1e3).toFixed(1)} km` : `${distanceMeters} m`;
        throw new ApiError(
          400,
          `B\u1EA1n \u0111ang c\xE1ch \u0111i\u1EC3m giao h\xE0ng ${distText}. Vui l\xF2ng di chuy\u1EC3n \u0111\u1EBFn \u0111i\u1EC3m giao (trong ph\u1EA1m vi 500m) \u0111\u1EC3 ho\xE0n t\u1EA5t.`,
          "GEOFENCE_TOO_FAR"
        );
      }
    }
  }
  const updatedRows = await client.unsafe(
    `
    UPDATE bookings
    SET 
      status = $1::booking_status,
      payment_status = CASE WHEN $1 = 'COMPLETED' THEN 'PAID'::payment_status ELSE payment_status END,
      pickup_proof_image = CASE WHEN $1 = 'IN_TRANSIT' AND $4::text IS NOT NULL THEN $4 ELSE pickup_proof_image END,
      delivery_proof_image = CASE WHEN $1 = 'COMPLETED' AND $4::text IS NOT NULL THEN $4 ELSE delivery_proof_image END,
      in_transit_at = CASE WHEN $1 = 'IN_TRANSIT' AND in_transit_at IS NULL THEN NOW() ELSE in_transit_at END,
      completed_at = CASE WHEN $1 = 'COMPLETED' THEN NOW() ELSE completed_at END,
      completed_lat = CASE WHEN $1 = 'COMPLETED' AND $5::numeric IS NOT NULL THEN $5::numeric ELSE completed_lat END,
      completed_lng = CASE WHEN $1 = 'COMPLETED' AND $6::numeric IS NOT NULL THEN $6::numeric ELSE completed_lng END,
      updated_at = NOW()
    WHERE id = $2::uuid AND driver_id = $3::uuid
    RETURNING id, booking_code, status, payment_status, pickup_proof_image, delivery_proof_image, delivery_otp, completed_lat, completed_lng, in_transit_at, completed_at, updated_at
    `,
    [
      cleanStatus,
      bookingId,
      driverId,
      cleanProof,
      opts.driverLat !== void 0 ? opts.driverLat : null,
      opts.driverLng !== void 0 ? opts.driverLng : null
    ]
  );
  const updatedBooking = updatedRows[0];
  const statusMsg = STATUS_MESSAGES[cleanStatus] || `C\u1EADp nh\u1EADt tr\u1EA1ng th\xE1i th\xE0nh c\xF4ng: ${cleanStatus}`;
  await triggerBookingStatusChange(bookingId, cleanStatus, {
    message: statusMsg,
    driverId,
    note: note || null,
    deliveryOtp: updatedBooking.delivery_otp || booking.delivery_otp
  });
  if (cleanStatus === "ARRIVED_AT_PICKUP") {
    notifyCustomerDriverArrived(booking.customer_id, {
      bookingId,
      bookingCode: booking.booking_code,
      driverName: driverProfile[0]?.full_name || "T\xE0i x\u1EBF"
    }).catch((err) => console.warn("FCM driver arrived error:", err.message));
  } else if (cleanStatus === "IN_TRANSIT") {
    notifyCustomerBookingInTransit(booking.customer_id, {
      bookingId,
      bookingCode: booking.booking_code
    }).catch((err) => console.warn("FCM in transit error:", err.message));
  } else if (cleanStatus === "COMPLETED") {
    notifyCustomerBookingCompleted(booking.customer_id, {
      bookingId,
      bookingCode: booking.booking_code,
      totalPrice: Number(booking.total_price)
    }).catch((err) => console.warn("FCM completed error:", err.message));
  }
  let commissionInfo = null;
  if (cleanStatus === "COMPLETED") {
    try {
      commissionInfo = await deductTripCommission(bookingId);
    } catch (commErr) {
      console.error(
        `[Wallet Commission Error] L\u1ED7i kh\u1EA5u tr\u1EEB hoa h\u1ED3ng cu\u1ED1c ${booking.booking_code}:`,
        commErr.message
      );
    }
  }
  return {
    bookingId: updatedBooking.id,
    bookingCode: updatedBooking.booking_code,
    status: updatedBooking.status,
    paymentStatus: updatedBooking.payment_status,
    commission: commissionInfo,
    proofImages: {
      pickup: updatedBooking.pickup_proof_image || null,
      delivery: updatedBooking.delivery_proof_image || null
    },
    message: statusMsg,
    updatedAt: updatedBooking.updated_at
  };
}
async function cancelBooking(userId, bookingId, reason) {
  if (!userId) {
    throw new ApiError(401, "Y\xEAu c\u1EA7u \u0111\u0103ng nh\u1EADp");
  }
  if (!bookingId) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin bookingId");
  }
  const rows = await client.unsafe(
    `
    SELECT 
      b.id, 
      b.booking_code, 
      b.status, 
      b.customer_id, 
      b.driver_id, 
      dp.user_id as driver_user_id,
      b.accepted_at,
      b.initial_distance_to_pickup,
      b.created_at,
      b.updated_at,
      ST_Distance(dl.location_point::geography, b.origin_point::geography) as current_driver_distance
    FROM bookings b
    LEFT JOIN driver_profiles dp ON dp.id = b.driver_id
    LEFT JOIN driver_locations dl ON dl.driver_id = dp.id
    WHERE b.id = $1::uuid
    LIMIT 1
    `,
    [bookingId]
  );
  if (rows.length === 0) {
    throw new ApiError(404, "Chuy\u1EBFn xe kh\xF4ng t\u1ED3n t\u1EA1i");
  }
  const b = rows[0];
  const isCustomer = b.customer_id === userId;
  const isDriver = b.driver_user_id === userId;
  if (!isCustomer && !isDriver) {
    throw new ApiError(403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n h\u1EE7y chuy\u1EBFn xe n\xE0y");
  }
  if (b.status === "CANCELLED") {
    return {
      bookingId: b.id,
      bookingCode: b.booking_code,
      status: "CANCELLED",
      message: "Chuy\u1EBFn xe \u0111\xE3 b\u1ECB h\u1EE7y tr\u01B0\u1EDBc \u0111\xF3"
    };
  }
  if (b.status === "COMPLETED") {
    throw new ApiError(400, "Chuy\u1EBFn xe \u0111\xE3 ho\xE0n th\xE0nh, kh\xF4ng th\u1EC3 h\u1EE7y");
  }
  if (b.status === "IN_TRANSIT") {
    throw new ApiError(
      400,
      "H\xE0ng h\xF3a \u0111\xE3 \u0111\u01B0\u1EE3c nh\u1EADn l\xEAn xe v\xE0 \u0111ang tr\xEAn \u0111\u01B0\u1EDDng v\u1EADn chuy\u1EC3n, kh\xF4ng th\u1EC3 h\u1EE7y chuy\u1EBFn xe. Vui l\xF2ng li\xEAn h\u1EC7 t\u1ED5ng \u0111\xE0i \u0111\u1EC3 \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3."
    );
  }
  if (isCustomer) {
    if (b.status === "ACCEPTED" || b.status === "ARRIVED_AT_PICKUP") {
      const acceptedTime = b.accepted_at ? new Date(b.accepted_at).getTime() : new Date(b.updated_at || b.created_at).getTime();
      const now = Date.now();
      const elapsedMinutes = (now - acceptedTime) / (1e3 * 60);
      if (elapsedMinutes > 15) {
        throw new ApiError(
          400,
          "\u0110\xE3 qu\xE1 15 ph\xFAt k\u1EC3 t\u1EEB khi t\xE0i x\u1EBF nh\u1EADn cu\u1ED1c. \u0110\u1EC3 b\u1EA3o v\u1EC7 quy\u1EC1n l\u1EE3i t\xE0i x\u1EBF \u0111ang di chuy\u1EC3n \u0111\u1EBFn, b\u1EA1n kh\xF4ng th\u1EC3 t\u1EF1 h\u1EE7y l\xFAc n\xE0y. Vui l\xF2ng li\xEAn h\u1EC7 t\xE0i x\u1EBF \u0111\u1EC3 th\u01B0\u01A1ng l\u01B0\u1EE3ng.",
          "CANCELLATION_TIME_EXCEEDED"
        );
      }
      if (elapsedMinutes > 2) {
        const initialDist = b.initial_distance_to_pickup != null ? Number(b.initial_distance_to_pickup) : null;
        const currentDist = b.current_driver_distance != null ? Number(b.current_driver_distance) : null;
        if (b.status === "ARRIVED_AT_PICKUP" || initialDist != null && currentDist != null && initialDist - currentDist >= 250) {
          throw new ApiError(
            400,
            "T\xE0i x\u1EBF \u0111\xE3 di chuy\u1EC3n \u0111\xFAng \u0111\u01B0\u1EDDng v\u1EC1 ph\xEDa \u0111i\u1EC3m l\u1EA5y h\xE0ng. N\xFAt h\u1EE7y t\u1EF1 \u0111\u1ED9ng \u0111\xE3 b\u1ECB kh\xF3a \u0111\u1EC3 b\u1EA3o v\u1EC7 t\xE0i x\u1EBF. Vui l\xF2ng li\xEAn h\u1EC7 tr\u1EF1c ti\u1EBFp v\u1EDBi t\xE0i x\u1EBF.",
            "DRIVER_ON_THE_WAY"
          );
        }
      }
    }
  }
  if (isDriver) {
  }
  const cancelledBy = isCustomer ? "CUSTOMER" : "DRIVER";
  const cancelReason = reason || (isCustomer ? "Kh\xE1ch h\xE0ng y\xEAu c\u1EA7u h\u1EE7y cu\u1ED1c" : "T\xE0i x\u1EBF h\u1EE7y cu\u1ED1c");
  const cancellationFee = 0;
  const updatedRows = await client.unsafe(
    `
    UPDATE bookings
    SET 
      status = 'CANCELLED'::booking_status,
      cancelled_by = $1,
      cancellation_reason = $2,
      cancellation_fee = $3::numeric,
      cancelled_at = NOW(),
      updated_at = NOW()
    WHERE id = $4::uuid
    RETURNING id, booking_code, status, cancelled_by, cancellation_reason, cancellation_fee, cancelled_at, updated_at
    `,
    [cancelledBy, cancelReason, cancellationFee, bookingId]
  );
  const cancelled = updatedRows[0];
  await triggerBookingCancelled(
    bookingId,
    cancelledBy,
    cancelReason,
    b.driver_id,
    b.driver_user_id,
    b.booking_code
  );
  const targetUserId = isCustomer ? b.driver_user_id : b.customer_id;
  if (targetUserId) {
    notifyTripCancelled(targetUserId, {
      bookingId,
      bookingCode: b.booking_code,
      cancelledBy,
      reason: cancelReason
    }).catch((err) => console.warn("FCM cancel error:", err.message));
  }
  return {
    bookingId: cancelled.id,
    bookingCode: cancelled.booking_code,
    status: "CANCELLED",
    cancelledBy,
    reason: cancelReason,
    cancellationFee,
    cancelledAt: cancelled.cancelled_at,
    message: cancellationFee > 0 ? `H\u1EE7y chuy\u1EBFn xe th\xE0nh c\xF4ng. Ph\xED b\u1ED3i th\u01B0\u1EDDng t\xE0i x\u1EBF \u0111\xE3 \u0111\u1EBFn \u0111\xF3n: ${cancellationFee.toLocaleString("vi-VN")}\u0111` : "H\u1EE7y chuy\u1EBFn xe th\xE0nh c\xF4ng"
  };
}
async function escalateBookingDispatch(bookingId) {
  if (!bookingId) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin bookingId");
  }
  const rows = await client.unsafe(
    `
    SELECT id, booking_code, status, vehicle_type_id,
           ST_Y(origin_point) as origin_lat, ST_X(origin_point) as origin_lng,
           origin_address, destination_address, distance_km, total_price
    FROM bookings
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [bookingId]
  );
  if (rows.length === 0) {
    throw new ApiError(404, "Chuy\u1EBFn xe kh\xF4ng t\u1ED3n t\u1EA1i");
  }
  const b = rows[0];
  if (b.status !== "SEARCHING") {
    return {
      escalated: false,
      bookingId: b.id,
      status: b.status,
      message: `Chuy\u1EBFn xe kh\xF4ng c\xF2n \u1EDF tr\u1EA1ng th\xE1i t\xECm ki\u1EBFm (Tr\u1EA1ng th\xE1i hi\u1EC7n t\u1EA1i: ${b.status})`
    };
  }
  const round1Drivers = await findNearbyDrivers({
    originLat: Number(b.origin_lat),
    originLng: Number(b.origin_lng),
    radiusKm: 5,
    vehicleTypeId: b.vehicle_type_id,
    limit: 20
  });
  const round1DriverIds = round1Drivers.map((d) => d.driverId);
  const round2Drivers = await findNearbyDrivers({
    originLat: Number(b.origin_lat),
    originLng: Number(b.origin_lng),
    radiusKm: 8,
    vehicleTypeId: b.vehicle_type_id,
    excludeDriverIds: round1DriverIds,
    limit: 15
  });
  for (const driver of round2Drivers) {
    await triggerDriverNewOffer(driver.driverId, {
      bookingId: b.id,
      bookingCode: b.booking_code,
      originAddress: b.origin_address,
      destinationAddress: b.destination_address,
      distanceKm: Number(b.distance_km),
      totalPrice: Number(b.total_price),
      vehicleTypeName: driver.vehicleTypeName,
      expiresInSeconds: 20
    });
  }
  const driverUserIds = round2Drivers.map((d) => d.userId).filter(Boolean);
  if (driverUserIds.length > 0) {
    notifyDriverNewBookingOffer(driverUserIds, {
      bookingId: b.id,
      bookingCode: b.booking_code,
      originAddress: b.origin_address,
      destinationAddress: b.destination_address,
      distanceKm: Number(b.distance_km),
      totalPrice: Number(b.total_price),
      vehicleTypeName: round2Drivers[0]?.vehicleTypeName || void 0
    }).catch((err) => console.warn("FCM escalation offer error:", err.message));
  }
  return {
    escalated: true,
    bookingId: b.id,
    bookingCode: b.booking_code,
    dispatchRound: 2,
    radiusKm: 8,
    matchedDriversCount: round2Drivers.length,
    drivers: round2Drivers.map((d) => ({
      driverId: d.driverId,
      name: d.fullName,
      distanceKm: d.distanceKm
    })),
    message: `\u0110\xE3 m\u1EDF r\u1ED9ng b\xE1n k\xEDnh t\xECm xe l\xEAn 8km. Qu\xE9t th\u1EA5y ${round2Drivers.length} t\xE0i x\u1EBF trong V\xF2ng 2.`
  };
}
async function reassignBookingDriver(customerId, bookingId, reason) {
  if (!customerId || !bookingId) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin ng\u01B0\u1EDDi d\xF9ng ho\u1EB7c chuy\u1EBFn xe");
  }
  const rows = await client.unsafe(
    `
    SELECT b.id, b.booking_code, b.status, b.customer_id, b.driver_id, b.vehicle_type_id,
           ST_Y(b.origin_point) as origin_lat, ST_X(b.origin_point) as origin_lng,
           b.origin_address, b.destination_address, b.distance_km, b.total_price,
           dp.user_id as driver_user_id
    FROM bookings b
    LEFT JOIN driver_profiles dp ON dp.id = b.driver_id
    WHERE b.id = $1::uuid
    LIMIT 1
    `,
    [bookingId]
  );
  if (rows.length === 0) {
    throw new ApiError(404, "Chuy\u1EBFn xe kh\xF4ng t\u1ED3n t\u1EA1i");
  }
  const b = rows[0];
  if (b.customer_id !== customerId) {
    throw new ApiError(403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n \u0111\u1ED5i t\xE0i x\u1EBF cho chuy\u1EBFn xe n\xE0y");
  }
  if (b.status !== "ACCEPTED" && b.status !== "ARRIVED_AT_PICKUP") {
    throw new ApiError(
      400,
      `Kh\xF4ng th\u1EC3 \u0111\u1ED5i t\xE0i x\u1EBF khi \u0111\u01A1n \u0111ang \u1EDF tr\u1EA1ng th\xE1i ${b.status}`
    );
  }
  const oldDriverId = b.driver_id;
  await client.unsafe(
    `
    UPDATE bookings
    SET 
      status = 'SEARCHING'::booking_status,
      driver_id = NULL,
      updated_at = NOW()
    WHERE id = $1::uuid
    `,
    [bookingId]
  );
  if (oldDriverId) {
    await triggerEvent(`private-driver-${oldDriverId}`, "booking:cancelled", {
      bookingId,
      cancelledBy: "SYSTEM",
      reason: reason || "Kh\xE1ch h\xE0ng \u0111\u1ED5i t\xE0i x\u1EBF do th\u1EDDi gian ch\u1EDD qu\xE1 l\xE2u"
    }).catch(() => {
    });
  }
  await triggerEvent(`private-trip-${bookingId}`, "booking:reassigned", {
    bookingId,
    status: "SEARCHING",
    message: "\u0110ang t\xECm ki\u1EBFm t\xE0i x\u1EBF xe t\u1EA3i kh\xE1c g\u1EA7n b\u1EA1n..."
  }).catch(() => {
  });
  const nearby = await findNearbyDrivers({
    originLat: Number(b.origin_lat),
    originLng: Number(b.origin_lng),
    radiusKm: 6,
    vehicleTypeId: b.vehicle_type_id,
    excludeDriverIds: oldDriverId ? [oldDriverId] : [],
    limit: 15
  });
  for (const driver of nearby) {
    await triggerDriverNewOffer(driver.driverId, {
      bookingId,
      bookingCode: b.booking_code,
      originAddress: b.origin_address,
      destinationAddress: b.destination_address,
      distanceKm: Number(b.distance_km),
      totalPrice: Number(b.total_price),
      vehicleTypeName: driver.vehicleTypeName || void 0
    }).catch(() => {
    });
  }
  return {
    bookingId,
    status: "SEARCHING",
    message: "\u0110\xE3 h\u1EE7y t\xE0i x\u1EBF tr\u1EC5 v\xE0 \u0111ang t\u1EF1 \u0111\u1ED9ng t\xECm t\xE0i x\u1EBF xe t\u1EA3i m\u1EDBi quanh b\u1EA1n"
  };
}
async function rateBooking(bookingId, customerId, data) {
  const { rating, comment, tags } = data;
  if (!rating || rating < 1 || rating > 5) {
    throw new ApiError(400, "\u0110i\u1EC3m \u0111\xE1nh gi\xE1 ph\u1EA3i t\u1EEB 1 \u0111\u1EBFn 5 sao");
  }
  const bookingRows = await client.unsafe(
    `SELECT id, driver_id, customer_id, status FROM bookings WHERE id = $1::uuid LIMIT 1`,
    [bookingId]
  );
  if (bookingRows.length === 0) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y chuy\u1EBFn xe \u0111\u1EC3 \u0111\xE1nh gi\xE1");
  }
  const b = bookingRows[0];
  if (b.customer_id !== customerId) {
    throw new ApiError(403, "B\u1EA1n kh\xF4ng ph\u1EA3i l\xE0 kh\xE1ch h\xE0ng c\u1EE7a chuy\u1EBFn xe n\xE0y");
  }
  if (b.status !== "COMPLETED") {
    throw new ApiError(400, "Ch\u1EC9 c\xF3 th\u1EC3 \u0111\xE1nh gi\xE1 chuy\u1EBFn xe khi \u0111\xE3 ho\xE0n th\xE0nh");
  }
  if (b.driver_id) {
    await client.unsafe(
      `
      INSERT INTO driver_ratings (booking_id, driver_id, customer_id, rating, tags, comment, updated_at)
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::text[], $6, NOW())
      ON CONFLICT (booking_id, customer_id)
      DO UPDATE SET rating = EXCLUDED.rating, tags = EXCLUDED.tags, comment = EXCLUDED.comment, updated_at = NOW()
      `,
      [b.id, b.driver_id, customerId, rating, tags || [], comment || null]
    );
    const avgRes = await client.unsafe(
      `SELECT ROUND(AVG(rating)::numeric, 2) as avg_rating FROM driver_ratings WHERE driver_id = $1::uuid`,
      [b.driver_id]
    );
    const newAvg = avgRes[0]?.avg_rating ? Number(avgRes[0].avg_rating) : rating;
    await client.unsafe(
      `UPDATE driver_profiles SET rating_avg = $1 WHERE id = $2::uuid`,
      [newAvg, b.driver_id]
    );
  }
  return {
    bookingId: b.id,
    rating,
    comment: comment || null,
    tags: tags || [],
    message: "\u0110\xE1nh gi\xE1 chuy\u1EBFn \u0111i th\xE0nh c\xF4ng. C\u1EA3m \u01A1n ph\u1EA3n h\u1ED3i c\u1EE7a b\u1EA1n!"
  };
}
async function getDriverBookings(driverUserId, limit = 50) {
  if (!driverUserId) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin t\xE0i x\u1EBF");
  }
  const dpRows = await client.unsafe(
    `SELECT id FROM driver_profiles WHERE user_id = $1::uuid LIMIT 1`,
    [driverUserId]
  );
  if (dpRows.length === 0) {
    return {
      bookings: [],
      summary: { todayEarnings: 0, todayTrips: 0, weekEarnings: 0 }
    };
  }
  const driverId = dpRows[0].id;
  const rows = await client.unsafe(
    `
    SELECT 
      b.id,
      b.booking_code,
      b.status,
      b.origin_address,
      b.destination_address,
      b.distance_km,
      b.total_price,
      b.driver_commission,
      b.payment_method,
      b.payment_status,
      b.created_at,
      b.updated_at,
      u.full_name as customer_name,
      u.phone as customer_phone,
      vt.name as vehicle_type_name
    FROM bookings b
    LEFT JOIN users u ON u.id = b.customer_id
    LEFT JOIN vehicle_types vt ON vt.id = b.vehicle_type_id
    WHERE b.driver_id = $1::uuid
    ORDER BY b.created_at DESC
    LIMIT $2
    `,
    [driverId, limit]
  );
  const todayStats = await client.unsafe(
    `
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(total_price * 0.8), 0) as total_earnings
    FROM bookings
    WHERE driver_id = $1::uuid 
      AND status = 'COMPLETED'
      AND created_at >= CURRENT_DATE
    `,
    [driverId]
  );
  const weekStats = await client.unsafe(
    `
    SELECT 
      COALESCE(SUM(total_price * 0.8), 0) as total_earnings
    FROM bookings
    WHERE driver_id = $1::uuid 
      AND status = 'COMPLETED'
      AND created_at >= NOW() - INTERVAL '7 days'
    `,
    [driverId]
  );
  const todayEarnings = Math.round(Number(todayStats[0]?.total_earnings || 0));
  const todayTrips = Number(todayStats[0]?.count || 0);
  const weekEarnings = Math.round(Number(weekStats[0]?.total_earnings || 0));
  const bookings2 = rows.map((r) => ({
    id: r.id,
    bookingCode: r.booking_code,
    status: r.status,
    originAddress: r.origin_address,
    destinationAddress: r.destination_address,
    distanceKm: Number(r.distance_km || 0),
    totalPrice: Number(r.total_price || 0),
    driverEarning: Math.round(Number(r.total_price || 0) * 0.8),
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    customerName: r.customer_name || "Kh\xE1ch h\xE0ng",
    customerPhone: r.customer_phone || "",
    vehicleTypeName: r.vehicle_type_name || "Xe t\u1EA3i",
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
  return {
    bookings: bookings2,
    summary: {
      todayEarnings,
      todayTrips,
      weekEarnings
    }
  };
}

// src/api/routes/driver.ts
var router3 = Router3();
router3.get("/vehicle-types", async (req, res, next) => {
  try {
    const types = await getVehicleTypes();
    res.json({ success: true, data: types });
  } catch (err) {
    next(err);
  }
});
router3.get("/nearby", async (req, res, next) => {
  try {
    const lat = Number(req.query.lat || req.query.latitude);
    const lng = Number(req.query.lng || req.query.longitude);
    const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : void 0;
    const radiusMeters = req.query.radiusMeters ? Number(req.query.radiusMeters) : void 0;
    const vehicleTypeId = req.query.vehicleTypeId ? String(req.query.vehicleTypeId) : void 0;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const maxAgeMinutes = req.query.maxAgeMinutes ? Number(req.query.maxAgeMinutes) : 30;
    const drivers = await findNearbyDrivers({
      originLat: lat,
      originLng: lng,
      radiusKm,
      radiusMeters,
      vehicleTypeId,
      limit,
      maxAgeMinutes
    });
    res.json({
      success: true,
      count: drivers.length,
      data: drivers
    });
  } catch (err) {
    next(err);
  }
});
router3.get("/demand-zones", async (req, res, next) => {
  try {
    const lat = req.query.lat ? Number(req.query.lat) : void 0;
    const lng = req.query.lng ? Number(req.query.lng) : void 0;
    const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : void 0;
    const result = await getDemandHotspots({ lat, lng, radiusKm });
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});
router3.use(requireAuth, requireRoles(["DRIVER", "ADMIN"]));
router3.get("/profile", async (req, res, next) => {
  try {
    const profile = await getDriverProfile(req.user.userId);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
});
router3.get("/kyc/status", async (req, res, next) => {
  try {
    const status = await getDriverKycStatus(req.user.userId);
    res.json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
});
router3.post("/kyc/submit", async (req, res, next) => {
  try {
    const updatedProfile = await submitDriverKyc(req.user.userId, req.body);
    res.json({
      success: true,
      message: "N\u1ED9p h\u1ED3 s\u01A1 KYC th\xE0nh c\xF4ng. Vui l\xF2ng ch\u1EDD qu\u1EA3n tr\u1ECB vi\xEAn x\xE9t duy\u1EC7t.",
      data: updatedProfile
    });
  } catch (err) {
    next(err);
  }
});
router3.patch(["/status", "/status/online"], async (req, res, next) => {
  try {
    const result = await setDriverOnlineStatus(
      req.user.userId,
      Boolean(req.body.isOnline)
    );
    res.json({ success: true, message: result.message, data: result });
  } catch (err) {
    next(err);
  }
});
router3.put("/location", async (req, res, next) => {
  try {
    const profile = await getOrCreateDriverProfile(req.user.userId);
    const lat = req.body.lat !== void 0 ? req.body.lat : req.body.latitude;
    const lng = req.body.lng !== void 0 ? req.body.lng : req.body.longitude;
    const heading = req.body.heading;
    const speed = req.body.speed;
    const location = await updateDriverLocation(profile.id, {
      lat,
      lng,
      heading,
      speed
    });
    res.json({
      success: true,
      message: location.activeBooking ? `C\u1EADp nh\u1EADt t\u1ECDa \u0111\u1ED9 GPS th\xE0nh c\xF4ng (\u0110ang truy\u1EC1n realtime cho chuy\u1EBFn xe ${location.activeBooking.bookingCode})` : "C\u1EADp nh\u1EADt t\u1ECDa \u0111\u1ED9 GPS th\xE0nh c\xF4ng",
      data: location
    });
  } catch (err) {
    next(err);
  }
});
router3.get("/location", async (req, res, next) => {
  try {
    const profile = await getOrCreateDriverProfile(req.user.userId);
    const location = await getDriverLocation(profile.id);
    res.json({
      success: true,
      data: location
    });
  } catch (err) {
    next(err);
  }
});
router3.post(
  "/bookings/:bookingId/accept",
  async (req, res, next) => {
    try {
      const result = await acceptBooking(
        req.user.userId,
        req.params.bookingId
      );
      res.json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
);
router3.get("/bookings/available", async (req, res, next) => {
  try {
    const list = await getAvailableBookings(req.user?.userId);
    res.json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (err) {
    next(err);
  }
});
router3.get("/bookings/active", async (req, res, next) => {
  try {
    const profile = await getOrCreateDriverProfile(req.user.userId);
    const activeBooking = await getDriverActiveBooking(profile.id);
    res.json({
      success: true,
      data: activeBooking
    });
  } catch (err) {
    next(err);
  }
});
router3.get("/bookings", async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const result = await getDriverBookings(req.user.userId, limit);
    res.json({
      success: true,
      count: result.bookings.length,
      data: result.bookings,
      summary: result.summary
    });
  } catch (err) {
    next(err);
  }
});
router3.patch(
  "/bookings/:bookingId/status",
  async (req, res, next) => {
    try {
      const {
        status,
        note,
        proofImageUrl,
        requireProof,
        requireOtp,
        driverLat,
        driverLng,
        deliveryOtp,
        bypassGeofence,
        bypassReason
      } = req.body;
      const result = await updateBookingStatus(
        req.user.userId,
        req.params.bookingId,
        status,
        note,
        proofImageUrl,
        {
          requireProof: requireProof ?? true,
          requireOtp: requireOtp ?? true,
          driverLat: driverLat !== void 0 ? Number(driverLat) : void 0,
          driverLng: driverLng !== void 0 ? Number(driverLng) : void 0,
          deliveryOtp,
          bypassGeofence: Boolean(bypassGeofence),
          bypassReason
        }
      );
      res.json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
);
router3.post(
  "/bookings/:bookingId/cancel",
  async (req, res, next) => {
    try {
      const { reason } = req.body;
      const result = await cancelBooking(
        req.user.userId,
        req.params.bookingId,
        reason
      );
      res.json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
);
router3.get("/wallet", async (req, res, next) => {
  try {
    const wallet = await getWalletDetails(req.user.userId);
    res.json({
      success: true,
      data: wallet
    });
  } catch (err) {
    next(err);
  }
});
router3.get("/wallet/transactions", async (req, res, next) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const type = req.query.type ? String(req.query.type) : void 0;
    const result = await getWalletTransactions(req.user.userId, {
      page,
      limit,
      type
    });
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
});
router3.post("/wallet/topup", async (req, res, next) => {
  try {
    const { amount, description, referenceCode } = req.body;
    const result = await topUpWallet({
      userId: req.user.userId,
      amount: Number(amount),
      description,
      referenceCode,
      performedByUserId: req.user.userId
    });
    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (err) {
    next(err);
  }
});
var driver_default = router3;

// src/api/routes/admin.ts
import { Router as Router6 } from "express";
import { eq as eq9, desc as desc6 } from "drizzle-orm";

// src/lib/adminService.ts
import { eq as eq6, desc as desc4, and as and5, ilike as ilike2, or as or2, sql as sql4 } from "drizzle-orm";
async function getAllUsers() {
  const rows = await client.unsafe(`
    SELECT
      u.id,
      u.full_name AS "fullName",
      u.phone,
      u.email,
      u.role,
      u.status,
      u.created_at AS "createdAt",
      COALESCE(stats.order_count, 0)::int AS "orderCount",
      COALESCE(stats.total_spent, 0)::numeric AS "totalSpent",
      last_b.booking_code AS "lastBookingCode",
      last_b.created_at AS "lastBookingAt"
    FROM users u
    LEFT JOIN (
      SELECT
        customer_id,
        COUNT(*)::int AS order_count,
        COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total_price ELSE 0 END), 0) AS total_spent
      FROM bookings
      GROUP BY customer_id
    ) stats ON stats.customer_id = u.id
    LEFT JOIN LATERAL (
      SELECT booking_code, created_at
      FROM bookings
      WHERE customer_id = u.id
      ORDER BY created_at DESC
      LIMIT 1
    ) last_b ON true
    WHERE u.role = 'CUSTOMER'
    ORDER BY u.created_at DESC
  `);
  return rows;
}
async function getPendingKycDrivers(page = 1, limit = 20) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;
  const pendingProfiles = await db.select({
    id: driverProfiles.id,
    userId: driverProfiles.userId,
    vehicleTypeId: driverProfiles.vehicleTypeId,
    licensePlate: driverProfiles.licensePlate,
    driverLicenseNo: driverProfiles.driverLicenseNo,
    kycStatus: driverProfiles.kycStatus,
    ratingAvg: driverProfiles.ratingAvg,
    isOnline: driverProfiles.isOnline,
    isActive: driverProfiles.isActive,
    rejectionReason: driverProfiles.rejectionReason,
    createdAt: driverProfiles.createdAt,
    updatedAt: driverProfiles.updatedAt,
    // User info
    userName: users.fullName,
    userPhone: users.phone,
    userEmail: users.email,
    userAvatar: users.avatarUrl
  }).from(driverProfiles).innerJoin(users, eq6(driverProfiles.userId, users.id)).where(eq6(driverProfiles.kycStatus, "PENDING")).orderBy(desc4(driverProfiles.updatedAt)).limit(safeLimit).offset(offset);
  const results = await Promise.all(
    pendingProfiles.map(async (dp) => {
      let vehicleType = null;
      if (dp.vehicleTypeId) {
        const vt = await db.select().from(vehicleTypes).where(eq6(vehicleTypes.id, dp.vehicleTypeId)).limit(1);
        if (vt.length > 0) vehicleType = vt[0];
      }
      const docs = await db.select().from(driverDocuments).where(eq6(driverDocuments.driverId, dp.id));
      return {
        id: dp.id,
        userId: dp.userId,
        driverName: dp.userName,
        phone: dp.userPhone,
        email: dp.userEmail,
        avatarUrl: dp.userAvatar,
        licensePlate: dp.licensePlate,
        driverLicenseNo: dp.driverLicenseNo,
        kycStatus: dp.kycStatus,
        isOnline: dp.isOnline,
        isActive: dp.isActive,
        vehicleType,
        documents: docs,
        submittedAt: dp.updatedAt || dp.createdAt
      };
    })
  );
  const countResult = await db.select({ count: sql4`count(*)::int` }).from(driverProfiles).where(eq6(driverProfiles.kycStatus, "PENDING"));
  const total = countResult[0]?.count || 0;
  return {
    drivers: results,
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit)
  };
}
async function getDriverKycDetail(driverId) {
  if (!driverId) {
    throw new ApiError(400, "Thi\u1EBFu m\xE3 t\xE0i x\u1EBF (driverId)");
  }
  const profiles = await db.select().from(driverProfiles).where(eq6(driverProfiles.id, driverId)).limit(1);
  if (profiles.length === 0) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y h\u1ED3 s\u01A1 t\xE0i x\u1EBF");
  }
  const p = profiles[0];
  const userList = await db.select({
    id: users.id,
    fullName: users.fullName,
    phone: users.phone,
    email: users.email,
    avatarUrl: users.avatarUrl,
    role: users.role,
    status: users.status
  }).from(users).where(eq6(users.id, p.userId)).limit(1);
  let vehicleType = null;
  if (p.vehicleTypeId) {
    const vt = await db.select().from(vehicleTypes).where(eq6(vehicleTypes.id, p.vehicleTypeId)).limit(1);
    if (vt.length > 0) vehicleType = vt[0];
  }
  const docs = await db.select().from(driverDocuments).where(eq6(driverDocuments.driverId, p.id));
  return {
    ...p,
    user: userList[0] || null,
    vehicleType,
    documents: docs
  };
}
async function approveDriverKyc(driverId) {
  if (!driverId) {
    throw new ApiError(400, "Thi\u1EBFu m\xE3 t\xE0i x\u1EBF (driverId)");
  }
  const existing = await db.select().from(driverProfiles).where(eq6(driverProfiles.id, driverId)).limit(1);
  if (existing.length === 0) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y h\u1ED3 s\u01A1 t\xE0i x\u1EBF \u0111\u1EC3 ph\xEA duy\u1EC7t");
  }
  const docs = await db.select({ docType: driverDocuments.docType }).from(driverDocuments).where(eq6(driverDocuments.driverId, driverId));
  const submittedTypes = new Set(docs.map((d) => d.docType));
  const requiredTypes = [
    "CCCD_FRONT",
    "CCCD_BACK",
    "DRIVER_LICENSE",
    "VEHICLE_REGISTRATION"
  ];
  const missing = requiredTypes.filter((t) => !submittedTypes.has(t));
  if (missing.length > 0) {
    throw new ApiError(
      400,
      `Kh\xF4ng th\u1EC3 ph\xEA duy\u1EC7t: T\xE0i x\u1EBF ch\u01B0a n\u1ED9p \u0111\u1EE7 gi\u1EA5y t\u1EDD b\u1EAFt bu\u1ED9c (${missing.join(", ")})`
    );
  }
  const updated = await db.update(driverProfiles).set({
    kycStatus: "APPROVED",
    rejectionReason: null,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq6(driverProfiles.id, driverId)).returning();
  await db.update(users).set({ role: "DRIVER" }).where(eq6(users.id, existing[0].userId));
  try {
    await grantKycWelcomeDeposit(existing[0].userId, driverId);
  } catch (bonusErr) {
    console.warn("L\u1ED7i c\u1ED9ng v\u1ED1n k\xFD qu\u1EF9 kh\u1EDFi nghi\u1EC7p KYC:", bonusErr?.message);
  }
  return {
    driverId,
    kycStatus: updated[0].kycStatus,
    message: "Ph\xEA duy\u1EC7t h\u1ED3 s\u01A1 KYC t\xE0i x\u1EBF th\xE0nh c\xF4ng v\xE0 \u0111\xE3 t\u1EB7ng 200.000\u0111 v\u1ED1n k\xFD qu\u1EF9 kh\u1EDFi nghi\u1EC7p. T\xE0i x\u1EBF hi\u1EC7n \u0111\xE3 c\xF3 th\u1EC3 b\u1EADt Tr\u1EF1c tuy\u1EBFn."
  };
}
async function rejectDriverKyc(driverId, reason) {
  if (!driverId) {
    throw new ApiError(400, "Thi\u1EBFu m\xE3 t\xE0i x\u1EBF (driverId)");
  }
  if (!reason || !reason.trim()) {
    throw new ApiError(400, "L\xFD do t\u1EEB ch\u1ED1i h\u1ED3 s\u01A1 kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng");
  }
  const existing = await db.select().from(driverProfiles).where(eq6(driverProfiles.id, driverId)).limit(1);
  if (existing.length === 0) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y h\u1ED3 s\u01A1 t\xE0i x\u1EBF \u0111\u1EC3 x\u1EED l\xFD");
  }
  const updated = await db.update(driverProfiles).set({
    kycStatus: "REJECTED",
    rejectionReason: reason.trim(),
    isOnline: false,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq6(driverProfiles.id, driverId)).returning();
  return {
    driverId,
    kycStatus: updated[0].kycStatus,
    rejectionReason: updated[0].rejectionReason,
    isOnline: updated[0].isOnline,
    message: "\u0110\xE3 t\u1EEB ch\u1ED1i ph\xEA duy\u1EC7t h\u1ED3 s\u01A1 KYC t\xE0i x\u1EBF."
  };
}
async function getAllDrivers(params = {}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;
  let query = db.select({
    id: driverProfiles.id,
    userId: driverProfiles.userId,
    vehicleTypeId: driverProfiles.vehicleTypeId,
    licensePlate: driverProfiles.licensePlate,
    driverLicenseNo: driverProfiles.driverLicenseNo,
    kycStatus: driverProfiles.kycStatus,
    ratingAvg: driverProfiles.ratingAvg,
    isOnline: driverProfiles.isOnline,
    isActive: driverProfiles.isActive,
    rejectionReason: driverProfiles.rejectionReason,
    createdAt: driverProfiles.createdAt,
    updatedAt: driverProfiles.updatedAt,
    // User info
    userName: users.fullName,
    userPhone: users.phone,
    userEmail: users.email,
    userAvatar: users.avatarUrl
  }).from(driverProfiles).innerJoin(users, eq6(driverProfiles.userId, users.id));
  const conditions = [];
  if (params.kycStatus && params.kycStatus !== "ALL") {
    conditions.push(eq6(driverProfiles.kycStatus, params.kycStatus));
  }
  if (params.isOnline !== void 0) {
    conditions.push(eq6(driverProfiles.isOnline, params.isOnline));
  }
  if (params.search && params.search.trim()) {
    const s = `%${params.search.trim()}%`;
    conditions.push(
      or2(
        ilike2(users.fullName, s),
        ilike2(users.phone, s),
        ilike2(driverProfiles.licensePlate, s)
      )
    );
  }
  const finalQuery = conditions.length > 0 ? query.where(and5(...conditions)) : query;
  const rawList = await finalQuery.orderBy(desc4(driverProfiles.updatedAt)).limit(limit).offset(offset);
  const results = await Promise.all(
    rawList.map(async (dp) => {
      let vehicleType = null;
      if (dp.vehicleTypeId) {
        const vt = await db.select().from(vehicleTypes).where(eq6(vehicleTypes.id, dp.vehicleTypeId)).limit(1);
        if (vt.length > 0) vehicleType = vt[0];
      }
      const docs = await db.select().from(driverDocuments).where(eq6(driverDocuments.driverId, dp.id));
      return {
        id: dp.id,
        userId: dp.userId,
        driverName: dp.userName,
        phone: dp.userPhone,
        email: dp.userEmail,
        avatarUrl: dp.userAvatar,
        licensePlate: dp.licensePlate,
        driverLicenseNo: dp.driverLicenseNo,
        kycStatus: dp.kycStatus,
        isOnline: dp.isOnline,
        isActive: dp.isActive,
        vehicleType,
        documentsCount: docs.length,
        rejectionReason: dp.rejectionReason,
        updatedAt: dp.updatedAt
      };
    })
  );
  const countQuery = db.select({ count: sql4`count(*)::int` }).from(driverProfiles).innerJoin(users, eq6(driverProfiles.userId, users.id));
  const countResult = await (conditions.length > 0 ? countQuery.where(and5(...conditions)) : countQuery);
  const total = countResult[0]?.count || 0;
  return {
    drivers: results,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  };
}
async function setDriverActiveStatus(driverId, isActive) {
  if (!driverId) {
    throw new ApiError(400, "Thi\u1EBFu m\xE3 t\xE0i x\u1EBF (driverId)");
  }
  const existing = await db.select().from(driverProfiles).where(eq6(driverProfiles.id, driverId)).limit(1);
  if (existing.length === 0) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y h\u1ED3 s\u01A1 t\xE0i x\u1EBF");
  }
  const updated = await db.update(driverProfiles).set({
    isActive,
    isOnline: isActive ? existing[0].isOnline : false,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq6(driverProfiles.id, driverId)).returning();
  return {
    driverId,
    isActive: updated[0].isActive,
    isOnline: updated[0].isOnline,
    message: isActive ? "\u0110\xE3 k\xEDch ho\u1EA1t t\xE0i x\u1EBF" : "\u0110\xE3 t\u1EA1m kh\xF3a t\xE0i kho\u1EA3n t\xE0i x\u1EBF"
  };
}
async function getAdminBookings(params = {}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;
  const conditions = [];
  const values = [];
  let pIdx = 1;
  if (params.status && params.status !== "ALL" && params.status !== "T\u1EA5t c\u1EA3") {
    conditions.push(`b.status = $${pIdx++}`);
    values.push(params.status);
  }
  if (params.vehicle && params.vehicle !== "ALL" && params.vehicle !== "T\u1EA5t c\u1EA3 lo\u1EA1i xe") {
    conditions.push(`vt.name ILIKE $${pIdx++}`);
    values.push(`%${params.vehicle.trim()}%`);
  }
  if (params.search && params.search.trim()) {
    const s = `%${params.search.trim()}%`;
    conditions.push(`(
      b.booking_code ILIKE $${pIdx} OR 
      b.origin_address ILIKE $${pIdx} OR 
      b.destination_address ILIKE $${pIdx} OR 
      u_cust.full_name ILIKE $${pIdx} OR 
      u_cust.phone ILIKE $${pIdx} OR
      u_driver.full_name ILIKE $${pIdx} OR
      u_driver.phone ILIKE $${pIdx} OR
      dp.license_plate ILIKE $${pIdx}
    )`);
    values.push(s);
    pIdx++;
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql6 = `
    SELECT
      b.id,
      b.booking_code AS "bookingCode",
      b.customer_id AS "customerId",
      b.driver_id AS "driverId",
      b.vehicle_type_id AS "vehicleTypeId",
      b.status,
      b.origin_address AS "originAddress",
      b.destination_address AS "destinationAddress",
      b.distance_km AS "distanceKm",
      b.base_price AS "basePrice",
      b.surcharge_price AS "surchargePrice",
      b.total_price AS "totalPrice",
      b.driver_commission AS "driverCommission",
      b.payment_method AS "paymentMethod",
      b.payment_status AS "paymentStatus",
      b.cancelled_by AS "cancelledBy",
      b.cancellation_reason AS "cancellationReason",
      b.cancellation_fee AS "cancellationFee",
      b.pickup_proof_image AS "pickupProofImage",
      b.delivery_proof_image AS "deliveryProofImage",
      b.created_at AS "createdAt",
      ST_Y(b.origin_point::geometry) AS "originLat",
      ST_X(b.origin_point::geometry) AS "originLng",
      ST_Y(b.destination_point::geometry) AS "destLat",
      ST_X(b.destination_point::geometry) AS "destLng",
      u_cust.full_name AS "customerName",
      u_cust.phone AS "customerPhone",
      u_driver.full_name AS "driverName",
      u_driver.phone AS "driverPhone",
      dp.license_plate AS "licensePlate",
      vt.name AS "vehicleName"
    FROM bookings b
    LEFT JOIN users u_cust ON b.customer_id = u_cust.id
    LEFT JOIN driver_profiles dp ON b.driver_id = dp.id
    LEFT JOIN users u_driver ON dp.user_id = u_driver.id
    LEFT JOIN vehicle_types vt ON b.vehicle_type_id = vt.id
    ${whereClause}
    ORDER BY b.created_at DESC
    LIMIT $${pIdx++} OFFSET $${pIdx++}
  `;
  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM bookings b
    LEFT JOIN users u_cust ON b.customer_id = u_cust.id
    LEFT JOIN driver_profiles dp ON b.driver_id = dp.id
    LEFT JOIN users u_driver ON dp.user_id = u_driver.id
    LEFT JOIN vehicle_types vt ON b.vehicle_type_id = vt.id
    ${whereClause}
  `;
  const [rawList, countRes] = await Promise.all([
    client.unsafe(sql6, [...values, limit, offset]),
    client.unsafe(countSql, values)
  ]);
  const total = Number(countRes[0]?.total || 0);
  return {
    bookings: rawList,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1
  };
}
async function getAllDriverRatings(params = {}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;
  await seedInitialRatingsIfEmpty();
  const conditions = [];
  const values = [];
  let paramIdx = 1;
  if (params.rating) {
    conditions.push(`dr.rating = $${paramIdx++}`);
    values.push(params.rating);
  }
  if (params.driverId) {
    conditions.push(`dr.driver_id = $${paramIdx++}::uuid`);
    values.push(params.driverId);
  }
  if (params.search && params.search.trim()) {
    const term = `%${params.search.trim()}%`;
    conditions.push(
      `(u_driver.full_name ILIKE $${paramIdx} OR u_driver.phone ILIKE $${paramIdx} OR u_cust.full_name ILIKE $${paramIdx} OR b.booking_code ILIKE $${paramIdx} OR dr.comment ILIKE $${paramIdx})`
    );
    values.push(term);
    paramIdx++;
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const listSql = `
    SELECT
      dr.id,
      dr.rating,
      dr.tags,
      dr.comment,
      dr.created_at as "createdAt",
      b.id as "bookingId",
      b.booking_code as "bookingCode",
      b.origin_address as "originAddress",
      b.destination_address as "destinationAddress",
      b.total_price as "totalPrice",
      dp.id as "driverId",
      dp.license_plate as "licensePlate",
      dp.rating_avg as "driverRatingAvg",
      vt.name as "vehicleTypeName",
      u_driver.full_name as "driverName",
      u_driver.phone as "driverPhone",
      u_driver.avatar_url as "driverAvatar",
      u_cust.id as "customerId",
      u_cust.full_name as "customerName",
      u_cust.phone as "customerPhone",
      u_cust.avatar_url as "customerAvatar"
    FROM driver_ratings dr
    JOIN bookings b ON dr.booking_id = b.id
    JOIN driver_profiles dp ON dr.driver_id = dp.id
    JOIN users u_driver ON dp.user_id = u_driver.id
    LEFT JOIN vehicle_types vt ON dp.vehicle_type_id = vt.id
    LEFT JOIN users u_cust ON dr.customer_id = u_cust.id
    ${whereClause}
    ORDER BY dr.created_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;
  const items = await client.unsafe(listSql, [...values, limit, offset]);
  const countSql = `
    SELECT COUNT(*)::int as total
    FROM driver_ratings dr
    JOIN bookings b ON dr.booking_id = b.id
    JOIN driver_profiles dp ON dr.driver_id = dp.id
    JOIN users u_driver ON dp.user_id = u_driver.id
    LEFT JOIN users u_cust ON dr.customer_id = u_cust.id
    ${whereClause}
  `;
  const countRes = await client.unsafe(countSql, values);
  const total = Number(countRes[0]?.total || 0);
  const statsRes = await client.unsafe(`
    SELECT
      COUNT(*)::int as total,
      ROUND(COALESCE(AVG(rating), 5.0)::numeric, 2) as avg_rating,
      COUNT(CASE WHEN rating = 5 THEN 1 END)::int as star5,
      COUNT(CASE WHEN rating = 4 THEN 1 END)::int as star4,
      COUNT(CASE WHEN rating = 3 THEN 1 END)::int as star3,
      COUNT(CASE WHEN rating = 2 THEN 1 END)::int as star2,
      COUNT(CASE WHEN rating = 1 THEN 1 END)::int as star1
    FROM driver_ratings
  `);
  const stats = statsRes[0] || {
    total: 0,
    avg_rating: 5,
    star5: 0,
    star4: 0,
    star3: 0,
    star2: 0,
    star1: 0
  };
  return {
    ratings: items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    summary: {
      totalRatings: Number(stats.total || 0),
      avgRating: Number(stats.avg_rating || 5),
      distribution: {
        5: Number(stats.star5 || 0),
        4: Number(stats.star4 || 0),
        3: Number(stats.star3 || 0),
        2: Number(stats.star2 || 0),
        1: Number(stats.star1 || 0)
      }
    }
  };
}
async function seedInitialRatingsIfEmpty() {
  try {
    const check = await client.unsafe(`SELECT COUNT(*)::int as count FROM driver_ratings`);
    if (Number(check[0]?.count || 0) > 0) return;
    const candidateBookings = await client.unsafe(`
      SELECT b.id, b.driver_id, b.customer_id
      FROM bookings b
      WHERE b.driver_id IS NOT NULL AND b.customer_id IS NOT NULL
      ORDER BY b.created_at DESC
      LIMIT 8
    `);
    if (candidateBookings.length === 0) return;
    const seedTemplates = [
      {
        rating: 5,
        tags: ["L\xE1i xe an to\xE0n", "Nhi\u1EC7t t\xECnh, chu \u0111\xE1o", "Xe s\u1EA1ch \u0111\u1EB9p"],
        comment: "B\xE1c t\xE0i l\xE1i xe r\u1EA5t c\u1EA9n th\u1EADn, b\u1ED1c x\u1EBFp h\xE0ng nhi\u1EC7t t\xECnh gi\xFAp \u0111\u1EE1. Xe s\u1EA1ch \u0111\u1EB9p v\xE0 th\xF9ng xe r\u1ED9ng!"
      },
      {
        rating: 5,
        tags: ["\u0110\xFAng gi\u1EDD", "H\xE0ng h\xF3a c\u1EA9n th\u1EADn"],
        comment: "\u0110\xFAng gi\u1EDD h\u1EB9n, v\u1EADn chuy\u1EC3n an to\xE0n kh\xF4ng m\xF3p m\xE9o ki\u1EC7n h\xE0ng n\xE0o. R\u1EA5t \u01B0ng \xFD d\u1ECBch v\u1EE5!"
      },
      {
        rating: 4,
        tags: ["Nhi\u1EC7t t\xECnh, chu \u0111\xE1o"],
        comment: "T\xE0i x\u1EBF \u0111\u1EBFn h\u01A1i ch\u1EADm 5 ph\xFAt do k\u1EB9t \u0111\u01B0\u1EDDng nh\u01B0ng th\xE1i \u0111\u1ED9 vui v\u1EBB v\xE0 h\u1ED7 tr\u1EE3 b\u01B0ng \u0111\u1ED3 r\u1EA5t t\u1ED1t."
      },
      {
        rating: 5,
        tags: ["L\xE1i xe an to\xE0n", "\u0110\xFAng gi\u1EDD"],
        comment: "D\u1ECBch v\u1EE5 r\u1EA5t t\u1ED1t, s\u1EBD ti\u1EBFp t\u1EE5c \u0111\u1EB7t xe b\xEAn m\xECnh khi chuy\u1EC3n kho h\xE0ng l\u1EA7n t\u1EDBi."
      },
      {
        rating: 3,
        tags: ["H\xE0ng h\xF3a c\u1EA9n th\u1EADn"],
        comment: "T\xE0i x\u1EBF \u0111i h\u01A1i g\u1EA5p m\u1ED9t ch\xFAt, c\u1EA7n ch\u1EA1y \xEAm h\u01A1n khi ch\u1EDF \u0111\u1ED3 g\u1ED1m s\u1EE9."
      },
      {
        rating: 5,
        tags: ["L\xE1i xe an to\xE0n", "Nhi\u1EC7t t\xECnh, chu \u0111\xE1o", "\u0110\xFAng gi\u1EDD"],
        comment: "Anh t\xE0i x\u1EBF tuy\u1EC7t v\u1EDDi! Nhi\u1EC7t t\xECnh v\xE0 chuy\xEAn nghi\u1EC7p, 5 sao x\u1EE9ng \u0111\xE1ng."
      },
      {
        rating: 5,
        tags: ["H\xE0ng h\xF3a c\u1EA9n th\u1EADn", "Xe s\u1EA1ch \u0111\u1EB9p"],
        comment: "Th\xF9ng xe r\u1ED9ng r\xE3i v\xE0 s\u1EA1ch s\u1EBD, \u0111\xF3ng g\xF3i ch\u1EB1ng bu\u1ED9c h\xE0ng r\u1EA5t k\u1EF9 c\xE0ng."
      },
      {
        rating: 4,
        tags: ["L\xE1i xe an to\xE0n"],
        comment: "Chuy\u1EBFn \u0111i \u1ED5n \u0111\u1ECBnh, t\xE0i x\u1EBF r\xE0nh \u0111\u01B0\u1EDDng n\xE9 \u0111\u01B0\u1EE3c gi\u1EDD cao \u0111i\u1EC3m ng\u1EADp n\u01B0\u1EDBc."
      }
    ];
    for (let i = 0; i < candidateBookings.length; i++) {
      const b = candidateBookings[i];
      const t = seedTemplates[i % seedTemplates.length];
      await client.unsafe(
        `
        INSERT INTO driver_ratings (booking_id, driver_id, customer_id, rating, tags, comment, created_at, updated_at)
        VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::text[], $6, NOW() - ($7 || ' hours')::interval, NOW())
        ON CONFLICT (booking_id, customer_id) DO NOTHING
        `,
        [b.id, b.driver_id, b.customer_id, t.rating, t.tags, t.comment, (i * 4 + 1).toString()]
      );
    }
    await client.unsafe(`
      UPDATE driver_profiles dp
      SET rating_avg = sub.avg_r
      FROM (
        SELECT driver_id, ROUND(AVG(rating)::numeric, 2) as avg_r
        FROM driver_ratings
        GROUP BY driver_id
      ) sub
      WHERE dp.id = sub.driver_id
    `);
  } catch (err) {
    console.warn("L\u1ED7i seed driver ratings:", err.message);
  }
}
async function setUserStatus(userId, status) {
  if (status !== "ACTIVE" && status !== "BLOCKED") {
    throw new ApiError(400, "Tr\u1EA1ng th\xE1i kh\xF4ng h\u1EE3p l\u1EC7 (ch\u1EC9 ch\u1EA5p nh\u1EADn ACTIVE ho\u1EB7c BLOCKED)");
  }
  const [user] = await db.select().from(users).where(eq6(users.id, userId)).limit(1);
  if (!user) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y ng\u01B0\u1EDDi d\xF9ng");
  }
  if (user.role === "ADMIN") {
    throw new ApiError(403, "Kh\xF4ng th\u1EC3 kh\xF3a t\xE0i kho\u1EA3n Qu\u1EA3n tr\u1ECB vi\xEAn qua endpoint n\xE0y");
  }
  const [updated] = await db.update(users).set({ status, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(users.id, userId)).returning({
    id: users.id,
    fullName: users.fullName,
    phone: users.phone,
    status: users.status
  });
  return updated;
}
async function getDashboardSummary() {
  const [bookingStats] = await client.unsafe(`
    SELECT
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS "todayOrders",
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' AND created_at < CURRENT_DATE)::int AS "yesterdayOrders",
      COUNT(*) FILTER (WHERE status IN ('ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT'))::int AS "inTransitOrders",
      COUNT(*) FILTER (WHERE status IN ('PENDING', 'SEARCHING'))::int AS "waitingDriverOrders",
      COUNT(*) FILTER (WHERE status IN ('PENDING', 'SEARCHING', 'ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT'))::int AS "activeOrders",
      COALESCE(SUM(total_price) FILTER (WHERE created_at >= CURRENT_DATE AND status = 'COMPLETED'), 0)::numeric AS "todayRevenue",
      COALESCE(SUM(total_price) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' AND created_at < CURRENT_DATE AND status = 'COMPLETED'), 0)::numeric AS "yesterdayRevenue"
    FROM bookings
  `);
  const [driverStats] = await client.unsafe(`
    SELECT
      COUNT(*) FILTER (WHERE is_online = true AND is_active = true)::int AS "onlineDrivers",
      COUNT(*) FILTER (WHERE kyc_status = 'APPROVED' AND is_active = true)::int AS "totalActiveDrivers",
      COUNT(*) FILTER (WHERE kyc_status = 'PENDING')::int AS "pendingKycCount"
    FROM driver_profiles
  `);
  const pendingKycList = await client.unsafe(`
    SELECT
      dp.id,
      u.full_name AS "fullName",
      u.phone,
      dp.license_plate AS "licensePlate",
      dp.created_at AS "createdAt"
    FROM driver_profiles dp
    INNER JOIN users u ON dp.user_id = u.id
    WHERE dp.kyc_status = 'PENDING'
    ORDER BY dp.created_at ASC
    LIMIT 5
  `);
  const stuckOrders = await client.unsafe(`
    SELECT
      b.id,
      b.booking_code AS "bookingCode",
      b.status,
      b.origin_address AS "originAddress",
      b.created_at AS "createdAt",
      EXTRACT(EPOCH FROM (NOW() - b.created_at)) / 60 AS "waitingMinutes"
    FROM bookings b
    WHERE b.status IN ('PENDING', 'SEARCHING')
      AND b.created_at < NOW() - INTERVAL '15 minutes'
    ORDER BY b.created_at ASC
    LIMIT 10
  `);
  const onlineLocations = await client.unsafe(`
    SELECT
      dl.driver_id AS "driverId",
      u.full_name AS "driverName",
      dp.license_plate AS "licensePlate",
      ST_Y(dl.location_point::geometry) AS "lat",
      ST_X(dl.location_point::geometry) AS "lng",
      dl.updated_at AS "updatedAt"
    FROM driver_locations dl
    INNER JOIN driver_profiles dp ON dl.driver_id = dp.id
    INNER JOIN users u ON dp.user_id = u.id
    WHERE dp.is_online = true AND dp.is_active = true
    LIMIT 50
  `);
  return {
    todayOrders: Number(bookingStats?.todayOrders || 0),
    yesterdayOrders: Number(bookingStats?.yesterdayOrders || 0),
    inTransitOrders: Number(bookingStats?.inTransitOrders || 0),
    waitingDriverOrders: Number(bookingStats?.waitingDriverOrders || 0),
    activeOrders: Number(bookingStats?.activeOrders || 0),
    todayRevenue: Number(bookingStats?.todayRevenue || 0),
    yesterdayRevenue: Number(bookingStats?.yesterdayRevenue || 0),
    onlineDrivers: Number(driverStats?.onlineDrivers || 0),
    totalActiveDrivers: Number(driverStats?.totalActiveDrivers || 0),
    pendingKycCount: Number(driverStats?.pendingKycCount || 0),
    pendingKycList,
    stuckOrders,
    onlineLocations
  };
}
async function findBookingByIdOrCode(bookingIdOrCode) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    bookingIdOrCode
  );
  const [booking] = await db.select().from(bookings).where(
    isUuid ? eq6(bookings.id, bookingIdOrCode) : eq6(bookings.bookingCode, bookingIdOrCode)
  ).limit(1);
  if (!booking) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y \u0111\u01A1n h\xE0ng");
  }
  return booking;
}
async function adminCancelBooking(bookingIdOrCode, reason) {
  if (!reason || reason.trim().length < 3) {
    throw new ApiError(400, "Vui l\xF2ng nh\u1EADp l\xFD do h\u1EE7y \u0111\u01A1n (t\u1ED1i thi\u1EC3u 3 k\xFD t\u1EF1)");
  }
  const booking = await findBookingByIdOrCode(bookingIdOrCode);
  if (booking.status === "COMPLETED" || booking.status === "CANCELLED") {
    throw new ApiError(
      400,
      `Kh\xF4ng th\u1EC3 h\u1EE7y \u0111\u01A1n h\xE0ng \u0111ang \u1EDF tr\u1EA1ng th\xE1i ${booking.status}`
    );
  }
  const [updated] = await db.update(bookings).set({
    status: "CANCELLED",
    cancelledBy: "ADMIN",
    cancellationReason: reason.trim(),
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq6(bookings.id, booking.id)).returning();
  return updated;
}
async function adminAssignDriver(bookingIdOrCode, driverProfileId) {
  if (!driverProfileId) {
    throw new ApiError(400, "Vui l\xF2ng ch\u1ECDn t\xE0i x\u1EBF \u0111\u1EC3 \u0111i\u1EC1u ph\u1ED1i");
  }
  const booking = await findBookingByIdOrCode(bookingIdOrCode);
  if (booking.status !== "PENDING" && booking.status !== "SEARCHING") {
    throw new ApiError(
      400,
      `Ch\u1EC9 c\xF3 th\u1EC3 g\xE1n t\xE0i x\u1EBF cho \u0111\u01A1n PENDING ho\u1EB7c SEARCHING (hi\u1EC7n t\u1EA1i: ${booking.status})`
    );
  }
  const [driver] = await db.select().from(driverProfiles).where(eq6(driverProfiles.id, driverProfileId)).limit(1);
  if (!driver) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y h\u1ED3 s\u01A1 t\xE0i x\u1EBF");
  }
  if (driver.kycStatus !== "APPROVED" || !driver.isActive) {
    throw new ApiError(
      400,
      "T\xE0i x\u1EBF ch\u01B0a \u0111\u01B0\u1EE3c duy\u1EC7t KYC ho\u1EB7c \u0111ang b\u1ECB kh\xF3a t\xE0i kho\u1EA3n"
    );
  }
  const [updated] = await db.update(bookings).set({
    driverId: driver.id,
    status: "ACCEPTED",
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq6(bookings.id, booking.id)).returning();
  return updated;
}
async function adminRefundBooking(bookingIdOrCode, reason, adminUserId) {
  if (!reason || reason.trim().length < 3) {
    throw new ApiError(400, "Vui l\xF2ng nh\u1EADp l\xFD do ho\xE0n ti\u1EC1n");
  }
  const booking = await findBookingByIdOrCode(bookingIdOrCode);
  if (booking.paymentStatus === "REFUNDED") {
    throw new ApiError(400, "\u0110\u01A1n h\xE0ng n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c ho\xE0n ti\u1EC1n tr\u01B0\u1EDBc \u0111\xF3");
  }
  if (booking.paymentStatus !== "PAID") {
    throw new ApiError(
      400,
      `\u0110\u01A1n h\xE0ng ch\u01B0a thanh to\xE1n (${booking.paymentStatus}), kh\xF4ng th\u1EC3 ho\xE0n ti\u1EC1n`
    );
  }
  const refundAmount = Number(booking.totalPrice || 0);
  if (refundAmount <= 0) {
    throw new ApiError(400, "S\u1ED1 ti\u1EC1n ho\xE0n kh\xF4ng h\u1EE3p l\u1EC7");
  }
  await adminAdjustWallet({
    targetUserId: booking.customerId,
    amount: refundAmount,
    type: "REFUND",
    description: `Ho\xE0n ti\u1EC1n \u0111\u01A1n ${booking.bookingCode}: ${reason.trim()}`,
    referenceCode: booking.bookingCode,
    adminUserId
  });
  const [updated] = await db.update(bookings).set({
    paymentStatus: "REFUNDED",
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq6(bookings.id, booking.id)).returning();
  return updated;
}

// src/lib/paymentService.ts
import crypto from "node:crypto";
var VNPAY_CONFIG = {
  tmnCode: process.env.VNPAY_TMN_CODE || "DATXETAI_SANDBOX",
  hashSecret: process.env.VNPAY_HASH_SECRET || "VNPAY_DATXETAI_HASH_SECRET_KEY_2026",
  url: process.env.VNPAY_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  defaultReturnUrl: process.env.VNPAY_RETURN_URL || "http://localhost:8443/payment/vnpay-callback"
};
var MOMO_CONFIG = {
  partnerCode: process.env.MOMO_PARTNER_CODE || "MOMO_DATXETAI",
  accessKey: process.env.MOMO_ACCESS_KEY || "MOMO_ACCESS_KEY_DEV",
  secretKey: process.env.MOMO_SECRET_KEY || "MOMO_SECRET_KEY_DEV_TRUCK_BOOKING_2026",
  endpoint: process.env.MOMO_ENDPOINT || "https://test-payment.momo.vn/v2/gateway/api/create",
  defaultRedirectUrl: process.env.MOMO_REDIRECT_URL || "http://localhost:8443/payment/momo-callback",
  defaultIpnUrl: process.env.MOMO_IPN_URL || "http://localhost:3000/api/v1/payments/momo-ipn"
};
var VIETQR_CONFIG = {
  bankId: process.env.BANK_ID || "VCB",
  // Vietcombank
  bankName: "Vietcombank (VCB)",
  accountNo: process.env.BANK_ACCOUNT_NO || "1049761056",
  accountName: process.env.BANK_ACCOUNT_NAME || "TRAN VU HUNG"
};
function formatVnpayDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}${h}${mi}${s}`;
}
function generateTransactionCode(gateway) {
  const prefix = gateway.toUpperCase();
  const timestamp2 = Date.now();
  const random = Math.floor(1e3 + Math.random() * 9e3);
  return `${prefix}_${timestamp2}_${random}`;
}
async function createPaymentOrder(dto) {
  const {
    userId,
    amount,
    gateway,
    purpose,
    bookingId,
    ipAddr = "127.0.0.1",
    bankCode,
    redirectUrl,
    description
  } = dto;
  if (!userId) {
    throw new ApiError(401, "Y\xEAu c\u1EA7u \u0111\u0103ng nh\u1EADp ng\u01B0\u1EDDi d\xF9ng");
  }
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount < 1e4) {
    throw new ApiError(400, "S\u1ED1 ti\u1EC1n thanh to\xE1n t\u1ED1i thi\u1EC3u l\xE0 10.000 VN\u0110");
  }
  let walletId = null;
  let bookingCode = null;
  if (purpose === "TOPUP_WALLET") {
    const wallet = await getOrCreateWallet(userId);
    walletId = wallet.id;
  } else if (purpose === "PAY_BOOKING") {
    if (!bookingId) {
      throw new ApiError(
        400,
        "Thi\u1EBFu th\xF4ng tin bookingId \u0111\u1EC3 thanh to\xE1n chuy\u1EBFn xe"
      );
    }
    const bRows = await client.unsafe(
      `SELECT id, booking_code, status, total_price, payment_status FROM bookings WHERE id = $1::uuid LIMIT 1`,
      [bookingId]
    );
    if (bRows.length === 0) {
      throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y chuy\u1EBFn xe c\u1EA7n thanh to\xE1n");
    }
    if (bRows[0].payment_status === "PAID") {
      throw new ApiError(400, "Chuy\u1EBFn xe n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c thanh to\xE1n tr\u01B0\u1EDBc \u0111\xF3");
    }
    bookingCode = bRows[0].booking_code;
  }
  const transactionCode = generateTransactionCode(gateway);
  const orderDesc = description || (purpose === "TOPUP_WALLET" ? `N\u1EA1p ${numAmount.toLocaleString("vi-VN")} \u0111 v\xE0o v\xED` : `Thanh to\xE1n chuy\u1EBFn xe ${bookingCode || bookingId}`);
  let paymentUrl;
  let qrCodeUrl = null;
  if (gateway === "VNPAY") {
    const returnUrl = redirectUrl || VNPAY_CONFIG.defaultReturnUrl;
    const createDate = formatVnpayDate(/* @__PURE__ */ new Date());
    const vnpParams = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: VNPAY_CONFIG.tmnCode,
      vnp_Locale: "vn",
      vnp_CurrCode: "VND",
      vnp_TxnRef: transactionCode,
      vnp_OrderInfo: orderDesc,
      vnp_OrderType: purpose === "TOPUP_WALLET" ? "topup" : "billpayment",
      vnp_Amount: String(numAmount * 100),
      // VNPay quy ước nhân 100
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate
    };
    if (bankCode) {
      vnpParams.vnp_BankCode = bankCode;
    }
    const sortedKeys = Object.keys(vnpParams).sort();
    const signDataParts = [];
    const queryParts = [];
    for (const key of sortedKeys) {
      const val = vnpParams[key];
      if (val !== void 0 && val !== null && val.length > 0) {
        signDataParts.push(
          `${key}=${encodeURIComponent(val).replace(/%20/g, "+")}`
        );
        queryParts.push(
          `${key}=${encodeURIComponent(val).replace(/%20/g, "+")}`
        );
      }
    }
    const signData = signDataParts.join("&");
    const hmac = crypto.createHmac("sha512", VNPAY_CONFIG.hashSecret);
    const secureHash = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
    paymentUrl = `${VNPAY_CONFIG.url}?${queryParts.join("&")}&vnp_SecureHash=${secureHash}`;
    qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(paymentUrl)}`;
  } else if (gateway === "MOMO") {
    const returnUrl = redirectUrl || MOMO_CONFIG.defaultRedirectUrl;
    const ipnUrl = MOMO_CONFIG.defaultIpnUrl;
    const requestId = `${transactionCode}_REQ`;
    const extraData = Buffer.from(
      JSON.stringify({ userId, purpose, bookingId })
    ).toString("base64");
    const rawSignature = `accessKey=${MOMO_CONFIG.accessKey}&amount=${numAmount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${transactionCode}&orderInfo=${orderDesc}&partnerCode=${MOMO_CONFIG.partnerCode}&redirectUrl=${returnUrl}&requestId=${requestId}&requestType=captureWallet`;
    const signature = crypto.createHmac("sha256", MOMO_CONFIG.secretKey).update(rawSignature).digest("hex");
    paymentUrl = `https://test-payment.momo.vn/v2/gateway/pay?partnerCode=${MOMO_CONFIG.partnerCode}&orderId=${transactionCode}&requestId=${requestId}&amount=${numAmount}&orderInfo=${encodeURIComponent(orderDesc)}&signature=${signature}`;
    qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(paymentUrl)}`;
  } else if (gateway === "VIETQR") {
    const cleanAccountName = encodeURIComponent(VIETQR_CONFIG.accountName);
    const transferMemo = encodeURIComponent(`${transactionCode}`);
    qrCodeUrl = `https://img.vietqr.io/image/${VIETQR_CONFIG.bankId}-${VIETQR_CONFIG.accountNo}-compact2.png?amount=${numAmount}&addInfo=${transferMemo}&accountName=${cleanAccountName}`;
    paymentUrl = qrCodeUrl;
  } else {
    throw new ApiError(400, `C\u1ED5ng thanh to\xE1n "${gateway}" kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3`);
  }
  const inserted = await client.unsafe(
    `
    INSERT INTO payment_transactions (
      user_id,
      booking_id,
      wallet_id,
      amount,
      gateway,
      transaction_code,
      status,
      payment_url,
      description,
      created_at,
      updated_at
    ) VALUES (
      $1::uuid,
      $2::uuid,
      $3::uuid,
      $4::numeric,
      $5,
      $6,
      'PENDING',
      $7,
      $8,
      NOW(),
      NOW()
    )
    RETURNING id, transaction_code, amount, gateway, status, payment_url, created_at
    `,
    [
      userId,
      bookingId || null,
      walletId || null,
      numAmount,
      gateway,
      transactionCode,
      paymentUrl,
      orderDesc
    ]
  );
  return {
    paymentId: inserted[0].id,
    transactionCode,
    gateway,
    amount: numAmount,
    purpose,
    paymentUrl,
    qrCodeUrl,
    bookingCode,
    description: orderDesc,
    createdAt: inserted[0].created_at
  };
}
async function processVnpayIpn(query) {
  const vnpParams = {};
  let secureHash = "";
  for (const [key, value] of Object.entries(query)) {
    if (key === "vnp_SecureHash" || key === "vnp_SecureHashType") {
      if (key === "vnp_SecureHash") secureHash = String(value);
      continue;
    }
    if (key.startsWith("vnp_")) {
      vnpParams[key] = String(value);
    }
  }
  const sortedKeys = Object.keys(vnpParams).sort();
  const signDataParts = [];
  for (const key of sortedKeys) {
    const val = vnpParams[key];
    if (val !== void 0 && val !== null && val.length > 0) {
      signDataParts.push(
        `${key}=${encodeURIComponent(val).replace(/%20/g, "+")}`
      );
    }
  }
  const signData = signDataParts.join("&");
  const hmac = crypto.createHmac("sha512", VNPAY_CONFIG.hashSecret);
  const calculatedHash = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
  if (calculatedHash.toLowerCase() !== secureHash.toLowerCase()) {
    return {
      isValidChecksum: false,
      response: { RspCode: "97", Message: "Invalid Checksum" }
    };
  }
  const transactionCode = vnpParams["vnp_TxnRef"];
  const vnpAmount = Number(vnpParams["vnp_Amount"] || 0) / 100;
  const responseCode = vnpParams["vnp_ResponseCode"];
  const vnpTransactionNo = vnpParams["vnp_TransactionNo"];
  const txRows = await client.unsafe(
    `SELECT * FROM payment_transactions WHERE transaction_code = $1 LIMIT 1`,
    [transactionCode]
  );
  if (txRows.length === 0) {
    return {
      isValidChecksum: true,
      response: { RspCode: "01", Message: "Order Not Found" }
    };
  }
  const tx = txRows[0];
  if (Number(tx.amount) !== vnpAmount) {
    return {
      isValidChecksum: true,
      response: { RspCode: "04", Message: "Invalid Amount" }
    };
  }
  if (tx.status === "SUCCESS") {
    return {
      isValidChecksum: true,
      response: { RspCode: "02", Message: "Order already confirmed" }
    };
  }
  if (responseCode === "00") {
    await fulfillSuccessfulPayment({
      paymentTxId: tx.id,
      userId: tx.user_id,
      bookingId: tx.booking_id,
      walletId: tx.wallet_id,
      amount: vnpAmount,
      gateway: "VNPAY",
      transactionCode,
      gatewayRefId: vnpTransactionNo,
      rawResponse: query
    });
    return {
      isValidChecksum: true,
      success: true,
      response: { RspCode: "00", Message: "Confirm Success" }
    };
  } else {
    await client.unsafe(
      `
      UPDATE payment_transactions
      SET status = 'FAILED', gateway_ref_id = $1, raw_response = $2::jsonb, updated_at = NOW()
      WHERE id = $3::uuid
      `,
      [vnpTransactionNo, JSON.stringify(query), tx.id]
    );
    return {
      isValidChecksum: true,
      success: false,
      response: {
        RspCode: "00",
        Message: "Confirm Success (Recorded Failure)"
      }
    };
  }
}
async function processMomoIpn(body) {
  const {
    partnerCode,
    orderId,
    requestId,
    amount,
    orderInfo,
    orderType,
    transId,
    resultCode,
    message,
    payType,
    responseTime,
    extraData,
    signature
  } = body;
  if (!orderId || !signature) {
    return {
      isValidChecksum: false,
      response: { message: "Invalid MoMo Request Payload", status: 400 }
    };
  }
  const rawSignature = `accessKey=${MOMO_CONFIG.accessKey}&amount=${amount}&extraData=${extraData || ""}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
  const calculatedSignature = crypto.createHmac("sha256", MOMO_CONFIG.secretKey).update(rawSignature).digest("hex");
  if (calculatedSignature !== signature) {
    return {
      isValidChecksum: false,
      response: { message: "Bad Signature", status: 400 }
    };
  }
  const txRows = await client.unsafe(
    `SELECT * FROM payment_transactions WHERE transaction_code = $1 LIMIT 1`,
    [orderId]
  );
  if (txRows.length === 0) {
    return {
      isValidChecksum: true,
      response: { message: "Order Not Found", status: 404 }
    };
  }
  const tx = txRows[0];
  if (tx.status === "SUCCESS") {
    return {
      isValidChecksum: true,
      response: { message: "Order already confirmed", status: 200 }
    };
  }
  if (Number(resultCode) === 0) {
    await fulfillSuccessfulPayment({
      paymentTxId: tx.id,
      userId: tx.user_id,
      bookingId: tx.booking_id,
      walletId: tx.wallet_id,
      amount: Number(amount),
      gateway: "MOMO",
      transactionCode: orderId,
      gatewayRefId: String(transId),
      rawResponse: body
    });
    return {
      isValidChecksum: true,
      success: true,
      response: { message: "Success", status: 200 }
    };
  } else {
    await client.unsafe(
      `
      UPDATE payment_transactions
      SET status = 'FAILED', gateway_ref_id = $1, raw_response = $2::jsonb, updated_at = NOW()
      WHERE id = $3::uuid
      `,
      [String(transId), JSON.stringify(body), tx.id]
    );
    return {
      isValidChecksum: true,
      success: false,
      response: { message: "Payment Failed", status: 200 }
    };
  }
}
async function fulfillSuccessfulPayment(params) {
  const {
    paymentTxId,
    userId,
    bookingId,
    amount,
    gateway,
    transactionCode,
    gatewayRefId,
    rawResponse
  } = params;
  return await client.begin(async (sql6) => {
    await sql6`
      UPDATE payment_transactions
      SET 
        status = 'SUCCESS',
        gateway_ref_id = ${gatewayRefId},
        raw_response = ${JSON.stringify(rawResponse)}::jsonb,
        updated_at = NOW()
      WHERE id = ${paymentTxId}::uuid
    `;
    if (bookingId) {
      await sql6`
        UPDATE bookings
        SET 
          payment_method = ${gateway}::payment_method,
          payment_status = 'PAID'::payment_status,
          updated_at = NOW()
        WHERE id = ${bookingId}::uuid
      `;
    } else {
      await topUpWallet({
        userId,
        amount,
        description: `N\u1EA1p ${amount.toLocaleString("vi-VN")} \u0111 qua c\u1ED5ng ${gateway} (${transactionCode})`,
        referenceCode: gatewayRefId || transactionCode
      });
    }
  });
}
async function getPaymentStatus(transactionCode) {
  if (!transactionCode) {
    throw new ApiError(400, "Thi\u1EBFu m\xE3 giao d\u1ECBch transactionCode");
  }
  const rows = await client.unsafe(
    `
    SELECT 
      pt.id,
      pt.user_id,
      pt.booking_id,
      pt.wallet_id,
      pt.amount,
      pt.gateway,
      pt.transaction_code,
      pt.gateway_ref_id,
      pt.status,
      pt.payment_url,
      pt.description,
      pt.created_at,
      pt.updated_at,
      b.booking_code
    FROM payment_transactions pt
    LEFT JOIN bookings b ON b.id = pt.booking_id
    WHERE pt.transaction_code = $1
    LIMIT 1
    `,
    [transactionCode]
  );
  if (rows.length === 0) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y th\xF4ng tin giao d\u1ECBch thanh to\xE1n");
  }
  const r = rows[0];
  return {
    id: r.id,
    transactionCode: r.transaction_code,
    gateway: r.gateway,
    amount: Number(r.amount),
    status: r.status,
    isSuccess: r.status === "SUCCESS",
    gatewayRefId: r.gateway_ref_id,
    bookingCode: r.booking_code || null,
    bookingId: r.booking_id || null,
    description: r.description,
    paymentUrl: r.payment_url,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}
async function getUserPaymentHistory(userId, limit = 20) {
  const rows = await client.unsafe(
    `
    SELECT 
      pt.id,
      pt.amount,
      pt.gateway,
      pt.transaction_code,
      pt.gateway_ref_id,
      pt.status,
      pt.description,
      pt.created_at,
      b.booking_code
    FROM payment_transactions pt
    LEFT JOIN bookings b ON b.id = pt.booking_id
    WHERE pt.user_id = $1::uuid
    ORDER BY pt.created_at DESC
    LIMIT $2
    `,
    [userId, limit]
  );
  return rows.map((r) => ({
    id: r.id,
    transactionCode: r.transaction_code,
    gateway: r.gateway,
    amount: Number(r.amount),
    status: r.status,
    gatewayRefId: r.gateway_ref_id,
    bookingCode: r.booking_code || null,
    description: r.description,
    createdAt: r.created_at
  }));
}
async function confirmSimulatedPayment(transactionCode) {
  if (!transactionCode) {
    throw new ApiError(400, "Thi\u1EBFu m\xE3 giao d\u1ECBch transactionCode");
  }
  const txRows = await client.unsafe(
    `SELECT * FROM payment_transactions WHERE transaction_code = $1 LIMIT 1`,
    [transactionCode]
  );
  if (txRows.length === 0) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y giao d\u1ECBch thanh to\xE1n");
  }
  const tx = txRows[0];
  if (tx.status !== "SUCCESS") {
    await fulfillSuccessfulPayment({
      paymentTxId: tx.id,
      userId: tx.user_id,
      bookingId: tx.booking_id,
      walletId: tx.wallet_id,
      amount: Number(tx.amount),
      gateway: tx.gateway,
      transactionCode: tx.transaction_code,
      gatewayRefId: "SIMULATED_" + Date.now(),
      rawResponse: { simulated: true, completedAt: (/* @__PURE__ */ new Date()).toISOString() }
    });
  }
  return { success: true, message: "X\xE1c nh\u1EADn thanh to\xE1n th\xE0nh c\xF4ng!" };
}
async function reportPaymentTransferred(transactionCode) {
  if (!transactionCode) {
    throw new ApiError(400, "Thi\u1EBFu m\xE3 giao d\u1ECBch transactionCode");
  }
  const txRows = await client.unsafe(
    `SELECT * FROM payment_transactions WHERE transaction_code = $1 LIMIT 1`,
    [transactionCode]
  );
  if (txRows.length === 0) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y giao d\u1ECBch thanh to\xE1n");
  }
  const tx = txRows[0];
  if (tx.status === "PENDING" || !tx.status || tx.status === "WAITING_APPROVAL") {
    await client.unsafe(
      `UPDATE payment_transactions 
       SET status = 'WAITING_APPROVAL',
           description = COALESCE(description, '') || ' [T\xE0i x\u1EBF \u0111\xE3 chuy\u1EC3n kho\u1EA3n - Ch\u1EDD Admin \u0111\u1ED1i so\xE1t]',
           updated_at = NOW() 
       WHERE id = $1`,
      [tx.id]
    );
  }
  try {
    const { emitLocalRealtime } = await Promise.resolve().then(() => (init_pusher(), pusher_exports));
    emitLocalRealtime("admin-channel", "admin:new-topup-request", {
      transactionCode,
      amount: Number(tx.amount),
      userId: tx.user_id
    });
  } catch (e) {
  }
  return {
    success: true,
    message: "H\u1EC7 th\u1ED1ng \u0111\xE3 ghi nh\u1EADn th\xF4ng b\xE1o chuy\u1EC3n kho\u1EA3n. \u0110ang ch\u1EDD Admin x\xE1c minh.",
    data: {
      transactionCode,
      amount: Number(tx.amount),
      status: "WAITING_APPROVAL"
    }
  };
}
async function getPendingTopUpRequests(options = {}) {
  const statusFilter = options.status || "WAITING_APPROVAL";
  const whereClauses = ["pt.gateway = 'VIETQR'"];
  const params = [];
  if (statusFilter === "PENDING_ALL") {
    whereClauses.push("pt.status IN ('WAITING_APPROVAL', 'PENDING')");
  } else if (statusFilter !== "ALL") {
    params.push(statusFilter);
    whereClauses.push(`pt.status = $${params.length}`);
  }
  if (options.search?.trim()) {
    const s = `%${options.search.trim()}%`;
    params.push(s);
    whereClauses.push(`(u.full_name ILIKE $${params.length} OR u.phone ILIKE $${params.length} OR pt.transaction_code ILIKE $${params.length} OR dp.license_plate ILIKE $${params.length})`);
  }
  const whereStr = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";
  const rows = await client.unsafe(
    `
    SELECT 
      pt.id,
      pt.user_id,
      pt.wallet_id,
      pt.amount,
      pt.gateway,
      pt.transaction_code,
      pt.status,
      pt.description,
      pt.raw_response,
      pt.created_at,
      pt.updated_at,
      u.full_name as driver_name,
      u.phone as driver_phone,
      u.avatar_url as driver_avatar,
      dp.id as driver_id,
      dp.license_plate,
      w.balance as current_balance,
      w.available_balance
    FROM payment_transactions pt
    JOIN users u ON u.id = pt.user_id
    LEFT JOIN driver_profiles dp ON dp.user_id = u.id
    LEFT JOIN wallets w ON w.user_id = u.id
    ${whereStr}
    ORDER BY pt.created_at DESC
    LIMIT 100
    `,
    params
  );
  const countRows = await client.unsafe(
    `SELECT COUNT(*) as count FROM payment_transactions WHERE gateway = 'VIETQR' AND status IN ('WAITING_APPROVAL', 'PENDING')`
  );
  const pendingCount = Number(countRows[0]?.count || 0);
  return {
    requests: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      driverId: r.driver_id,
      driverName: r.driver_name || `T\xE0i x\u1EBF (${r.driver_phone})`,
      driverPhone: r.driver_phone,
      driverAvatar: r.driver_avatar,
      licensePlate: r.license_plate,
      amount: Number(r.amount),
      gateway: r.gateway,
      transactionCode: r.transaction_code,
      status: r.status,
      description: r.description,
      rawResponse: r.raw_response,
      currentBalance: Number(r.current_balance || 0),
      availableBalance: Number(r.available_balance || 0),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    })),
    pendingCount
  };
}
async function adminApproveTopUpRequest(txId, adminUserId) {
  const rows = await client.unsafe(
    `SELECT * FROM payment_transactions WHERE id = $1::uuid LIMIT 1`,
    [txId]
  );
  if (rows.length === 0) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y giao d\u1ECBch n\u1EA1p ti\u1EC1n");
  }
  const tx = rows[0];
  if (tx.status === "SUCCESS") {
    throw new ApiError(400, "Giao d\u1ECBch n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c duy\u1EC7t th\xE0nh c\xF4ng tr\u01B0\u1EDBc \u0111\xF3");
  }
  await completePayment({
    paymentTxId: tx.id,
    bookingId: tx.booking_id,
    userId: tx.user_id,
    amount: Number(tx.amount),
    gateway: tx.gateway,
    transactionCode: tx.transaction_code,
    gatewayRefId: `ADMIN_APPROVED_${Date.now()}`,
    rawResponse: {
      approvedBy: adminUserId,
      approvedAt: (/* @__PURE__ */ new Date()).toISOString(),
      method: "ADMIN_MANUAL_VERIFIED"
    }
  });
  try {
    const { emitLocalRealtime } = await Promise.resolve().then(() => (init_pusher(), pusher_exports));
    emitLocalRealtime(`private-driver-${tx.user_id}`, "wallet:topup-approved", {
      transactionCode: tx.transaction_code,
      amount: Number(tx.amount),
      message: `Admin \u0111\xE3 x\xE1c nh\u1EADn chuy\u1EC3n kho\u1EA3n: +${Number(tx.amount).toLocaleString("vi-VN")} \u0111 v\xE0o v\xED k\xFD qu\u1EF9.`
    });
  } catch (e) {
    console.warn("Kh\xF4ng th\u1EC3 ph\xE1t s\u1EF1 ki\u1EC7n realtime duy\u1EC7t n\u1EA1p ti\u1EC1n:", e);
  }
  return {
    success: true,
    message: `\u0110\xE3 duy\u1EC7t th\xE0nh c\xF4ng n\u1EA1p ${Number(tx.amount).toLocaleString("vi-VN")} \u0111 v\xE0o v\xED t\xE0i x\u1EBF`,
    amount: Number(tx.amount),
    transactionCode: tx.transaction_code
  };
}
async function adminRejectTopUpRequest(txId, adminUserId, reason) {
  const rows = await client.unsafe(
    `SELECT * FROM payment_transactions WHERE id = $1::uuid LIMIT 1`,
    [txId]
  );
  if (rows.length === 0) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y giao d\u1ECBch n\u1EA1p ti\u1EC1n");
  }
  const tx = rows[0];
  if (tx.status === "SUCCESS") {
    throw new ApiError(400, "Kh\xF4ng th\u1EC3 t\u1EEB ch\u1ED1i giao d\u1ECBch \u0111\xE3 duy\u1EC7t th\xE0nh c\xF4ng");
  }
  const rejectReason = reason?.trim() || "Ch\u01B0a nh\u1EADn \u0111\u01B0\u1EE3c ti\u1EC1n v\xE0o t\xE0i kho\u1EA3n ng\xE2n h\xE0ng ho\u1EB7c sai n\u1ED9i dung chuy\u1EC3n kho\u1EA3n";
  await client.unsafe(
    `UPDATE payment_transactions 
     SET status = 'FAILED',
         description = COALESCE(description, '') || ' [Admin t\u1EEB ch\u1ED1i: ' || $1 || ']',
         raw_response = $2::jsonb,
         updated_at = NOW()
     WHERE id = $3::uuid`,
    [
      rejectReason,
      JSON.stringify({ rejectedBy: adminUserId, rejectedAt: (/* @__PURE__ */ new Date()).toISOString(), reason: rejectReason }),
      tx.id
    ]
  );
  try {
    const { emitLocalRealtime } = await Promise.resolve().then(() => (init_pusher(), pusher_exports));
    emitLocalRealtime(`private-driver-${tx.user_id}`, "wallet:topup-rejected", {
      transactionCode: tx.transaction_code,
      reason: rejectReason,
      message: `Y\xEAu c\u1EA7u n\u1EA1p ti\u1EC1n b\u1ECB t\u1EEB ch\u1ED1i: ${rejectReason}`
    });
  } catch (e) {
  }
  return {
    success: true,
    message: "\u0110\xE3 t\u1EEB ch\u1ED1i y\xEAu c\u1EA7u n\u1EA1p ti\u1EC1n",
    reason: rejectReason,
    transactionCode: tx.transaction_code
  };
}

// src/lib/cronJobs.ts
import cron from "node-cron";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
init_pusher();
var execAsync = promisify(exec);
var systemStatus = {
  isRunning: false,
  jobs: {
    blockLowRating: {
      cronSchedule: "0 3 * * *",
      // 03:00 sáng hàng ngày
      lastRunAt: null,
      lastRunStatus: "IDLE",
      lastProcessedCount: 0
    },
    databaseBackup: {
      cronSchedule: "0 2 * * *",
      // 02:00 sáng hàng ngày
      lastRunAt: null,
      lastRunStatus: "IDLE",
      lastBackupFile: null
    }
  },
  backupFiles: []
};
async function autoBlockLowRatingDrivers(minTrips = 5, ratingThreshold = 4) {
  console.log(
    `\u23F3 [CronJob] B\u1EAFt \u0111\u1EA7u qu\xE9t t\xE0i x\u1EBF \u0111i\u1EC3m th\u1EA5p (< ${ratingThreshold} sao, t\u1ED1i thi\u1EC3u ${minTrips} cu\u1ED1c)...`
  );
  systemStatus.jobs.blockLowRating.lastRunAt = (/* @__PURE__ */ new Date()).toISOString();
  systemStatus.jobs.blockLowRating.lastRunStatus = "RUNNING";
  try {
    const candidates = await client`
      SELECT
        dp.id AS driver_id,
        dp.user_id,
        u.full_name AS driver_name,
        u.phone,
        dp.license_plate,
        dp.rating_avg::float AS rating_avg,
        COUNT(b.id)::int AS completed_trips
      FROM driver_profiles dp
      JOIN users u ON dp.user_id = u.id
      LEFT JOIN bookings b ON b.driver_id = dp.id AND b.status = 'COMPLETED'
      WHERE dp.is_active = true
        AND dp.rating_avg IS NOT NULL
        AND dp.rating_avg > 0
        AND dp.rating_avg < ${ratingThreshold}
      GROUP BY dp.id, dp.user_id, u.full_name, u.phone, dp.license_plate, dp.rating_avg
      HAVING COUNT(b.id) >= ${minTrips}
    `;
    const blockedDrivers = [];
    for (const d of candidates) {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const reason = `T\xE0i kho\u1EA3n t\u1EA1m kh\xF3a t\u1EF1 \u0111\u1ED9ng: \u0110i\u1EC3m \u0111\xE1nh gi\xE1 trung b\xECnh ${d.rating_avg} sao d\u01B0\u1EDBi chu\u1EA9n t\u1ED1i thi\u1EC3u (${ratingThreshold} sao)`;
      await client`
        UPDATE driver_profiles
        SET 
          is_active = false,
          is_online = false,
          rejection_reason = ${reason},
          updated_at = NOW()
        WHERE id = ${d.driver_id}::uuid
      `;
      await client`
        UPDATE users
        SET 
          status = 'BLOCKED',
          updated_at = NOW()
        WHERE id = ${d.user_id}::uuid
      `;
      await sendPushNotificationToUser(d.user_id, {
        title: "\u26A0\uFE0F T\xE0i kho\u1EA3n t\xE0i x\u1EBF b\u1ECB t\u1EA1m kh\xF3a",
        body: `\u0110i\u1EC3m \u0111\xE1nh gi\xE1 trung b\xECnh c\u1EE7a b\u1EA1n l\xE0 ${d.rating_avg} sao (d\u01B0\u1EDBi ng\u01B0\u1EE1ng ${ratingThreshold} sao). T\xE0i kho\u1EA3n \u0111\xE3 t\u1EA1m th\u1EDDi b\u1ECB kh\xF3a. Vui l\xF2ng li\xEAn h\u1EC7 t\u1ED5ng \u0111\xE0i \u0111\u1EC3 \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3 \u0111\xE0o t\u1EA1o l\u1EA1i.`,
        data: {
          type: "ACCOUNT_BLOCKED",
          ratingAvg: String(d.rating_avg),
          reason
        }
      });
      await triggerEvent("private-admin", "driver:auto-blocked", {
        driverId: d.driver_id,
        userId: d.user_id,
        driverName: d.driver_name,
        phone: d.phone,
        licensePlate: d.license_plate,
        ratingAvg: d.rating_avg,
        completedTrips: d.completed_trips,
        blockedAt: now
      });
      blockedDrivers.push({
        driverId: d.driver_id,
        userId: d.user_id,
        driverName: d.driver_name,
        phone: d.phone,
        licensePlate: d.license_plate,
        ratingAvg: d.rating_avg,
        completedTrips: d.completed_trips,
        blockedAt: now
      });
    }
    systemStatus.jobs.blockLowRating.lastRunStatus = "SUCCESS";
    systemStatus.jobs.blockLowRating.lastProcessedCount = blockedDrivers.length;
    console.log(
      `\u2705 [CronJob] Ho\xE0n t\u1EA5t qu\xE9t t\xE0i x\u1EBF: \u0110\xE3 kh\xF3a ${blockedDrivers.length} t\xE0i x\u1EBF vi ph\u1EA1m \u0111i\u1EC3m s\u1ED1.`
    );
    return {
      processedCount: blockedDrivers.length,
      blockedDrivers
    };
  } catch (err) {
    systemStatus.jobs.blockLowRating.lastRunStatus = `FAILED: ${err.message}`;
    console.error("\u274C [CronJob] L\u1ED7i qu\xE9t t\xE0i x\u1EBF \u0111i\u1EC3m th\u1EA5p:", err);
    throw err;
  }
}
async function autoBackupDatabase(customDir, keepDays = 7) {
  console.log("\u23F3 [CronJob] B\u1EAFt \u0111\u1EA7u quy tr\xECnh sao l\u01B0u Database t\u1EF1 \u0111\u1ED9ng...");
  systemStatus.jobs.databaseBackup.lastRunAt = (/* @__PURE__ */ new Date()).toISOString();
  systemStatus.jobs.databaseBackup.lastRunStatus = "RUNNING";
  const backupDir = customDir || path.resolve(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const timestamp2 = (/* @__PURE__ */ new Date()).toISOString().replace(/T/, "_").replace(/:/g, "-").split(".")[0];
  const dbUrl = process.env.DATABASE_URL;
  let backupFile = "";
  let fileSizeBytes = 0;
  let backupMethod = "pg_dump";
  try {
    let pgDumpSuccess = false;
    if (dbUrl) {
      backupFile = path.join(backupDir, `backup_pg_${timestamp2}.sql`);
      try {
        await execAsync(
          `pg_dump "${dbUrl}" --clean --if-exists -f "${backupFile}"`,
          {
            timeout: 6e4
          }
        );
        if (fs.existsSync(backupFile)) {
          const stats = fs.statSync(backupFile);
          if (stats.size > 0) {
            fileSizeBytes = stats.size;
            pgDumpSuccess = true;
            backupMethod = "pg_dump";
          }
        }
      } catch (dumpErr) {
        console.warn(
          "\u26A0\uFE0F [CronJob pg_dump] Kh\xF4ng th\u1EC3 ch\u1EA1y pg_dump tr\u1EF1c ti\u1EBFp:",
          dumpErr.message,
          "-> Chuy\u1EC3n sang sao l\u01B0u snapshot JSON t\u1EF1 \u0111\u1ED9ng."
        );
      }
    }
    if (!pgDumpSuccess) {
      backupMethod = "json_snapshot";
      backupFile = path.join(backupDir, `backup_snapshot_${timestamp2}.json`);
      console.log(
        "\u{1F4E6} [CronJob] \u0110ang tr\xEDch xu\u1EA5t snapshot d\u1EEF li\u1EC7u qua k\u1EBFt n\u1ED1i Client..."
      );
      const [
        usersData,
        driversData,
        vehicleData,
        pricingData,
        bookingsData,
        walletsData,
        walletTxData,
        paymentTxData,
        messagesData,
        callsData
      ] = await Promise.all([
        client`SELECT * FROM users ORDER BY created_at DESC LIMIT 5000`,
        client`SELECT * FROM driver_profiles ORDER BY created_at DESC LIMIT 5000`,
        client`SELECT * FROM vehicle_types`,
        client`SELECT * FROM pricing_rules`,
        client`SELECT * FROM bookings ORDER BY created_at DESC LIMIT 5000`,
        client`SELECT * FROM wallets`,
        client`SELECT * FROM wallet_transactions ORDER BY created_at DESC LIMIT 10000`,
        client`SELECT * FROM payment_transactions ORDER BY created_at DESC LIMIT 5000`,
        client`SELECT * FROM booking_messages ORDER BY created_at DESC LIMIT 10000`,
        client`SELECT * FROM call_logs ORDER BY created_at DESC LIMIT 5000`
      ]);
      const snapshot = {
        metadata: {
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          version: "1.0",
          type: "APP_DAT_XE_TAI_FULL_SNAPSHOT"
        },
        counts: {
          users: usersData.length,
          drivers: driversData.length,
          vehicleTypes: vehicleData.length,
          pricingRules: pricingData.length,
          bookings: bookingsData.length,
          wallets: walletsData.length,
          walletTransactions: walletTxData.length,
          paymentTransactions: paymentTxData.length,
          messages: messagesData.length,
          callLogs: callsData.length
        },
        tables: {
          users: usersData,
          driverProfiles: driversData,
          vehicleTypes: vehicleData,
          pricingRules: pricingData,
          bookings: bookingsData,
          wallets: walletsData,
          walletTransactions: walletTxData,
          paymentTransactions: paymentTxData,
          bookingMessages: messagesData,
          callLogs: callsData
        }
      };
      fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 2), "utf-8");
      const stats = fs.statSync(backupFile);
      fileSizeBytes = stats.size;
    }
    let cleanedCount = 0;
    const now = Date.now();
    const maxAgeMs = keepDays * 24 * 60 * 60 * 1e3;
    const existingFiles = fs.readdirSync(backupDir);
    for (const f of existingFiles) {
      if (f.startsWith("backup_")) {
        const fullPath = path.join(backupDir, f);
        const fileStat = fs.statSync(fullPath);
        if (now - fileStat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(fullPath);
          cleanedCount++;
          console.log(`\u{1F9F9} [CronJob] \u0110\xE3 x\xF3a b\u1EA3n backup c\u0169 qu\xE1 h\u1EA1n: ${f}`);
        }
      }
    }
    const logEntry = `[${(/* @__PURE__ */ new Date()).toISOString()}] BACKUP SUCCESS: ${path.basename(backupFile)} (${fileSizeBytes} bytes, method: ${backupMethod}, cleaned: ${cleanedCount} files)
`;
    fs.appendFileSync(path.join(backupDir, "backup_history.log"), logEntry);
    systemStatus.jobs.databaseBackup.lastRunStatus = "SUCCESS";
    systemStatus.jobs.databaseBackup.lastBackupFile = path.basename(backupFile);
    console.log(
      `\u2705 [CronJob] Sao l\u01B0u Database th\xE0nh c\xF4ng: ${path.basename(backupFile)} (${fileSizeBytes} bytes)`
    );
    return {
      success: true,
      filename: path.basename(backupFile),
      filepath: backupFile,
      fileSizeBytes,
      method: backupMethod,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      cleanedOldFilesCount: cleanedCount
    };
  } catch (err) {
    systemStatus.jobs.databaseBackup.lastRunStatus = `FAILED: ${err.message}`;
    console.error("\u274C [CronJob] L\u1ED7i sao l\u01B0u Database:", err);
    throw err;
  }
}
function getCronSystemStatus() {
  const backupDir = path.resolve(process.cwd(), "backups");
  const backupFiles = [];
  if (fs.existsSync(backupDir)) {
    const files = fs.readdirSync(backupDir);
    for (const f of files) {
      if (f.startsWith("backup_")) {
        const fullPath = path.join(backupDir, f);
        const stats = fs.statSync(fullPath);
        backupFiles.push({
          filename: f,
          sizeBytes: stats.size,
          createdAt: stats.birthtime.toISOString()
        });
      }
    }
  }
  backupFiles.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return {
    ...systemStatus,
    backupFiles
  };
}

// src/api/routes/pricing_admin.ts
import { Router as Router4 } from "express";

// src/lib/pricingService.ts
import { eq as eq7, or as or3 } from "drizzle-orm";
var MOCK_PRICING_RULES = [
  {
    id: "p-500kg",
    vehicleTypeId: "v-500kg",
    basePrice: "150000",
    baseDistanceKm: "4.0",
    pricePerKm: "15000",
    createdAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date(),
    vehicleCode: "500KG",
    vehicleName: "Xe Van 500kg",
    payloadCapacityKg: "500",
    dimensionsLxwxh: "1.7m x 1.2m x 1.2m"
  },
  {
    id: "p-1ton",
    vehicleTypeId: "v-1ton",
    basePrice: "200000",
    baseDistanceKm: "4.0",
    pricePerKm: "17000",
    createdAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date(),
    vehicleCode: "1TON",
    vehicleName: "Xe t\u1EA3i 1 t\u1EA5n",
    payloadCapacityKg: "1000",
    dimensionsLxwxh: "3.0m x 1.6m x 1.7m"
  },
  {
    id: "p-2ton-thungkin",
    vehicleTypeId: "v-2ton-thungkin",
    basePrice: "280000",
    baseDistanceKm: "4.0",
    pricePerKm: "21000",
    createdAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date(),
    vehicleCode: "2TON_THUNGKIN",
    vehicleName: "Xe t\u1EA3i 2 t\u1EA5n (Th\xF9ng k\xEDn)",
    payloadCapacityKg: "2000",
    dimensionsLxwxh: "4.3m x 1.8m x 1.8m"
  },
  {
    id: "p-2ton-muibat",
    vehicleTypeId: "v-2ton-muibat",
    basePrice: "280000",
    baseDistanceKm: "4.0",
    pricePerKm: "21000",
    createdAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date(),
    vehicleCode: "2TON_MUIBAT",
    vehicleName: "Xe t\u1EA3i 2 t\u1EA5n (Mui b\u1EA1t)",
    payloadCapacityKg: "2000",
    dimensionsLxwxh: "4.3m x 1.8m x 1.9m"
  },
  {
    id: "p-5ton",
    vehicleTypeId: "v-5ton",
    basePrice: "450000",
    baseDistanceKm: "4.0",
    pricePerKm: "28000",
    createdAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date(),
    vehicleCode: "5TON",
    vehicleName: "Xe t\u1EA3i 5 t\u1EA5n",
    payloadCapacityKg: "5000",
    dimensionsLxwxh: "6.0m x 2.2m x 2.2m"
  }
];
var MOCK_SURCHARGE_SERVICES = [
  {
    id: "s-loading-floor",
    code: "LOADING_FLOOR",
    name: "B\u1ED1c x\u1EBFp t\u1EA7ng tr\u1EC7t",
    description: "T\xE0i x\u1EBF h\u1ED7 tr\u1EE3 b\u1ED1c x\u1EBFp h\xE0ng h\xF3a l\xEAn/xu\u1ED1ng xe t\u1EA1i t\u1EA7ng tr\u1EC7t (b\xE1n k\xEDnh d\u01B0\u1EDBi 10m)",
    price: "50000",
    isActive: true,
    createdAt: /* @__PURE__ */ new Date()
  },
  {
    id: "s-loading-stairs",
    code: "LOADING_STAIRS",
    name: "B\u1ED1c x\u1EBFp l\u1EA7u / thang b\u1ED9",
    description: "Khu\xE2n v\xE1c h\xE0ng h\xF3a l\xEAn/xu\u1ED1ng c\u1EA7u thang b\u1ED9 (kh\xF4ng c\xF3 thang m\xE1y)",
    price: "100000",
    isActive: true,
    createdAt: /* @__PURE__ */ new Date()
  },
  {
    id: "s-extra-helper",
    code: "EXTRA_HELPER",
    name: "Th\xEAm 1 ng\u01B0\u1EDDi b\u1ED1c x\u1EBFp theo xe",
    description: "B\u1ED1 tr\xED th\xEAm 1 ph\u1EE5 xe \u0111i c\xF9ng h\u1ED7 tr\u1EE3 b\u1ED1c x\u1EBFp c\xE1c ki\u1EC7n h\xE0ng c\u1ED3ng k\u1EC1nh",
    price: "200000",
    isActive: true,
    createdAt: /* @__PURE__ */ new Date()
  },
  {
    id: "s-night-surcharge",
    code: "NIGHT_SURCHARGE",
    name: "Ph\u1EE5 ph\xED ban \u0111\xEAm (22:00 - 06:00)",
    description: "Ph\u1EE5 thu ch\u1EA1y xe v\xE0 giao h\xE0ng khung gi\u1EDD \u0111\xEAm",
    price: "20000",
    isActive: true,
    createdAt: /* @__PURE__ */ new Date()
  },
  {
    id: "s-extra-stop",
    code: "EXTRA_STOP",
    name: "Th\xEAm \u0111i\u1EC3m giao h\xE0ng ph\u1EE5",
    description: "D\u1EEBng th\xEAm 1 \u0111i\u1EC3m tr\xEAn c\xF9ng tuy\u1EBFn \u0111\u01B0\u1EDDng (b\xE1n k\xEDnh l\u1EC7ch d\u01B0\u1EDBi 5km)",
    price: "35000",
    isActive: true,
    createdAt: /* @__PURE__ */ new Date()
  }
];
async function getPricingRules() {
  try {
    const list = await db.select({
      id: pricingRules.id,
      vehicleTypeId: pricingRules.vehicleTypeId,
      basePrice: pricingRules.basePrice,
      baseDistanceKm: pricingRules.baseDistanceKm,
      pricePerKm: pricingRules.pricePerKm,
      createdAt: pricingRules.createdAt,
      updatedAt: pricingRules.updatedAt,
      vehicleCode: vehicleTypes.code,
      vehicleName: vehicleTypes.name,
      payloadCapacityKg: vehicleTypes.payloadCapacityKg,
      dimensionsLxwxh: vehicleTypes.dimensionsLxwxh
    }).from(pricingRules).innerJoin(vehicleTypes, eq7(pricingRules.vehicleTypeId, vehicleTypes.id)).where(eq7(vehicleTypes.isActive, true));
    if (list.length === 0) {
      console.warn("[pricingService] Kh\xF4ng t\xECm th\u1EA5y quy t\u1EAFc gi\xE1 n\xE0o trong Database");
      return [];
    }
    return list;
  } catch (err) {
    console.warn(
      "[pricingService] L\u1ED7i k\u1EBFt n\u1ED1i Database khi l\u1EA5y b\u1EA3ng gi\xE1 c\u01B0\u1EDBc:",
      err?.message
    );
    return [];
  }
}
async function getSurchargeServices() {
  try {
    const list = await db.select().from(surchargeServices).where(eq7(surchargeServices.isActive, true));
    if (list.length === 0) {
      console.warn("[pricingService] Kh\xF4ng t\xECm th\u1EA5y ph\u1EE5 ph\xED n\xE0o trong Database");
      return [];
    }
    return list;
  } catch (err) {
    console.warn(
      "[pricingService] L\u1ED7i k\u1EBFt n\u1ED1i Database khi l\u1EA5y danh m\u1EE5c ph\u1EE5 ph\xED:",
      err?.message
    );
    return [];
  }
}
async function updatePricingRule(vehicleTypeId, data) {
  if (!vehicleTypeId) {
    throw new ApiError(400, "Thi\u1EBFu m\xE3 lo\u1EA1i xe (vehicleTypeId)");
  }
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vehicleTypeId);
  try {
    let existing = [];
    if (isUuid) {
      existing = await db.select().from(pricingRules).where(
        or3(
          eq7(pricingRules.vehicleTypeId, vehicleTypeId),
          eq7(pricingRules.id, vehicleTypeId)
        )
      ).limit(1);
    } else {
      const vtypes = await db.select().from(vehicleTypes).where(
        or3(
          eq7(vehicleTypes.code, vehicleTypeId),
          eq7(vehicleTypes.code, vehicleTypeId.toUpperCase())
        )
      ).limit(1);
      if (vtypes.length > 0) {
        existing = await db.select().from(pricingRules).where(eq7(pricingRules.vehicleTypeId, vtypes[0].id)).limit(1);
      }
    }
    if (existing.length === 0) {
      const mockIdx = MOCK_PRICING_RULES.findIndex(
        (r) => r.vehicleTypeId === vehicleTypeId || r.id === vehicleTypeId || r.vehicleCode?.toLowerCase() === vehicleTypeId.toLowerCase()
      );
      if (mockIdx !== -1) {
        if (data.basePrice !== void 0) MOCK_PRICING_RULES[mockIdx].basePrice = String(data.basePrice);
        if (data.baseDistanceKm !== void 0) MOCK_PRICING_RULES[mockIdx].baseDistanceKm = String(data.baseDistanceKm);
        if (data.pricePerKm !== void 0) MOCK_PRICING_RULES[mockIdx].pricePerKm = String(data.pricePerKm);
        return MOCK_PRICING_RULES[mockIdx];
      }
      throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y b\u1EA3ng gi\xE1 c\u1EE7a lo\u1EA1i xe n\xE0y");
    }
    const updateFields = {
      updatedAt: /* @__PURE__ */ new Date()
    };
    if (data.basePrice !== void 0) {
      if (data.basePrice < 0)
        throw new ApiError(400, "Gi\xE1 m\u1EDF c\u1EEDa kh\xF4ng \u0111\u01B0\u1EE3c \xE2m");
      updateFields.basePrice = String(data.basePrice);
    }
    if (data.baseDistanceKm !== void 0) {
      if (data.baseDistanceKm <= 0)
        throw new ApiError(400, "C\u1EF1 ly m\u1EDF c\u1EEDa ph\u1EA3i l\u1EDBn h\u01A1n 0");
      updateFields.baseDistanceKm = String(data.baseDistanceKm);
    }
    if (data.pricePerKm !== void 0) {
      if (data.pricePerKm < 0)
        throw new ApiError(400, "Gi\xE1 m\u1ED7i km kh\xF4ng \u0111\u01B0\u1EE3c \xE2m");
      updateFields.pricePerKm = String(data.pricePerKm);
    }
    const updated = await db.update(pricingRules).set(updateFields).where(eq7(pricingRules.id, existing[0].id)).returning();
    return updated[0];
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const found = MOCK_PRICING_RULES.find(
      (r) => r.vehicleTypeId === vehicleTypeId || r.id === vehicleTypeId || r.vehicleCode?.toLowerCase() === vehicleTypeId.toLowerCase()
    );
    if (found) {
      if (data.basePrice !== void 0) found.basePrice = String(data.basePrice);
      if (data.baseDistanceKm !== void 0)
        found.baseDistanceKm = String(data.baseDistanceKm);
      if (data.pricePerKm !== void 0)
        found.pricePerKm = String(data.pricePerKm);
      return found;
    }
    throw new ApiError(
      500,
      "C\u1EADp nh\u1EADt b\u1EA3ng gi\xE1 th\u1EA5t b\u1EA1i. Vui l\xF2ng ki\u1EC3m tra k\u1EBFt n\u1ED1i Database."
    );
  }
}
function nameToCode(name) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toUpperCase().replace(/[^A-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
}
async function createPricingRule(data) {
  const basePrice = Number(data.basePrice);
  if (isNaN(basePrice) || basePrice < 0) {
    throw new ApiError(400, "Gi\xE1 m\u1EDF c\u1EEDa kh\xF4ng h\u1EE3p l\u1EC7");
  }
  const pricePerKm = Number(data.pricePerKm);
  if (isNaN(pricePerKm) || pricePerKm < 0) {
    throw new ApiError(400, "\u0110\u01A1n gi\xE1 m\u1ED7i km kh\xF4ng h\u1EE3p l\u1EC7");
  }
  const baseDistanceKm = Number(data.baseDistanceKm ?? 4);
  let targetVehicleTypeId = "";
  try {
    if (data.vehicleTypeId && data.vehicleTypeId.trim()) {
      const rawId = data.vehicleTypeId.trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);
      if (isUuid) {
        const vtype = await db.select().from(vehicleTypes).where(eq7(vehicleTypes.id, rawId)).limit(1);
        if (vtype.length > 0) {
          targetVehicleTypeId = vtype[0].id;
        }
      } else {
        const vtype = await db.select().from(vehicleTypes).where(
          or3(
            eq7(vehicleTypes.code, rawId),
            eq7(vehicleTypes.code, rawId.toUpperCase())
          )
        ).limit(1);
        if (vtype.length > 0) {
          targetVehicleTypeId = vtype[0].id;
        }
      }
    }
    if (!targetVehicleTypeId) {
      const vName = (data.vehicleName || data.vehicleCode || data.vehicleTypeId || "Xe t\u1EA3i m\u1EDBi").trim();
      const vCode = (data.vehicleCode || nameToCode(vName) || `TRUCK_${Date.now()}`).trim().toUpperCase();
      const existing = await db.select().from(vehicleTypes).where(eq7(vehicleTypes.code, vCode)).limit(1);
      if (existing.length > 0) {
        targetVehicleTypeId = existing[0].id;
        if (data.vehicleName) {
          await db.update(vehicleTypes).set({
            name: data.vehicleName,
            payloadCapacityKg: String(data.payloadCapacityKg || existing[0].payloadCapacityKg),
            dimensionsLxwxh: data.dimensionsLxwxh || existing[0].dimensionsLxwxh,
            isActive: true
          }).where(eq7(vehicleTypes.id, targetVehicleTypeId));
        }
      } else {
        let dim = data.dimensionsLxwxh;
        if (typeof dim === "string" && dim.trim()) {
          const parts = dim.split(/x|\*/i).map((s) => parseFloat(s.replace(/[^0-9.]/g, "")));
          if (parts.length >= 3 && !parts.some(isNaN)) {
            dim = { length: parts[0], width: parts[1], height: parts[2] };
          } else {
            dim = { length: 4.3, width: 1.8, height: 1.8 };
          }
        } else if (!dim || typeof dim !== "object") {
          dim = { length: 4.3, width: 1.8, height: 1.8 };
        }
        const [newV] = await db.insert(vehicleTypes).values({
          code: vCode,
          name: vName,
          payloadCapacityKg: String(data.payloadCapacityKg || 2e3),
          dimensionsLxwxh: dim,
          description: data.description || `Lo\u1EA1i xe v\u1EADn chuy\u1EC3n ${vName}`,
          isActive: true
        }).returning();
        targetVehicleTypeId = newV.id;
      }
    }
    const inserted = await db.insert(pricingRules).values({
      vehicleTypeId: targetVehicleTypeId,
      basePrice: String(basePrice),
      baseDistanceKm: String(baseDistanceKm),
      pricePerKm: String(pricePerKm)
    }).onConflictDoUpdate({
      target: pricingRules.vehicleTypeId,
      set: {
        basePrice: String(basePrice),
        baseDistanceKm: String(baseDistanceKm),
        pricePerKm: String(pricePerKm),
        updatedAt: /* @__PURE__ */ new Date()
      }
    }).returning();
    const fullRule = await db.select({
      id: pricingRules.id,
      vehicleTypeId: pricingRules.vehicleTypeId,
      basePrice: pricingRules.basePrice,
      baseDistanceKm: pricingRules.baseDistanceKm,
      pricePerKm: pricingRules.pricePerKm,
      createdAt: pricingRules.createdAt,
      updatedAt: pricingRules.updatedAt,
      vehicleCode: vehicleTypes.code,
      vehicleName: vehicleTypes.name,
      payloadCapacityKg: vehicleTypes.payloadCapacityKg,
      dimensionsLxwxh: vehicleTypes.dimensionsLxwxh
    }).from(pricingRules).innerJoin(vehicleTypes, eq7(pricingRules.vehicleTypeId, vehicleTypes.id)).where(eq7(pricingRules.id, inserted[0].id)).limit(1);
    return fullRule[0] || inserted[0];
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error("[createPricingRule] Error:", err);
    throw new ApiError(500, `L\u1ED7i t\u1EA1o b\u1EA3ng gi\xE1: ${err?.message || "L\u1ED7i CSDL"}`);
  }
}
async function createSurchargeService(data) {
  if (!data.code || !data.name || data.price === void 0) {
    throw new ApiError(
      400,
      "Thi\u1EBFu th\xF4ng tin ph\u1EE5 ph\xED b\u1EAFt bu\u1ED9c (code, name, price)"
    );
  }
  const cleanCode = data.code.trim().toUpperCase();
  try {
    const inserted = await db.insert(surchargeServices).values({
      code: cleanCode,
      name: data.name.trim(),
      price: String(data.price),
      description: data.description?.trim() || null,
      isActive: true
    }).returning();
    return inserted[0];
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const newItem = {
      id: `s-${Date.now()}`,
      code: cleanCode,
      name: data.name.trim(),
      price: String(data.price),
      description: data.description?.trim() || null,
      isActive: true,
      createdAt: /* @__PURE__ */ new Date()
    };
    MOCK_SURCHARGE_SERVICES.push(newItem);
    return newItem;
  }
}
async function updateSurchargeService(code, data) {
  if (!code) throw new ApiError(400, "Thi\u1EBFu m\xE3 ph\u1EE5 ph\xED (code)");
  const cleanCode = code.trim().toUpperCase();
  const updateFields = {};
  if (data.name !== void 0) updateFields.name = data.name.trim();
  if (data.price !== void 0) updateFields.price = String(data.price);
  if (data.description !== void 0)
    updateFields.description = data.description.trim();
  if (data.isActive !== void 0) updateFields.isActive = data.isActive;
  if (Object.keys(updateFields).length === 0) {
    throw new ApiError(
      400,
      "Vui l\xF2ng cung c\u1EA5p \xEDt nh\u1EA5t m\u1ED9t tr\u01B0\u1EDDng d\u1EEF li\u1EC7u c\u1EA7n c\u1EADp nh\u1EADt (name, price, description ho\u1EB7c isActive)"
    );
  }
  try {
    const updated = await db.update(surchargeServices).set(updateFields).where(eq7(surchargeServices.code, cleanCode)).returning();
    if (updated.length === 0) {
      throw new ApiError(404, `Kh\xF4ng t\xECm th\u1EA5y ph\u1EE5 ph\xED v\u1EDBi m\xE3 "${cleanCode}"`);
    }
    return updated[0];
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const found = MOCK_SURCHARGE_SERVICES.find((s) => s.code === cleanCode);
    if (found) {
      if (data.name !== void 0) found.name = data.name.trim();
      if (data.price !== void 0) found.price = String(data.price);
      if (data.description !== void 0)
        found.description = data.description.trim();
      if (data.isActive !== void 0) found.isActive = data.isActive;
      return found;
    }
    throw new ApiError(500, "C\u1EADp nh\u1EADt ph\u1EE5 ph\xED th\u1EA5t b\u1EA1i.");
  }
}
async function estimateBookingPrice(input) {
  const {
    vehicleTypeId,
    originLat,
    originLng,
    destLat,
    destLng,
    services = []
  } = input;
  if (!vehicleTypeId) {
    throw new ApiError(400, "Vui l\xF2ng ch\u1ECDn lo\u1EA1i xe t\u1EA3i (vehicleTypeId)");
  }
  let rule = null;
  try {
    const isVehicleUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      vehicleTypeId
    );
    const ruleQuery = await db.select({
      ruleId: pricingRules.id,
      basePrice: pricingRules.basePrice,
      baseDistanceKm: pricingRules.baseDistanceKm,
      pricePerKm: pricingRules.pricePerKm,
      vehicleId: vehicleTypes.id,
      vehicleCode: vehicleTypes.code,
      vehicleName: vehicleTypes.name,
      payloadCapacityKg: vehicleTypes.payloadCapacityKg
    }).from(pricingRules).innerJoin(vehicleTypes, eq7(pricingRules.vehicleTypeId, vehicleTypes.id)).where(
      isVehicleUuid ? eq7(vehicleTypes.id, vehicleTypeId) : or3(
        eq7(vehicleTypes.code, vehicleTypeId),
        eq7(vehicleTypes.code, vehicleTypeId.toUpperCase())
      )
    ).limit(1);
    if (ruleQuery.length > 0) {
      rule = ruleQuery[0];
    }
  } catch (err) {
    console.warn(
      "[pricingService] Kh\xF4ng th\u1EC3 truy v\u1EA5n DB cho estimateBookingPrice, d\xF9ng mock:",
      err?.message
    );
  }
  if (!rule) {
    const mockMatch = MOCK_PRICING_RULES.find(
      (r) => r.vehicleTypeId === vehicleTypeId || r.vehicleCode === vehicleTypeId || r.id === vehicleTypeId
    ) || MOCK_PRICING_RULES[0];
    rule = {
      ruleId: mockMatch.id,
      basePrice: mockMatch.basePrice,
      baseDistanceKm: mockMatch.baseDistanceKm,
      pricePerKm: mockMatch.pricePerKm,
      vehicleId: mockMatch.vehicleTypeId,
      vehicleCode: mockMatch.vehicleCode,
      vehicleName: mockMatch.vehicleName,
      payloadCapacityKg: mockMatch.payloadCapacityKg
    };
  }
  const route = await calculateRouteDistance(
    Number(originLat),
    Number(originLng),
    Number(destLat),
    Number(destLng),
    input.waypoints
  );
  const distanceKm = route.distanceKm;
  const durationMinutes = route.durationMinutes;
  const basePrice = Number(rule.basePrice);
  const baseDistanceKm = Number(rule.baseDistanceKm);
  const pricePerKm = Number(rule.pricePerKm);
  const extraDistanceKm = Math.max(
    0,
    Number((distanceKm - baseDistanceKm).toFixed(1))
  );
  const extraKmPrice = Math.round(extraDistanceKm * pricePerKm);
  const transportPrice = basePrice + extraKmPrice;
  const allActiveSurcharges = await getSurchargeServices();
  const selectedSurcharges = [];
  const serviceQuantityMap = /* @__PURE__ */ new Map();
  for (const s of services) {
    if (typeof s === "string") {
      const code = s.toUpperCase();
      serviceQuantityMap.set(code, (serviceQuantityMap.get(code) || 0) + 1);
    } else if (s && typeof s === "object" && s.code) {
      const code = s.code.toUpperCase();
      const qty = Math.max(1, Number(s.quantity) || 1);
      serviceQuantityMap.set(code, (serviceQuantityMap.get(code) || 0) + qty);
    }
  }
  for (const sc of allActiveSurcharges) {
    const scCode = sc.code.toUpperCase();
    if (serviceQuantityMap.has(scCode)) {
      const quantity = serviceQuantityMap.get(scCode);
      const unitPrice = Number(sc.price);
      selectedSurcharges.push({
        code: sc.code,
        name: sc.name,
        price: unitPrice,
        quantity,
        totalPrice: unitPrice * quantity,
        description: sc.description
      });
    }
  }
  let isNightTime = false;
  if (typeof input.isNight === "boolean") {
    isNightTime = input.isNight;
  } else {
    const targetDate = input.bookingTime ? new Date(input.bookingTime) : /* @__PURE__ */ new Date();
    const vnHour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "numeric",
        hour12: false
      }).format(targetDate)
    );
    isNightTime = vnHour >= 22 || vnHour < 6;
  }
  const hasNightSurchargeSelected = selectedSurcharges.some(
    (s) => s.code === "NIGHT_SURCHARGE"
  );
  if (isNightTime && !hasNightSurchargeSelected) {
    const nightService = allActiveSurcharges.find(
      (s) => s.code === "NIGHT_SURCHARGE"
    );
    if (nightService) {
      const unitPrice = Number(nightService.price);
      selectedSurcharges.push({
        code: nightService.code,
        name: nightService.name,
        price: unitPrice,
        quantity: 1,
        totalPrice: unitPrice,
        description: "T\u1EF1 \u0111\u1ED9ng \xE1p d\u1EE5ng cho khung gi\u1EDD giao h\xE0ng \u0111\xEAm Vi\u1EC7t Nam (22:00 - 06:00)"
      });
    }
  }
  const surchargeTotal = selectedSurcharges.reduce(
    (sum, item) => sum + (item.totalPrice !== void 0 ? item.totalPrice : item.price),
    0
  );
  const totalPrice = transportPrice + surchargeTotal;
  const commissionRate = 0.2;
  const platformFee = Math.round(transportPrice * commissionRate);
  const driverEarnings = totalPrice - platformFee;
  return {
    vehicleType: {
      id: rule.vehicleId,
      code: rule.vehicleCode,
      name: rule.vehicleName,
      payloadCapacityKg: rule.payloadCapacityKg
    },
    distanceKm,
    durationMinutes,
    routingSource: route.routingSource,
    totalPrice,
    surchargeTotal,
    breakdown: {
      basePrice,
      baseDistanceKm,
      extraDistanceKm,
      pricePerKm,
      extraKmPrice,
      transportPrice,
      surcharges: selectedSurcharges,
      surchargeTotal,
      totalPrice,
      driverCommissionRate: commissionRate,
      platformFee,
      driverEarnings
    }
  };
}

// src/api/routes/pricing_admin.ts
var router4 = Router4();
router4.get("/rules", async (req, res, next) => {
  try {
    const rules = await getPricingRules();
    res.json({ success: true, data: rules });
  } catch (err) {
    next(err);
  }
});
var handleUpdateRule = async (req, res, next) => {
  try {
    const updated = await updatePricingRule(req.params.id, req.body);
    res.json({
      success: true,
      message: "C\u1EADp nh\u1EADt b\u1EA3ng gi\xE1 lo\u1EA1i xe th\xE0nh c\xF4ng",
      data: updated
    });
  } catch (err) {
    next(err);
  }
};
router4.patch("/rules/:id", handleUpdateRule);
router4.put("/rules/:id", handleUpdateRule);
router4.post("/rules", async (req, res, next) => {
  try {
    const created = await createPricingRule(req.body);
    res.status(201).json({
      success: true,
      message: "Thi\u1EBFt l\u1EADp b\u1EA3ng gi\xE1 lo\u1EA1i xe th\xE0nh c\xF4ng",
      data: created
    });
  } catch (err) {
    next(err);
  }
});
router4.get("/surcharges", async (req, res, next) => {
  try {
    const services = await getSurchargeServices();
    res.json({ success: true, data: services });
  } catch (err) {
    next(err);
  }
});
router4.post("/surcharges", async (req, res, next) => {
  try {
    const created = await createSurchargeService(req.body);
    res.status(201).json({
      success: true,
      message: "Th\xEAm m\u1EDBi ph\u1EE5 ph\xED th\xE0nh c\xF4ng",
      data: created
    });
  } catch (err) {
    next(err);
  }
});
var handleUpdateSurcharge = async (req, res, next) => {
  try {
    const updated = await updateSurchargeService(req.params.code, req.body);
    res.json({
      success: true,
      message: "C\u1EADp nh\u1EADt ph\u1EE5 ph\xED th\xE0nh c\xF4ng",
      data: updated
    });
  } catch (err) {
    next(err);
  }
};
router4.patch("/surcharges/:code", handleUpdateSurcharge);
router4.put("/surcharges/:code", handleUpdateSurcharge);
var pricing_admin_default = router4;

// src/api/routes/b2b.ts
import { Router as Router5 } from "express";

// src/lib/b2bService.ts
import { eq as eq8, desc as desc5, ilike as ilike3, or as or4, and as and7, sql as sql5 } from "drizzle-orm";
async function getB2bCustomers(params = {}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;
  let query = db.select().from(b2bCustomers);
  const conditions = [];
  if (params.status && params.status !== "ALL") {
    conditions.push(eq8(b2bCustomers.status, params.status.toUpperCase()));
  }
  if (params.search && params.search.trim()) {
    const s = `%${params.search.trim()}%`;
    conditions.push(
      or4(
        ilike3(b2bCustomers.companyName, s),
        ilike3(b2bCustomers.taxCode, s),
        ilike3(b2bCustomers.contactPhone, s),
        ilike3(b2bCustomers.contactName, s)
      )
    );
  }
  const finalQuery = conditions.length > 0 ? query.where(and7(...conditions)) : query;
  const rawList = await finalQuery.orderBy(desc5(b2bCustomers.createdAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql5`count(*)::int` }).from(b2bCustomers).where(conditions.length > 0 ? and7(...conditions) : void 0);
  const total = countResult[0]?.count || 0;
  const customers = rawList.map((c) => {
    const creditLimit = Number(c.creditLimit || 0);
    const currentDebt = Number(c.currentDebt || 0);
    const availableCredit = Math.max(0, creditLimit - currentDebt);
    const debtUsagePercent = creditLimit > 0 ? Math.round(currentDebt / creditLimit * 100) : 0;
    return {
      ...c,
      creditLimit,
      currentDebt,
      availableCredit,
      debtUsagePercent,
      discountPercent: Number(c.discountPercent || 0)
    };
  });
  return {
    customers,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  };
}
async function getB2bCustomerDetail(id) {
  if (!id) throw new ApiError(400, "Thi\u1EBFu m\xE3 kh\xE1ch h\xE0ng doanh nghi\u1EC7p (id)");
  const list = await db.select().from(b2bCustomers).where(eq8(b2bCustomers.id, id)).limit(1);
  if (list.length === 0) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y kh\xE1ch h\xE0ng doanh nghi\u1EC7p");
  }
  const c = list[0];
  const creditLimit = Number(c.creditLimit || 0);
  const currentDebt = Number(c.currentDebt || 0);
  const availableCredit = Math.max(0, creditLimit - currentDebt);
  const debtUsagePercent = creditLimit > 0 ? Math.round(currentDebt / creditLimit * 100) : 0;
  return {
    ...c,
    creditLimit,
    currentDebt,
    availableCredit,
    debtUsagePercent,
    discountPercent: Number(c.discountPercent || 0)
  };
}
async function createB2bCustomer(input) {
  if (!input.companyName || !input.companyName.trim()) {
    throw new ApiError(400, "T\xEAn doanh nghi\u1EC7p kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng");
  }
  if (!input.taxCode || !input.taxCode.trim()) {
    throw new ApiError(400, "M\xE3 s\u1ED1 thu\u1EBF kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng");
  }
  if (!input.businessAddress || !input.businessAddress.trim()) {
    throw new ApiError(400, "\u0110\u1ECBa ch\u1EC9 tr\u1EE5 s\u1EDF doanh nghi\u1EC7p kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng");
  }
  if (!input.contactName || !input.contactName.trim()) {
    throw new ApiError(400, "T\xEAn ng\u01B0\u1EDDi li\xEAn h\u1EC7 kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng");
  }
  if (!input.contactPhone || !input.contactPhone.trim()) {
    throw new ApiError(400, "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i li\xEAn h\u1EC7 kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng");
  }
  const cleanTaxCode = input.taxCode.trim();
  const existing = await db.select().from(b2bCustomers).where(eq8(b2bCustomers.taxCode, cleanTaxCode)).limit(1);
  if (existing.length > 0) {
    throw new ApiError(
      400,
      `M\xE3 s\u1ED1 thu\u1EBF "${cleanTaxCode}" \u0111\xE3 t\u1ED3n t\u1EA1i trong h\u1EC7 th\u1ED1ng`
    );
  }
  const inserted = await db.insert(b2bCustomers).values({
    userId: input.userId || null,
    companyName: input.companyName.trim(),
    taxCode: cleanTaxCode,
    businessAddress: input.businessAddress.trim(),
    contactName: input.contactName.trim(),
    contactPhone: input.contactPhone.trim(),
    invoiceEmail: input.invoiceEmail?.trim() || null,
    creditLimit: String(input.creditLimit ?? 0),
    currentDebt: "0",
    paymentTermDays: input.paymentTermDays ?? 30,
    discountPercent: String(input.discountPercent ?? 0),
    status: "ACTIVE",
    notes: input.notes?.trim() || null
  }).returning();
  return inserted[0];
}
async function updateB2bCustomer(id, input) {
  if (!id) throw new ApiError(400, "Thi\u1EBFu m\xE3 kh\xE1ch h\xE0ng doanh nghi\u1EC7p (id)");
  const existing = await db.select().from(b2bCustomers).where(eq8(b2bCustomers.id, id)).limit(1);
  if (existing.length === 0) {
    throw new ApiError(
      404,
      "Kh\xF4ng t\xECm th\u1EA5y kh\xE1ch h\xE0ng doanh nghi\u1EC7p \u0111\u1EC3 c\u1EADp nh\u1EADt"
    );
  }
  if (input.taxCode && input.taxCode.trim() !== existing[0].taxCode) {
    const cleanTaxCode = input.taxCode.trim();
    const duplicate = await db.select().from(b2bCustomers).where(eq8(b2bCustomers.taxCode, cleanTaxCode)).limit(1);
    if (duplicate.length > 0) {
      throw new ApiError(
        400,
        `M\xE3 s\u1ED1 thu\u1EBF "${cleanTaxCode}" \u0111\xE3 thu\u1ED9c v\u1EC1 doanh nghi\u1EC7p kh\xE1c`
      );
    }
  }
  const updateFields = {
    updatedAt: /* @__PURE__ */ new Date()
  };
  if (input.companyName !== void 0)
    updateFields.companyName = input.companyName.trim();
  if (input.taxCode !== void 0) updateFields.taxCode = input.taxCode.trim();
  if (input.businessAddress !== void 0)
    updateFields.businessAddress = input.businessAddress.trim();
  if (input.contactName !== void 0)
    updateFields.contactName = input.contactName.trim();
  if (input.contactPhone !== void 0)
    updateFields.contactPhone = input.contactPhone.trim();
  if (input.invoiceEmail !== void 0)
    updateFields.invoiceEmail = input.invoiceEmail?.trim() || null;
  if (input.creditLimit !== void 0)
    updateFields.creditLimit = String(input.creditLimit);
  if (input.paymentTermDays !== void 0)
    updateFields.paymentTermDays = input.paymentTermDays;
  if (input.discountPercent !== void 0)
    updateFields.discountPercent = String(input.discountPercent);
  if (input.status !== void 0)
    updateFields.status = input.status.toUpperCase();
  if (input.notes !== void 0)
    updateFields.notes = input.notes?.trim() || null;
  const updated = await db.update(b2bCustomers).set(updateFields).where(eq8(b2bCustomers.id, id)).returning();
  return updated[0];
}
async function setB2bCustomerStatus(id, status) {
  if (!id) throw new ApiError(400, "Thi\u1EBFu m\xE3 kh\xE1ch h\xE0ng doanh nghi\u1EC7p");
  if (status !== "ACTIVE" && status !== "SUSPENDED") {
    throw new ApiError(400, "Tr\u1EA1ng th\xE1i ph\u1EA3i l\xE0 ACTIVE ho\u1EB7c SUSPENDED");
  }
  const updated = await db.update(b2bCustomers).set({
    status,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq8(b2bCustomers.id, id)).returning();
  if (updated.length === 0) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y kh\xE1ch h\xE0ng doanh nghi\u1EC7p");
  }
  return {
    id,
    status: updated[0].status,
    message: status === "ACTIVE" ? "\u0110\xE3 k\xEDch ho\u1EA1t \u0111\u1ED1i t\xE1c B2B th\xE0nh c\xF4ng" : "\u0110\xE3 t\u1EA1m ng\u01B0ng \u0111\u1ED1i t\xE1c B2B"
  };
}
async function recordB2bPayment(id, amount, note) {
  if (!id) throw new ApiError(400, "Thi\u1EBFu m\xE3 kh\xE1ch h\xE0ng doanh nghi\u1EC7p");
  if (!amount || amount <= 0) {
    throw new ApiError(400, "S\u1ED1 ti\u1EC1n thanh to\xE1n ph\u1EA3i l\u1EDBn h\u01A1n 0");
  }
  const existing = await db.select().from(b2bCustomers).where(eq8(b2bCustomers.id, id)).limit(1);
  if (existing.length === 0) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y kh\xE1ch h\xE0ng doanh nghi\u1EC7p");
  }
  const currentDebt = Number(existing[0].currentDebt || 0);
  const newDebt = Math.max(0, currentDebt - amount);
  const updated = await db.update(b2bCustomers).set({
    currentDebt: String(newDebt),
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq8(b2bCustomers.id, id)).returning();
  return {
    id,
    paidAmount: amount,
    previousDebt: currentDebt,
    remainingDebt: newDebt,
    note: note || "Thanh to\xE1n c\xF4ng n\u1EE3 k\u1EF3",
    message: `\u0110\xE3 ghi nh\u1EADn thanh to\xE1n ${amount.toLocaleString()} VN\u0110 th\xE0nh c\xF4ng`
  };
}

// src/api/routes/b2b.ts
var router5 = Router5();
router5.get("/customers", async (req, res, next) => {
  try {
    const search = req.query.search;
    const status = req.query.status;
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "20", 10);
    const result = await getB2bCustomers({ search, status, page, limit });
    res.json({
      success: true,
      data: result.customers,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (err) {
    next(err);
  }
});
router5.post("/customers", async (req, res, next) => {
  try {
    const created = await createB2bCustomer(req.body);
    res.status(201).json({
      success: true,
      message: "Th\xEAm m\u1EDBi kh\xE1ch h\xE0ng doanh nghi\u1EC7p B2B th\xE0nh c\xF4ng",
      data: created
    });
  } catch (err) {
    next(err);
  }
});
router5.get("/customers/:id", async (req, res, next) => {
  try {
    const detail = await getB2bCustomerDetail(req.params.id);
    res.json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
});
router5.put("/customers/:id", async (req, res, next) => {
  try {
    const updated = await updateB2bCustomer(req.params.id, req.body);
    res.json({
      success: true,
      message: "C\u1EADp nh\u1EADt th\xF4ng tin doanh nghi\u1EC7p th\xE0nh c\xF4ng",
      data: updated
    });
  } catch (err) {
    next(err);
  }
});
router5.patch("/customers/:id/status", async (req, res, next) => {
  try {
    const result = await setB2bCustomerStatus(req.params.id, req.body.status);
    res.json({ success: true, message: result.message, data: result });
  } catch (err) {
    next(err);
  }
});
router5.post("/customers/:id/payment", async (req, res, next) => {
  try {
    const result = await recordB2bPayment(
      req.params.id,
      Number(req.body.amount),
      req.body.note
    );
    res.json({ success: true, message: result.message, data: result });
  } catch (err) {
    next(err);
  }
});
var b2b_default = router5;

// src/api/routes/admin.ts
var router6 = Router6();
router6.use(requireAuth, requireRoles(["ADMIN"]));
router6.get("/ratings", async (req, res, next) => {
  try {
    const rating = req.query.rating ? parseInt(req.query.rating, 10) : void 0;
    const driverId = req.query.driverId;
    const search = req.query.search;
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "20", 10);
    const result = await getAllDriverRatings({
      rating,
      driverId,
      search,
      page,
      limit
    });
    res.json({
      success: true,
      data: result.ratings,
      summary: result.summary,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (err) {
    next(err);
  }
});
router6.get("/dashboard/summary", async (req, res, next) => {
  try {
    const summary = await getDashboardSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});
router6.get("/users", async (req, res, next) => {
  try {
    const allUsers = await getAllUsers();
    res.json({ success: true, data: allUsers });
  } catch (err) {
    next(err);
  }
});
router6.patch("/users/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body;
    const updated = await setUserStatus(req.params.id, status);
    res.json({
      success: true,
      message: status === "BLOCKED" ? "\u0110\xE3 t\u1EA1m kh\xF3a t\xE0i kho\u1EA3n kh\xE1ch h\xE0ng" : "\u0110\xE3 m\u1EDF kh\xF3a t\xE0i kho\u1EA3n kh\xE1ch h\xE0ng",
      data: updated
    });
  } catch (err) {
    next(err);
  }
});
router6.get("/drivers/kyc-pending", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "20", 10);
    const result = await getPendingKycDrivers(page, limit);
    res.json({
      success: true,
      data: result.drivers,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total
      }
    });
  } catch (err) {
    next(err);
  }
});
router6.patch("/drivers/:id/kyc", async (req, res, next) => {
  try {
    if (req.body.action === "approve") {
      const result = await approveDriverKyc(req.params.id);
      res.json({ success: true, data: result });
    } else if (req.body.action === "reject") {
      const result = await rejectDriverKyc(req.params.id, req.body.reason);
      res.json({ success: true, data: result });
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid action (must be approve or reject)"
      });
    }
  } catch (err) {
    next(err);
  }
});
router6.post("/drivers/:id/kyc/approve", async (req, res, next) => {
  try {
    const result = await approveDriverKyc(req.params.id);
    res.json({
      success: true,
      message: "Ph\xEA duy\u1EC7t h\u1ED3 s\u01A1 t\xE0i x\u1EBF th\xE0nh c\xF4ng",
      data: result
    });
  } catch (err) {
    next(err);
  }
});
router6.post("/drivers/:id/kyc/reject", async (req, res, next) => {
  try {
    const result = await rejectDriverKyc(req.params.id, req.body?.reason);
    res.json({
      success: true,
      message: "\u0110\xE3 t\u1EEB ch\u1ED1i h\u1ED3 s\u01A1 t\xE0i x\u1EBF",
      data: result
    });
  } catch (err) {
    next(err);
  }
});
router6.patch("/drivers/:id/status", async (req, res, next) => {
  try {
    const result = await setDriverActiveStatus(
      req.params.id,
      Boolean(req.body.isActive)
    );
    res.json({ success: true, message: result.message, data: result });
  } catch (err) {
    next(err);
  }
});
router6.get("/drivers/:id", async (req, res, next) => {
  try {
    const detail = await getDriverKycDetail(req.params.id);
    res.json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
});
router6.get("/drivers", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "20", 10);
    const kycStatus = req.query.kycStatus || void 0;
    const isOnlineParam = req.query.isOnline;
    const isOnline = isOnlineParam !== void 0 ? isOnlineParam === "true" : void 0;
    const search = req.query.search || void 0;
    const result = await getAllDrivers({
      page,
      limit,
      kycStatus,
      isOnline,
      search
    });
    res.json({
      success: true,
      data: result.drivers,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total
      }
    });
  } catch (err) {
    next(err);
  }
});
router6.get("/wallets", async (req, res, next) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const search = req.query.search ? String(req.query.search) : void 0;
    const result = await getAllDriverWallets({ page, limit, search });
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
});
router6.get("/wallets/topup-requests", async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : void 0;
    const search = req.query.search ? String(req.query.search) : void 0;
    const result = await getPendingTopUpRequests({ status, search });
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
});
router6.post("/wallets/topup-requests/:id/approve", async (req, res, next) => {
  try {
    const result = await adminApproveTopUpRequest(req.params.id, req.user.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
router6.post("/wallets/topup-requests/:id/reject", async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await adminRejectTopUpRequest(req.params.id, req.user.userId, reason);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
router6.get("/wallets/:userId", async (req, res, next) => {
  try {
    const details = await getWalletDetails(req.params.userId);
    res.json({
      success: true,
      data: details
    });
  } catch (err) {
    next(err);
  }
});
router6.get("/wallets/:userId/transactions", async (req, res, next) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const type = req.query.type ? String(req.query.type) : void 0;
    const result = await getWalletTransactions(req.params.userId, {
      page,
      limit,
      type
    });
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
});
var walletAdjustIdempotencyCache = /* @__PURE__ */ new Map();
function cleanExpiredIdempotency() {
  const now = Date.now();
  for (const [key, val] of walletAdjustIdempotencyCache.entries()) {
    if (val.expiresAt < now) walletAdjustIdempotencyCache.delete(key);
  }
}
router6.post("/wallets/:userId/adjust", async (req, res, next) => {
  try {
    const { amount, type, description, referenceCode, idempotencyKey } = req.body;
    cleanExpiredIdempotency();
    if (idempotencyKey && walletAdjustIdempotencyCache.has(idempotencyKey)) {
      const cached = walletAdjustIdempotencyCache.get(idempotencyKey);
      return res.json({
        success: true,
        message: "(Y\xEAu c\u1EA7u tr\xF9ng l\u1EB7p - \u0110\xE3 ho\xE0n t\u1EA5t tr\u01B0\u1EDBc \u0111\xF3) " + cached.result.message,
        data: cached.result
      });
    }
    const result = await adminAdjustWallet({
      targetUserId: req.params.userId,
      amount: Number(amount),
      type: type || "ADMIN_ADJUSTMENT",
      description,
      referenceCode,
      adminUserId: req.user.userId
    });
    if (idempotencyKey) {
      walletAdjustIdempotencyCache.set(idempotencyKey, {
        result,
        expiresAt: Date.now() + 5 * 60 * 1e3
      });
    }
    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (err) {
    next(err);
  }
});
router6.get("/cron/status", async (req, res, next) => {
  try {
    const status = getCronSystemStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (err) {
    next(err);
  }
});
router6.post(
  "/cron/trigger-block-drivers",
  async (req, res, next) => {
    try {
      const minTrips = req.body.minTrips ? Number(req.body.minTrips) : 5;
      const ratingThreshold = req.body.ratingThreshold ? Number(req.body.ratingThreshold) : 4;
      const result = await autoBlockLowRatingDrivers(minTrips, ratingThreshold);
      res.json({
        success: true,
        message: `\u0110\xE3 qu\xE9t v\xE0 kh\xF3a ${result.processedCount} t\xE0i x\u1EBF vi ph\u1EA1m \u0111i\u1EC3m s\u1ED1.`,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
);
router6.post("/cron/trigger-backup", async (req, res, next) => {
  try {
    const keepDays = req.body.keepDays ? Number(req.body.keepDays) : 7;
    const result = await autoBackupDatabase(void 0, keepDays);
    res.json({
      success: true,
      message: "Sao l\u01B0u Database th\xE0nh c\xF4ng.",
      data: result
    });
  } catch (err) {
    next(err);
  }
});
router6.get("/bookings", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "20", 10);
    const status = req.query.status;
    const search = req.query.search;
    const vehicle = req.query.vehicle;
    const result = await getAdminBookings({ page, limit, status, search, vehicle });
    res.json({
      success: true,
      data: result.bookings,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (err) {
    next(err);
  }
});
router6.post("/bookings/:id/cancel", async (req, res, next) => {
  try {
    const { reason } = req.body;
    const updated = await adminCancelBooking(req.params.id, reason);
    res.json({
      success: true,
      message: `\u0110\xE3 h\u1EE7y \u0111\u01A1n ${updated.bookingCode}`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
});
router6.post("/bookings/:id/assign-driver", async (req, res, next) => {
  try {
    const { driverId } = req.body;
    const updated = await adminAssignDriver(req.params.id, driverId);
    res.json({
      success: true,
      message: `\u0110\xE3 \u0111i\u1EC1u ph\u1ED1i t\xE0i x\u1EBF cho \u0111\u01A1n ${updated.bookingCode}`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
});
router6.post("/bookings/:id/refund", async (req, res, next) => {
  try {
    const { reason } = req.body;
    const updated = await adminRefundBooking(
      req.params.id,
      reason,
      req.user.userId
    );
    res.json({
      success: true,
      message: `\u0110\xE3 ho\xE0n ti\u1EC1n cho \u0111\u01A1n ${updated.bookingCode}`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
});
router6.get("/complaints", requireAuth, requireRoles(["ADMIN"]), async (req, res, next) => {
  try {
    const { status, page = "1", limit = "20" } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    let query = db.select({
      complaint: complaints,
      userName: users.fullName,
      userPhone: users.phone
    }).from(complaints).leftJoin(users, eq9(complaints.userId, users.id));
    if (status) {
      let dbStatus = status;
      if (status === "M\u1EDBi") dbStatus = "PENDING";
      else if (status === "\u0110ang x\u1EED l\xFD") dbStatus = "PROCESSING";
      else if (status === "\u0110\xE3 gi\u1EA3i quy\u1EBFt") dbStatus = "RESOLVED";
      else if (status === "T\u1EEB ch\u1ED1i") dbStatus = "REJECTED";
      query = query.where(eq9(complaints.status, dbStatus));
    }
    const result = await query.orderBy(desc6(complaints.createdAt)).limit(parseInt(limit, 10)).offset(offset);
    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});
router6.patch("/complaints/:id", requireAuth, requireRoles(["ADMIN"]), async (req, res, next) => {
  try {
    const complaintId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!complaintId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(complaintId)) {
      return res.status(400).json({ success: false, message: "ID khi\u1EBFu n\u1EA1i kh\xF4ng h\u1EE3p l\u1EC7" });
    }
    const { status, adminNotes } = req.body;
    const updateData = { updatedAt: /* @__PURE__ */ new Date() };
    if (status) {
      let dbStatus = status;
      if (status === "M\u1EDBi") dbStatus = "PENDING";
      else if (status === "\u0110ang x\u1EED l\xFD") dbStatus = "PROCESSING";
      else if (status === "\u0110\xE3 gi\u1EA3i quy\u1EBFt") dbStatus = "RESOLVED";
      else if (status === "T\u1EEB ch\u1ED1i") dbStatus = "REJECTED";
      updateData.status = dbStatus;
      if (dbStatus === "RESOLVED") updateData.resolvedAt = /* @__PURE__ */ new Date();
    }
    if (adminNotes) updateData.adminNotes = adminNotes;
    const [updated] = await db.update(complaints).set(updateData).where(eq9(complaints.id, complaintId)).returning();
    if (!updated) return res.status(404).json({ success: false, message: "Khi\u1EBFu n\u1EA1i kh\xF4ng t\u1ED3n t\u1EA1i" });
    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});
router6.use("/pricing", pricing_admin_default);
router6.use("/b2b", b2b_default);
var admin_default = router6;

// src/api/routes/pricing.ts
import { Router as Router7 } from "express";
var router7 = Router7();
router7.post("/estimate", async (req, res, next) => {
  try {
    const result = await estimateBookingPrice(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});
router7.get("/rules", async (req, res, next) => {
  try {
    const rules = await getPricingRules();
    res.json({ success: true, data: rules });
  } catch (err) {
    next(err);
  }
});
router7.get("/services", async (req, res, next) => {
  try {
    const services = await getSurchargeServices();
    res.json({ success: true, data: services });
  } catch (err) {
    next(err);
  }
});
var pricing_default = router7;

// src/api/routes/booking.ts
import { Router as Router8 } from "express";
var router8 = Router8();
router8.post("/estimate", async (req, res, next) => {
  try {
    const result = await estimateBookingPrice(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});
router8.use(requireAuth);
router8.post("/", async (req, res, next) => {
  try {
    const result = await createBooking(req.user.userId, req.body);
    res.status(201).json({
      success: true,
      message: "\u0110\u1EB7t xe th\xE0nh c\xF4ng, \u0111ang t\xECm t\xE0i x\u1EBF g\u1EA7n nh\u1EA5t",
      data: result
    });
  } catch (err) {
    next(err);
  }
});
router8.get("/:id", async (req, res, next) => {
  try {
    const booking = await getBookingById(req.params.id);
    const isOwner = booking.customerId === req.user?.userId || booking.driverId === req.user?.userId || booking.driverUserId === req.user?.userId || req.user?.role === "ADMIN";
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n truy c\u1EADp th\xF4ng tin chuy\u1EBFn xe n\xE0y"
      });
    }
    const isCustomerOrAdmin = booking.customerId === req.user?.userId || req.user?.role === "ADMIN";
    const data = isCustomerOrAdmin ? booking : { ...booking, deliveryOtp: null };
    res.json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
});
router8.get("/:id/track", async (req, res, next) => {
  try {
    const booking = await getBookingById(req.params.id);
    const isOwner = booking.customerId === req.user?.userId || booking.driverId === req.user?.userId || booking.driverUserId === req.user?.userId || req.user?.role === "ADMIN";
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n truy c\u1EADp th\xF4ng tin chuy\u1EBFn xe n\xE0y"
      });
    }
    res.json({
      success: true,
      data: {
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        status: booking.status,
        origin: booking.origin,
        destination: booking.destination,
        distanceKm: booking.distanceKm,
        totalPrice: booking.pricing?.totalPrice,
        pricing: booking.pricing,
        proofImages: booking.proofImages,
        deliveryProofImage: booking.proofImages?.delivery,
        deliveryOtp: booking.customerId === req.user?.userId || req.user?.role === "ADMIN" ? booking.deliveryOtp : null,
        completedAt: booking.completedAt,
        driver: booking.driver ? {
          id: booking.driver.id,
          name: booking.driver.name,
          phone: booking.driver.phone,
          avatarUrl: booking.driver.avatarUrl,
          licensePlate: booking.driver.licensePlate,
          vehicleTypeName: booking.driver.vehicleTypeName,
          currentLocation: booking.driver.currentLocation
        } : null
      }
    });
  } catch (err) {
    next(err);
  }
});
router8.get("/", async (req, res, next) => {
  try {
    const list = await getCustomerBookings(req.user.userId);
    res.json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (err) {
    next(err);
  }
});
router8.post("/:id/cancel", async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await cancelBooking(
      req.user.userId,
      req.params.id,
      reason
    );
    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (err) {
    next(err);
  }
});
router8.post("/:id/escalate", async (req, res, next) => {
  try {
    const result = await escalateBookingDispatch(req.params.id);
    res.json({
      success: true,
      message: result.message || "\u0110\xE3 m\u1EDF r\u1ED9ng ph\u1EA1m vi t\xECm t\xE0i x\u1EBF",
      data: result
    });
  } catch (err) {
    next(err);
  }
});
router8.post("/:id/rate", async (req, res, next) => {
  try {
    const result = await rateBooking(
      req.params.id,
      req.user.userId,
      req.body
    );
    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (err) {
    next(err);
  }
});
router8.post("/:id/reassign", async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await reassignBookingDriver(
      req.user.userId,
      req.params.id,
      reason
    );
    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (err) {
    next(err);
  }
});
var booking_default = router8;

// src/api/routes/payment.ts
import { Router as Router9 } from "express";
var router9 = Router9();
router9.post("/create-url", requireAuth, async (req, res, next) => {
  try {
    const {
      amount,
      gateway,
      purpose,
      bookingId,
      bankCode,
      redirectUrl,
      description
    } = req.body;
    const clientIp = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress || "127.0.0.1";
    const result = await createPaymentOrder({
      userId: req.user.userId,
      amount: Number(amount),
      gateway: gateway ? String(gateway).toUpperCase() : "VIETQR",
      purpose: purpose ? String(purpose).toUpperCase() : "TOPUP_WALLET",
      bookingId,
      bankCode,
      redirectUrl,
      description,
      ipAddr: clientIp
    });
    res.json({
      success: true,
      message: `T\u1EA1o link thanh to\xE1n qua ${result.gateway} th\xE0nh c\xF4ng`,
      data: result
    });
  } catch (err) {
    next(err);
  }
});
router9.get("/vnpay-ipn", async (req, res) => {
  try {
    const result = await processVnpayIpn(req.query);
    res.json(result.response);
  } catch (err) {
    console.error("[VNPay IPN Error]:", err.message);
    res.json({ RspCode: "99", Message: "Unknown Error" });
  }
});
router9.get("/vnpay-return", async (req, res) => {
  try {
    const result = await processVnpayIpn(req.query);
    const transactionCode = req.query.vnp_TxnRef;
    const responseCode = req.query.vnp_ResponseCode;
    const isSuccess = result.isValidChecksum && responseCode === "00";
    const rawAmount = Number(req.query.vnp_Amount || 0);
    const amount = rawAmount > 0 ? rawAmount / 100 : 0;
    const bankCode = req.query.vnp_BankCode || "VNPay";
    const message = isSuccess ? "Giao d\u1ECBch VNPay th\xE0nh c\xF4ng!" : "Giao d\u1ECBch VNPay kh\xF4ng th\xE0nh c\xF4ng ho\u1EB7c \u0111\xE3 b\u1ECB h\u1EE7y.";
    if (req.query.format === "json" || req.headers.accept?.includes("application/json") && !req.headers.accept?.includes("text/html")) {
      return res.json({
        success: isSuccess,
        transactionCode,
        responseCode,
        message,
        data: req.query
      });
    }
    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>K\u1EBFt qu\u1EA3 thanh to\xE1n VNPay - FastDrop</title>
  <style>
    :root {
      --primary: #2563eb;
      --success: #16a34a;
      --danger: #dc2626;
      --bg: #0f172a;
      --card: #1e293b;
      --text: #f8fafc;
      --subtext: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 16px;
    }
    .card {
      background: var(--card);
      border-radius: 20px;
      padding: 32px 24px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.08);
    }
    .icon {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      margin: 0 auto 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      background: ${isSuccess ? "rgba(22, 163, 74, 0.15)" : "rgba(220, 38, 38, 0.15)"};
      color: ${isSuccess ? "var(--success)" : "var(--danger)"};
      border: 2px solid ${isSuccess ? "var(--success)" : "var(--danger)"};
    }
    h1 {
      font-size: 20px;
      font-weight: 800;
      margin-bottom: 8px;
      color: ${isSuccess ? "#4ade80" : "#f87171"};
    }
    .amount {
      font-size: 28px;
      font-weight: 800;
      margin: 12px 0 20px;
      color: #fff;
    }
    .details {
      background: rgba(0,0,0,0.25);
      border-radius: 12px;
      padding: 14px 16px;
      text-align: left;
      font-size: 13px;
      margin-bottom: 24px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .row:last-child { border-bottom: none; }
    .label { color: var(--subtext); }
    .val { font-weight: 600; color: #fff; }
    .btn {
      display: block;
      width: 100%;
      padding: 14px;
      border-radius: 12px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #fff;
      font-weight: 700;
      font-size: 15px;
      text-decoration: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(37,99,235,0.4);
    }
    .countdown {
      font-size: 12px;
      color: var(--subtext);
      margin-top: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${isSuccess ? "\u2713" : "\u2715"}</div>
    <h1>${isSuccess ? "Thanh To\xE1n Th\xE0nh C\xF4ng!" : "Thanh To\xE1n Th\u1EA5t B\u1EA1i"}</h1>
    <p style="font-size: 13px; color: var(--subtext);">${message}</p>
    ${amount > 0 ? `<div class="amount">${amount.toLocaleString("vi-VN")} \u0111</div>` : ""}
    <div class="details">
      <div class="row">
        <span class="label">M\xE3 giao d\u1ECBch</span>
        <span class="val">${transactionCode || "\u2014"}</span>
      </div>
      <div class="row">
        <span class="label">C\u1ED5ng thanh to\xE1n</span>
        <span class="val">VNPay (${bankCode})</span>
      </div>
      <div class="row">
        <span class="label">M\xE3 ph\u1EA3n h\u1ED3i</span>
        <span class="val">${responseCode || "\u2014"}</span>
      </div>
    </div>
    <a href="/" class="btn" id="returnBtn">Quay l\u1EA1i FastDrop</a>
    <div class="countdown">T\u1EF1 \u0111\u1ED9ng chuy\u1EC3n h\u01B0\u1EDBng sau <span id="timer">5</span> gi\xE2y...</div>
  </div>
  <script>
    var sec = 5;
    var timerEl = document.getElementById("timer");
    var interval = setInterval(function() {
      sec--;
      if (timerEl) timerEl.innerText = sec;
      if (sec <= 0) {
        clearInterval(interval);
        window.location.href = "/";
      }
    }, 1000);
  </script>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (err) {
    if (req.query.format === "json" || req.headers.accept?.includes("application/json") && !req.headers.accept?.includes("text/html")) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    res.status(400).send(`<h3>L\u1ED7i x\u1EED l\xFD ph\u1EA3n h\u1ED3i VNPay: ${err.message}</h3><p><a href="/">Quay l\u1EA1i \u1EE9ng d\u1EE5ng</a></p>`);
  }
});
router9.post("/momo-ipn", async (req, res) => {
  try {
    const result = await processMomoIpn(req.body);
    res.status(result.response.status || 200).json(result.response);
  } catch (err) {
    console.error("[MoMo IPN Error]:", err.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
router9.get("/status/:transactionCode", async (req, res, next) => {
  try {
    const status = await getPaymentStatus(req.params.transactionCode);
    res.json({
      success: true,
      data: status
    });
  } catch (err) {
    next(err);
  }
});
router9.get("/history", requireAuth, async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const history = await getUserPaymentHistory(req.user.userId, limit);
    res.json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (err) {
    next(err);
  }
});
router9.post("/confirm-simulated", async (req, res, next) => {
  try {
    const { transactionCode } = req.body;
    const result = await confirmSimulatedPayment(transactionCode);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
router9.post("/report-transferred", async (req, res, next) => {
  try {
    const { transactionCode } = req.body;
    const result = await reportPaymentTransferred(transactionCode);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
var payment_default = router9;

// src/api/routes/chat.ts
import { Router as Router10 } from "express";

// src/lib/chatService.ts
init_pusher();
async function sendChatMessage(dto) {
  const {
    bookingId,
    senderUserId,
    content,
    messageType = "TEXT",
    mediaUrl
  } = dto;
  if (!senderUserId) {
    throw new ApiError(401, "Y\xEAu c\u1EA7u \u0111\u0103ng nh\u1EADp \u0111\u1EC3 g\u1EEDi tin nh\u1EAFn");
  }
  if (!bookingId) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin bookingId");
  }
  const cleanContent = content ? String(content).trim() : "";
  if (!cleanContent && !mediaUrl) {
    throw new ApiError(
      400,
      "N\u1ED9i dung tin nh\u1EAFn ho\u1EB7c t\u1EC7p \u0111\xEDnh k\xE8m kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng"
    );
  }
  const bookingRows = await client.unsafe(
    `
    SELECT 
      b.id,
      b.booking_code,
      b.status,
      b.customer_id,
      b.driver_id,
      dp.user_id as driver_user_id,
      cu.full_name as customer_name,
      du.full_name as driver_name
    FROM bookings b
    JOIN users cu ON cu.id = b.customer_id
    LEFT JOIN driver_profiles dp ON dp.id = b.driver_id
    LEFT JOIN users du ON du.id = dp.user_id
    WHERE b.id = $1::uuid
    LIMIT 1
    `,
    [bookingId]
  );
  if (bookingRows.length === 0) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y chuy\u1EBFn xe");
  }
  const booking = bookingRows[0];
  let senderRole;
  let receiverUserId = null;
  if (senderUserId === booking.customer_id) {
    senderRole = "CUSTOMER";
    receiverUserId = booking.driver_user_id || null;
  } else if (senderUserId === booking.driver_user_id) {
    senderRole = "DRIVER";
    receiverUserId = booking.customer_id;
  } else {
    const adminCheck = await client.unsafe(
      `SELECT role FROM users WHERE id = $1::uuid LIMIT 1`,
      [senderUserId]
    );
    if (adminCheck[0]?.role === "ADMIN") {
      senderRole = "ADMIN";
      receiverUserId = booking.customer_id;
    } else {
      throw new ApiError(
        403,
        "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n tham gia cu\u1ED9c tr\xF2 chuy\u1EC7n trong chuy\u1EBFn xe n\xE0y"
      );
    }
  }
  const senderUser = await client.unsafe(
    `SELECT id, full_name, avatar_url FROM users WHERE id = $1::uuid LIMIT 1`,
    [senderUserId]
  );
  const senderName = senderUser[0]?.full_name || "Ng\u01B0\u1EDDi d\xF9ng";
  const senderAvatar = senderUser[0]?.avatar_url || null;
  const inserted = await client.unsafe(
    `
    INSERT INTO booking_messages (
      booking_id,
      sender_id,
      message_type,
      content,
      media_url,
      is_read,
      created_at
    ) VALUES (
      $1::uuid,
      $2::uuid,
      $3,
      $4,
      $5,
      false,
      NOW()
    )
    RETURNING id, booking_id, sender_id, message_type, content, media_url, is_read, created_at
    `,
    [
      bookingId,
      senderUserId,
      messageType,
      cleanContent || null,
      mediaUrl || null
    ]
  );
  const msg = inserted[0];
  await triggerNewChatMessage(bookingId, {
    messageId: msg.id,
    bookingId: msg.booking_id,
    senderId: msg.sender_id,
    senderRole,
    senderName,
    senderAvatar,
    messageType: msg.message_type,
    content: msg.content || "",
    mediaUrl: msg.media_url,
    createdAt: msg.created_at
  });
  if (receiverUserId) {
    const notifyBody = messageType === "IMAGE" ? "[H\xECnh \u1EA3nh]" : messageType === "LOCATION" ? "[V\u1ECB tr\xED hi\u1EC7n t\u1EA1i]" : cleanContent.length > 80 ? `${cleanContent.slice(0, 80)}...` : cleanContent;
    sendPushNotificationToUser(receiverUserId, {
      title: `\u{1F4AC} ${senderName} \u0111\xE3 nh\u1EAFn cho b\u1EA1n`,
      body: notifyBody,
      data: {
        type: "NEW_CHAT_MESSAGE",
        bookingId,
        bookingCode: booking.booking_code,
        messageId: msg.id
      }
    }).catch((err) => console.warn("FCM chat message error:", err.message));
  }
  return {
    id: msg.id,
    bookingId: msg.booking_id,
    bookingCode: booking.booking_code,
    senderId: msg.sender_id,
    senderRole,
    senderName,
    senderAvatar,
    messageType: msg.message_type,
    content: msg.content,
    mediaUrl: msg.media_url,
    isRead: msg.is_read,
    createdAt: msg.created_at
  };
}
async function getBookingChatMessages(bookingId, currentUserId, options) {
  if (!currentUserId) {
    throw new ApiError(401, "Y\xEAu c\u1EA7u \u0111\u0103ng nh\u1EADp");
  }
  if (!bookingId) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin bookingId");
  }
  const bookingRows = await client.unsafe(
    `
    SELECT 
      b.id,
      b.booking_code,
      b.status,
      b.customer_id,
      b.driver_id,
      dp.user_id as driver_user_id,
      cu.full_name as customer_name,
      cu.avatar_url as customer_avatar,
      du.full_name as driver_name,
      du.avatar_url as driver_avatar
    FROM bookings b
    JOIN users cu ON cu.id = b.customer_id
    LEFT JOIN driver_profiles dp ON dp.id = b.driver_id
    LEFT JOIN users du ON du.id = dp.user_id
    WHERE b.id = $1::uuid
    LIMIT 1
    `,
    [bookingId]
  );
  if (bookingRows.length === 0) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y chuy\u1EBFn xe");
  }
  const booking = bookingRows[0];
  const isParticipant = currentUserId === booking.customer_id || currentUserId === booking.driver_user_id;
  if (!isParticipant) {
    const adminCheck = await client.unsafe(
      `SELECT role FROM users WHERE id = $1::uuid LIMIT 1`,
      [currentUserId]
    );
    if (adminCheck[0]?.role !== "ADMIN") {
      throw new ApiError(
        403,
        "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n xem cu\u1ED9c tr\xF2 chuy\u1EC7n c\u1EE7a chuy\u1EBFn xe n\xE0y"
      );
    }
  }
  const page = Math.max(1, Number(options?.page || 1));
  const limit = Math.min(100, Math.max(1, Number(options?.limit || 50)));
  const offset = (page - 1) * limit;
  const updatedRead = await client.unsafe(
    `
    UPDATE booking_messages
    SET is_read = true
    WHERE booking_id = $1::uuid 
      AND sender_id != $2::uuid 
      AND is_read = false
    RETURNING id
    `,
    [bookingId, currentUserId]
  );
  if (updatedRead.length > 0) {
    triggerMessagesRead(bookingId, currentUserId).catch(
      (err) => console.warn("Pusher mark read error:", err.message)
    );
  }
  const countRes = await client.unsafe(
    `SELECT count(*) as total FROM booking_messages WHERE booking_id = $1::uuid`,
    [bookingId]
  );
  const total = parseInt(countRes[0]?.total || "0", 10);
  const rows = await client.unsafe(
    `
    SELECT 
      bm.id,
      bm.booking_id,
      bm.sender_id,
      bm.message_type,
      bm.content,
      bm.media_url,
      bm.is_read,
      bm.created_at,
      u.full_name as sender_name,
      u.avatar_url as sender_avatar,
      CASE 
        WHEN bm.sender_id = $2::uuid THEN 'CUSTOMER'
        WHEN bm.sender_id = $3::uuid THEN 'DRIVER'
        ELSE 'ADMIN'
      END as sender_role
    FROM booking_messages bm
    JOIN users u ON u.id = bm.sender_id
    WHERE bm.booking_id = $1::uuid
    ORDER BY bm.created_at ASC
    LIMIT $4 OFFSET $5
    `,
    [
      bookingId,
      booking.customer_id,
      booking.driver_user_id || "00000000-0000-0000-0000-000000000000",
      limit,
      offset
    ]
  );
  return {
    booking: {
      id: booking.id,
      bookingCode: booking.booking_code,
      status: booking.status,
      customer: {
        id: booking.customer_id,
        name: booking.customer_name,
        avatarUrl: booking.customer_avatar
      },
      driver: booking.driver_user_id ? {
        id: booking.driver_user_id,
        name: booking.driver_name,
        avatarUrl: booking.driver_avatar
      } : null
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    messages: rows.map((r) => ({
      id: r.id,
      bookingId: r.booking_id,
      senderId: r.sender_id,
      senderRole: r.sender_role,
      senderName: r.sender_name,
      senderAvatar: r.sender_avatar,
      messageType: r.message_type,
      content: r.content,
      mediaUrl: r.media_url,
      isRead: r.is_read,
      isMe: r.sender_id === currentUserId,
      createdAt: r.created_at
    }))
  };
}
async function markBookingChatRead(bookingId, currentUserId) {
  if (!currentUserId || !bookingId) {
    throw new ApiError(400, "Thi\u1EBFu tham s\u1ED1 bookingId ho\u1EB7c currentUserId");
  }
  const updated = await client.unsafe(
    `
    UPDATE booking_messages
    SET is_read = true
    WHERE booking_id = $1::uuid AND sender_id != $2::uuid AND is_read = false
    RETURNING id
    `,
    [bookingId, currentUserId]
  );
  if (updated.length > 0) {
    await triggerMessagesRead(bookingId, currentUserId);
  }
  return {
    success: true,
    updatedCount: updated.length,
    message: "\u0110\xE3 \u0111\xE1nh d\u1EA5u \u0111\u1ECDc tin nh\u1EAFn th\xE0nh c\xF4ng"
  };
}
async function getUserChatConversations(userId) {
  if (!userId) {
    throw new ApiError(401, "Y\xEAu c\u1EA7u \u0111\u0103ng nh\u1EADp");
  }
  const rows = await client.unsafe(
    `
    SELECT 
      b.id as booking_id,
      b.booking_code,
      b.status as booking_status,
      b.created_at as booking_created_at,
      cu.id as customer_id,
      cu.full_name as customer_name,
      cu.avatar_url as customer_avatar,
      du.id as driver_user_id,
      du.full_name as driver_name,
      du.avatar_url as driver_avatar,
      dp.license_plate,
      vt.name as vehicle_type_name,
      last_msg.content as last_message_content,
      last_msg.message_type as last_message_type,
      last_msg.created_at as last_message_time,
      COALESCE(unread.unread_count, 0) as unread_count
    FROM bookings b
    JOIN users cu ON cu.id = b.customer_id
    LEFT JOIN driver_profiles dp ON dp.id = b.driver_id
    LEFT JOIN users du ON du.id = dp.user_id
    LEFT JOIN vehicle_types vt ON vt.id = b.vehicle_type_id
    LEFT JOIN LATERAL (
      SELECT content, message_type, created_at
      FROM booking_messages
      WHERE booking_id = b.id
      ORDER BY created_at DESC
      LIMIT 1
    ) last_msg ON true
    LEFT JOIN LATERAL (
      SELECT count(*) as unread_count
      FROM booking_messages
      WHERE booking_id = b.id AND sender_id != $1::uuid AND is_read = false
    ) unread ON true
    WHERE (b.customer_id = $1::uuid OR dp.user_id = $1::uuid)
    ORDER BY COALESCE(last_msg.created_at, b.created_at) DESC
    LIMIT 30
    `,
    [userId]
  );
  return rows.map((r) => {
    const isCustomer = r.customer_id === userId;
    const partner = isCustomer ? {
      name: r.driver_name || "T\xE0i x\u1EBF \u0111ang nh\u1EADn chuy\u1EBFn",
      avatarUrl: r.driver_avatar,
      role: "DRIVER",
      licensePlate: r.license_plate
    } : {
      name: r.customer_name,
      avatarUrl: r.customer_avatar,
      role: "CUSTOMER",
      licensePlate: null
    };
    return {
      bookingId: r.booking_id,
      bookingCode: r.booking_code,
      bookingStatus: r.booking_status,
      partner,
      vehicleTypeName: r.vehicle_type_name,
      lastMessage: r.last_message_content ? {
        content: r.last_message_content,
        type: r.last_message_type,
        time: r.last_message_time
      } : null,
      unreadCount: Number(r.unread_count || 0)
    };
  });
}

// src/api/routes/chat.ts
var router10 = Router10();
router10.use(requireAuth);
router10.post("/send", async (req, res, next) => {
  try {
    const { bookingId, content, messageType, mediaUrl } = req.body;
    const result = await sendChatMessage({
      bookingId,
      senderUserId: req.user.userId,
      content,
      messageType,
      mediaUrl
    });
    res.json({
      success: true,
      message: "G\u1EEDi tin nh\u1EAFn th\xE0nh c\xF4ng",
      data: result
    });
  } catch (err) {
    next(err);
  }
});
router10.get("/conversations", async (req, res, next) => {
  try {
    const conversations = await getUserChatConversations(req.user.userId);
    res.json({
      success: true,
      count: conversations.length,
      data: conversations
    });
  } catch (err) {
    next(err);
  }
});
router10.get("/:bookingId/messages", async (req, res, next) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const result = await getBookingChatMessages(
      req.params.bookingId,
      req.user.userId,
      { page, limit }
    );
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});
router10.patch("/:bookingId/read", async (req, res, next) => {
  try {
    const result = await markBookingChatRead(
      req.params.bookingId,
      req.user.userId
    );
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});
var chat_default = router10;

// src/api/routes/calls.ts
import { Router as Router11 } from "express";

// src/lib/stringeeService.ts
import jwt2 from "jsonwebtoken";
var STRINGEE_CONFIG = {
  apiKeySid: process.env.STRINGEE_API_KEY_SID || "SK_STRINGEE_DATXETAI_DEV_001",
  apiKeySecret: process.env.STRINGEE_API_KEY_SECRET || "STRINGEE_SECRET_KEY_DEV_2026_TRUCK_BOOKING",
  hotlineNumber: process.env.STRINGEE_HOTLINE_NUMBER || "1900-8888"
  // Số hiển thị đại diện giấu số
};
function generateStringeeClientToken(userId, expiresInSeconds = 3600 * 24) {
  if (!userId) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin userId \u0111\u1EC3 c\u1EA5p Stringee Token");
  }
  const now = Math.floor(Date.now() / 1e3);
  const exp = now + expiresInSeconds;
  const header = {
    alg: "HS256",
    typ: "JWT",
    cty: "stringee-api;v=1"
  };
  const payload = {
    jti: `${STRINGEE_CONFIG.apiKeySid}_${now}_${Math.floor(1e3 + Math.random() * 9e3)}`,
    iss: STRINGEE_CONFIG.apiKeySid,
    exp,
    userId
  };
  return jwt2.sign(payload, STRINGEE_CONFIG.apiKeySecret, {
    algorithm: "HS256",
    header
  });
}
async function authorizeTripCall(dto) {
  const { bookingId, callerUserId } = dto;
  if (!callerUserId) {
    throw new ApiError(401, "Y\xEAu c\u1EA7u \u0111\u0103ng nh\u1EADp \u0111\u1EC3 th\u1EF1c hi\u1EC7n cu\u1ED9c g\u1ECDi");
  }
  if (!bookingId) {
    throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin bookingId");
  }
  const bookingRows = await client.unsafe(
    `
    SELECT 
      b.id,
      b.booking_code,
      b.status,
      b.customer_id,
      b.driver_id,
      dp.user_id as driver_user_id,
      cu.full_name as customer_name,
      cu.phone as customer_phone,
      du.full_name as driver_name,
      du.phone as driver_phone,
      dp.license_plate,
      vt.name as vehicle_type_name
    FROM bookings b
    JOIN users cu ON cu.id = b.customer_id
    LEFT JOIN driver_profiles dp ON dp.id = b.driver_id
    LEFT JOIN users du ON du.id = dp.user_id
    LEFT JOIN vehicle_types vt ON vt.id = b.vehicle_type_id
    WHERE b.id = $1::uuid
    LIMIT 1
    `,
    [bookingId]
  );
  if (bookingRows.length === 0) {
    throw new ApiError(404, "Kh\xF4ng t\xECm th\u1EA5y chuy\u1EBFn xe");
  }
  const booking = bookingRows[0];
  const allowedStatuses = [
    "SEARCHING",
    "ACCEPTED",
    "ARRIVED_AT_PICKUP",
    "IN_TRANSIT"
  ];
  if (!allowedStatuses.includes(booking.status)) {
    throw new ApiError(
      400,
      `Kh\xF4ng th\u1EC3 th\u1EF1c hi\u1EC7n cu\u1ED9c g\u1ECDi v\xEC chuy\u1EBFn xe \u0111\xE3 ${booking.status === "COMPLETED" ? "ho\xE0n th\xE0nh" : "b\u1ECB h\u1EE7y"}.`,
      "TRIP_NOT_CALLABLE"
    );
  }
  let callerRole;
  let calleeRole;
  let calleeUserId;
  let calleeName;
  let calleeAvatar = null;
  if (callerUserId === booking.customer_id) {
    callerRole = "CUSTOMER";
    calleeRole = "DRIVER";
    if (!booking.driver_user_id) {
      throw new ApiError(
        400,
        "Chuy\u1EBFn xe ch\u01B0a c\xF3 t\xE0i x\u1EBF ti\u1EBFp nh\u1EADn. Vui l\xF2ng ch\u1EDD t\xE0i x\u1EBF nh\u1EADn cu\u1ED1c \u0111\u1EC3 li\xEAn l\u1EA1c.",
        "DRIVER_NOT_ASSIGNED"
      );
    }
    calleeUserId = booking.driver_user_id;
    calleeName = booking.driver_name || "T\xE0i x\u1EBF";
  } else if (callerUserId === booking.driver_user_id) {
    callerRole = "DRIVER";
    calleeRole = "CUSTOMER";
    calleeUserId = booking.customer_id;
    calleeName = booking.customer_name || "Kh\xE1ch h\xE0ng";
  } else {
    throw new ApiError(
      403,
      "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n g\u1ECDi \u0111i\u1EC7n trong chuy\u1EBFn xe n\xE0y (Ch\u1EC9 Kh\xE1ch h\xE0ng v\xE0 T\xE0i x\u1EBF trong chuy\u1EBFn m\u1EDBi \u0111\u01B0\u1EE3c ph\xE9p li\xEAn l\u1EA1c)"
    );
  }
  const stringeeCallId = `CALL_${booking.booking_code}_${Date.now()}`;
  const insertedCall = await client.unsafe(
    `
    INSERT INTO call_logs (
      booking_id,
      caller_id,
      receiver_id,
      stringee_call_id,
      call_status,
      duration_seconds,
      created_at
    ) VALUES (
      $1::uuid,
      $2::uuid,
      $3::uuid,
      $4,
      'STARTED',
      0,
      NOW()
    )
    RETURNING id, booking_id, caller_id, receiver_id, stringee_call_id, call_status, created_at
    `,
    [bookingId, callerUserId, calleeUserId, stringeeCallId]
  );
  const clientToken = generateStringeeClientToken(callerUserId);
  return {
    callLogId: insertedCall[0].id,
    stringeeCallId,
    bookingId: booking.id,
    bookingCode: booking.booking_code,
    tripStatus: booking.status,
    clientToken,
    caller: {
      userId: callerUserId,
      role: callerRole
    },
    callee: {
      userId: calleeUserId,
      role: calleeRole,
      name: calleeName,
      phone: calleeRole === "DRIVER" ? booking.driver_phone || "0903124486" : booking.customer_phone || "0918234567",
      licensePlate: calleeRole === "DRIVER" ? booking.license_plate : null,
      vehicleType: calleeRole === "DRIVER" ? booking.vehicle_type_name : null,
      // SỐ ĐIỆN THOẠI THẬT ĐƯỢC GIẤU HOÀN TOÀN:
      maskedDisplayNumber: STRINGEE_CONFIG.hotlineNumber
    },
    message: "C\u1EA5p ph\xE9p cu\u1ED9c g\u1ECDi gi\u1EA5u s\u1ED1 th\xE0nh c\xF4ng"
  };
}
function generateAnswerUrlScco(params) {
  const { from, to, customData } = params;
  return [
    {
      action: "record",
      eventUrl: `${process.env.API_BASE_URL || "http://localhost:3000"}/api/v1/calls/events`,
      format: "mp3"
    },
    {
      action: "connect",
      from: {
        type: "internal",
        number: from,
        alias: `Hotline ${STRINGEE_CONFIG.hotlineNumber}`
      },
      to: {
        type: "internal",
        number: to,
        alias: `Ng\u01B0\u1EDDi d\xF9ng ${to.slice(0, 8)}`
      },
      customData: customData || "{}"
    }
  ];
}
async function processStringeeEvent(payload) {
  const callId = payload.call_id || payload.stringee_call_id;
  const event = String(payload.event || payload.call_status || "").toLowerCase();
  const duration = payload.duration || payload.duration_seconds || 0;
  const recordUrl = payload.record_url || null;
  let normalizedStatus = "STARTED";
  if (event.includes("ringing")) normalizedStatus = "RINGING";
  else if (event.includes("answered") || event === "in_call")
    normalizedStatus = "ANSWERED";
  else if (event.includes("ended") || event.includes("completed"))
    normalizedStatus = "ENDED";
  else if (event.includes("busy")) normalizedStatus = "BUSY";
  else if (event.includes("no_answer") || event.includes("timeout"))
    normalizedStatus = "MISSED";
  else if (event.includes("failed") || event.includes("rejected"))
    normalizedStatus = "FAILED";
  if (callId) {
    await client.unsafe(
      `
      UPDATE call_logs
      SET 
        call_status = $1,
        duration_seconds = CASE WHEN $2 > 0 THEN $2 ELSE duration_seconds END,
        record_url = COALESCE($3, record_url)
      WHERE stringee_call_id = $4
      `,
      [normalizedStatus, Number(duration), recordUrl, callId]
    );
  }
  return {
    success: true,
    callId,
    status: normalizedStatus,
    duration
  };
}
async function getTripCallLogs(bookingId, currentUserId) {
  if (!currentUserId || !bookingId) {
    throw new ApiError(400, "Thi\u1EBFu tham s\u1ED1 bookingId ho\u1EB7c currentUserId");
  }
  const rows = await client.unsafe(
    `
    SELECT 
      cl.id,
      cl.booking_id,
      cl.caller_id,
      cl.receiver_id,
      cl.stringee_call_id,
      cl.call_status,
      cl.duration_seconds,
      cl.record_url,
      cl.created_at,
      u_caller.full_name as caller_name,
      u_receiver.full_name as receiver_name
    FROM call_logs cl
    JOIN users u_caller ON u_caller.id = cl.caller_id
    JOIN users u_receiver ON u_receiver.id = cl.receiver_id
    WHERE cl.booking_id = $1::uuid
    ORDER BY cl.created_at DESC
    `,
    [bookingId]
  );
  return rows.map((r) => ({
    id: r.id,
    bookingId: r.booking_id,
    callerId: r.caller_id,
    callerName: r.caller_name,
    receiverId: r.receiver_id,
    receiverName: r.receiver_name,
    stringeeCallId: r.stringee_call_id,
    callStatus: r.call_status,
    durationSeconds: r.duration_seconds,
    recordUrl: r.record_url,
    createdAt: r.created_at,
    isCaller: r.caller_id === currentUserId
  }));
}
async function getUserCallHistory(userId, limit = 20) {
  if (!userId) {
    throw new ApiError(401, "Y\xEAu c\u1EA7u \u0111\u0103ng nh\u1EADp");
  }
  const rows = await client.unsafe(
    `
    SELECT 
      cl.id,
      cl.booking_id,
      b.booking_code,
      cl.caller_id,
      cl.receiver_id,
      cl.call_status,
      cl.duration_seconds,
      cl.created_at,
      u_caller.full_name as caller_name,
      u_receiver.full_name as receiver_name
    FROM call_logs cl
    JOIN bookings b ON b.id = cl.booking_id
    JOIN users u_caller ON u_caller.id = cl.caller_id
    JOIN users u_receiver ON u_receiver.id = cl.receiver_id
    WHERE cl.caller_id = $1::uuid OR cl.receiver_id = $1::uuid
    ORDER BY cl.created_at DESC
    LIMIT $2
    `,
    [userId, limit]
  );
  return rows.map((r) => ({
    id: r.id,
    bookingId: r.booking_id,
    bookingCode: r.booking_code,
    isIncoming: r.receiver_id === userId,
    partnerName: r.caller_id === userId ? r.receiver_name : r.caller_name,
    callStatus: r.call_status,
    durationSeconds: r.duration_seconds,
    createdAt: r.created_at
  }));
}

// src/api/routes/calls.ts
var router11 = Router11();
router11.get("/token", requireAuth, (req, res, next) => {
  try {
    const token = generateStringeeClientToken(req.user.userId);
    res.json({
      success: true,
      data: {
        userId: req.user.userId,
        clientToken: token,
        expiresInSeconds: 3600 * 24
      }
    });
  } catch (err) {
    next(err);
  }
});
router11.post("/authorize", requireAuth, async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    const result = await authorizeTripCall({
      bookingId,
      callerUserId: req.user.userId
    });
    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (err) {
    next(err);
  }
});
router11.all("/answer-url", (req, res) => {
  try {
    const from = String(req.query.from || req.body?.from || "");
    const to = String(req.query.to || req.body?.to || "");
    const customData = req.query.customData || req.body?.customData;
    const scco = generateAnswerUrlScco({
      from,
      to,
      customData: customData ? String(customData) : void 0
    });
    res.json(scco);
  } catch (err) {
    console.error("[Stringee Answer URL Error]:", err.message);
    res.status(500).json([]);
  }
});
router11.post("/events", async (req, res) => {
  try {
    const result = await processStringeeEvent(req.body);
    res.json(result);
  } catch (err) {
    console.error("[Stringee Event Error]:", err.message);
    res.status(500).json({ success: false });
  }
});
router11.get(
  "/trip/:bookingId",
  requireAuth,
  async (req, res, next) => {
    try {
      const logs = await getTripCallLogs(
        req.params.bookingId,
        req.user.userId
      );
      res.json({
        success: true,
        count: logs.length,
        data: logs
      });
    } catch (err) {
      next(err);
    }
  }
);
router11.get("/history", requireAuth, async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const logs = await getUserCallHistory(req.user.userId, limit);
    res.json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (err) {
    next(err);
  }
});
var calls_default = router11;

// src/api/routes/accounting.ts
import { Router as Router12 } from "express";

// src/lib/accountingService.ts
import ExcelJS from "exceljs";
function resolveDateRange(startDate, endDate) {
  const end = endDate ? new Date(endDate) : /* @__PURE__ */ new Date();
  if (!endDate) {
    end.setHours(23, 59, 59, 999);
  }
  const start = startDate ? new Date(startDate) : /* @__PURE__ */ new Date();
  if (!startDate) {
    start.setDate(end.getDate() - 30);
    start.setHours(0, 0, 0, 0);
  }
  return {
    startStr: start.toISOString(),
    endStr: end.toISOString(),
    displayStart: start.toISOString().split("T")[0],
    displayEnd: end.toISOString().split("T")[0]
  };
}
async function getAccountingDashboard(filters = {}) {
  const { startStr, endStr, displayStart, displayEnd } = resolveDateRange(
    filters.startDate,
    filters.endDate
  );
  const tripCountRows = await client`
    SELECT
      COUNT(*)::int AS total_trips,
      COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::int AS completed_trips,
      COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END)::int AS cancelled_trips,
      COUNT(CASE WHEN status IN ('ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT') THEN 1 END)::int AS active_trips,
      COUNT(CASE WHEN status IN ('PENDING', 'SEARCHING') THEN 1 END)::int AS pending_trips,
      COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total_price ELSE 0 END), 0)::float AS gross_revenue,
      COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN driver_commission ELSE 0 END), 0)::float AS commission_calc,
      COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN (total_price - driver_commission) ELSE 0 END), 0)::float AS driver_earnings,
      COALESCE(AVG(CASE WHEN status = 'COMPLETED' THEN distance_km END), 0)::float AS avg_distance
    FROM bookings
    WHERE created_at >= ${startStr}::timestamptz 
      AND created_at <= ${endStr}::timestamptz
      ${filters.paymentMethod ? client`AND payment_method = ${filters.paymentMethod}` : client``}
      ${filters.vehicleTypeId ? client`AND vehicle_type_id = ${filters.vehicleTypeId}` : client``}
      ${filters.driverId ? client`AND driver_id = ${filters.driverId}` : client``}
  `;
  const tripCounts = tripCountRows[0] || {
    total_trips: 0,
    completed_trips: 0,
    cancelled_trips: 0,
    active_trips: 0,
    pending_trips: 0,
    gross_revenue: 0,
    commission_calc: 0,
    driver_earnings: 0,
    avg_distance: 0
  };
  const totalTrips = Number(tripCounts.total_trips) || 0;
  const completedTrips = Number(tripCounts.completed_trips) || 0;
  const cancelledTrips = Number(tripCounts.cancelled_trips) || 0;
  const activeTrips = Number(tripCounts.active_trips) || 0;
  const pendingTrips = Number(tripCounts.pending_trips) || 0;
  const grossRevenue = Number(tripCounts.gross_revenue) || 0;
  const platformCommission = Number(tripCounts.commission_calc) || 0;
  const driverNetEarnings = Number(tripCounts.driver_earnings) || 0;
  const averageDistanceKm = Math.round((Number(tripCounts.avg_distance) || 0) * 10) / 10;
  const completionRate = totalTrips > 0 ? Math.round(completedTrips / totalTrips * 1e3) / 10 : 0;
  const averageTripValue = completedTrips > 0 ? Math.round(grossRevenue / completedTrips) : 0;
  const paymentRows = await client`
    SELECT
      payment_method,
      COUNT(*)::int AS trips,
      COALESCE(SUM(total_price), 0)::float AS revenue,
      COALESCE(SUM(driver_commission), 0)::float AS commission
    FROM bookings
    WHERE status = 'COMPLETED'
      AND created_at >= ${startStr}::timestamptz 
      AND created_at <= ${endStr}::timestamptz
      ${filters.vehicleTypeId ? client`AND vehicle_type_id = ${filters.vehicleTypeId}` : client``}
      ${filters.driverId ? client`AND driver_id = ${filters.driverId}` : client``}
    GROUP BY payment_method
    ORDER BY revenue DESC
  `;
  const byPaymentMethod = paymentRows.map((r) => {
    const rev = Number(r.revenue) || 0;
    return {
      method: r.payment_method,
      totalTrips: Number(r.trips) || 0,
      totalRevenue: rev,
      commission: Number(r.commission) || 0,
      percentage: grossRevenue > 0 ? Math.round(rev / grossRevenue * 1e3) / 10 : 0
    };
  });
  const vehicleRows = await client`
    SELECT
      vt.id AS vehicle_type_id,
      vt.code AS vehicle_code,
      vt.name AS vehicle_name,
      COUNT(b.id)::int AS completed_trips,
      COALESCE(SUM(b.total_price), 0)::float AS revenue
    FROM vehicle_types vt
    LEFT JOIN bookings b ON b.vehicle_type_id = vt.id 
      AND b.status = 'COMPLETED'
      AND b.created_at >= ${startStr}::timestamptz 
      AND b.created_at <= ${endStr}::timestamptz
      ${filters.paymentMethod ? client`AND b.payment_method = ${filters.paymentMethod}` : client``}
      ${filters.driverId ? client`AND b.driver_id = ${filters.driverId}` : client``}
    GROUP BY vt.id, vt.code, vt.name
    ORDER BY revenue DESC
  `;
  const byVehicleType = vehicleRows.map((r) => {
    const rev = Number(r.revenue) || 0;
    return {
      vehicleTypeId: r.vehicle_type_id,
      vehicleCode: r.vehicle_code,
      vehicleName: r.vehicle_name,
      completedTrips: Number(r.completed_trips) || 0,
      revenue: rev,
      percentage: grossRevenue > 0 ? Math.round(rev / grossRevenue * 1e3) / 10 : 0
    };
  });
  const dailyRows = await client`
    SELECT
      TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS trip_date,
      COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::int AS completed_trips,
      COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END)::int AS cancelled_trips,
      COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total_price ELSE 0 END), 0)::float AS revenue,
      COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN driver_commission ELSE 0 END), 0)::float AS commission
    FROM bookings
    WHERE created_at >= ${startStr}::timestamptz 
      AND created_at <= ${endStr}::timestamptz
      ${filters.paymentMethod ? client`AND payment_method = ${filters.paymentMethod}` : client``}
      ${filters.vehicleTypeId ? client`AND vehicle_type_id = ${filters.vehicleTypeId}` : client``}
    GROUP BY DATE_TRUNC('day', created_at)
    ORDER BY DATE_TRUNC('day', created_at) ASC
  `;
  const dailyTrend = dailyRows.map((r) => ({
    date: r.trip_date,
    completedTrips: Number(r.completed_trips) || 0,
    cancelledTrips: Number(r.cancelled_trips) || 0,
    revenue: Number(r.revenue) || 0,
    commission: Number(r.commission) || 0
  }));
  const topDriverRows = await client`
    SELECT
      dp.id AS driver_id,
      u.full_name AS driver_name,
      u.phone AS driver_phone,
      dp.license_plate,
      dp.rating_avg,
      COUNT(b.id)::int AS completed_trips,
      COALESCE(SUM(b.total_price), 0)::float AS gross_revenue,
      COALESCE(SUM(b.total_price - b.driver_commission), 0)::float AS driver_earnings,
      COALESCE(SUM(b.driver_commission), 0)::float AS commission_paid
    FROM driver_profiles dp
    JOIN users u ON dp.user_id = u.id
    LEFT JOIN bookings b ON b.driver_id = dp.id 
      AND b.status = 'COMPLETED'
      AND b.created_at >= ${startStr}::timestamptz 
      AND b.created_at <= ${endStr}::timestamptz
    GROUP BY dp.id, u.full_name, u.phone, dp.license_plate, dp.rating_avg
    HAVING COUNT(b.id) > 0
    ORDER BY gross_revenue DESC
    LIMIT 10
  `;
  const topDrivers = topDriverRows.map((r) => ({
    driverId: r.driver_id,
    driverName: r.driver_name || "T\xE0i x\u1EBF",
    driverPhone: r.driver_phone,
    licensePlate: r.license_plate || "Ch\u01B0a c\u1EADp nh\u1EADt",
    ratingAvg: Number(r.rating_avg || 5),
    completedTrips: Number(r.completed_trips) || 0,
    grossRevenue: Number(r.gross_revenue) || 0,
    driverEarnings: Number(r.driver_earnings) || 0,
    commissionPaid: Number(r.commission_paid) || 0
  }));
  const walletRows = await client`
    SELECT
      COALESCE(SUM(w.balance), 0)::float AS total_balance
    FROM wallets w
    JOIN users u ON w.user_id = u.id
    WHERE u.role = 'DRIVER'
  `;
  const walletTxRows = await client`
    SELECT
      COALESCE(SUM(CASE WHEN type IN ('TOPUP', 'VNPAY_TOPUP', 'MOMO_TOPUP') THEN amount ELSE 0 END), 0)::float AS total_topup,
      COALESCE(SUM(CASE WHEN type = 'COMMISSION_DEDUCTION' THEN ABS(amount) ELSE 0 END), 0)::float AS total_commission
    FROM wallet_transactions
    WHERE created_at >= ${startStr}::timestamptz 
      AND created_at <= ${endStr}::timestamptz
  `;
  const walletStats = {
    totalDriverBalance: Number(walletRows[0]?.total_balance) || 0,
    totalTopupInPeriod: Number(walletTxRows[0]?.total_topup) || 0,
    totalCommissionDeductedInPeriod: Number(walletTxRows[0]?.total_commission) || 0
  };
  return {
    timeRange: {
      startDate: displayStart,
      endDate: displayEnd
    },
    summary: {
      grossRevenue,
      platformCommission,
      driverNetEarnings,
      totalTrips,
      completedTrips,
      cancelledTrips,
      activeTrips,
      pendingTrips,
      completionRate,
      averageTripValue,
      averageDistanceKm
    },
    byPaymentMethod,
    byVehicleType,
    dailyTrend,
    topDrivers,
    walletStats
  };
}
async function exportAccountingExcel(filters = {}) {
  const { startStr, endStr, displayStart, displayEnd } = resolveDateRange(
    filters.startDate,
    filters.endDate
  );
  const dashboardData = await getAccountingDashboard(filters);
  const tripDetails = await client`
    SELECT
      b.id,
      b.booking_code,
      b.created_at,
      b.updated_at,
      b.status,
      b.payment_method,
      b.payment_status,
      b.distance_km::float,
      b.base_price::float,
      b.surcharge_price::float,
      b.total_price::float,
      b.driver_commission::float AS platform_commission,
      (b.total_price - b.driver_commission)::float AS driver_earnings,
      b.origin_address,
      b.destination_address,
      cu.full_name AS customer_name,
      cu.phone AS customer_phone,
      du.full_name AS driver_name,
      du.phone AS driver_phone,
      dp.license_plate,
      vt.name AS vehicle_name
    FROM bookings b
    JOIN users cu ON b.customer_id = cu.id
    LEFT JOIN driver_profiles dp ON b.driver_id = dp.id
    LEFT JOIN users du ON dp.user_id = du.id
    LEFT JOIN vehicle_types vt ON b.vehicle_type_id = vt.id
    WHERE b.created_at >= ${startStr}::timestamptz 
      AND b.created_at <= ${endStr}::timestamptz
      ${filters.status ? client`AND b.status = ${filters.status}` : client``}
      ${filters.paymentMethod ? client`AND b.payment_method = ${filters.paymentMethod}` : client``}
      ${filters.vehicleTypeId ? client`AND b.vehicle_type_id = ${filters.vehicleTypeId}` : client``}
    ORDER BY b.created_at DESC
  `;
  const walletTransactions2 = await client`
    SELECT
      wt.id,
      wt.type,
      wt.amount::float,
      wt.balance_before::float,
      wt.balance_after::float,
      wt.description,
      wt.reference_code,
      wt.created_at,
      u.full_name AS user_name,
      u.phone AS user_phone,
      b.booking_code
    FROM wallet_transactions wt
    JOIN wallets w ON wt.wallet_id = w.id
    JOIN users u ON w.user_id = u.id
    LEFT JOIN bookings b ON wt.booking_id = b.id
    WHERE wt.created_at >= ${startStr}::timestamptz 
      AND wt.created_at <= ${endStr}::timestamptz
    ORDER BY wt.created_at DESC
    LIMIT 2000
  `;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "H\u1EC7 th\u1ED1ng App \u0110\u1EB7t Xe T\u1EA3i";
  workbook.created = /* @__PURE__ */ new Date();
  const navyHeaderFill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A8A" }
    // Dark Navy Blue
  };
  const goldHeaderFill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD97706" }
    // Amber/Gold
  };
  const headerFont = {
    name: "Arial",
    size: 11,
    bold: true,
    color: { argb: "FFFFFFFF" }
  };
  const thinBorder = {
    top: { style: "thin", color: { argb: "FFD1D5DB" } },
    left: { style: "thin", color: { argb: "FFD1D5DB" } },
    bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
    right: { style: "thin", color: { argb: "FFD1D5DB" } }
  };
  const sheet1 = workbook.addWorksheet("T\u1ED5ng quan Doanh thu", {
    views: [{ showGridLines: true }]
  });
  sheet1.mergeCells("A2:F2");
  const titleCell = sheet1.getCell("A2");
  titleCell.value = "B\xC1O C\xC1O K\u1EBE TO\xC1N & DOANH THU H\u1EC6 TH\u1ED0NG V\u1EACN T\u1EA2I";
  titleCell.font = {
    name: "Arial",
    size: 16,
    bold: true,
    color: { argb: "FF1E3A8A" }
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet1.getRow(2).height = 32;
  sheet1.mergeCells("A3:F3");
  const subCell = sheet1.getCell("A3");
  subCell.value = `K\u1EF3 b\xE1o c\xE1o: T\u1EEB ng\xE0y ${displayStart} \u0111\u1EBFn ng\xE0y ${displayEnd} | Xu\u1EA5t l\xFAc: ${(/* @__PURE__ */ new Date()).toLocaleString("vi-VN")}`;
  subCell.font = {
    name: "Arial",
    size: 11,
    italic: true,
    color: { argb: "FF4B5563" }
  };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet1.getRow(3).height = 20;
  sheet1.getCell("A5").value = "1. CH\u1EC8 S\u1ED0 T\xC0I CH\xCDNH T\u1ED4NG QUAN";
  sheet1.getCell("A5").font = {
    name: "Arial",
    size: 12,
    bold: true,
    color: { argb: "FF111827" }
  };
  sheet1.getRow(6).values = [
    "STT",
    "Ch\u1EC9 s\u1ED1 t\xE0i ch\xEDnh",
    "Gi\xE1 tr\u1ECB",
    "\u0110\u01A1n v\u1ECB",
    "Ghi ch\xFA"
  ];
  sheet1.getRow(6).height = 24;
  for (let c = 1; c <= 5; c++) {
    const cell = sheet1.getRow(6).getCell(c);
    cell.fill = navyHeaderFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }
  const kpiData = [
    [
      1,
      "T\u1ED5ng Doanh thu G\u1ED9p (Gross Revenue)",
      dashboardData.summary.grossRevenue,
      "VN\u0110",
      "T\xEDnh tr\xEAn c\xE1c chuy\u1EBFn ho\xE0n th\xE0nh"
    ],
    [
      2,
      "T\u1ED5ng Hoa h\u1ED3ng S\xE0n thu \u0111\u01B0\u1EE3c (Platform Commission 20%)",
      dashboardData.summary.platformCommission,
      "VN\u0110",
      "Doanh thu th\u1EF1c t\u1EBF c\u1EE7a n\u1EC1n t\u1EA3ng"
    ],
    [
      3,
      "T\u1ED5ng Thu nh\u1EADp T\xE0i x\u1EBF \u0111\u1ED1i t\xE1c (Driver Net 80%)",
      dashboardData.summary.driverNetEarnings,
      "VN\u0110",
      "Chi tr\u1EA3 cho \u0111\u1ED1i t\xE1c t\xE0i x\u1EBF"
    ],
    [
      4,
      "T\u1ED5ng s\u1ED1 chuy\u1EBFn xe ph\xE1t sinh",
      dashboardData.summary.totalTrips,
      "Chuy\u1EBFn",
      "Bao g\u1ED3m t\u1EA5t c\u1EA3 tr\u1EA1ng th\xE1i"
    ],
    [
      5,
      "S\u1ED1 chuy\u1EBFn xe ho\xE0n th\xE0nh",
      dashboardData.summary.completedTrips,
      "Chuy\u1EBFn",
      "Ho\xE0n t\u1EA5t giao nh\u1EADn"
    ],
    [
      6,
      "S\u1ED1 chuy\u1EBFn xe b\u1ECB h\u1EE7y",
      dashboardData.summary.cancelledTrips,
      "Chuy\u1EBFn",
      "Kh\xE1ch ho\u1EB7c t\xE0i x\u1EBF h\u1EE7y"
    ],
    [
      7,
      "T\u1EF7 l\u1EC7 ho\xE0n th\xE0nh chuy\u1EBFn",
      dashboardData.summary.completionRate / 100,
      "%",
      "Completed / Total trips"
    ],
    [
      8,
      "Gi\xE1 tr\u1ECB trung b\xECnh m\u1ED7i chuy\u1EBFn (AOV)",
      dashboardData.summary.averageTripValue,
      "VN\u0110",
      "Gross / Completed trips"
    ],
    [
      9,
      "Kho\u1EA3ng c\xE1ch trung b\xECnh m\u1ED7i chuy\u1EBFn",
      dashboardData.summary.averageDistanceKm,
      "km",
      "Qu\xE3ng \u0111\u01B0\u1EDDng v\u1EADn chuy\u1EC3n"
    ],
    [
      10,
      "T\u1ED5ng s\u1ED1 d\u01B0 v\xED k\xFD qu\u1EF9 t\xE0i x\u1EBF hi\u1EC7n c\xF3",
      dashboardData.walletStats.totalDriverBalance,
      "VN\u0110",
      "Ti\u1EC1n c\u1ECDc trong v\xED t\xE0i x\u1EBF"
    ],
    [
      11,
      "T\u1ED5ng ti\u1EC1n t\xE0i x\u1EBF n\u1EA1p v\xED trong k\u1EF3",
      dashboardData.walletStats.totalTopupInPeriod,
      "VN\u0110",
      "Top-up qua MoMo, VNPay, Chuy\u1EC3n kho\u1EA3n"
    ],
    [
      12,
      "T\u1ED5ng hoa h\u1ED3ng \u0111\xE3 tr\u1EEB qua v\xED",
      dashboardData.walletStats.totalCommissionDeductedInPeriod,
      "VN\u0110",
      "Thu c\u1EA5n tr\u1EEB t\u1EF1 \u0111\u1ED9ng"
    ]
  ];
  let currentRow = 7;
  for (const row of kpiData) {
    const r = sheet1.getRow(currentRow);
    r.values = row;
    r.height = 20;
    r.getCell(1).alignment = { horizontal: "center" };
    r.getCell(2).alignment = { horizontal: "left" };
    r.getCell(3).alignment = { horizontal: "right" };
    r.getCell(4).alignment = { horizontal: "center" };
    r.getCell(5).alignment = { horizontal: "left" };
    if (row[3] === "VN\u0110") {
      r.getCell(3).numFmt = '#,##0 "\u20AB"';
    } else if (row[3] === "%") {
      r.getCell(3).numFmt = "0.0%";
    } else {
      r.getCell(3).numFmt = "#,##0";
    }
    for (let c = 1; c <= 5; c++) {
      r.getCell(c).border = thinBorder;
    }
    currentRow++;
  }
  currentRow += 2;
  sheet1.getCell(`A${currentRow}`).value = "2. PH\xC2N B\u1ED4 THEO PH\u01AF\u01A0NG TH\u1EE8C THANH TO\xC1N";
  sheet1.getCell(`A${currentRow}`).font = {
    name: "Arial",
    size: 12,
    bold: true,
    color: { argb: "FF111827" }
  };
  currentRow++;
  sheet1.getRow(currentRow).values = [
    "Ph\u01B0\u01A1ng th\u1EE9c thanh to\xE1n",
    "S\u1ED1 chuy\u1EBFn ho\xE0n th\xE0nh",
    "T\u1ED5ng doanh thu",
    "Hoa h\u1ED3ng s\xE0n 20%",
    "T\u1EF7 tr\u1ECDng (%)"
  ];
  sheet1.getRow(currentRow).height = 24;
  for (let c = 1; c <= 5; c++) {
    const cell = sheet1.getRow(currentRow).getCell(c);
    cell.fill = goldHeaderFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }
  currentRow++;
  for (const pm of dashboardData.byPaymentMethod) {
    const r = sheet1.getRow(currentRow);
    const methodNames = {
      CASH: "Ti\u1EC1n m\u1EB7t (CASH)",
      WALLET: "V\xED t\xE0i kho\u1EA3n (WALLET)",
      VNPAY: "C\u1ED5ng thanh to\xE1n VNPay",
      MOMO: "V\xED \u0111i\u1EC7n t\u1EED MoMo"
    };
    r.values = [
      methodNames[pm.method] || pm.method,
      pm.totalTrips,
      pm.totalRevenue,
      pm.commission,
      pm.percentage / 100
    ];
    r.height = 20;
    r.getCell(1).alignment = { horizontal: "left" };
    r.getCell(2).alignment = { horizontal: "right" };
    r.getCell(3).alignment = { horizontal: "right" };
    r.getCell(4).alignment = { horizontal: "right" };
    r.getCell(5).alignment = { horizontal: "right" };
    r.getCell(2).numFmt = "#,##0";
    r.getCell(3).numFmt = '#,##0 "\u20AB"';
    r.getCell(4).numFmt = '#,##0 "\u20AB"';
    r.getCell(5).numFmt = "0.0%";
    for (let c = 1; c <= 5; c++) {
      r.getCell(c).border = thinBorder;
    }
    currentRow++;
  }
  currentRow += 2;
  sheet1.getCell(`A${currentRow}`).value = "3. DOANH THU THEO T\u1EEANG LO\u1EA0I XE T\u1EA2I";
  sheet1.getCell(`A${currentRow}`).font = {
    name: "Arial",
    size: 12,
    bold: true,
    color: { argb: "FF111827" }
  };
  currentRow++;
  sheet1.getRow(currentRow).values = [
    "M\xE3 xe",
    "T\xEAn lo\u1EA1i xe t\u1EA3i",
    "S\u1ED1 chuy\u1EBFn ho\xE0n th\xE0nh",
    "Doanh thu \u0111\u1EA1t \u0111\u01B0\u1EE3c",
    "T\u1EF7 tr\u1ECDng \u0111\xF3ng g\xF3p"
  ];
  sheet1.getRow(currentRow).height = 24;
  for (let c = 1; c <= 5; c++) {
    const cell = sheet1.getRow(currentRow).getCell(c);
    cell.fill = navyHeaderFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }
  currentRow++;
  for (const vt of dashboardData.byVehicleType) {
    const r = sheet1.getRow(currentRow);
    r.values = [
      vt.vehicleCode,
      vt.vehicleName,
      vt.completedTrips,
      vt.revenue,
      vt.percentage / 100
    ];
    r.height = 20;
    r.getCell(1).alignment = { horizontal: "center" };
    r.getCell(2).alignment = { horizontal: "left" };
    r.getCell(3).alignment = { horizontal: "right" };
    r.getCell(4).alignment = { horizontal: "right" };
    r.getCell(5).alignment = { horizontal: "right" };
    r.getCell(3).numFmt = "#,##0";
    r.getCell(4).numFmt = '#,##0 "\u20AB"';
    r.getCell(5).numFmt = "0.0%";
    for (let c = 1; c <= 5; c++) {
      r.getCell(c).border = thinBorder;
    }
    currentRow++;
  }
  sheet1.getColumn(1).width = 18;
  sheet1.getColumn(2).width = 46;
  sheet1.getColumn(3).width = 24;
  sheet1.getColumn(4).width = 22;
  sheet1.getColumn(5).width = 35;
  sheet1.getColumn(6).width = 20;
  const sheet2 = workbook.addWorksheet("Danh s\xE1ch Chuy\u1EBFn xe", {
    views: [{ state: "frozen", ySplit: 3, showGridLines: true }]
  });
  sheet2.mergeCells("A1:U1");
  const s2Title = sheet2.getCell("A1");
  s2Title.value = `B\u1EA2NG K\xCA CHI TI\u1EBET CHUY\u1EBEN XE (${displayStart} \u0110\u1EBEN ${displayEnd})`;
  s2Title.font = {
    name: "Arial",
    size: 14,
    bold: true,
    color: { argb: "FF1E3A8A" }
  };
  s2Title.alignment = { horizontal: "center", vertical: "middle" };
  sheet2.getRow(1).height = 28;
  const s2Headers = [
    "STT",
    "M\xE3 chuy\u1EBFn",
    "Th\u1EDDi gian t\u1EA1o",
    "Tr\u1EA1ng th\xE1i chuy\u1EBFn",
    "T\xEAn kh\xE1ch h\xE0ng",
    "S\u0110T kh\xE1ch",
    "T\xE0i x\u1EBF nh\u1EADn",
    "S\u0110T t\xE0i x\u1EBF",
    "Bi\u1EC3n s\u1ED1 xe",
    "Lo\u1EA1i xe",
    "\u0110i\u1EC3m \u0111\xF3n (Origin)",
    "\u0110i\u1EC3m tr\u1EA3 (Destination)",
    "Kho\u1EA3ng c\xE1ch (km)",
    "C\u01B0\u1EDBc c\u01A1 b\u1EA3n (VN\u0110)",
    "Ph\u1EE5 ph\xED (VN\u0110)",
    "T\u1ED5ng ti\u1EC1n c\u01B0\u1EDBc (VN\u0110)",
    "Hoa h\u1ED3ng s\xE0n 20% (VN\u0110)",
    "T\xE0i x\u1EBF th\u1EF1c nh\u1EADn 80% (VN\u0110)",
    "Ph\u01B0\u01A1ng th\u1EE9c TT",
    "Tr\u1EA1ng th\xE1i TT"
  ];
  sheet2.getRow(3).values = s2Headers;
  sheet2.getRow(3).height = 26;
  for (let c = 1; c <= s2Headers.length; c++) {
    const cell = sheet2.getRow(3).getCell(c);
    cell.fill = navyHeaderFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }
  let tripRowIdx = 4;
  let totalGrossSum = 0;
  let totalCommSum = 0;
  let totalDriverSum = 0;
  for (let i = 0; i < tripDetails.length; i++) {
    const t = tripDetails[i];
    const row = sheet2.getRow(tripRowIdx);
    const gross = Number(t.total_price) || 0;
    const comm = Number(t.platform_commission) || 0;
    const driverEarn = Number(t.driver_earnings) || 0;
    if (t.status === "COMPLETED") {
      totalGrossSum += gross;
      totalCommSum += comm;
      totalDriverSum += driverEarn;
    }
    const createdAtStr = t.created_at ? new Date(t.created_at).toLocaleString("vi-VN") : "";
    row.values = [
      i + 1,
      t.booking_code,
      createdAtStr,
      t.status,
      t.customer_name || "Kh\xE1ch h\xE0ng",
      t.customer_phone,
      t.driver_name || "Ch\u01B0a c\xF3",
      t.driver_phone || "",
      t.license_plate || "",
      t.vehicle_name || "",
      t.origin_address,
      t.destination_address,
      Number(t.distance_km) || 0,
      Number(t.base_price) || 0,
      Number(t.surcharge_price) || 0,
      gross,
      comm,
      driverEarn,
      t.payment_method,
      t.payment_status
    ];
    row.height = 20;
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).alignment = { horizontal: "center" };
    row.getCell(3).alignment = { horizontal: "center" };
    row.getCell(4).alignment = { horizontal: "center" };
    row.getCell(6).alignment = { horizontal: "center" };
    row.getCell(8).alignment = { horizontal: "center" };
    row.getCell(9).alignment = { horizontal: "center" };
    row.getCell(13).alignment = { horizontal: "right" };
    row.getCell(14).alignment = { horizontal: "right" };
    row.getCell(15).alignment = { horizontal: "right" };
    row.getCell(16).alignment = { horizontal: "right" };
    row.getCell(17).alignment = { horizontal: "right" };
    row.getCell(18).alignment = { horizontal: "right" };
    row.getCell(19).alignment = { horizontal: "center" };
    row.getCell(20).alignment = { horizontal: "center" };
    row.getCell(13).numFmt = "0.0";
    row.getCell(14).numFmt = '#,##0 "\u20AB"';
    row.getCell(15).numFmt = '#,##0 "\u20AB"';
    row.getCell(16).numFmt = '#,##0 "\u20AB"';
    row.getCell(17).numFmt = '#,##0 "\u20AB"';
    row.getCell(18).numFmt = '#,##0 "\u20AB"';
    for (let c = 1; c <= s2Headers.length; c++) {
      row.getCell(c).border = thinBorder;
    }
    tripRowIdx++;
  }
  const totalRow = sheet2.getRow(tripRowIdx);
  totalRow.getCell(1).value = "";
  totalRow.getCell(2).value = "T\u1ED4NG C\u1ED8NG HO\xC0N TH\xC0NH";
  totalRow.getCell(16).value = totalGrossSum;
  totalRow.getCell(17).value = totalCommSum;
  totalRow.getCell(18).value = totalDriverSum;
  totalRow.height = 24;
  totalRow.font = { name: "Arial", size: 11, bold: true };
  totalRow.getCell(16).numFmt = '#,##0 "\u20AB"';
  totalRow.getCell(17).numFmt = '#,##0 "\u20AB"';
  totalRow.getCell(18).numFmt = '#,##0 "\u20AB"';
  for (let c = 1; c <= s2Headers.length; c++) {
    totalRow.getCell(c).border = thinBorder;
    totalRow.getCell(c).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF3F4F6" }
    };
  }
  sheet2.getColumn(1).width = 6;
  sheet2.getColumn(2).width = 16;
  sheet2.getColumn(3).width = 20;
  sheet2.getColumn(4).width = 16;
  sheet2.getColumn(5).width = 22;
  sheet2.getColumn(6).width = 14;
  sheet2.getColumn(7).width = 22;
  sheet2.getColumn(8).width = 14;
  sheet2.getColumn(9).width = 15;
  sheet2.getColumn(10).width = 16;
  sheet2.getColumn(11).width = 30;
  sheet2.getColumn(12).width = 30;
  sheet2.getColumn(13).width = 14;
  sheet2.getColumn(14).width = 16;
  sheet2.getColumn(15).width = 14;
  sheet2.getColumn(16).width = 18;
  sheet2.getColumn(17).width = 18;
  sheet2.getColumn(18).width = 18;
  sheet2.getColumn(19).width = 16;
  sheet2.getColumn(20).width = 16;
  const sheet3 = workbook.addWorksheet("Giao d\u1ECBch V\xED & C\u1ED5ng TT", {
    views: [{ state: "frozen", ySplit: 3, showGridLines: true }]
  });
  sheet3.mergeCells("A1:J1");
  const s3Title = sheet3.getCell("A1");
  s3Title.value = `NH\u1EACT K\xDD GIAO D\u1ECACH V\xCD & C\u1ED4NG THANH TO\xC1N (${displayStart} \u0110\u1EBEN ${displayEnd})`;
  s3Title.font = {
    name: "Arial",
    size: 14,
    bold: true,
    color: { argb: "FF1E3A8A" }
  };
  s3Title.alignment = { horizontal: "center", vertical: "middle" };
  sheet3.getRow(1).height = 28;
  const s3Headers = [
    "STT",
    "Th\u1EDDi gian",
    "T\xEAn ng\u01B0\u1EDDi d\xF9ng",
    "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i",
    "Lo\u1EA1i giao d\u1ECBch",
    "S\u1ED1 ti\u1EC1n (VN\u0110)",
    "S\u1ED1 d\u01B0 tr\u01B0\u1EDBc",
    "S\u1ED1 d\u01B0 sau",
    "M\xE3 cu\u1ED1c li\xEAn quan",
    "N\u1ED9i dung di\u1EC5n gi\u1EA3i"
  ];
  sheet3.getRow(3).values = s3Headers;
  sheet3.getRow(3).height = 26;
  for (let c = 1; c <= s3Headers.length; c++) {
    const cell = sheet3.getRow(3).getCell(c);
    cell.fill = navyHeaderFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }
  let txRowIdx = 4;
  for (let i = 0; i < walletTransactions2.length; i++) {
    const tx = walletTransactions2[i];
    const row = sheet3.getRow(txRowIdx);
    const createdAtStr = tx.created_at ? new Date(tx.created_at).toLocaleString("vi-VN") : "";
    row.values = [
      i + 1,
      createdAtStr,
      tx.user_name || "Ng\u01B0\u1EDDi d\xF9ng",
      tx.user_phone,
      tx.type,
      Number(tx.amount) || 0,
      Number(tx.balance_before) || 0,
      Number(tx.balance_after) || 0,
      tx.booking_code || "",
      tx.description || ""
    ];
    row.height = 20;
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).alignment = { horizontal: "center" };
    row.getCell(4).alignment = { horizontal: "center" };
    row.getCell(5).alignment = { horizontal: "center" };
    row.getCell(6).alignment = { horizontal: "right" };
    row.getCell(7).alignment = { horizontal: "right" };
    row.getCell(8).alignment = { horizontal: "right" };
    row.getCell(9).alignment = { horizontal: "center" };
    row.getCell(6).numFmt = '#,##0 "\u20AB"';
    row.getCell(7).numFmt = '#,##0 "\u20AB"';
    row.getCell(8).numFmt = '#,##0 "\u20AB"';
    for (let c = 1; c <= s3Headers.length; c++) {
      row.getCell(c).border = thinBorder;
    }
    txRowIdx++;
  }
  sheet3.getColumn(1).width = 6;
  sheet3.getColumn(2).width = 20;
  sheet3.getColumn(3).width = 22;
  sheet3.getColumn(4).width = 16;
  sheet3.getColumn(5).width = 22;
  sheet3.getColumn(6).width = 18;
  sheet3.getColumn(7).width = 18;
  sheet3.getColumn(8).width = 18;
  sheet3.getColumn(9).width = 18;
  sheet3.getColumn(10).width = 40;
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// src/api/routes/accounting.ts
var router12 = Router12();
router12.use(requireAuth, requireRoles(["ADMIN"]));
router12.get("/dashboard", async (req, res, next) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      paymentMethod: req.query.paymentMethod,
      vehicleTypeId: req.query.vehicleTypeId,
      driverId: req.query.driverId
    };
    const data = await getAccountingDashboard(filters);
    res.json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
});
router12.get("/export-excel", async (req, res, next) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      paymentMethod: req.query.paymentMethod,
      vehicleTypeId: req.query.vehicleTypeId,
      status: req.query.status
    };
    const excelBuffer = await exportAccountingExcel(filters);
    const dateTag = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const filename = `Bao_Cao_Ke_Toan_${dateTag}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", excelBuffer.length);
    res.send(excelBuffer);
  } catch (err) {
    next(err);
  }
});
var accounting_default = router12;

// src/api/routes/upload.ts
import { Router as Router13 } from "express";

// src/lib/upload.ts
import { v2 as cloudinary } from "cloudinary";
var ensureCloudinaryConfig = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
};
ensureCloudinaryConfig();
var generateCloudinarySignature = (folder = "avatars") => {
  ensureCloudinaryConfig();
  const timestamp2 = Math.round((/* @__PURE__ */ new Date()).getTime() / 1e3);
  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp: timestamp2,
      folder
    },
    process.env.CLOUDINARY_API_SECRET
  );
  return {
    timestamp: timestamp2,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder
  };
};
var uploadFileToServer = async (filePath, folder) => {
  try {
    ensureCloudinaryConfig();
    const result = await cloudinary.uploader.upload(filePath, { folder });
    return {
      url: result.secure_url,
      publicId: result.public_id
    };
  } catch (error) {
    console.error("L\u1ED7i khi upload l\xEAn Cloudinary:", error);
    throw new Error("Kh\xF4ng th\u1EC3 upload \u1EA3nh");
  }
};

// src/api/routes/upload.ts
var router13 = Router13();
router13.post("/signature", requireAuth, (req, res, next) => {
  try {
    const folder = req.body?.folder || "avatars";
    const allowedFolders = ["avatars", "licenses", "chat_images"];
    if (!allowedFolders.includes(folder)) {
      res.status(400).json({
        success: false,
        message: `Folder kh\xF4ng h\u1EE3p l\u1EC7. Ch\u1EC9 ch\u1EA5p nh\u1EADn: ${allowedFolders.join(", ")}`
      });
      return;
    }
    const signatureData = generateCloudinarySignature(folder);
    res.json({
      success: true,
      message: "T\u1EA1o ch\u1EEF k\xFD s\u1ED1 upload Cloudinary th\xE0nh c\xF4ng",
      data: signatureData
    });
  } catch (err) {
    next(err);
  }
});
router13.post("/server", requireAuth, async (req, res, next) => {
  try {
    const { filePath, folder = "avatars" } = req.body;
    if (!filePath) {
      res.status(400).json({
        success: false,
        message: "Thi\u1EBFu tham s\u1ED1 'filePath' (Chu\u1ED7i Base64 Data URI)"
      });
      return;
    }
    const isBase64DataUri = typeof filePath === "string" && (filePath.startsWith("data:image/") || filePath.startsWith("data:application/pdf;base64,"));
    if (!isBase64DataUri) {
      res.status(400).json({
        success: false,
        message: "D\u1EEF li\u1EC7u 'filePath' kh\xF4ng h\u1EE3p l\u1EC7. Ch\u1EC9 ch\u1EA5p nh\u1EADn chu\u1ED7i base64 Data URI (b\u1EAFt \u0111\u1EA7u b\u1EB1ng 'data:image/' ho\u1EB7c 'data:application/pdf;base64,')"
      });
      return;
    }
    const result = await uploadFileToServer(filePath, folder);
    res.json({
      success: true,
      message: "T\u1EA3i l\xEAn t\u1EC7p tin qua Server th\xE0nh c\xF4ng",
      data: result
    });
  } catch (err) {
    next(err);
  }
});
var upload_default = router13;

// src/api/routes/pusher.ts
import { Router as Router14 } from "express";
init_pusher();
var router14 = Router14();
router14.get("/events", requireAuth, (req, res) => {
  const channel = req.query.channel;
  const since = req.query.since ? parseInt(req.query.since) : void 0;
  const events = getRecentEvents(channel, since);
  return res.json({ success: true, data: events });
});
router14.post("/auth", requireAuth, async (req, res, next) => {
  try {
    const { socket_id, channel_name } = req.body;
    if (!socket_id || !channel_name) {
      throw new ApiError(400, "Thi\u1EBFu th\xF4ng tin socket_id ho\u1EB7c channel_name");
    }
    const userId = req.user.userId;
    const userRole = req.user.role;
    let isAuthorized = false;
    const isUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    if (channel_name.startsWith("private-driver-")) {
      const driverId = channel_name.replace("private-driver-", "");
      if (userRole === "ADMIN") {
        isAuthorized = true;
      } else if (!isUuid(driverId) || !isUuid(userId)) {
        isAuthorized = driverId === userId || driverId.includes("driver");
      } else {
        const drivers = await client.unsafe(
          `SELECT id FROM driver_profiles WHERE id = $1::uuid AND user_id = $2::uuid LIMIT 1`,
          [driverId, userId]
        );
        isAuthorized = drivers.length > 0;
      }
    } else if (channel_name.startsWith("private-trip-") || channel_name.startsWith("private-chat-")) {
      const bookingId = channel_name.replace("private-trip-", "").replace("private-chat-", "");
      if (userRole === "ADMIN") {
        isAuthorized = true;
      } else if (!isUuid(bookingId) || !isUuid(userId)) {
        isAuthorized = bookingId.includes("test") || bookingId.includes("mock");
      } else {
        const bookings2 = await client.unsafe(
          `
          SELECT b.id FROM bookings b
          LEFT JOIN driver_profiles dp ON dp.id = b.driver_id
          WHERE b.id = $1::uuid AND (b.customer_id = $2::uuid OR dp.user_id = $2::uuid)
          LIMIT 1
          `,
          [bookingId, userId]
        );
        isAuthorized = bookings2.length > 0;
      }
    } else if (channel_name.startsWith("private-user-")) {
      const targetUserId = channel_name.replace("private-user-", "");
      isAuthorized = targetUserId === userId || userRole === "ADMIN";
    } else if (channel_name === "private-admin") {
      isAuthorized = userRole === "ADMIN";
    } else {
      isAuthorized = true;
    }
    if (!isAuthorized) {
      throw new ApiError(403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n truy c\u1EADp k\xEAnh th\u1EDDi gian th\u1EF1c n\xE0y");
    }
    if (pusherServer) {
      const authResponse = pusherServer.authorizeChannel(socket_id, channel_name);
      return res.json(authResponse);
    }
    const mockAuth = `mock_key:${socket_id}`;
    return res.json({
      auth: mockAuth,
      channel_data: JSON.stringify({ user_id: userId })
    });
  } catch (err) {
    next(err);
  }
});
var pusher_default = router14;

// src/api/router.ts
var app = express();
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});
var mountRoutes = (prefix) => {
  app.use(`${prefix}/auth`, auth_default);
  app.use(`${prefix}/upload`, upload_default);
  app.use(`${prefix}/customer`, customer_default);
  app.use(`${prefix}/driver`, driver_default);
  app.use(`${prefix}/admin`, admin_default);
  app.use(`${prefix}/pricing`, pricing_default);
  app.use(`${prefix}/bookings`, booking_default);
  app.use(`${prefix}/payments`, payment_default);
  app.use(`${prefix}/chat`, chat_default);
  app.use(`${prefix}/calls`, calls_default);
  app.use(`${prefix}/accounting`, accounting_default);
  app.use(`${prefix}/pusher`, pusher_default);
};
mountRoutes("/api/v1");
mountRoutes("/api");
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} kh\xF4ng t\u1ED3n t\u1EA1i`
  });
});
app.use(errorHandler);
var router_default = app;

// src/api/serverless.ts
function handler(req, res) {
  return router_default(req, res);
}
export {
  handler as default
};

import { 
  pgTable, 
  uuid, 
  varchar, 
  text, 
  timestamp, 
  boolean, 
  decimal, 
  pgEnum,
  jsonb,
  geometry,
  index
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// --- ENUMS ---
export const userRoleEnum = pgEnum('user_role', ['CUSTOMER', 'DRIVER', 'ADMIN']);
export const accountStatusEnum = pgEnum('account_status', ['ACTIVE', 'BLOCKED', 'PENDING']);
export const kycStatusEnum = pgEnum('kyc_status', ['PENDING', 'APPROVED', 'REJECTED']);
export const bookingStatusEnum = pgEnum('booking_status', ['PENDING', 'SEARCHING', 'ACCEPTED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED']);
export const paymentMethodEnum = pgEnum('payment_method', ['CASH', 'WALLET', 'VNPAY', 'MOMO']);
export const paymentStatusEnum = pgEnum('payment_status', ['UNPAID', 'PAID', 'REFUNDED']);

// --- CORE TABLES ---

// 2.1 USERS
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  email: varchar('email', { length: 100 }).unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  fullName: varchar('full_name', { length: 100 }),
  avatarUrl: text('avatar_url'),
  role: userRoleEnum('role').notNull().default('CUSTOMER'),
  status: accountStatusEnum('status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// 2.2 VEHICLE_TYPES
export const vehicleTypes = pgTable('vehicle_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  payloadCapacityKg: decimal('payload_capacity_kg', { precision: 10, scale: 2 }).notNull(),
  dimensionsLxwxh: jsonb('dimensions_lxwxh'),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// 2.3 DRIVER_PROFILES
export const driverProfiles = pgTable('driver_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  vehicleTypeId: uuid('vehicle_type_id').references(() => vehicleTypes.id),
  licensePlate: varchar('license_plate', { length: 20 }).unique(),
  driverLicenseNo: varchar('driver_license_no', { length: 50 }).unique(),
  kycStatus: kycStatusEnum('kyc_status').default('PENDING'),
  ratingAvg: decimal('rating_avg', { precision: 3, scale: 2 }).default('5.00'),
  isOnline: boolean('is_online').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// 2.4 CUSTOMER_ADDRESSES
export const customerAddresses = pgTable('customer_addresses', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 100 }),
  addressText: text('address_text').notNull(),
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  contactName: varchar('contact_name', { length: 100 }),
  contactPhone: varchar('contact_phone', { length: 20 }),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// --- SPATIAL TABLES ---

// 3.1 DRIVER_LOCATIONS
export const driverLocations = pgTable('driver_locations', {
  driverId: uuid('driver_id').primaryKey().references(() => driverProfiles.id, { onDelete: 'cascade' }),
  locationPoint: geometry('location_point', { type: 'point', mode: 'xy', srid: 4326 }).notNull(),
  heading: decimal('heading', { precision: 5, scale: 2 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    locationPointIdx: index('idx_driver_locations_point').using('gist', table.locationPoint),
  };
});

// --- BOOKINGS & TRANSACTIONS ---

// 4.1 PRICING_RULES
export const pricingRules = pgTable('pricing_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  vehicleTypeId: uuid('vehicle_type_id').notNull().references(() => vehicleTypes.id),
  basePrice: decimal('base_price', { precision: 12, scale: 2 }).notNull(),
  baseDistanceKm: decimal('base_distance_km', { precision: 5, scale: 2 }).notNull(),
  pricePerKm: decimal('price_per_km', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// 4.2 BOOKINGS
export const bookings = pgTable('bookings', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookingCode: varchar('booking_code', { length: 50 }).notNull().unique(),
  customerId: uuid('customer_id').notNull().references(() => users.id),
  driverId: uuid('driver_id').references(() => driverProfiles.id),
  vehicleTypeId: uuid('vehicle_type_id').notNull().references(() => vehicleTypes.id),
  status: bookingStatusEnum('status').default('PENDING'),
  
  originAddress: text('origin_address').notNull(),
  originPoint: geometry('origin_point', { type: 'point', mode: 'xy', srid: 4326 }).notNull(),
  destinationAddress: text('destination_address').notNull(),
  destinationPoint: geometry('destination_point', { type: 'point', mode: 'xy', srid: 4326 }).notNull(),
  
  distanceKm: decimal('distance_km', { precision: 10, scale: 2 }).notNull(),
  
  basePrice: decimal('base_price', { precision: 12, scale: 2 }).notNull(),
  surchargePrice: decimal('surcharge_price', { precision: 12, scale: 2 }).default('0'),
  totalPrice: decimal('total_price', { precision: 12, scale: 2 }).notNull(),
  driverCommission: decimal('driver_commission', { precision: 12, scale: 2 }).notNull(),
  
  paymentMethod: paymentMethodEnum('payment_method').default('CASH'),
  paymentStatus: paymentStatusEnum('payment_status').default('UNPAID'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    originPointIdx: index('idx_bookings_origin_point').using('gist', table.originPoint),
  };
});

// 4.3 WALLETS & TRANSACTIONS
export const wallets = pgTable('wallets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  balance: decimal('balance', { precision: 15, scale: 2 }).default('0'),
  lockedBalance: decimal('locked_balance', { precision: 15, scale: 2 }).default('0'),
  currency: varchar('currency', { length: 10 }).default('VND'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const walletTransactions = pgTable('wallet_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  walletId: uuid('wallet_id').notNull().references(() => wallets.id),
  bookingId: uuid('booking_id').references(() => bookings.id),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

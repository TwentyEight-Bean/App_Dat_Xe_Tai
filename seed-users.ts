import { db } from './src/db';
import { sql } from 'drizzle-orm';
import { users, driverProfiles, vehicleTypes } from './src/db/schema';
import * as bcrypt from 'bcryptjs';

async function seedData() {
  console.log('Seeding dummy users and drivers...');
  try {
    const passwordHash = await bcrypt.hash('123456', 10);
    
    // 1. Tạo Users (Khách hàng)
    const customerData = [
      { phone: '0908122940', email: 'thuha.nguyen@gmail.com', fullName: 'Nguyễn Thu Hà', role: 'CUSTOMER' as const },
      { phone: '0914557102', email: 'duclong.pham@outlook.com', fullName: 'Phạm Đức Long', role: 'CUSTOMER' as const },
      { phone: '0932201188', email: 'minhthu.le@gmail.com', fullName: 'Lê Minh Thư', role: 'CUSTOMER' as const },
      { phone: '0976348832', email: 'giabao.hoang@gmail.com', fullName: 'Hoàng Gia Bảo', role: 'CUSTOMER' as const },
      { phone: '0901185624', email: 'haiyen.truong@gmail.com', fullName: 'Trương Hải Yến', role: 'CUSTOMER' as const },
    ];
    await db.insert(users).values(customerData.map(c => ({ ...c, passwordHash })));
    console.log('Added customers');

    // 2. Tạo Users (Tài xế)
    const driverUsersData = [
      { phone: '0903124486', fullName: 'Trần Minh Quân', role: 'DRIVER' as const },
      { phone: '0987452201', fullName: 'Võ Tuấn Kiệt', role: 'DRIVER' as const },
      { phone: '0916348832', fullName: 'Ngô Hoàng Nam', role: 'DRIVER' as const },
      { phone: '0908815624', fullName: 'Lê Thành Đạt', role: 'DRIVER' as const },
    ];
    const insertedDrivers = await db.insert(users).values(driverUsersData.map(d => ({ ...d, passwordHash }))).returning({ id: users.id });
    console.log('Added driver users');

    // 3. Lấy Vehicle Types
    const vTypes = await db.select().from(vehicleTypes);
    const vanType = vTypes.find(v => v.code === '500KG')?.id;
    const truckType = vTypes.find(v => v.code === '1TON')?.id;

    // 4. Tạo Driver Profiles
    const driverProfilesData = [
      { userId: insertedDrivers[0].id, vehicleTypeId: vanType, licensePlate: '51D-482.19', kycStatus: 'APPROVED' as const, isOnline: true },
      { userId: insertedDrivers[1].id, vehicleTypeId: truckType, licensePlate: '51C-903.47', kycStatus: 'APPROVED' as const, isOnline: true },
      { userId: insertedDrivers[2].id, vehicleTypeId: vanType, licensePlate: '59P2-184.20', kycStatus: 'APPROVED' as const, isOnline: true },
      { userId: insertedDrivers[3].id, vehicleTypeId: truckType, licensePlate: '51D-721.08', kycStatus: 'PENDING' as const, isOnline: false },
    ];
    await db.insert(driverProfiles).values(driverProfilesData);
    console.log('Added driver profiles');

    console.log('Seeding completed successfully!');
  } catch (err: any) {
    console.error('Seeding failed:', err.message);
  } finally {
    process.exit(0);
  }
}
seedData();

import { db } from './src/db';
import { sql } from 'drizzle-orm';

async function checkDb() {
  console.log("Checking Neon database...");
  try {
    const res = await db.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
    console.log('Tables in public schema:', res.map(r => r.table_name));
    
    if (res.length > 0) {
      const vTypes = await db.execute(sql`SELECT count(*) FROM vehicle_types`);
      console.log('vehicle_types count:', vTypes[0].count);
      
      const rules = await db.execute(sql`SELECT count(*) FROM pricing_rules`);
      console.log('pricing_rules count:', rules[0].count);
      
      const surcharges = await db.execute(sql`SELECT count(*) FROM surcharge_services`);
      console.log('surcharge_services count:', surcharges[0].count);
      
      const drivers = await db.execute(sql`SELECT count(*) FROM driver_profiles`);
      console.log('driver_profiles count:', drivers[0].count);
      
      const users = await db.execute(sql`SELECT count(*) FROM users`);
      console.log('users count:', users[0].count);
    }
  } catch (e: any) {
    console.error('Error connecting to DB or executing queries:', e.message);
  }
  process.exit(0);
}

checkDb();

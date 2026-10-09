import { client } from './src/db/index';
import * as fs from 'fs';
import * as path from 'path';

async function runMigrations() {
  console.log("Starting DB migration...");
  try {
    const dbDir = path.join(process.cwd(), 'db');
    const files = fs.readdirSync(dbDir).filter(f => f.endsWith('.sql')).sort();
    
    console.log("Dropping existing public schema...");
    await client.unsafe(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);

    for (const file of files) {
      console.log(`Executing ${file}...`);
      const sqlContent = fs.readFileSync(path.join(dbDir, file), 'utf-8');
      await client.unsafe(sqlContent);
      console.log(`Success: ${file}`);
    }
    console.log("All migrations completed successfully.");
  } catch (err: any) {
    console.error("Migration failed:", err.message);
  } finally {
    process.exit(0);
  }
}

runMigrations();

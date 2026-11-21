export default async function handler(req: any, res: any) {
  try {
    const { client } = await import("../src/db");
    const result = await client`SELECT count(*) FROM vehicle_types`;
    res.status(200).json({ success: true, count: result[0]?.count, dbUrlSet: !!process.env.DATABASE_URL });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || String(err), stack: err?.stack || null });
  }
}

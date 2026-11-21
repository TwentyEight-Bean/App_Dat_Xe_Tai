export default async function handler(req: any, res: any) {
  try {
    const { app } = await import("../src/api/router");
    return app(req, res);
  } catch (err: any) {
    console.error("Vercel API error:", err);
    return res.status(500).json({
      success: false,
      error: err?.message || String(err),
      stack: err?.stack || null,
    });
  }
}

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleApiRequest } from "../src/api/router";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const handled = await handleApiRequest(req as any, res as any);
    if (!handled && !res.writableEnded) {
      res.status(404).json({ success: false, message: "Endpoint not found" });
    }
  } catch (error: any) {
    console.error("Vercel Serverless Function Error:", error);
    if (!res.writableEnded) {
      res.status(500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  }
}

import app from "./router";

export default function handler(req: any, res: any) {
  return app(req, res);
}


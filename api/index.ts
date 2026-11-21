import app from "../src/api/router";

export default function handler(req: any, res: any) {
  return app(req, res);
}

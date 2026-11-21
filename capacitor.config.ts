import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "vn.vantaisieutoc.app",
  appName: "Vận Tải Siêu Tốc",
  webDir: "dist",
  server: {
    url: "https://app-dat-xe-tai.vercel.app",
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  preview: {
    host: true,              // 또는 "0.0.0.0"
    port: 3000,
    allowedHosts: true,      // ✅ 모든 호스트 허용(가장 간단)
  },
});

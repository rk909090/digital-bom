import type { NextConfig } from "next";

// Aplikasi internal dengan data yang selalu berubah: semua halaman dirender per request.
// Cache Components sengaja tidak dipakai di Fase 1 agar perilaku data sederhana dan selalu terbaru.
const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "libsql"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

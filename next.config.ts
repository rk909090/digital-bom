import type { NextConfig } from "next";

// Aplikasi internal dengan data yang selalu berubah: semua halaman dirender per request.
// Cache Components sengaja tidak dipakai agar perilaku data sederhana dan selalu terbaru.
// Tailwind diproses lewat PostCSS (postcss.config.mjs). Build produksi memakai webpack
// (`next build --webpack`) karena Turbopack gagal menjalankan proses Node pembantu di shared hosting.
const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;

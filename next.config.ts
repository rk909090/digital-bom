import type { NextConfig } from "next";

// Aplikasi internal dengan data yang selalu berubah: semua halaman dirender per request.
// Cache Components sengaja tidak dipakai agar perilaku data sederhana dan selalu terbaru.
// Tailwind diproses lewat PostCSS (postcss.config.mjs). Build produksi memakai webpack
// (`next build --webpack`) karena Turbopack gagal menjalankan proses Node pembantu di shared hosting.
// Shared hosting membatasi jumlah thread: tanpa batas ini Next.js memakai 1 worker per CPU
// (34 di server Hostinger) dan build gagal dengan "OS can't spawn worker thread".
const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "libsql"],
  experimental: { cpus: 2, webpackBuildWorker: false },
};

export default nextConfig;

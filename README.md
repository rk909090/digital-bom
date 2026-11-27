# Smart Bakery Production — Digital BOM

Aplikasi web untuk produksi bakery: rencana → permintaan bahan (Gudang RM) → timbang bahan → adonan masuk/keluar freezer (Gudang WIP) → hasil produksi + jam kerja → pengiriman produk jadi (Packing FG) → verifikasi → laporan & ekspor Excel.
Spesifikasi dan semua asumsi: [docs/FASE-0-SPESIFIKASI.md](docs/FASE-0-SPESIFIKASI.md).

## Menjalankan

```bash
npm install
npm run db:reset     # buat database SQLite + data demo (data/bakery.db)
npm run dev          # http://localhost:3000
```

Produksi: `npm run build && npm start`. Wajib set `SESSION_SECRET` (acak, ≥32 karakter) di environment.
Set `DEMO_MODE=false` agar PIN tidak ditampilkan di halaman masuk.

### Akun demo (PIN)

| Nama | Peran | PIN |
|---|---|---|
| Admin | Administrator (semua menu) | 0000 |
| Rina | PPIC | 1111 |
| Budi, Sari | Operator Produksi | 2222, 3333 |
| Dewi | Gudang RM | 4444 |
| Hendra | Supervisor | 5555 |
| Wawan | Gudang WIP (freezer) | 6666 |
| Putri | Packing FG | 7777 |

Admin bisa **Reset demo** di menu *Resep & Bahan*.

## Alur & layar

| Menu | Peran | Fungsi |
|---|---|---|
| Rencana | PPIC | Pilih produk + jumlah → batch & kebutuhan bahan otomatis dari BOM, permintaan bahan ke gudang |
| Gudang RM | Gudang RM | Siapkan/serahkan permintaan bahan, barang masuk, daftar perlu dibeli |
| Timbang Bahan | Operator Produksi | Panduan per bahan dengan gambar, zona toleransi (default 2%), timbangan (Web Serial), keypad, atau suara |
| Gudang WIP | Gudang WIP | Adonan yang selesai ditimbang dicatat masuk freezer (kg), lalu dikeluarkan untuk produksi |
| Hasil Produksi | Operator Produksi | Tray penuh × isi + satuan, reject (gagal proving / gagal oven), jam kerja (orang × jam), yield & produktivitas |
| Pengiriman FG | Packing FG | Kirim produk bagus ke Gudang FG atau outlet; disetujui otomatis oleh sistem |
| Verifikasi | Supervisor | Setujui/investigasi penyimpangan (>2%), tutup batch |
| Laporan | PPIC/Supervisor | Yield (bagus ÷ standar output BOM), reject %, produktivitas (pcs/orang-jam), pengiriman per tujuan, unduh Excel/CSV |
| Resep & Bahan | PPIC | Editor BOM berversi per SKU, impor/ekspor resep via Excel, master bahan |

## Fase 2: Digital Agent, notifikasi & integrasi ERP

Spesifikasi: [docs/FASE-2-SPESIFIKASI.md](docs/FASE-2-SPESIFIKASI.md).

| Fitur | Di mana |
|---|---|
| Lonceng notifikasi per peran (tugas baru, penyimpangan, pengingat, laporan) | Header semua halaman, halaman *Notifikasi* |
| Telegram Bot & WhatsApp gateway (opsional, tes kirim per peran) | *Pengaturan* (Admin) |
| Digital Agent otomatis setiap 5 menit: batch tertahan, penyimpangan belum ditangani, stok kurang/menipis, pencapaian & reject | `src/lib/agent.ts`, dijalankan `src/instrumentation.ts` |
| Laporan harian 17.00 WIB + ringkasan AI (Claude `claude-opus-5-5`) dengan cadangan template | *Laporan*, `src/lib/ai.ts` |
| Auto-posting ERP: 4 jenis dokumen, webhook bertanda tangan HMAC + coba ulang, API tarik, ekspor CSV/JSON | *Integrasi ERP* (Admin), `src/lib/posting.ts` |

Environment tambahan (opsional):

| Variabel | Fungsi |
|---|---|
| `OPENROUTER_API_KEY` | Mengaktifkan fitur AI (Claude Opus 5.5 via OpenRouter): ringkasan laporan, urai suara, hitung kamera. |
| `ANTHROPIC_API_KEY` | Opsional. Jika diisi, fitur AI memakai API Anthropic langsung (didahulukan dari OpenRouter). |
| `APP_URL` | Alamat aplikasi (mis. `https://produksi.perusahaan.co.id`) agar pesan Telegram/WhatsApp berisi tautan. |
| `AGENT_SCHEDULER=off` | Mematikan penjadwal internal (jika memakai cron eksternal ke `POST /api/agent/jalankan`). |

API untuk ERP (header `X-API-Key`, kunci dibuat di Pengaturan):

```
GET  /api/integrasi/posting?status=menunggu,gagal
POST /api/integrasi/posting/{code}/terima
POST /api/agent/jalankan
```

## Fase 3: AI Voice Input & AI Camera Counting

Spesifikasi & hasil uji: [docs/FASE-3-SPESIFIKASI.md](docs/FASE-3-SPESIFIKASI.md).

| Fitur | Di mana |
|---|---|
| **Suara**: tab *Suara* di Stasiun Timbang. Tekan mikrofon lalu ucapkan "tepung dua puluh lima kilo, gula lima kilo", atau pilih bahan lalu sebut angkanya saja. Bisa juga diketik. Hasil selalu dikonfirmasi operator. | `voice-panel.tsx`, `src/lib/voice-parse.ts` (pengurai lokal), AI untuk kalimat tidak rapi |
| **Kamera**: tombol *Hitung pakai kamera* di Stasiun Output. Foto 1–4 tray, AI menghitung produk bagus & yang tampak reject, operator memeriksa lalu menyimpan. Foto tidak disimpan. | `camera-count.tsx`, `POST /api/kamera/hitung` |

Tes pengurai suara: `npm run test:voice`.
Skrip `dev`/`start` memakai `node --use-system-ca` agar koneksi HTTPS ke layanan AI tetap jalan di jaringan/antivirus yang memeriksa HTTPS.
Mikrofon & kamera browser butuh HTTPS di produksi (localhost dikecualikan).

## Fase 4: Penyesuaian jawaban klien

Spesifikasi, keputusan & hasil uji: [docs/FASE-4-SPESIFIKASI.md](docs/FASE-4-SPESIFIKASI.md). Rekomendasi timbangan: [docs/SPESIFIKASI-TIMBANGAN.md](docs/SPESIFIKASI-TIMBANGAN.md).

| Fitur | Di mana |
|---|---|
| Ekspor Excel (.xlsx, 9 sheet) untuk ERP | *Laporan* → Unduh Excel, *Integrasi ERP* → Ekspor spreadsheet, `GET /laporan/excel?p=7` (p = hari, 7, 30) |
| Impor resep per SKU dari Excel (template, pratinjau, versi baru) | *Resep & Bahan* → Impor Excel, `GET /master/template-resep` |
| Notifikasi email lewat Resend (API key, pengirim, alamat per peran, tes kirim) | *Pengaturan* → Notifikasi Email |
| Tujuan pengiriman FG (Gudang FG, outlet) | *Pengaturan* → Tujuan pengiriman |

Email: isi **API key Resend** dan **alamat pengirim** (domain terverifikasi di Resend) di Pengaturan, lalu aktifkan. `RESEND_API_URL` hanya untuk pengujian (default `https://api.resend.com/emails`).

## Deploy (Hostinger, Node.js)

Online: https://bom.psm-manajemen.com

| Pengaturan build | Nilai |
|---|---|
| Node.js | 24 |
| Framework | Next.js |
| Build | `npm run build` (memakai `next build --webpack`; Turbopack gagal di shared hosting) |
| Output | `.next` |

Environment variable di Hostinger (hPanel → Website → Node.js → Environment variables):

| Variabel | Isi |
|---|---|
| `SESSION_SECRET` | acak ≥ 32 karakter |
| `DATABASE_URL` | `file:/home/<user>/domains/<domain>/sb-data/bakery.db` — **di luar folder aplikasi** agar data tidak hilang saat deploy ulang |
| `APP_URL` | `https://bom.psm-manajemen.com` |
| `OPENROUTER_API_KEY` | kunci OpenRouter untuk fitur AI |

Saat server pertama kali start, migrasi database dijalankan otomatis dan data demo diisi jika database kosong (`src/lib/bootstrap.ts`). Tidak perlu terminal.

## Teknologi

- Next.js 16 (App Router, Server Actions) + TypeScript, Tailwind CSS 4, ikon Lucide
- SQLite via libSQL + Drizzle ORM (`src/db/schema.ts`, migrasi di `drizzle/`)
- Login PIN dengan sesi JWT (cookie httpOnly), hak akses per peran (`src/lib/access.ts`)
- Timbangan: `src/lib/scale.ts` (Web Serial, 9600 baud, format umum `ST,GS,+10.00kg`) — **belum diuji dengan unit timbangan klien**
- Ilustrasi bahan/produk: dibuat dengan model gambar OpenAI (`openai/gpt-5.4-image-2`) via OpenRouter, disimpan di `public/img/`

## Struktur

```
src/app/(app)/…        halaman per menu (server components)
src/app/actions/…      server actions (semua validasi & aturan di server)
src/lib/rules.ts       aturan bisnis murni (skala BOM, toleransi, yield)
src/lib/queries.ts     akses data
src/db/seed-data.ts    data demo
docs/                  dokumen Fase 0
```

## Jalur scale-up

1. **Database**: ganti `DATABASE_URL` ke Turso/libSQL server (tanpa ubah kode), atau pindah ke PostgreSQL (ubah `sqlite-core` → `pg-core` di skema Drizzle).
2. **Integrasi ERP / notifikasi WhatsApp** (Fase 2): tambahkan di server actions setelah transaksi tersimpan; semua dokumen punya kode unik (PRD-, RQ-, ST-, EX-).
3. **AI voice & kamera** (Fase 3): input masuk ke server action yang sama (`saveWeighing`, `saveOutput`), jadi aturan & audit tetap satu.

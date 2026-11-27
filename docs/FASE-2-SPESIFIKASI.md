# Fase 2 — Digital Agent, Notifikasi & Integrasi

Versi 1.0 · 27 Nov 2026 · melanjutkan [FASE-0-SPESIFIKASI.md](FASE-0-SPESIFIKASI.md)
Dari dokumen klien: *"Business Process Digital Agent — Auto-posting · Reconciliation · Exception Monitoring"* dan tabel 8 fungsi Digital Agent.

## 1. Keputusan (asumsi terbaik)

| # | Hal | Keputusan | Alasan |
|---|---|---|---|
| K17 | Kanal notifikasi | **Selalu di aplikasi** (lonceng). Opsional: **Telegram Bot** dan **WhatsApp lewat gateway HTTP** (format umum: URL + token + nomor + pesan). Diatur Admin di menu Pengaturan. | Telegram gratis dan mudah; WhatsApp paling dipakai di Indonesia tetapi butuh layanan gateway berbayar yang dipilih klien. |
| K18 | Siapa menerima apa | Ditentukan per peran (tabel bagian 3). | Setiap orang hanya menerima yang perlu ditindaklanjuti. |
| K19 | ERP / auto-posting | ERP klien belum diketahui, jadi dibuat **antrean posting standar** berisi 4 jenis dokumen (bagian 4). Dikirim lewat **webhook** (JSON + tanda tangan HMAC-SHA256, coba ulang otomatis) dan/atau **diambil ERP lewat API** (kunci API). Bisa juga diunduh CSV/JSON. | Cocok untuk ERP apa pun (Accurate, Odoo, SAP B1, dll.) tanpa mengikat ke satu vendor. |
| K20 | Jadwal Digital Agent | Berjalan otomatis setiap 5 menit di server aplikasi; juga bisa dipicu dari cron eksternal (`POST /api/agent/jalankan`). | Tidak perlu server tambahan. |
| K21 | Aturan pemantauan | Batch tertahan di penimbangan > 3 jam; output belum diterima gudang > 2 jam; penyimpangan belum ditangani > 4 jam; stok di bawah minimum / kurang untuk rencana; pencapaian < 95%; reject > 2%. Semua angka bisa diubah Admin. | Mengganti "pemeriksaan rutin" menjadi "berbasis penyimpangan" (dokumen klien hal. 5). |
| K22 | Laporan harian otomatis | Dibuat setiap hari pukul **17.00 WIB** dan dikirim ke Supervisor & PPIC. Ringkasan ditulis oleh **Claude Opus 5.5** (lewat OpenRouter, atau API Anthropic langsung jika `ANTHROPIC_API_KEY` diisi — lihat Fase 3 K31); jika AI tidak tersedia, memakai ringkasan template. Angka selalu dari database, AI hanya menulis narasi. | AI tidak boleh mengarang angka; laporan tetap jalan tanpa AI. |
| K23 | Keamanan integrasi | Token kanal & rahasia webhook disimpan di server, ditampilkan tersamar. API integrasi wajib kunci `X-API-Key`. | Data produksi bersifat internal. |

## 2. Fungsi Digital Agent (dokumen klien) → implementasi

| Fungsi | Implementasi |
|---|---|
| Material Planning | Fase 1 (rencana) + notifikasi "perlu dibeli" ke PPIC |
| Material Issuing | Fase 1 (timbang) + posting **PEMAKAIAN_BAHAN** |
| Production Tracking | Aturan batch tertahan (K21) |
| Output Recording | Fase 1 + notifikasi ke gudang |
| Digital Handover | Fase 1 + posting **PENERIMAAN_FG** |
| Reconciliation | Rekonsiliasi per batch saat ditutup → posting **PENYELESAIAN_PRODUKSI** (selisih bahan, reject per penyebab) |
| Exception Management | Notifikasi penyimpangan + pengingat jika belum ditangani |
| Auto Reporting | Laporan harian otomatis + ringkasan AI |

## 3. Tabel notifikasi

| Kejadian | Penerima |
|---|---|
| Rencana baru / permintaan bahan | Gudang |
| Bahan perlu dibeli | PPIC, Gudang |
| Bahan sudah diserahkan ke produksi | Operator |
| Berat bahan di luar batas | Supervisor |
| Semua bahan selesai ditimbang | Operator |
| Hasil produksi dicatat | Gudang |
| Selisih serah terima | Supervisor |
| Batch siap ditutup | Supervisor |
| Pengingat aturan K21 | Sesuai aturan |
| Laporan harian | Supervisor, PPIC |

Admin menerima semua notifikasi di aplikasi.

## 4. Dokumen posting ERP

Semua berformat JSON dengan `code` unik (kunci idempoten — ERP wajib menolak kode yang sama dua kali).

| Jenis | Kapan | Isi |
|---|---|---|
| `PENERIMAAN_BAHAN` | Gudang mencatat barang masuk | bahan, qty kg, catatan |
| `PEMAKAIAN_BAHAN` | Semua bahan batch selesai ditimbang | batch, produk, baris bahan (standar & aktual kg) |
| `PENERIMAAN_FG` | Gudang FG konfirmasi | batch, produk, qty diserahkan & diterima |
| `PENYELESAIAN_PRODUKSI` | Batch ditutup | target, bagus, reject per penyebab, selisih bahan, penyimpangan |

Webhook: `POST <url>` dengan header `X-SmartBakery-Signature: sha256=<hex HMAC body>` dan `X-SmartBakery-Event: <jenis>`. Respons 2xx = terkirim. Gagal → dicoba ulang 1, 5, 15, 60 menit, lalu setiap 60 menit (maks 10 kali).

API tarik:
- `GET /api/integrasi/posting?status=menunggu` (header `X-API-Key`)
- `POST /api/integrasi/posting/<code>/terima` → menandai sudah diambil ERP

## 5. Belum termasuk
- Pemetaan akun/gudang spesifik ERP tertentu (dikerjakan saat ERP klien diketahui).
- Fase 3: AI voice input, AI camera counting.

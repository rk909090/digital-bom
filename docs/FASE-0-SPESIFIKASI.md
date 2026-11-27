# Fase 0 — Spesifikasi Smart Bakery Production (Digital BOM)

Versi 1.0 · 27 Nov 2026
Sumber: dokumen klien "27 Nov 26_Smart Bakery Production.pdf" (5 halaman).
Status: klien menyerahkan keputusan detail ke tim pengembang. Semua keputusan di bawah adalah **asumsi terbaik** dan bisa diubah setelah uji coba di lantai produksi.

---

## 1. Tujuan

Mengganti pencatatan manual produksi bakery dengan alur digital:

| Aktivitas | Sekarang | Setelah Fase 1 |
|---|---|---|
| Identifikasi material | Manual | Otomatis dari BOM |
| Input berat material | Diketik | Dari timbangan (atau keypad sebagai cadangan) |
| Input hasil produksi | Catat manual | Hitung tray + satuan di layar sentuh |
| Serah terima FG | Catat ulang | Konfirmasi satu tombol |
| Rekonsiliasi | Admin | Otomatis per batch |
| Reporting | Admin | Otomatis |
| Monitoring | Pemeriksaan rutin | Hanya saat ada penyimpangan (exception) |

## 2. Keputusan atas hal yang belum jelas di dokumen klien

| # | Pertanyaan | Keputusan (asumsi) | Alasan |
|---|---|---|---|
| K1 | Arti "Ordering RM" | **Permintaan bahan internal ke gudang.** Gudang menyiapkan lalu menyerahkan bahan ke produksi. Bahan yang stoknya kurang masuk daftar **"Perlu dibeli"**. PO ke supplier di luar Fase 1. | Dokumen berfokus pada lantai produksi; pembelian biasanya sudah ditangani sistem lain. |
| K2 | Sistem ERP / auto-posting | Belum ada integrasi. Semua transaksi tersimpan dengan kode unik dan bisa diunduh CSV, siap diposting ke ERP di Fase 2. | Sistem ERP klien belum diketahui. |
| K3 | Struktur BOM | Satu tingkat, per **batch dasar** (mis. 500 pcs), diskalakan linier. Setiap perubahan BOM membuat **versi baru**; batch yang sudah dibuat memakai versi saat dibuat. | Paling umum di bakery skala menengah; aman untuk audit. |
| K4 | Satuan | Semua bahan dalam **kg** (air 1 L = 1 kg, telur ditimbang tanpa kulit). Di layar, jumlah di bawah 1 kg ditampilkan dalam **gram** agar mudah dibaca. | Timbangan membaca kg; operator lebih mudah membaca "500 g" daripada "0,500 kg". |
| K5 | Toleransi selisih timbang | Default **±5%** per bahan, **±3%** untuk ragi dan garam. Bisa diubah per bahan di BOM. | Bahan kecil sangat memengaruhi hasil. |
| K6 | Jika di luar toleransi | Operator diminta **timbang ulang**. Jika tetap disimpan, operator memilih alasan dan sistem membuat **exception** untuk Supervisor. Batch tidak bisa ditutup sebelum exception selesai. | Sesuai contoh notifikasi di dokumen (Butter +12%). |
| K7 | Kapan stok berkurang | Saat penimbangan dikonfirmasi (pemakaian aktual). Penerimaan barang menambah stok lewat menu Gudang. | Paling sederhana dan akurat untuk Fase 1. |
| K8 | Rumus | Good = tray penuh × isi tray + satuan tambahan. **Achievement = good ÷ target. Quality yield = good ÷ (good + reject).** | Sama dengan angka contoh dokumen (492/500 = 98,4%). |
| K9 | Penyebab reject | Gosong, Bentuk tidak standar, Kurang mengembang, Jatuh/rusak, Lainnya. | Penyebab umum di bakery; bisa ditambah. |
| K10 | Serah terima FG | Diterima oleh **Gudang FG** dengan menghitung fisik. Jika jumlah berbeda, sistem membuat exception. | Dokumen: "Konfirmasi penerimaan". |
| K11 | WIP | Di Fase 1, WIP = status batch "Sedang diproduksi" (setelah semua bahan ditimbang, sebelum output dicatat). Belum ada stok WIP terpisah. | WIP tidak dijelaskan di dokumen. |
| K12 | Lot / kedaluwarsa bahan | Belum dicatat di Fase 1. | Tidak disebut di dokumen; menambah langkah operator. |
| K13 | Lokasi & lini | 1 lokasi, 1 lini produksi, beberapa stasiun (tablet). | Asumsi skala awal. |
| K14 | Notifikasi | Di dalam aplikasi (lencana + daftar). WhatsApp/Telegram di Fase 2. | Perlu keputusan kanal dan biaya. |
| K15 | Login | Pilih nama lalu **PIN 4 digit**. Tanpa email/kata sandi panjang. | Operator memakai tablet bersama, sering memakai sarung tangan. |
| K16 | Produktivitas | Belum dihitung (data jam kerja belum ada). Laporan menampilkan output per batch dan per hari. | Tidak ada data jam kerja di alur. |

## 3. Peran pengguna

| Peran | Tugas utama | Layar |
|---|---|---|
| **PPIC / Admin** | Kelola bahan, BOM, rencana produksi | Rencana, Master BOM, Master Bahan, Laporan |
| **Gudang** | Siapkan permintaan bahan, terima barang masuk, terima FG | Gudang, Serah Terima |
| **Operator** | Timbang bahan, catat hasil produksi | Stasiun Timbang, Stasiun Output |
| **Supervisor** | Verifikasi exception, tutup batch, lihat laporan | Verifikasi, Batch, Laporan |

Admin bisa membuka semua layar (untuk demo dan pelatihan).

## 4. Alur kerja (Fase 1)

```
PPIC: Rencana (produk + jumlah)
   └─► Production Order + batch otomatis + kebutuhan bahan (dari BOM)
         └─► Permintaan bahan ke Gudang  ──► Gudang: Siapkan ─► Serahkan
Operator: Stasiun Timbang (ambil bahan → timbang → konfirmasi)
   └─► semua bahan selesai ─► batch "Sedang diproduksi"
Operator: Stasiun Output (tray penuh + satuan + reject)
   └─► Gudang FG: Serah terima (hitung & konfirmasi)
Supervisor: Verifikasi exception ─► Tutup batch ─► Laporan
```

Status batch: `Menunggu timbang → Sedang ditimbang → Sedang diproduksi → Output tercatat → Sudah diterima gudang → Ditutup`

## 5. Data inti

- **Bahan**: kode, nama, gambar, stok, stok minimum.
- **Produk**: kode, nama, gambar, isi per tray.
- **Versi BOM**: produk, nomor versi, batch dasar, catatan, dibuat oleh.
- **Baris BOM**: bahan, qty per batch dasar, toleransi %.
- **Production Order**: kode `PRD-YYMMDD-nn`, tanggal, produk, jumlah, versi BOM.
- **Batch**: kode `CRO-YYMMDD-nn`, target, status.
- **Bahan batch**: kebutuhan standar, aktual, sumber (timbangan/keypad), penimbang, waktu.
- **Permintaan bahan**: kode `RQ-nnnn`, baris bahan, kekurangan, status.
- **Output**: tray, satuan, reject per penyebab.
- **Serah terima**: kode `ST-…`, jumlah dikirim, jumlah diterima, penerima.
- **Exception**: jenis (selisih bahan / selisih serah terima), nilai standar & aktual, alasan, status, penyelesaian.
- **Pergerakan stok** dan **log aktivitas** untuk audit.

## 6. Aturan bisnis

1. Kebutuhan bahan = qty BOM × (jumlah rencana ÷ batch dasar).
2. Rencana dipecah menjadi batch berukuran batch dasar; sisa yang tidak genap menjadi batch terakhir.
3. Selisih % = (aktual − standar) ÷ standar. Di luar toleransi → exception (K6).
4. Batch bisa ditutup jika: semua bahan ditimbang, output tercatat, serah terima selesai, dan tidak ada exception terbuka. Hanya Supervisor/Admin.
5. Data yang sudah dikonfirmasi tidak dihapus. Koreksi dilakukan lewat exception dan tercatat di log.

## 7. Lingkup Fase 1 (MVP)

**Termasuk**
- Login PIN per peran.
- Master bahan (gambar, stok, stok minimum) dan Master BOM berversi.
- Rencana produksi → Production Order, batch, kebutuhan bahan, permintaan ke gudang, daftar "perlu dibeli".
- Gudang: proses permintaan bahan, terima barang (stok masuk), stok rendah.
- Stasiun Timbang: panduan langkah demi langkah dengan gambar, indikator target, input timbangan (Web Serial) atau keypad, mode latihan.
- Stasiun Output: tray + satuan + reject per penyebab, ringkasan achievement & yield.
- Serah terima FG dengan konfirmasi jumlah.
- Verifikasi Supervisor: exception, tutup batch, rekonsiliasi per batch.
- Laporan: output, achievement, yield, waste per penyebab, selisih material, unduh CSV.

**Belum termasuk (fase berikutnya)**
- Fase 2: notifikasi WhatsApp/Telegram, integrasi ERP / auto-posting, ringkasan laporan oleh AI.
- Fase 3: input suara (AI voice), AI camera counting.
- Lot/kedaluwarsa, multi-lokasi, PO ke supplier.

## 8. Teknologi

| Bagian | Pilihan | Alasan |
|---|---|---|
| Aplikasi | **Next.js 16 (App Router) + TypeScript** | Satu kode untuk tampilan dan server, halaman dirender di server sehingga cepat dimuat di tablet, mudah dikembangkan ke API/ERP. |
| Tampilan | Tailwind CSS 4, ikon Lucide, font Plus Jakarta Sans | Ringan, konsisten, mudah dibaca. |
| Database | **SQLite (libSQL) + Drizzle ORM** | Tanpa server database untuk Fase 1/uji coba. Skema berbasis kode; pindah ke PostgreSQL atau Turso saat skala bertambah. |
| Timbangan | **Web Serial API** di Chrome/Edge | Timbangan RS232/USB-serial terbaca langsung dari browser tanpa aplikasi tambahan. |
| Gambar | Ilustrasi bahan & produk dibuat dengan model gambar OpenAI via OpenRouter | Operator memilih bahan dari gambar. |

## 9. Perangkat yang direkomendasikan (per stasiun)

- **Stasiun Timbang**: tablet/PC layar sentuh ≥ 10" dengan Chrome; timbangan platform 30–60 kg (resolusi 5–10 g) untuk tepung/air, dan timbangan meja 3–6 kg (resolusi 0,1–1 g) untuk ragi/garam. Keduanya dengan output RS232 atau USB-serial.
- **Stasiun Output, Gudang, Supervisor**: tablet ≥ 10" atau PC.
- Jaringan Wi-Fi di area produksi; server di PC lokal atau hosting.

> Model timbangan belum diuji. Pembacaan data timbangan memakai format umum ("ST,GS,+010.00kg"); perlu diverifikasi dengan unit timbangan yang dibeli.

## 10. Kriteria selesai Fase 1

1. PPIC bisa membuat rencana dan sistem menghasilkan batch dan kebutuhan bahan yang benar sesuai BOM.
2. Operator tanpa pelatihan panjang bisa menimbang semua bahan satu batch hanya dengan mengikuti layar.
3. Selisih di luar toleransi selalu menghasilkan exception dan menahan penutupan batch.
4. Output, serah terima, dan penutupan batch tercatat dengan nama pengguna dan waktu.
5. Laporan menampilkan angka yang sama dengan data transaksi (dapat dicek lewat CSV).

## 11. Hal yang perlu dikonfirmasi saat uji coba

- Resep (BOM) asli per produk. Data awal hanya contoh: angka Croissant mengikuti contoh dokumen klien (tepung 25 kg, butter 10 kg, gula 5 kg, ragi 0,5 kg per 500 pcs) ditambah garam, susu bubuk, telur, dan air. Resep produk lain adalah contoh.
- Merek/model timbangan dan format datanya.
- Nilai toleransi per bahan.
- Siapa penerima FG dan apakah perlu dokumen cetak.

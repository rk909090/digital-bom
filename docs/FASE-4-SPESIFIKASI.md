# Fase 4: Penyesuaian dari Jawaban Klien

Versi 1.0 · 27 Nov 2026 · melanjutkan [FASE-3-SPESIFIKASI.md](FASE-3-SPESIFIKASI.md)

Klien menjawab pertanyaan awal (poin 6 rencana). Dokumen ini mencatat apa yang diubah, keputusan untuk hal yang **belum dijawab** (asumsi default), dan hasil uji.

## 1. Jawaban klien → perubahan

| # | Jawaban klien | Perubahan di aplikasi |
|---|---|---|
| B1 | Toleransi timbang 2% | Toleransi semua bahan di data demo = 2%. Bahan baru & impor Excel default 2%. Di luar 2% → penyimpangan, perlu persetujuan Supervisor, batch tidak bisa ditutup sebelum disetujui. |
| B2 | Reject: gagal proving, gagal oven | Penyebab reject hanya **Gagal proving** dan **Gagal oven**. |
| B3 | Yield = Actual Output ÷ Standard Output (BOM) | **Yield = produk bagus ÷ standar output BOM** (jumlah pcs batch). Reject % ditampilkan terpisah: reject ÷ (bagus + reject). Aturan agent "pencapaian minimal" → **yield minimal**. |
| B4 | WIP = adonan di freezer | Tahap baru **Gudang WIP**: setelah semua bahan ditimbang, status batch "Adonan siap ke freezer" → Gudang WIP mencatat **masuk freezer (kg)** → **keluar freezer** → Operator mencatat hasil. Posting ERP `WIP_MASUK` dan `WIP_KELUAR`. |
| B5 | ERP: output ke spreadsheet dulu | Integrasi ERP (webhook/API) **tetap ada**. Ditambah **ekspor Excel (.xlsx)** dengan 9 sheet: Ringkasan, Batch, Pemakaian Bahan, WIP Freezer, Hasil & Reject, Pengiriman FG, Produktivitas, Stok Bahan, Posting ERP. Tersedia di Laporan dan Integrasi ERP. |
| B6 | Master resep per SKU | **Impor resep dari Excel**: unduh template (berisi resep aktif), ubah, unggah, lalu pratinjau (produk baru / versi resep baru / ganti nama / tidak berubah, bahan baru, error per baris), lalu simpan. Setiap perubahan = versi resep baru; versi lama tetap tersimpan. |
| B7 | Peran: Gudang RM, Gudang WIP, Packing FG | Peran "Gudang" menjadi **Gudang RM**. Peran baru **Gudang WIP** dan **Packing FG**. Akun demo: Wawan (6666), Putri (7777). |
| B8 | Handover FG ke gudang/outlet, disetujui sistem | "Serah terima" diganti **Pengiriman FG** oleh Packing FG: pilih tujuan (Gudang FG / Outlet 1 / Outlet 2, bisa diubah di Pengaturan). Jumlah = produk bagus tercatat, **disetujui otomatis**. Tidak ada lagi hitung ulang & penyimpangan serah terima. Posting `PENGIRIMAN_FG`. |
| B9 | Notifikasi via email | In-app, Telegram, dan WhatsApp **tetap ada**. Ditambah kanal **Email lewat Resend**: toggle, API key (tersimpan tersembunyi), alamat pengirim, email per peran (bisa lebih dari satu, dipisah koma), tombol Tes per peran. |
| B10 | Produktivitas = output ÷ jam kerja | Stasiun Hasil Produksi menambah **jumlah orang** dan **lama kerja (jam, naik 0,5)**. Wajib diisi sebelum menyimpan. **Produktivitas = produk bagus ÷ (orang × jam)** dalam pcs/orang-jam, di Ringkasan stasiun, detail batch, Laporan, Excel, dan posting `PENYELESAIAN_PRODUKSI`. |
| B11 | Timbangan belum ada | Rekomendasi perangkat & model: [SPESIFIKASI-TIMBANGAN.md](SPESIFIKASI-TIMBANGAN.md). |
| – | Tombol Simpan tidak sejajar (Pengaturan → Laporan harian) | Semua kontrol di Pengaturan disamakan tingginya (44 px). Tombol dipindah ke baris aksi di bawah tiap kartu. Seluruh halaman dipindai otomatis (lihat §4). |

## 2. Asumsi default untuk hal yang belum dijawab

| Hal | Asumsi yang dipakai |
|---|---|
| Siapa menyetujui penyimpangan > 2% | Supervisor. Batch tidak bisa ditutup sebelum semua penyimpangan disetujui. |
| Siapa menimbang & mencatat hasil | Peran **Operator Produksi** tetap ada. |
| Satuan WIP | kg adonan per batch (default = total berat bahan yang ditimbang, bisa diubah saat masuk freezer). |
| Adonan vs batch | **Satu adonan = satu batch produk.** Adonan dikeluarkan dari freezer **sekaligus satu batch**. *Pengeluaran sebagian belum dibuat*; bisa ditambahkan jika klien membutuhkannya. |
| Jam kerja | Diisi per batch: jumlah orang × lama kerja (jam). |
| Daftar outlet | "Outlet 1", "Outlet 2" (contoh). Ganti di Pengaturan → Tujuan pengiriman. |
| Email | Butuh akun Resend, API key, dan domain pengirim terverifikasi dari klien. Sampai diisi dan diaktifkan, email tidak dikirim (notifikasi lain tetap jalan). |
| Lokasi & lini | 1 lokasi, 1 lini produksi. |
| BOM | Satu tingkat (bahan → produk). Tanpa baker's percentage. |
| Suara & kamera | Tetap opsional (Fase 3). |

## 3. Alur status batch (baru)

```
menunggu → ditimbang → adonan (siap ke freezer) → wip (di freezer)
        → produksi (keluar freezer) → output (menunggu dikirim)
        → diterima (sudah dikirim) → ditutup
```

Notifikasi per tahap: adonan siap → Gudang WIP; keluar freezer → Operator; hasil dicatat → Packing FG; dikirim → Supervisor (siap tutup). Digital Agent juga mengingatkan adonan yang belum masuk freezer dan produk yang belum dikirim (batas jam di Pengaturan).

Perubahan database: migrasi `0003` hanya **menambah kolom** (batch: berat adonan & waktu/pencatat freezer; output: orang & jam; pengiriman: tujuan). Data lama tidak terhapus.

## 4. Hasil uji (27 Nov 2026, lokal)

| Uji | Hasil |
|---|---|
| `tsc`, `eslint`, `npm run test:voice`, `next build --webpack` | Lulus (17/17 uji suara) |
| Alur di browser: keluar freezer → catat hasil 24 tray×16 + 5, reject 3+2, 3 orang × 2,5 jam → kirim ke Outlet 1 | Tersimpan. Yield 97,3% (389/400), reject 1,3% (5/394), produktivitas 51,9 pcs/orang-jam. Nomor kirim `KRM-RSC-261127-01`. |
| Ekspor Excel (7 hari) | 9 sheet terisi. Total cocok dengan layar Laporan (1.549 bagus, yield 96,8%, 48,4 pcs/orang-jam). Rute `/laporan/excel` mengembalikan .xlsx valid. |
| Template resep → unggah tanpa perubahan | 33 baris valid, semua produk "Tidak berubah", tombol simpan nonaktif. |
| Impor dengan perubahan (pada salinan database) | CRO versi 2 (butter 10 → 9,5 kg), produk baru KJU v1 + bahan baru KJU (stok 0), RTW ganti nama tanpa versi baru. Impor ulang file yang sama → semua "Tidak berubah". |
| Impor dengan kesalahan | Error per baris (nama terlalu pendek, isi tray 0, qty negatif, toleransi 80, bahan dobel). File bukan .xlsx ditolak. |
| Email (server Resend tiruan) | Header `Authorization: Bearer`, subjek `[Smart Bakery] …`, isi teks. Penolakan 422 tercatat sebagai error. Antrean 2 alamat untuk 1 peran → 2 terkirim. Peran tanpa email tidak dikirimi. |
| Tata letak | Stasiun Timbang & Hasil: tanpa scroll di 1366×657, 1280×600, 1024×700, 800×1100. Sidebar 12 menu muat tanpa scroll di 1024×700, 1280×600, 1366×657. Pemindaian otomatis 19 halaman: tidak ada tombol/kolom bersebelahan yang beda tinggi atau posisi. |
| **Belum diuji** | Email ke Resend sungguhan (butuh API key klien), timbangan fisik, mikrofon sungguhan, tablet Android. |

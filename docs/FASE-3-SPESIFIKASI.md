# Fase 3 — AI Voice Input & AI Camera Counting

Versi 1.0 · 27 Nov 2026 · melanjutkan [FASE-2-SPESIFIKASI.md](FASE-2-SPESIFIKASI.md)
Dari dokumen klien: *"Operator cukup mengatakan, 'Tepung 25 kilogram, gula 5 kilogram.' AI mengubah suara menjadi data transaksi untuk dikonfirmasi. Atau klik gambar dan mengatakan…"* dan *"Input jumlah atau AI Camera Counting"*.

## 1. Keputusan (asumsi terbaik)

| # | Hal | Keputusan | Alasan |
|---|---|---|---|
| K24 | Suara → teks | **Web Speech API** bawaan Chrome/Edge, bahasa `id-ID`. Butuh internet dan HTTPS (localhost boleh). Selalu ada cadangan: ketik kalimat. | Gratis, tanpa server tambahan, sudah mendukung Bahasa Indonesia. Catatan privasi: audio diproses layanan pengenal suara milik browser. |
| K25 | Teks → transaksi | **Pengurai lokal** (tanpa internet) memahami nama bahan, sinonim (ragi/yeast, mentega/butter, terigu), angka digit dan kata ("dua puluh lima", "satu setengah", "dua koma lima", "setengah kilo"), satuan kg/kilo/gram/ons. Jika `ANTHROPIC_API_KEY` diisi, **Claude** dipakai lebih dulu untuk kalimat yang tidak rapi; hasilnya tetap dicek pengurai lokal (bahan harus ada di batch, angka masuk akal). | Tetap jalan tanpa AI; AI menambah ketahanan untuk ucapan bebas. |
| K26 | "Klik gambar lalu bicara" | Jika kalimat hanya berisi angka ("dua puluh lima kilo"), angka dipakai untuk **bahan yang sedang dipilih**. | Sesuai dokumen klien. |
| K27 | Konfirmasi | Hasil suara **tidak pernah langsung tersimpan**: operator melihat daftar bahan + berat + status zona, lalu menekan Simpan. Berat di luar batas tetap lewat alur penyimpangan (alasan + supervisor). | Suara bisa salah dengar. |
| K28 | Hitung pakai kamera | Operator memotret 1–4 foto tray dengan kamera tablet. Foto diperkecil di perangkat (maks. 1280 px) lalu dihitung oleh **Claude (vision)**: produk bagus, produk yang tampak cacat, perkiraan tray penuh + sisa, dan tingkat keyakinan. Hasil = **usulan** yang mengisi kolom hitung; operator memeriksa dan bisa mengubah sebelum menyimpan. | Penghitungan foto bisa meleset untuk produk bertumpuk; manusia tetap memutuskan. |
| K29 | Penyimpanan foto | Foto **tidak disimpan** di server. Yang dicatat: sumber angka (`kamera` / `manual`) dan hasil hitung AI di log aktivitas. | Hemat ruang, tidak menyimpan gambar area produksi. |
| K30 | Tanpa kunci AI | Input suara tetap jalan (pengurai lokal). Tombol kamera tampil nonaktif dengan penjelasan. | Tidak ada fitur yang rusak. |
| K31 | Penyedia AI | **Claude Opus 5.5 lewat OpenRouter** (`OPENROUTER_API_KEY`, model `anthropic/claude-opus-5.5`) — sesuai arahan pemilik proyek. Jika `ANTHROPIC_API_KEY` diisi, aplikasi otomatis memakai SDK resmi Anthropic (`claude-opus-5-5`) untuk semua fitur AI (ringkasan laporan, urai suara, hitung kamera). | Memakai kunci yang sudah ada; tetap siap pindah ke API langsung. |
| K32 | Sertifikat HTTPS | Server dijalankan dengan `--use-system-ca` agar mempercayai sertifikat Windows (dibutuhkan di jaringan/antivirus yang memeriksa HTTPS). | Ditemukan saat uji: koneksi ke OpenRouter ditolak tanpa ini. |

## 4. Hasil uji (27 Nov 2026)

| Uji | Hasil |
|---|---|
| Pengurai suara lokal (`npm run test:voice`) | 17/17 kalimat benar, termasuk "dua lima kilo", "sebelas koma dua", "seribu dua ratus gram", akhiran "-nya" |
| Kalimat tidak rapi ("…ragi limaratus gram") | Diurai AI → Gula Pasir 5 kg + Ragi 500 g, tersimpan dengan sumber `suara` |
| Hitung kamera, foto roti sobek 8 pcs | AI: 7 bagus + 1 sobek (reject), keyakinan sedang, ±9 detik |
| Foto produk yang tidak sesuai batch | AI memberi keyakinan rendah dan peringatan |
| Simpan hasil dari kamera | `outputs.source = kamera`, log audit mencatat hasil AI |
| Mikrofon sungguhan | **Belum diuji** (pengujian otomatis tidak bisa berbicara); perlu dicoba operator di Chrome/Edge |

## 2. Sumber data yang tercatat

| Tempat | Nilai |
|---|---|
| Bahan batch (`batch_materials.source`) | `timbangan`, `keypad`, `suara` |
| Hasil produksi (`outputs.source`) | `manual`, `kamera` |

## 3. Batasan yang diketahui
- Web Speech API tidak tersedia di Firefox dan sebagian browser Android lama → pakai ketik kalimat.
- Lingkungan bising menurunkan akurasi pengenal suara; disarankan headset/mikrofon dekat.
- Hitung kamera paling akurat untuk tray dengan produk tidak bertumpuk dan difoto dari atas dengan cahaya cukup.

# Rekomendasi Timbangan & Perangkat (B11)

Klien menjawab: **timbangan belum ada**. Dokumen ini berisi rekomendasi supaya timbangan bisa langsung mengirim berat ke aplikasi (tanpa mengetik), beserta batasannya. Spesifikasi model diambil dari situs resmi pabrikan (tautan di bawah); harga dan ketersediaan di Indonesia **belum dicek** dan perlu ditanyakan ke distributor.

## 1. Cara aplikasi membaca timbangan

- Aplikasi memakai **Web Serial API** di browser (berkas `src/lib/scale.ts`). Timbangan disambungkan dengan kabel **RS-232C** (lewat konverter RS-232→USB) atau kabel USB yang muncul sebagai port serial.
- Operator menekan **"Hubungkan timbangan"** sekali per sesi, memilih port, lalu angka berat tampil langsung di layar timbang. Tombol simpan memakai angka itu (sumber tercatat `timbangan`).
- Format data yang dikenali: baris teks berisi angka + satuan `kg` atau `g`, dengan penanda stabil `ST` / tidak stabil `US` bila ada (contoh: `ST,+0012.345  kg`). Format ini umum dipakai timbangan A&D dan banyak timbangan industri lain.
- Kecepatan data (baud rate) di aplikasi saat ini **9600 bps**. Pengaturan timbangan harus disamakan (atau kode diubah) saat uji coba.
- **Belum diuji dengan unit timbangan sungguhan.** Uji coba pertama wajib: format baris, baud rate, mode kirim (terus-menerus / saat stabil / tekan tombol PRINT).

## 2. Perangkat & browser yang didukung

| Perangkat | Browser | Status |
|---|---|---|
| PC / laptop Windows, macOS, Linux, ChromeOS | Chrome atau Edge versi 89+ | Didukung resmi (dokumentasi Chrome) |
| Tablet / HP Android | Chrome Android | Data *web-features* mencatat dukungan sejak Chrome Android 148 (Mei 2026), tetapi dokumentasi resmi Chrome belum menyebutnya. **Harus diuji dulu di tablet yang akan dipakai.** Sebelum versi itu, Android hanya bisa lewat WebUSB + polyfill dan tidak semua konverter didukung. |
| iPad / iPhone | Safari / Chrome iOS | **Tidak didukung** (WebKit menolak Web Serial). |
| Firefox | Firefox | Tidak disarankan; dukungan baru di versi desktop terbaru. |

Saran paling aman untuk stasiun timbang: **mini PC / laptop Windows + Chrome atau Edge**, monitor sentuh 15–22", dan konverter RS-232→USB. Jika ingin tablet Android, beli satu unit dulu untuk diuji bersama timbangan sebelum membeli banyak.

Aplikasi juga harus dibuka lewat **HTTPS** (sudah: `https://bom.psm-manajemen.com`). Tanpa timbangan, input tetap bisa lewat keypad atau suara.

## 3. Rekomendasi model (dua jenis timbangan)

Resep roti memakai bahan besar (tepung, gula, air: puluhan kg) dan bahan kecil (ragi, garam, improver: puluhan sampai ratusan gram). Toleransi yang disepakati 2%. Contoh: ragi 240 g → batas ±4,8 g, jadi timbangan bahan kecil sebaiknya membaca minimal 0,1 g. Rekomendasinya **dua timbangan per stasiun**:

### A. Timbangan lantai/meja untuk bahan besar: A&D seri HV-G / HW-G

Sumber: [aandd.jp, HV-G/HW-G Series](https://aandd.jp/products/weighing/scale/platform/hvw.html)

| Model | Kapasitas / nilai minimum | Catatan |
|---|---|---|
| HV-60KGL / HV-60KGV | 15 kg / 5 g · 30 kg / 10 g · 60 kg / 20 g (3 rentang) | Cocok untuk tepung per batch |
| HW-60KGL / HW-60KGV | 60 kg / 5 g | Lebih teliti, harga biasanya lebih tinggi |
| HV-15KGL / HV-15KGV | 3 kg / 1 g · 6 kg / 2 g · 15 kg / 5 g | Jika batch kecil |

- **RS-232C standar** (tidak perlu opsi). USB lewat aksesori konverter (AX-USB-DIN).
- Platform **IP65** (tahan debu & air, khusus bagian platform). Akhiran L = layar LCD (adaptor/baterai), V = layar VFD (listrik AC).
- Varian tahan air penuh: [HV/HW-CWP](https://aandd.jp/products/weighing/scale/platform/hvw-cwp.html) (IP65, permukaan SUS304). Di seri ini RS-232C dan USB **opsional** (HVW-03CWP / HVW-02BCWP), jadi harus dipesan bersama.

### B. Timbangan presisi untuk bahan kecil: A&D seri FX-i

Sumber: [aandd.jp, FZ-i/FX-i Series](https://aandd.jp/products/weighing/balance/toploader/fz-i_fx-i.htm)

| Model | Kapasitas | Catatan |
|---|---|---|
| FX-2000i | 2.200 g | Pilihan utama untuk ragi, garam, improver |
| FX-5000i | 5.200 g | Jika bahan kecil per batch lebih dari 2 kg |

- Nilai baca yang tercantum di halaman resmi adalah 0,001 g dan 0,01 g. Halaman tidak menyebut secara eksplisit model mana yang memakai nilai mana; perkiraannya 0,01 g untuk model 1200i–5000i. Ini lebih dari cukup untuk toleransi 2%.
- **RS-232C standar.** Opsi USB: FXi-02 (satu arah, tanpa driver). Konverter RS-232C/USB: AX-USB-9P (dua arah). FZ-i = versi dengan kalibrasi internal (lebih mahal).

> Merek lain (mis. Ohaus Defender 3000, Mettler Toledo) juga umum dan punya RS-232. Saya tidak berhasil membaca lembar data resminya, jadi tidak dicantumkan. Syarat apa pun mereknya: **ada output RS-232C/USB yang mengirim teks berat**, dan sertakan manual protokolnya saat pembelian.

## 4. Daftar belanja per stasiun timbang (perkiraan, belum termasuk harga)

1. 1× timbangan bahan besar (mis. HV-60KGL) + kabel RS-232C
2. 1× timbangan presisi (mis. FX-2000i) + FXi-02 atau AX-USB-9P
3. 1–2× konverter RS-232→USB (jika memakai kabel RS-232C)
4. 1× mini PC/laptop Windows + Chrome/Edge, monitor sentuh, dudukan
5. Koneksi internet/Wi-Fi stabil ke `bom.psm-manajemen.com`

## 5. Batasan aplikasi saat ini (jujur)

- Satu stasiun timbang terhubung ke **satu timbangan pada satu waktu**. Berganti timbangan = putuskan lalu hubungkan lagi. Dukungan dua timbangan sekaligus bisa ditambahkan setelah model dipilih.
- Baud rate tetap 9600 di kode. Belum ada layar pengaturan per timbangan.
- Belum ada kalibrasi atau tara dari aplikasi. Tara dilakukan di timbangan.

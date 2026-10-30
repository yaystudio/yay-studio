# Yay Photo Studio - Booking & Studio Management Platform

Platform pemesanan sesi foto modern untuk **Yay Photo Studio** dengan estetika monokrom minimalis ala studio foto Korea (Korean self photo studio), dilengkapi kalender slot waktu otomatis, konfirmasi email ganda (customer & admin), serta panel admin pengelola jadwal dan booking.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Keputusan Kunci Berdasarkan Preferensi Anda:**
> - **Identitas & Gaya Visual**: Yay Photo Studio bergaya monokrom minimalis Korea (palet hitam pekat, putih bersih, abu-abu netral, tipografi clean, layout editorial terstruktur, inspirasi studio seperti Haru Film / Photomatic).
> - **Sistem Jadwal**: Kalender interaktif dengan slot waktu dinamis per 30–60 menit sesuai durasi layanan, mencegah jadwal bertabrakan.
> - **Alur Notifikasi & Email**: Sistem otomatis mencatat booking dan mengirimkan konfirmasi email ke pelanggan serta ke admin studio (`yayphotostudio@gmail.com`), dilengkapi viewer invoice/voucher booking dan integrasi cepat WhatsApp.
> - **Panel Admin**: Dashboard pengelola studio terintegrasi untuk melihat daftar reservasi, menyetujui/mengubah status sesi, serta memblokir atau membuka slot jadwal tertentu.

---

## 1. Overview & Core Concept

- **Apa yang Dibangun**: Website booking komprehensif untuk Yay Photo Studio yang memungkinkan pelanggan memilih layanan, menentukan add-on (tambahan orang, cetak foto ekstra, backdrop), memilih tanggal dan jam pada kalender interaktif, serta menerima email konfirmasi resmi.
- **3 Layanan Utama Studio**:
  1. **Self Photo Reguler**: Sesi foto mandiri tanpa fotografer menggunakan remote shutter nirkabel dan live monitor. Durasi 20 menit sesi + 10 menit pilih foto. Termasuk 2 lembar print foto strip dan semua file digital.
  2. **Profile Self Photo**: Sesi foto potret profesional mandiri untuk kebutuhan LinkedIn, CV, kartu identitas, wisuda, atau portfolio pribadi. Termasuk lighting pro beauty dish, panduan komposisi, 1 cetak 4R, dan retouch dasar.
  3. **Photo by Photographer**: Sesi foto profesional diarahkan langsung oleh fotografer studio untuk grup, keluarga, wisuda, atau pasangan dengan arahan pose dan lighting studio lengkap.
- **Target Pengguna**: Kaum muda, pasangan, keluarga, mahasiswa/wisudawan, dan profesional yang menginginkan pengalaman foto studio yang estetik, privat, dan efisien.

---

## 2. User Experience & Visual Design

### Visual Identity & Theme (Korean Monochrome Minimalist)
- **Aesthetic Direction**: Monokrom editorial Korea kontemporer. Bersih, presisi, bernuansa galeri seni modern dengan aksen frame film analog hitam-putih.
- **Color Palette (60-30-10 Rule)**:
  - *Canvas (60%)*: Crisp White (`#FFFFFF`) / Off-White halus (`#F9F9FB`) pada mode terang, stark jet black (`#0A0A0A`) untuk elemen kontras.
  - *Structural Surfaces (30%)*: Border hairline halus (`#E4E4E7` / `#27272A`), container abu-abu tipis (`#F4F4F5`), typography muted slate.
  - *Accent Budget (10%)*: Deep Solid Black (`#111111`) dengan hover subtle invert, indikator waktu aktif yang tegas dan mudah terbaca.
- **Typography**:
  - Headings: `Outfit` / `Plus Jakarta Sans` dengan tracking rapat (`tracking-tight`) dan bobot tegas.
  - Body Prose: `Plus Jakarta Sans` / `DM Sans` (14px–16px, line-height seimbang).
  - Data, Jam, & Kode Booking: `font-mono tabular-nums` untuk akurasi penjadwalan.
- **Komponen Top Bar**:
  - Zona 1: Wordmark "YAY PHOTO STUDIO" (single text element).
  - Zona 2: Navigasi cepat (*Layanan*, *Cara Booking*, *Jadwal*, *Lokasi & Info*).
  - Zona 3: Tombol utama "Book a Session" + tautan cepat "Akses Admin".

### Key User Flows
1. **Eksplorasi Layanan**: Pelanggan menelusuri ketiga paket dengan kartu perbandingan fitur, fasilitas, durasi, dan galeri contoh foto.
2. **Interactive Booking Stepper**:
   - *Step 1 (Pilih Layanan & Add-on)*: Pilih paket, pilih warna backdrop (Hitam, Putih, Abu, Beige), tentukan jumlah orang dan opsi cetak tambahan.
   - *Step 2 (Pilih Tanggal & Slot Waktu)*: Kalender bulan interaktif. Mengklik tanggal menampilkan deretan slot waktu (pagi, siang, sore, malam). Slot yang telah dipesan ditandai nonaktif; slot tersedia dapat diklik langsung.
   - *Step 3 (Data Pemesan)*: Formulir nama lengkap, nomor WhatsApp, alamat email, dan catatan khusus (misal: pakaian wisuda, bawa anjing/kucing).
   - *Step 4 (Review & Konfirmasi Booking)*: Tinjauan rincian harga, waktu, syarat & ketentuan sesi foto studio.
3. **Konfirmasi & Notifikasi**:
   - Tampilan tiket/voucher booking resmi dengan kode booking unik (misal: `YAY-2610-890`).
   - Pengiriman otomatis notifikasi email ke pelanggan & email admin (`yayphotostudio@gmail.com`).
   - Opsi unduh tiket PDF/cetak & tombol pintas "Kirim Ringkasan ke WhatsApp Admin".
4. **Panel Admin Studio**:
   - Proteksi akses PIN/passcode.
   - Kalender ringkasan reservasi harian dan daftar booking masuk.
   - Filter status booking: *Menunggu*, *Terkonfirmasi*, *Selesai*, *Dibatalkan*.
   - Tombol blokir slot tanggal/jam tertentu (misal untuk maintenance studio atau libur).

---

## 3. Key Product Decisions & Trade-Offs

- **Sistem Email Konfirmasi**:
  - *Pendekatan*: Menyediakan endpoint server Express terintegrasi untuk menangani dispatch email simulasi/nyata ke admin (`yayphotostudio@gmail.com`) dan customer, disertai tampilan preview email responsif di browser sehingga pengguna bisa melihat format email yang terkirim.
  - *Alasan*: Menjamin operasional berjalan lancar tanpa terhalang dependensi pihak ketiga, sekaligus memberikan fleksibilitas jika studio ingin menghubungkan SMTP langsung.
- **State Persistence & Slot Booking**:
  - *Pendekatan*: Server-state tersimpan dengan sinkronisasi ke penyimpanan lokal browser dan in-memory API, sehingga jadwal yang sudah dibooking langsung memperbarui ketersediaan slot secara real-time.
  - *Alasan*: Cepat, instan, dapat dioperasikan langsung tanpa setup database kompleks di awal, dan siap ditingkatkan ke Cloud Firestore kapan saja.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        YAY PHOTO STUDIO APP                           │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [Top Navigation Bar: Wordmark · Nav Links · Book Now · Admin Link]    │
│                                                                        │
│  ┌──────────────────────┐  ┌────────────────────────────────────────┐  │
│  │     Hero Section     │  │          3 Layanan Showcase            │  │
│  │ Korean Minimalist    │  │  1. Self Photo Reguler                 │  │
│  │ Visuals & BookingCTA │  │  2. Profile Self Photo                 │  │
│  │                      │  │  3. Photo by Photographer              │  │
│  └──────────────────────┘  └────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                 INTERACTIVE BOOKING MODAL / WIZARD                │  │
│  │  Step 1: Layanan & Add-on (Backdrop, Tambahan Orang, Ekstra Cetak)│  │
│  │  Step 2: Kalender Tanggal + Slot Waktu Otomatis (Tersedia/Penuh)  │  │
│  │  Step 3: Form Kontak Customer (Nama, Email, WhatsApp)            │  │
│  │  Step 4: Invoice Review & Submit Booking                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────┐  ┌────────────────────────────────────────┐  │
│  │ Email Notification   │  │              Admin Panel               │  │
│  │ - Kirim ke Customer  │  │ - Jadwal Hari Ini & Kalender Slot      │  │
│  │ - Kirim ke Admin     │  │ - Kelola Status Booking                │  │
│  │ - Tiket Booking PDF  │  │ - Blokir / Buka Slot Waktu             │  │
│  └──────────────────────┘  └────────────────────────────────────────┘  │
│                                                                        │
│  [Footer: Lokasi Studio, Jam Operasional, Aturan Sesi, WhatsApp Info]  │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Model Utama
- `Service`: ID, nama, slug, harga, durasi sesi (menit), deskripsi, fasilitas, maks orang.
- `TimeSlot`: ID, tanggal (`YYYY-MM-DD`), jam mulai, jam selesai, status (`available` | `booked` | `blocked`).
- `Booking`: ID/Kode unik, serviceId, tanggal, timeSlot, customer (nama, email, whatsapp, notes), addons, totalHarga, status (`pending` | `confirmed` | `completed` | `cancelled`), createdAt.
- `AddOn`: ID, nama, harga, unit deskripsi.

---

## Verification & Testing Plan
1. **Uji Alur Booking**: Memilih masing-masing dari 3 layanan, memilih add-on, memilih tanggal dan jam pada kalender, hingga konfirmasi sukses.
2. **Uji Validasi Ketersediaan**: Memastikan slot yang sudah dipesan otomatis nonaktif sehingga tidak terjadi double-booking.
3. **Uji Notifikasi**: Memeriksa email konfirmasi yang digenerate untuk customer dan admin (`yayphotostudio@gmail.com`).
4. **Uji Panel Admin**: Login ke panel admin, memverifikasi daftar pesanan masuk, mengubah status booking, dan mencoba blokir slot waktu.
5. **Kompilasi & Lint**: Menjalankan `compile_applet` untuk memastikan TypeScript dan build Vite bebas error.

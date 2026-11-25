# StecyGrab — Web Source Code & CSS Extractor

Aplikasi web untuk mengambil source code **HTML + CSS lengkap** (termasuk seluruh file `<link rel="stylesheet">` eksternal yang otomatis digabung & di-inline) hanya dengan menempelkan URL website target.

## Struktur Project
- `index.html` — Antarmuka utama (Dark Matte-Glass UI) dengan 5 mode tampilan:
  1. **HTML + CSS (All-in-One)**: Gabungan HTML + semua CSS eksternal yang sudah di-inline ke `<style>`, langsung siap salin atau download.
  2. **HTML Raw**: Struktur HTML asli dengan path asset yang sudah diubah menjadi URL absolut.
  3. **CSS Lengkap**: Seluruh kode CSS eksternal & inline dalam satu file.
  4. **Live Preview**: Pratinjau desain langsung di dalam halaman atau tab baru.
  5. **Assets & Links**: Daftar URL stylesheet dan script eksternal.
- `api/scrape.js` — Backend Serverless Function (Vercel / Node.js) untuk bypass CORS dan mengambil seluruh file CSS eksternal secara paralel.
- `server.js` — Server Node.js mandiri jika ingin dijalankan di VPS, Panel, atau Termux.
- `vercel.json` & `package.json` — Konfigurasi siap deploy ke Vercel.

## Cara Deploy

### 1. Deploy ke Vercel (Rekomendasi - Gratis & Support API)
1. Upload seluruh isi folder ini ke repository GitHub.
2. Buka [vercel.com](https://vercel.com), klik **Add New Project**, pilih repository tersebut, lalu klik **Deploy**.
3. Endpoint API `/api/scrape?url=...` otomatis aktif tanpa konfigurasi tambahan.

### 2. Deploy ke GitHub Pages (Static Mode)
1. Upload file `index.html` ke repository GitHub dan aktifkan GitHub Pages.
2. Aplikasi otomatis mendeteksi mode static dan beralih ke **Client Proxy Mode** sehingga tetap bisa mengambil HTML & CSS tanpa backend.

### 3. Jalankan di Termux / VPS (Node.js)
```bash
npm install
npm start
```
Buka `http://localhost:3000` di browser.

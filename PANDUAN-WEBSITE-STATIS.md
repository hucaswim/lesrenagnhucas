# Panduan Website HUCAS (versi halaman statis)

Website sekarang dibangun menjadi HTML statis supaya Google, ChatGPT, Gemini, dan mesin pencari lain bisa langsung membaca isinya (harga, jadwal, FAQ, coach, artikel) tanpa menjalankan JavaScript.

## Halaman yang dihasilkan
| Alamat | Isi |
|---|---|
| `/` dan `/en/` | Beranda Indonesia dan English |
| `/les-renang-renon/`, `/les-renang-ubung/`, `/les-renang-padang-sambian/` | Halaman tiap kolam (jadwal, harga, peta, FAQ) |
| `/en/swim-lessons-renon/` dst. | Versi English halaman kolam |
| `/blog/` dan `/blog/<slug>/` | Daftar artikel dan tiap artikel (English: `/en/blog/...`) |
| `sitemap.xml`, `robots.txt`, `llms.txt` | Dibuat otomatis |
| `blog.html`, `article.html` | Alamat lama, otomatis diarahkan ke alamat baru |

Alamat halaman kolam mengikuti isi **Area** di admin (misal Area "Renon" → `/les-renang-renon/`).

## Cara memakai: 2 pilihan

### Pilihan A — Upload langsung (paling mudah, sekarang)
1. Ekstrak `hucas-github-upload.zip`.
2. GitHub → repo → **Add file → Upload files** → seret **isi** folder → **Commit changes**.
3. Hapus file lama yang tidak dipakai lagi dari repo (lihat daftar di bawah).
4. Setiap kali edit lewat `admin.html`: kirim `data.js` baru ke Claude untuk dibuatkan paket upload baru.

### Pilihan B — Otomatis lewat GitHub Actions (disarankan jangka panjang)
Setelah disiapkan, kamu cukup upload `data.js` baru dan website dibangun ulang sendiri dalam ±1 menit.
1. Ekstrak `hucas-site-source.zip`.
2. Di GitHub: **Add file → Upload files**, seret **seluruh isi** folder (termasuk folder `template`). Untuk file workflow: **Add file → Create new file**, ketik nama `.github/workflows/pages.yml`, tempel isi file `pages.yml` dari zip, lalu Commit.
3. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
4. Pastikan **Custom domain** tetap `lesrenanghucas.com` dan **Enforce HTTPS** aktif.
5. Buka tab **Actions** → pastikan proses "Build & deploy website" hijau.
6. Mulai sekarang: edit di `admin.html` → klik **🚀 Publikasikan** (setup token: lihat PANDUAN-PUBLIKASI.md) → tunggu ±1–2 menit. Cadangan manual: Download data.js → upload ke repo.

## File lama yang bisa dihapus dari repo (kalau ada)
`netlify.toml`, `google...html` (verifikasi sudah lewat DNS), dan — untuk Pilihan B — file `index.html`, `article.html`, `blog.html` lama di root repo (akan digantikan hasil build).

## Yang berubah dari sebelumnya
- `data.js` tidak lagi dimuat browser pengunjung. Isinya dibaca saat website dibangun. Foto dari admin disimpan sebagai file di folder `img/` (nama file deskriptif) sehingga halaman jauh lebih ringan.
- Bahasa dipilih lewat alamat (`/` untuk Indonesia, `/en/` untuk English), bukan tombol JavaScript.
- Tag SEO, canonical, hreflang, dan data terstruktur dibuat otomatis per halaman.
- Tab **SEO** di admin tetap bisa dipakai untuk judul, deskripsi, dan kata kunci halaman utama. Tombol download sitemap/robots tidak perlu dipakai lagi.

## Tips agar mudah ditemukan Google dan AI
- Isi **Deskripsi halaman lokasi** (admin → Lokasi & Jadwal) dengan teks asli: alamat jalan, patokan, fasilitas, tips datang.
- Tambahkan alamat lengkap kolam di deskripsi tersebut.
- Tulis artikel baru rutin (admin → Blog), lalu setelah dibangun, kirim URL-nya lewat Search Console → Pemeriksaan URL → Minta pengindeksan.
- Buat Google Business Profile untuk tiap kolam dan cantumkan alamat website halaman kolam yang bersangkutan.

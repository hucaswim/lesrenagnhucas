# Publikasi 1 klik dari Admin

Alur harian: buka `admin.html` → edit → klik **🚀 Publikasikan** → website berubah dalam 1–2 menit.

## Setup satu kali

### 1. Ganti isi repo dengan paket sumber
1. Buka repo `hucaswim/lesrenanghucas` di GitHub.
2. Hapus file lama (index.html, en/, blog/, img/, les-renang-*/, dst). Cara cepat: buka tiap file/folder → ⋯ → Delete. Atau biarkan saja, file lama tidak dipakai lagi setelah langkah 3.
3. Upload **isi** folder `hucas-site-source` (bukan foldernya): `build.js`, `data.js`, `template/`, `logo.png`, `404.html`, `privacy.html`, `tracking.js`, `dashboard.html`, `firebase-config.js`, dan folder tersembunyi `.github/` (berisi workflow).
   - Folder `.github` kadang tidak ikut ter-drag di Windows/Mac. Kalau begitu, di GitHub klik **Add file → Create new file**, ketik `.github/workflows/pages.yml` sebagai nama, lalu tempel isi file `pages.yml` dari paket.
4. Commit.

### 2. Aktifkan GitHub Actions untuk Pages
GitHub → repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Lalu buka tab **Actions** dan pastikan proses "Build & deploy website" berwarna hijau. Cek website setelahnya.

### 3. Buat token GitHub (kunci khusus repo ini)
1. GitHub → foto profil → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Token name: `hucas-admin`. Expiration: 1 tahun (catat tanggalnya).
3. Repository access: **Only select repositories** → pilih `lesrenanghucas`.
4. Permissions → Repository permissions → **Contents: Read and write**. Yang lain biarkan.
5. Generate, lalu **salin tokennya** (`github_pat_...`). Token hanya tampil sekali.

### 4. Isi token di admin
Buka `admin.html` → klik **⚙️** → isi repo `hucaswim/lesrenanghucas`, branch `main`, tempel token → Simpan.

## Catatan penting
- Token tersimpan hanya di browser itu. Di perangkat lain, isi ulang. Jangan kirim token ke siapa pun, termasuk ke chat.
- Kalau token bocor atau kedaluwarsa: hapus di GitHub (Developer settings) dan buat baru.
- Admin membaca data dari `data.js` di folder admin-mu dan dari data tersimpan di browser. Pastikan admin memuat data terbaru sebelum Publikasikan, karena Publikasikan **menimpa** `data.js` di GitHub. Kalau kamu pernah minta Claude mengubah data, klik **Import data.js** dengan file terbaru dulu.
- Tombol **Download data.js** tetap ada sebagai cadangan.
- Kalau muncul "Gagal publikasi", pesan error menjelaskan penyebabnya (token salah, nama repo salah, dst).

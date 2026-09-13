

# Run and deploy app

This contains everything you need to run your app locally.

## Run Frontend (Vite)

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in `.env.local` to your Gemini API key
3. Run the app:
   `npm run dev`

## Run Backend API (FastAPI)

**Prerequisites:** Python 3.10+

1. (Recommended) Create virtual environment:
   - Windows (PowerShell):
     `python -m venv .venv`
     `.\.venv\Scripts\Activate`
2. Install API dependencies:
   `pip install -r api/requirements.txt`
3. Set PostgreSQL environment variables (password diisi manual):
   - `POSTGRES_HOST=localhost`
   - `POSTGRES_PORT=5432`
   - `POSTGRES_DB=logbook_db`
   - `POSTGRES_USER=postgres`
   - `POSTGRES_PASSWORD=your_password_here`
4. Run FastAPI server:
   `uvicorn api.main:app --reload --host 0.0.0.0 --port 8000`
5. Open API docs:
   - Swagger UI: `http://localhost:8000/docs`
   - PostgreSQL connection endpoint: `http://localhost:8000/db/connect`

## Mata kuliah

Jalankan migrasi database sebelum menggunakan frontend/backend versi ini. Untuk
database baru, jalankan `001_init_logbook_schema.sql` terlebih dahulu. Untuk
database lama yang sudah memiliki tabel, jalankan hanya migrasi kedua, satu kali:

```powershell
psql -h localhost -U postgres -d logbook_db -v ON_ERROR_STOP=1 -f 002_add_matakuliah.sql
```

Migrasi mempertahankan kelompok, anggota, dan laporan lama dalam **Mata Kuliah
Lama**. Admin dapat mengubah namanya melalui panel Admin. Keanggotaan sekarang
tersimpan di `peserta_matakuliah`: satu mahasiswa dapat mengikuti beberapa MK,
dengan maksimal satu kelompok per MK. Kolom lama `mahasiswa.grup_id` dipertahankan
untuk kompatibilitas data lama; alur kelompok yang baru memakai tabel keanggotaan.

Alur admin:
1. Buka **Admin → Matakuliah**, klik **Tambah MK**, lalu isi nama dan simpan melalui modal.
   Tabel menampilkan MK, jumlah kelompok, dan jumlah mahasiswa terdaftar. Klik baris
   MK untuk membuka seluruh kelompok beserta nama anggotanya; ubah nama MK tersedia
   pada rincian tersebut.
2. Buka tab **Kelompok/Grup**, pilih MK, lalu buat kelompok untuk MK tersebut.
3. Buka tab **Mahasiswa**, pilih MK dan kelompok mahasiswa. Ini sekaligus
   mendaftarkan mahasiswa ke MK aktif. Tersedia juga pilihan mendaftar tanpa kelompok.
4. Ulangi pada MK lain jika mahasiswa mengikuti beberapa MK.
5. Pada tab **Monitoring Log**, gunakan **Filter MK** dan **Filter Kelompok/Grup**.
   Mengganti MK mengembalikan filter kelompok ke Semua Kelompok tanpa menutup tab.

Mahasiswa yang mengikuti satu MK otomatis menggunakan MK tersebut tanpa dropdown.
Jika mengikuti lebih dari satu MK, dropdown muncul di kanan atas. Kelompok,
ringkasan, riwayat, dan laporan baru mengikuti MK aktif. Mengganti MK menutup dan
mereset formulir laporan. Melepas kelompok tetap mempertahankan pendaftaran MK.
Satu laporan per mahasiswa per minggu diperbolehkan **untuk setiap MK**.

Proxy produksi perlu meneruskan `/matakuliah` ke FastAPI, sebagaimana `/grup` dan
`/logbook`. Proxy pengembangan Vite sudah menyertakannya.

Validasi:
```powershell
npm run lint
npm run build
node --test tests/frontend-matakuliah.test.mjs
pip install httpx
$env:LOGBOOK_TEST_DATABASE_URL = 'postgresql+psycopg2://USER:PASSWORD@localhost:5432/TEST_DATABASE'
python -m unittest api.tests.test_matakuliah -v
```

Tes integrasi membutuhkan database pengujian PostgreSQL dengan izin membuat skema.
Tes membuat skema bernama acak, menguji migrasi serta API dua MK, lalu menghapus
skema pengujiannya. Jangan arahkan variabel pengujian ke database produksi.

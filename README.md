# Kanban Board + Timeline

Kanban board multi-project dengan timeline Gantt. Dibangun dengan **Next.js 15**, **Better Auth**
(email & password), **Supabase Postgres** (via Drizzle ORM), dan siap deploy ke **Vercel**.

## Fitur

- **Login / daftar** dengan Better Auth (email + password). Data setiap user terpisah.
- **Project switcher**: pilih satu project (mis. _Insight_) untuk melihat board & timeline project itu saja,
  atau **Semua Project** untuk melihat semuanya digabung.
- **Board bisa dikustom**: tambah, rename (klik dua kali judul atau lewat menu `⋯`), hapus, dan geser
  kiri/kanan. Project baru otomatis punya board _To Do_, _In Progress_, _Done_.
- **Drag & drop task** antar board dan untuk mengubah urutan.
- **Timeline (Gantt)**: drag bar untuk menggeser jadwal, tarik ujung bar untuk mengubah durasi,
  klik untuk edit. Zoom Hari / Minggu / Bulan, tombol "Hari ini", task di board _Done_ dicoret.
  Task yang belum punya tanggal bisa dijadwalkan dengan klik langsung di timeline.

### Cara kerja mode "Semua Project"

Board dari semua project digabung **berdasarkan nama**. Contoh: _To Do_ di Insight dan _To Do_ di
Website tampil sebagai satu board _To Do_.

- Memindahkan task ke board yang belum dimiliki project-nya (mis. task Website ke _Review_ yang
  hanya ada di Insight) otomatis membuat board _Review_ di project Website.
- Tambah board di mode ini → board dibuat di semua project.
- Rename / hapus board di mode ini → berlaku untuk semua board dengan nama itu.

## Setup lokal

1. **Buat project Supabase** di <https://supabase.com>, lalu buka **Connect** (tombol di atas dashboard)
   → **ORMs / Connection string**. Ambil dua URL:
   - **Transaction pooler** (port `6543`) → `DATABASE_URL`
   - **Session pooler** (port `5432`) → `DIRECT_URL`
2. Salin env:
   ```bash
   cp .env.example .env.local
   ```
   Isi `DATABASE_URL`, `DIRECT_URL`, dan `BETTER_AUTH_SECRET` (buat dengan `npx @better-auth/cli secret`).
3. **Buat tabel**: copy isi [`supabase/schema.sql`](supabase/schema.sql) ke Supabase → **SQL Editor** → Run.
   (Alternatif: `npm run db:push`, tapi lalu jalankan juga baris `enable row level security` di akhir
   file SQL tersebut.)
4. Jalankan:
   ```bash
   npm install
   npm run dev
   ```
   Buka <http://localhost:3000>, daftar akun, lalu buat project pertama.

## Login dengan Google

Tombol "Lanjutkan dengan Google" otomatis muncul kalau `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` diisi.

1. Buka <https://console.cloud.google.com> → buat / pilih project.
2. **APIs & Services → OAuth consent screen**: isi nama app & email, User type **External**, lalu publish
   (atau tambahkan email kamu sebagai test user).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → tipe **Web application**:
   - **Authorized JavaScript origins**: `http://localhost:3000` dan `https://<domain-vercel-kamu>`
   - **Authorized redirect URIs**:
     `http://localhost:3000/api/auth/callback/google` dan
     `https://<domain-vercel-kamu>/api/auth/callback/google`
4. Salin Client ID & Client Secret ke `.env.local` dan ke Environment Variables di Vercel, lalu redeploy.

Kalau email Google sama dengan akun yang sebelumnya daftar pakai password, keduanya otomatis
tersambung ke akun yang sama.

## Deploy ke Vercel

1. Push folder ini ke GitHub.
2. Di Vercel: **Add New → Project** → import repo.
3. Tambahkan **Environment Variables**:
   | Nama | Nilai |
   | --- | --- |
   | `DATABASE_URL` | Supabase transaction pooler URL (port 6543) |
   | `BETTER_AUTH_SECRET` | string acak yang sama seperti lokal (atau buat baru) |
   | `BETTER_AUTH_URL` | URL produksi, mis. `https://kanban-kamu.vercel.app` |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | (opsional) untuk login Google |
4. Deploy. Tabel cukup dibuat sekali (langkah 3 setup lokal), tidak perlu di Vercel.

> Setelah deploy pertama, kalau URL Vercel berbeda dari yang kamu isi di `BETTER_AUTH_URL`,
> perbarui env tersebut lalu **Redeploy**.

## Struktur

```
src/
  app/
    actions.ts              server actions (CRUD project/board/task, cek kepemilikan per user)
    page.tsx                load data user → <Workspace />
    login/page.tsx          halaman masuk / daftar
    api/auth/[...all]/      handler Better Auth
  components/
    workspace.tsx           sidebar project, tab Board/Timeline, state & sinkronisasi
    kanban-board.tsx        board + drag & drop (dnd-kit)
    gantt-chart.tsx         timeline Gantt
    task-dialog.tsx, project-dialog.tsx
  db/schema.ts              skema Drizzle (tabel Better Auth + project, board_column, task)
  lib/auth.ts               konfigurasi Better Auth
  lib/board.ts              logika penggabungan board antar project
supabase/schema.sql         SQL alternatif untuk membuat tabel
```

## Catatan keamanan

App terhubung langsung ke Postgres (bukan Supabase REST API). `schema.sql` mengaktifkan
Row Level Security tanpa policy sehingga tabel tidak bisa diakses lewat anon key Supabase.
Semua akses data dicek kepemilikannya di server actions.

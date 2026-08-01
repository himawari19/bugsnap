# Mazway Dashboard

Web dashboard untuk **mazwayScreen** — platform screen recording & bug reporting ala Jam.dev/Loom.

- **Stack**: Next.js 14 (App Router) + Tailwind CSS + Supabase (PostgreSQL + Auth)
- **Storage**: Google Drive (milik user) — biaya Rp 0 untuk file
- **Auth**: Google OAuth via Supabase

## Fitur

### Dashboard (`/dashboard`)
- Analytics overview: total captures, recordings, screenshots, activity minggu ini
- Grafik aktivitas 7 hari + recent activity

### Captures (`/captures`)
- Grid semua capture (screenshot + video)
- Infinite scroll (12 item per batch, auto-load saat scroll)
- Filter tipe (Screenshot / Video) + search
- Badge durasi video, tag, dan status di kartu
- Edit modal: title, description, password, expiry, tag, status

### Detail Capture (`/captures/[id]`)
- Preview media (video embed / screenshot)
- DevTools panel: Info (OS, browser, window size), Console, Network (copy as cURL), Actions
- Komentar + thread reply (real-time via Supabase Realtime)

### Public Share (`/c/[id]`)
- Halaman publik tanpa login
- Password gate & expiry (via RPC `get_public_capture` — aman, tidak membocorkan data)
- Komentar publik
- Tombol Embed (iframe) + QR code
- ✨ AI Bug Report (OpenAI, fallback parser lokal)

### Settings (`/settings`)
- Webhook URL (Slack/Discord/Zapier)
- Custom branding: brand name, logo, hide watermark
- Team members (`/settings/members`): invite/remove member per workspace

### API Routes
| Route | Deskripsi |
|---|---|
| `POST /api/ai-bug-summary` | Generate bug report dari dev_logs (OpenAI, fallback lokal) |
| `GET /api/weekly-digest?token=CRON_SECRET` | Email digest mingguan (Resend) |

## Menjalankan Lokal

```bash
cd mazway-dashboard
npm install
npm run dev
```

Buka `http://localhost:3000`. Pastikan `.env.local` ada:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

### Env Opsional
```
OPENAI_API_KEY=...      # AI bug report pakai GPT-4o-mini
RESEND_API_KEY=...      # weekly digest email
RESEND_FROM_EMAIL=...
CRON_SECRET=...         # guard /api/weekly-digest
```

## Deploy ke Vercel

1. Import repo di [vercel.com](https://vercel.com)
2. Set env vars di project settings
3. Deploy. URL default: `https://<project>.vercel.app`

Setelah deploy, **wajib update `prodUrl`** di `mazwayScreen/editor.js`:
```js
prodUrl: 'https://<project>.vercel.app'
```

### Cron (opsional, weekly digest)
Tambahkan di `vercel.json`:
```json
{
  "crons": [{ "path": "/api/weekly-digest?token=CRON_SECRET", "schedule": "0 9 * * 1" }]
}
```

## Database (Supabase)

Schema & RPC lengkap ada di:
- `mazwayScreen/schema.sql` — baseline (users, workspaces, workspace_members, captures)
- `mazwayScreen/schema-bridge.sql` — email-link bridge (insert_capture_by_email)
- `mazwayScreen/schema-duration.sql` — kolom duration
- `mazwayScreen/schema-os-browser.sql` — kolom os/browser
- `mazwayScreen/schema-phase1.sql` — tabel comments
- `mazwayScreen/schema-saas-power.sql` — workspace_settings
- `mazwayScreen/schema-workspace-rpcs.sql` — RPC workspace

> ⚠️ **Jangan commit `.env.local`** — sudah di `.gitignore`.

> 📖 Aturan pengembangan: baca `AGENTS.md` di root proyek.

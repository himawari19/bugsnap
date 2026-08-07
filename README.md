# BugSnap
> **BugSnap - From Click to Fix · by akusaradigital.com**

Web dashboard untuk **BugSnap** — platform screen recording & bug reporting ala Jam.dev/Loom.

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

### Detail & Public Share (`/v/[id]`)
- Preview media (video embed / screenshot)
- DevTools panel: Info (OS, browser, window size), Console, Network (copy as cURL), Actions
- Halaman share tanpa login dengan password gate & expiry via RPC `get_public_capture`
- Komentar + thread reply (real-time via Supabase Realtime)
- Tombol Embed (iframe)
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
cd bugsnap
npm install
npm run dev
```

Buka `http://localhost:3000`. Pastikan `.env.local` ada:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key> # server only, jangan pakai prefix NEXT_PUBLIC_
```

### Env Opsional
```
OPENAI_API_KEY=...       # AI bug report pakai GPT-4o-mini
STRIPE_WEBHOOK_SECRET=... # verifikasi signature webhook Stripe
RESEND_API_KEY=...       # weekly digest email
RESEND_FROM_EMAIL=...
CRON_SECRET=...          # Bearer token /api/weekly-digest
```

## Deploy ke Vercel

1. Import repo di [vercel.com](https://vercel.com)
2. Set env vars di project settings
3. Deploy. URL default: `https://bugsnap.vercel.app`

Setelah deploy, **wajib update `prodUrl`** di `BugSnap/editor.js`:
```js
prodUrl: 'https://bugsnap.vercel.app'
```

### Cron (opsional, weekly digest)
Panggil `GET /api/weekly-digest` setiap Senin pukul 09:00 dengan header
`Authorization: Bearer <CRON_SECRET>`. Jangan menaruh secret di query string atau
path cron.

## Database (Supabase)

Schema dan RPC yang dikelola repository ini ada di direktori `supabase/`.
Terapkan migration bernomor secara berurutan pada project baru. Untuk deployment
lama, review dan backup database sebelum menerapkan migration terbaru; jangan
menjalankan integration test repository terhadap database produksi.

> ⚠️ **Jangan commit `.env.local`** — sudah di `.gitignore`.

> 📖 Aturan pengembangan: baca `AGENTS.md` di root proyek.

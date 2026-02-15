# Micro Reads

A personal daily reading app that delivers bite-sized chunks from your epub library to your inbox each morning.

![Screenshot 1](docs/Screenshot%201.png)
![Screenshot 2](docs/Screenshot%202.png)

## Features

- **Epub upload & chunking** — Upload epubs, configure chunk size (300-3000 words), and the app splits them into daily-sized readings that respect paragraph and chapter boundaries
- **Daily email digest** — A morning email with a teaser from each active book and a link to the full reading in the web app
- **Premium reading view** — Beautifully typeset with serif fonts, warm colors, dark mode, and zero clutter
- **Progress tracking** — Library view with progress bars, book detail pages with chapter lists, and reading stats
- **Stats dashboard** — GitHub-style reading heatmap, streaks, words-per-day chart

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router) |
| Database | SQLite via Drizzle ORM |
| Styling | Tailwind CSS + shadcn/ui |
| Email | React Email + Nodemailer (SMTP) |
| AI Recaps | Ollama (local, optional) |
| Scheduling | node-cron |

## Getting Started

### Prerequisites

- Node.js 20+
- An SMTP account for sending emails (Gmail, Fastmail, etc.)

### Setup

```bash
git clone git@github.com:dustinmartin/microreads.git
cd microreads
npm install
cp .env.example .env.local
```

Edit `.env.local` with your config:

```
AUTH_SECRET=your-random-secret-string
SMTP_HOST=smtp.fastmail.com
SMTP_PORT=587
SMTP_USER=you@example.com
SMTP_PASS=app-password
EMAIL_TO=you@example.com
# Optional for digest links:
APP_BASE_URL=https://your-hostname.ts.net
SEND_TIME=30 6 * * *
```

### Run

```bash
npx drizzle-kit migrate    # Create database tables
npm run dev                 # Start dev server at http://localhost:3000
```

### Build for Production

```bash
npm run build
npm run start
```

### Run On A PC (Docker, Auto-Restart)

Use Docker Compose so the app restarts automatically after reboot/crash.

```bash
docker compose up -d --build
docker compose logs -f microreads
```

Stop/restart:

```bash
docker compose stop
docker compose start
```

The compose setup mounts `./data` and `./covers` for persistent storage and uses `restart: unless-stopped`.

Set `APP_BASE_URL` in `.env` to your tailnet HTTPS URL on that PC (for example `https://your-pc-name.ts.net`) so email links resolve correctly.

If you want tailnet-only HTTPS access, run on that machine:

```bash
tailscale serve --bg 3000
tailscale serve status
```

## Testing

```bash
npm run test:e2e            # Run Playwright E2E tests
npm run test:e2e:ui         # Run tests with interactive UI
npm run test:e2e:headed     # Run tests in headed browser mode
npx playwright install      # Install browsers (first time only)
```

## How It Works

1. Upload an epub at `/upload` and pick a chunk size
2. The app parses the epub, splits it into chunks, and adds it to your library
3. Every morning at your configured time, you get an email with a teaser from each active book
4. Click through to read the full chunk in the web app with beautiful typography
5. Mark as read to advance to the next chunk
6. Track your progress and reading streaks on the stats page

## Configuration

All settings are manageable at `/settings`:

- **Email address** — Where to send the daily digest
- **Send time** — When to deliver (cron expression, default 6:30 AM)

The `/api/trigger` endpoint accepts a Bearer token (your `AUTH_SECRET`) for triggering digests from iOS Shortcuts or other automations.

## Data Storage

All data lives locally:

- **Database:** `data/microread.db` (SQLite)
- **Epubs:** `data/epubs/`
- **Covers:** `covers/`

Back up the `data/` and `covers/` directories to preserve everything.

## License

Personal project. Not licensed for redistribution.

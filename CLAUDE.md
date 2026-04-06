# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Next.js Version Warning

This project uses Next.js 16.2.2 with breaking changes — APIs, conventions, and file structure may differ from training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Commands

```bash
npm run dev       # Local dev server (http://localhost:3000)
npm run build     # Production build (also runs TypeScript checks)
npm run lint      # ESLint
./release.sh      # Build multi-arch Docker image, push to registry, deploy to LXC
```

No test framework is configured.

## Architecture

**GCA (Google Calendar Assistant)** — a Next.js App Router application for managing Google Calendar events with AI-powered event creation via Gemini. No database; all data lives in Google Calendar.

### Stack

- Next.js 16 (App Router, `output: "standalone"` for Docker)
- React 19, TypeScript 5, Tailwind CSS 4
- shadcn/ui components (base-ui/react primitives)
- `googleapis` for Google Calendar API, `@google/genai` for Gemini
- `jose` for encrypted JWT session cookies
- Icons: lucide-react

### Data Flow

```
Browser → Client hooks (useEvents, useCalendars, useSearchEvents)
       → API routes (src/app/api/*)
       → Google lib layer (src/lib/google/*)
       → Google Calendar API v3
```

No Redux/Zustand — state is React `useState` + URL query params (`?date=YYYY-MM-DD`) + localStorage (`gca:selectedCalendarIds`, `gca:selectedAiModel`).

### Key Directories

- `src/lib/google/` — One function per file pattern: `events.ts`, `create-event.ts`, `update-event.ts`, `search-events.ts`, `calendars.ts`. Follow this pattern when adding new Google API operations.
- `src/lib/auth/` — Session management via encrypted JWT cookies (`gca_session`). `getAuthClient()` is the auth gate used by all API routes.
- `src/hooks/` — Client-side data fetching hooks. `useEvents(date, calendarIds)` and `useSearchEvents(query)` are the main ones.
- `src/components/dashboard/` — Feature components. `timeline-view.tsx` renders the daily timeline; `top-bar.tsx` has date nav, search, calendar filter; `edit-panel.tsx` is the right sidebar editor.
- `src/components/ui/` — shadcn/ui primitives (Button, Input, Dialog, Popover, etc.)

### Auth Flow

Google OAuth2 → `/api/auth/google` → Google consent → `/api/auth/callback` → encrypted session cookie. Tokens auto-refresh 5 minutes before expiry. All API routes check auth via `getAuthClient()`.

### Recurring Events

Updates support three modes via `RecurrenceMode`: `"single"`, `"thisAndFollowing"`, `"all"`. The "all" mode does a full PUT on the master event. The "thisAndFollowing" mode batches PATCH calls (batch size 10).

### AI Integration

Gemini with Google Search grounding. The system prompt in `src/app/api/events/ai-create/route.ts` has detailed formatting rules for birthdays, historical events, and multilingual support. AI responses follow a strict JSON schema.

## Environment Variables

```
GOOGLE_CLIENT_ID        # OAuth2 client ID
GOOGLE_CLIENT_SECRET    # OAuth2 client secret
GOOGLE_REDIRECT_URI     # e.g., http://localhost:3000/api/auth/callback
SESSION_SECRET          # Min 32 chars for JWT encryption
GEMINI_API_KEY          # For AI features
```

## Deployment

Multi-stage Docker build (Node 20 Alpine). `release.sh` builds `linux/amd64,linux/arm64`, pushes to `registry.yurii.live/gca`, then SSH-deploys to `192.168.10.40`. Version comes from `package.json`.

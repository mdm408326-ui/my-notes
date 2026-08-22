# My Notes

A React reminder-notes app with Supabase authentication and a SQL database.
Each signed-in user can only see their own notes.

## Set up Supabase (free)

1. Create a free project at [Supabase](https://supabase.com/dashboard).
2. In **SQL Editor**, run the contents of `supabase/schema.sql`.
3. In **Project Settings → API**, copy the Project URL and the public anon key.
4. Create a file named `.env` beside `package.json`, using `.env.example` as a guide.

Only use the public **anon** key in `.env`. Never put a Supabase service-role key
in this website — anything in a `VITE_`-prefixed variable is shipped to the browser.

## Run it on your computer

```bash
npm install
npm run dev
```

That's the whole app — Supabase handles accounts and stores the notes, so there
is no separate backend server to run.

## Reminder notifications (phone push)

Notes with a reminder time can push a notification to the user's phone, even
when the site is closed. This uses Web Push (a PWA service worker) plus a
scheduled Supabase Edge Function. It needs a few one-time setup steps —
see [`supabase/README-reminders.md`](supabase/README-reminders.md).

## Put it online with Render

The app is a static site (Supabase is the backend), so deploy it as a Render
**Static Site**:

1. Put this project in a GitHub repository.
2. In Render, create a **Static Site** from that GitHub repository (or let it read
   the included `render.yaml`).
3. Build command: `npm install && npm run build`
4. Publish directory: `dist`
5. Under **Environment**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
   Vite reads these at build time, so redeploy after changing them.

Render gives you a public address for the app.

## Tech notes

This project uses [Vite](https://vite.dev) with the
[@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) plugin for
React with Fast Refresh, plus a minimal ESLint setup.

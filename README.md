# My Notes

A React reminder-notes app with Supabase authentication and a SQL database.
Each signed-in user can only see their own notes.

## Set up Supabase (free)

1. Create a free project at [Supabase](https://supabase.com/dashboard).
2. In **SQL Editor**, run the contents of `supabase/schema.sql`.
3. In **Project Settings → API**, copy the Project URL and the public anon key.
4. Create a file named `.env` beside `package.json`, using `.env.example` as a guide.

Only use the public **anon** key in `.env`. Never put a Supabase service-role key
in this website.

## Run it on your computer

Open two terminals:

```bash
# Website
npm run dev

# Notes server
cd server
npm run dev
```

## Put it online with Render

1. Put this project in a GitHub repository.
2. In Render, create a **Web Service** from that GitHub repository.
3. Use these commands in Render:

   - Build command: `npm install && npm --prefix server install && npm run build`
   - Start command: `npm --prefix server start`

Render gives you a public address for the complete app.

> This first learning version stores notes in a small file. On free hosting,
> that file can be reset when the server restarts. Before sharing it widely,
> replace it with a cloud database such as Supabase.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

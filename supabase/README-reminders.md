# Reminder push notifications — setup

Notes with a reminder time send a Web Push notification to the user's phone,
even when the site is closed. This needs a few one-time setup steps in your
Supabase project. Do them in order.

## 1. Database

In **SQL Editor**, run `supabase/reminders.sql` (or `supabase/schema.sql` for a
brand-new project — it already includes the reminder tables).

## 2. VAPID keys

Web Push is authenticated with a VAPID key pair. Generate one:

```bash
npx web-push generate-vapid-keys
```

- Put the **public** key in `.env` as `VITE_VAPID_PUBLIC_KEY` (safe for the browser).
- Keep the **private** key secret — it goes in step 4, never in the repo.

## 3. Deploy the Edge Function

Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy send-reminders
```

## 4. Set the function secrets

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY="your_public_key" \
  VAPID_PRIVATE_KEY="your_private_key" \
  VAPID_SUBJECT="mailto:you@example.com"
```

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — do
not set them yourself.)

## 5. Run it every minute (cron)

In **SQL Editor**, enable the scheduler extensions once, then schedule the call.
Replace `YOUR_PROJECT_REF` and the service-role key.

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-reminders-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.functions.supabase.co/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    )
  );
  $$
);
```

To stop it later: `select cron.unschedule('send-reminders-every-minute');`

## Testing

1. Open the site over **HTTPS** (Web Push does not work over plain HTTP, except
   on `http://localhost` during development).
2. Click **🔔 Enable reminders** and allow notifications.
3. Create a note with a reminder time a minute or two in the future.
4. Within a minute of that time you should get a notification.

You can also trigger the function by hand to test:

```bash
curl -X POST 'https://YOUR_PROJECT_REF.functions.supabase.co/send-reminders' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY'
```

## Notes

- **iPhone:** Apple only allows Web Push if the site is added to the Home Screen.
  In Safari: **Share → Add to Home Screen**, open it from there, then enable
  reminders. Android works in the normal browser.
- Notifications are per **device**. A user who enables them on their phone and
  laptop gets the reminder on both.

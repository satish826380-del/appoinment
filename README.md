# Clinic Appointment Booking System

Full-stack React + Supabase clinic appointment app using:

- Supabase Auth, Postgres, RLS, and Realtime
- React Router
- React Big Calendar
- React Hot Toast
- TailwindCSS

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Supabase project

This app is connected to:

```text
https://yxwvhkislhyqoybkhyve.supabase.co
```

The schema and RLS policies have already been applied to that project.

## Make an admin account

1. Register normally in the app with the email you want to use for clinic staff.
2. In Supabase SQL editor, run:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users
  where email = 'admin@example.com'
);
```

Replace `admin@example.com` with the real admin email.

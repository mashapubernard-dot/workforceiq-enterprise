# WorkforceIQ Enterprise on Replit

## Run the app

The `Start application` workflow runs:

```bash
npm run dev
```

The Next.js development server is configured to listen on port `5000`, which
is the port used by the Replit web preview.

## Supabase configuration

The app uses the existing Supabase project for:

- Supabase Auth
- PostgreSQL data access
- Storage, including clock-in photos
- Realtime-ready data access

These Replit Secrets must be configured:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The database schema has already been applied in Supabase. The app's Supabase
client is initialized from these two public environment variables at build
and runtime.

## Local commands

```bash
npm install
npm run dev
npm run build
```

Use the Supabase Auth account configured in the connected project to sign in.
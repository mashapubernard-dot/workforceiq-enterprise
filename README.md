# WorkforceIQ Enterprise

A production-oriented South African workforce-management SaaS starter built around Next.js, shadcn/ui, and Supabase.

## Included
- Multi-tenant companies and branches
- Supabase Auth-ready login
- Admin / Manager / Agent roles
- Shift scheduling
- GPS + photo clock-in/out flow
- Performance, QA, inventory, and alerts pages
- Responsive white/red UI with dark mode
- SQL schema with RLS policies
- Storage bucket for `clockin-photos`
- Realtime-ready data model

## Quick start
1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Copy `.env.example` to `.env.local` and add Supabase URL + anon key.
4. Install dependencies: `npm install`
5. Run: `npm run dev`
6. Open the local URL and test the dashboards.

This package is a runnable foundation; WhatsApp/email providers should be connected through Supabase Edge Functions before production rollout.

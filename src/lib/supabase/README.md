# Supabase Hookup Notes

The app currently runs as a local demo with `localStorage`, so the marketing dashboard, master table, and import workflow can be tested without credentials.

To connect Supabase:

1. Create a Supabase project.
2. Run `supabase/migrations/20260710110000_initial_schema.sql`.
3. Add env vars:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

4. Replace `AppStoreProvider` localStorage reads/writes with Supabase queries and mutations.
5. Keep role behavior simple:
   - `admin`: full access.
   - `viewer`: read-only dashboard/calendar access if needed later.

Protect contact, consent, media, and platform import tables behind authenticated access. Treat Booking/Airbnb imports as raw source data that must be linked to bookings or explicitly marked as requiring review.

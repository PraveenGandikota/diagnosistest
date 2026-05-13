# Diagnosetest — Multi-Campus Diagnostic Quiz Platform

React 18 + Vite + TypeScript + Supabase.

## Quick start

```bash
npm install
cp .env.example .env   # then fill in your Supabase project values
npm run dev            # http://localhost:8080
```

## Supabase environment

The frontend needs three values. They live in `.env` (already gitignored — make sure your local copy is up to date, never commit secrets):

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_PROJECT_ID` | Supabase dashboard → Project Settings → General |
| `VITE_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase dashboard → Project Settings → API → `anon`/`publishable` key |

[src/integrations/supabase/config.ts](src/integrations/supabase/config.ts) throws a friendly error if either of the last two is missing, so misconfiguration fails loud and early.

## Database migrations

Migrations live in [supabase/migrations/](supabase/migrations/). Apply them with the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Latest migration `20260513120000_add_remediation_fields.sql` adds three additive columns to `public.questions`:

- `recommended_remediation_beginner text NOT NULL DEFAULT ''`
- `recommended_remediation_intermediate text NOT NULL DEFAULT ''`
- `mastery_indicator text NOT NULL DEFAULT ''`

It is safe to re-run (`IF NOT EXISTS`), and old questions / old CSVs keep working because the columns default to empty strings.

If you don't use the CLI, paste the SQL into Supabase SQL Editor → Run.

## Roles

- **Super Admin** — access code `8096` (hard-coded client-side in [src/lib/admin-access.ts](src/lib/admin-access.ts)). Sees everything across campuses, uploads questions and students.
- **Campus Admin** — per-campus access code set in the Campuses tab. Sees only their own campus's students and submissions.
- **Student** — signs in with campus + student ID + full name. Takes quizzes, sees per-quiz feedback with remediation hints.

## Question CSV format

Download the latest template from Admin → Uploads → "Download template". Headers (aliases supported, see [src/lib/csv-import.ts](src/lib/csv-import.ts)):

```
skill, level, quiz_number,
kc, topic, sub_topic, type,
question, code,
option_a, option_b, option_c, option_d,
correct_option,
option_a_diagnosis, option_b_diagnosis, option_c_diagnosis, option_d_diagnosis,
explanation,
recommended_remediation_for_beginner,
recommended_remediation_for_intermediate,
mastery_indicator
```

`correct_option` accepts `A`/`B`/`C`/`D` or `0`-`3`. The diagnosis column matching the correct option is automatically skipped (only the three wrong-option diagnoses are stored).

## Security note (RLS)

For local dev, every table has wide-open RLS policies (`USING (true) WITH CHECK (true)` on the `anon` role). **Do not ship to production like this.** Before going live:

1. Enable Supabase Auth (magic link or email/password).
2. Move `SUPER_ADMIN_CODE` out of the client into a `roles` table keyed by `auth.uid()` or into an Edge Function check.
3. Replace the open policies with role-scoped ones (`auth.uid()` checks, plus campus-scoped reads for students).
4. Restrict the `anon` key to read-only paths; route writes through Edge Functions or a service role.

## Scripts

```bash
npm run dev       # dev server on port 8080
npm run build     # production build
npm run lint      # ESLint
npm run test      # Vitest one-shot
```

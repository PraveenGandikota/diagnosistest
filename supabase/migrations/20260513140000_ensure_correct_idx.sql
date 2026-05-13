-- Ensure questions.correct_idx exists.
-- The original questions table was created outside this repo (via the Lovable dashboard),
-- so this column may be missing in some Supabase projects. The CSV importer
-- maps "Correct Option" A/B/C/D to 0/1/2/3 and writes it to this column.
--
-- Idempotent — safe to re-run. Existing rows get correct_idx=0 (option A).

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS correct_idx integer NOT NULL DEFAULT 0;

-- Reload PostgREST's schema cache so the column is immediately visible via the REST API.
-- Without this, you can see the column in the table editor but uploads still fail
-- with "Could not find the 'correct_idx' column of 'questions' in the schema cache".
NOTIFY pgrst, 'reload schema';

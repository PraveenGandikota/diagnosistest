-- Exam configuration + student login credential.
--
-- 1. skills gains per-skill exam settings configured by the super admin:
--    - exam_access_code : optional unlock code a student must enter to start.
--    - exam_duration_min: countdown length in minutes (0 = untimed).
--    - max_attempts     : how many times a student may attempt each quiz.
-- 2. students gains access_code — the credential used at login alongside
--    Student ID, so the campus dropdown can be removed. Existing students are
--    backfilled with their Student ID as the default credential, so no one is
--    locked out; the super admin can hand out stronger codes later.
--
-- Idempotent and additive. Frontend code degrades gracefully if this has not
-- been applied yet (untimed, no unlock gate, 1 attempt, ID-as-credential).

ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS exam_access_code text;
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS exam_duration_min integer NOT NULL DEFAULT 30;
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 1;

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS access_code text;

-- Backfill: default credential = the student's own ID (idempotent).
UPDATE public.students
SET access_code = student_id
WHERE access_code IS NULL OR btrim(access_code) = '';

NOTIFY pgrst, 'reload schema';

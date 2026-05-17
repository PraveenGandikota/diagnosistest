-- Exam integrity fields on submissions.
--
-- The proctored exam UI tracks how many times a student left fullscreen or
-- switched away from the exam, and whether the exam was auto-submitted by the
-- 3-strike rule. These columns let admins review that without parsing text.
--
-- Idempotent and additive — saveSubmission() also degrades gracefully if this
-- migration has not been applied yet, so result saving never breaks.

ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS violations integer NOT NULL DEFAULT 0;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS termination_reason text;

NOTIFY pgrst, 'reload schema';

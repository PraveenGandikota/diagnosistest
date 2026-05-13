-- Additive migration: add remediation + mastery fields to questions.
-- Safe to re-run (IF NOT EXISTS). Defaults to '' so existing rows and old CSVs keep working.

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS recommended_remediation_beginner text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS recommended_remediation_intermediate text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mastery_indicator text NOT NULL DEFAULT '';

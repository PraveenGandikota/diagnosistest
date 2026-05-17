-- Exam session codes.
--
-- The Super Admin creates a time-boxed exam session for a campus + skill +
-- level + quiz; the system generates a unique unlock code. Campus admins read
-- the code for their campus and announce it; students type it to start.
--
-- Additive and idempotent. The older skills.exam_access_code column is kept as
-- a compatibility fallback and is NOT removed.

CREATE TABLE IF NOT EXISTS public.exam_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id    uuid REFERENCES public.campuses(id) ON DELETE CASCADE,
  skill_id     uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  level_id     uuid REFERENCES public.levels(id) ON DELETE SET NULL,
  quiz_number  integer NOT NULL DEFAULT 1,
  code         text NOT NULL UNIQUE,
  duration_sec integer NOT NULL DEFAULT 1800,
  max_attempts integer NOT NULL DEFAULT 1,
  starts_at    timestamptz NOT NULL DEFAULT now(),
  ends_at      timestamptz NOT NULL,
  status       text NOT NULL DEFAULT 'active',
  created_by   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

-- Public policies, consistent with the existing tables (the app has no
-- Supabase Auth — access is gated in the application layer).
DROP POLICY IF EXISTS "Public read exam_sessions"   ON public.exam_sessions;
DROP POLICY IF EXISTS "Public write exam_sessions"  ON public.exam_sessions;
DROP POLICY IF EXISTS "Public update exam_sessions" ON public.exam_sessions;
DROP POLICY IF EXISTS "Public delete exam_sessions" ON public.exam_sessions;
CREATE POLICY "Public read exam_sessions"   ON public.exam_sessions FOR SELECT USING (true);
CREATE POLICY "Public write exam_sessions"  ON public.exam_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update exam_sessions" ON public.exam_sessions FOR UPDATE USING (true);
CREATE POLICY "Public delete exam_sessions" ON public.exam_sessions FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_exam_sessions_code   ON public.exam_sessions(code);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_campus ON public.exam_sessions(campus_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_lookup ON public.exam_sessions(skill_id, level_id, quiz_number);

NOTIFY pgrst, 'reload schema';

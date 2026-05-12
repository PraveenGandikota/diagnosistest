
-- Campuses
CREATE TABLE public.campuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  admin_access_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read campuses" ON public.campuses FOR SELECT USING (true);
CREATE POLICY "Public write campuses" ON public.campuses FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update campuses" ON public.campuses FOR UPDATE USING (true);
CREATE POLICY "Public delete campuses" ON public.campuses FOR DELETE USING (true);

-- Students
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  name text NOT NULL,
  email text,
  campus_id uuid NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campus_id, student_id)
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Public write students" ON public.students FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update students" ON public.students FOR UPDATE USING (true);
CREATE POLICY "Public delete students" ON public.students FOR DELETE USING (true);

-- Skills
CREATE TABLE public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read skills" ON public.skills FOR SELECT USING (true);
CREATE POLICY "Public write skills" ON public.skills FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update skills" ON public.skills FOR UPDATE USING (true);
CREATE POLICY "Public delete skills" ON public.skills FOR DELETE USING (true);

-- Levels
CREATE TABLE public.levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (skill_id, name)
);
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read levels" ON public.levels FOR SELECT USING (true);
CREATE POLICY "Public write levels" ON public.levels FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update levels" ON public.levels FOR UPDATE USING (true);
CREATE POLICY "Public delete levels" ON public.levels FOR DELETE USING (true);

-- Extend questions
ALTER TABLE public.questions
  ADD COLUMN skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL,
  ADD COLUMN level_id uuid REFERENCES public.levels(id) ON DELETE SET NULL,
  ADD COLUMN quiz_number int NOT NULL DEFAULT 1,
  ADD COLUMN topic text NOT NULL DEFAULT '',
  ADD COLUMN sub_topic text NOT NULL DEFAULT '';

CREATE INDEX idx_questions_skill_level_quiz ON public.questions(skill_id, level_id, quiz_number);

-- Extend submissions
ALTER TABLE public.submissions
  ADD COLUMN student_uuid uuid REFERENCES public.students(id) ON DELETE SET NULL,
  ADD COLUMN campus_id uuid REFERENCES public.campuses(id) ON DELETE SET NULL,
  ADD COLUMN skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL,
  ADD COLUMN level_id uuid REFERENCES public.levels(id) ON DELETE SET NULL,
  ADD COLUMN quiz_number int NOT NULL DEFAULT 1;

CREATE INDEX idx_submissions_campus ON public.submissions(campus_id);
CREATE INDEX idx_submissions_student ON public.submissions(student_uuid);
CREATE INDEX idx_submissions_skill ON public.submissions(skill_id);

-- Seed skills
INSERT INTO public.skills (name, sort_order, description) VALUES
  ('Computational Thinking', 1, 'Problem decomposition, abstraction, pattern recognition'),
  ('CS Fundamentals', 2, 'Core computer science concepts and reasoning'),
  ('Applied Gen AI Development', 3, 'Building with generative AI tools and APIs'),
  ('UI Engineering', 4, 'Front-end engineering and interface design'),
  ('Quantitative Reasoning', 5, 'Math, statistics, and analytical reasoning'),
  ('Critical Thinking & Communication', 6, 'Reasoning and clear written/oral communication'),
  ('Technical Communication', 7, 'Communicating technical ideas precisely')
ON CONFLICT (name) DO NOTHING;

-- Seed L1 + L2 levels for each skill
INSERT INTO public.levels (skill_id, name, sort_order)
SELECT s.id, 'L1', 1 FROM public.skills s
ON CONFLICT DO NOTHING;
INSERT INTO public.levels (skill_id, name, sort_order)
SELECT s.id, 'L2', 2 FROM public.skills s
ON CONFLICT DO NOTHING;

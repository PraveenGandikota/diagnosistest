
# Diagnostic Platform — Architecture Overhaul

Transform the current single-tenant quiz app into a **multi-campus diagnostic platform** with a Skill → Level → Quiz hierarchy and role-based dashboards.

---

## 1. Roles & Access Model

| Role | Scope | Capabilities |
|---|---|---|
| **Super Admin** | All campuses | Upload students CSV (campus, student_id, name), upload questions CSV (skill/level/quiz tagged), view all campus/skill/student analytics, manage admins |
| **Campus Admin** | One campus | View only their campus students, results, weak KCs per skill, per-student diagnostic reports |
| **Student** | Self | Pick a Skill → see Levels (L1/L2…) → see Quizzes inside that level → take diagnostic → see AI report |

Access via simple code-based gate (existing `useAdminAccess`) extended with role + campus assignment stored in DB.

---

## 2. New Hierarchy

```text
Skill (e.g. Computational Thinking)
 └── Level (L1, L2, L3…)
      └── Quiz (Quiz 1, Quiz 2 … up to 5 per level)
           └── Questions (tagged by KC / Topic / Sub-topic)
```

Replaces the current flat `quiz_name` field. Students must complete **all quizzes in a level** to get a level-completion diagnostic.

---

## 3. Database Schema Changes

### New tables

- **`campuses`** — `id`, `name`, `code`
- **`students`** — `id`, `student_id` (external), `name`, `campus_id`, `email?`
- **`admins`** — `id`, `name`, `access_code` (hashed), `role` (`super` | `campus`), `campus_id` (null for super)
- **`skills`** — `id`, `name` (e.g. "Computational Thinking"), `description`, `order`
- **`levels`** — `id`, `skill_id`, `name` (L1/L2…), `order`

### Modify existing

- **`questions`** — add: `skill_id`, `level_id`, `quiz_number` (1-5), `topic`, `sub_topic`. Keep `kc`, `kc_name` for KC diagnosis. Drop reliance on `quiz_name`.
- **`submissions`** — add: `student_id` (FK to students), `campus_id`, `skill_id`, `level_id`, `quiz_number`. Keep score/answers/ai_report.

### CSV templates (Super Admin uploads)

1. **Students CSV**: `campus,student_id,name,email`
2. **Questions CSV** (per the columns the user listed):  
   `skill,level,quiz_number,kc,topic,sub_topic,question,option_a,option_b,option_c,option_d,correct,wrong_a,wrong_b,wrong_c,explanation`

---

## 4. Revised UI

### Student flow
1. **Login screen** — enter Student ID + Name (validated against `students` table; campus auto-resolved).
2. **Skill picker** — card grid of available skills (Computational Thinking, CS Fundamentals, Applied GenAI, UI Engineering, Quantitative Reasoning, Critical Thinking & Communication, Technical Communication).
3. **Level page** — shows L1, L2… with progress (e.g. "3 / 5 quizzes done").
4. **Quiz list** — 5 quiz tiles in the chosen level, marked complete/pending.
5. **Quiz runner** — existing MCQ flow.
6. **Result page** — existing structured AI report + KC weaknesses.

### Campus Admin dashboard
- Header: campus name, totals.
- **Students tab**: list of campus students + their attempts and average scores.
- **Skills tab**: per-skill aggregate — avg score, weakest KCs, students struggling.
- **Per-student drill-down**: skill-by-skill breakdown, missed KCs, AI reports.

### Super Admin dashboard (extends Campus Admin)
- Adds **Campus filter** + **Skill filter** + **Student filter**.
- **Uploads tab**: Students CSV, Questions CSV, Skills/Levels manager.
- **Cross-campus comparison**: avg score per campus per skill.
- **Manage admins**: add/remove campus admins.

Light theme retained, semantic tokens, consistent with current design.

---

## 5. Implementation Steps

1. **Migration** — create `campuses`, `students`, `admins`, `skills`, `levels`; alter `questions` and `submissions` to add new FKs + columns. Seed the 7 L1 skills the user listed.
2. **Update DB layer** (`src/lib/quiz-db.ts`) — new fetchers for skills, levels, quizzes, students, campus-scoped submissions.
3. **CSV templates & importers** — two new templates (students, questions) with new columns; CSV importer in Super Admin.
4. **Auth/role layer** — extend `admin-access.ts` to resolve role + campus from access code against `admins` table.
5. **Student pages** — replace `Home` with: student login → Skill picker → Level page → Quiz list → existing Quiz runner → existing Result.
6. **Admin pages** — split `Admin.tsx` into:
   - `SuperAdmin.tsx` (uploads, campus/skill/student filters, cross-campus view)
   - `CampusAdmin.tsx` (campus-scoped view)
   - Shared analytics components (KC heatmap, student table, skill summary cards).
7. **Routing** — `/`, `/skills/:skillId`, `/skills/:skillId/levels/:levelId`, `/quiz/:quizId`, `/result`, `/admin` (auto-routes to super or campus dashboard).
8. **Edge function** — `diagnose-report` unchanged, but payload now includes skill/level context.

---

## 6. Notes / Assumptions

- Existing quiz data in DB will be retained but un-tagged to a skill until re-uploaded. I'll provide a migration path: a "Legacy" skill bucket so nothing disappears.
- Access code system stays simple (no full Supabase Auth) unless you want me to add proper login. Each admin row has its own code.
- "Diagnostic platform" framing: no scores/leaderboards-as-progress — focus on weak KCs and recommendations.

---

**Approve this plan and I'll run the migration + rebuild the UI.** Anything to add or cut (e.g. skip cross-campus comparison, skip admins table and use env-based codes, etc.)?

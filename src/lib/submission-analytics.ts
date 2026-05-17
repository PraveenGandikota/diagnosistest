import type { DBSubmission } from "./quiz-db";

export interface KCScore {
  correct: number;
  total: number;
}

export type KCScoreMap = Record<string, KCScore>;

export function getTestedKCsFromScores(kcScores: KCScoreMap): string[] {
  return Object.entries(kcScores)
    .filter(([, value]) => value.total > 0)
    .map(([kc]) => kc)
    .sort();
}

export function getMissedKCsFromAnswers<T extends { kc: string; correct: boolean }>(answers: T[]): string[] {
  const missed = new Set<string>();
  answers.forEach((answer) => {
    if (!answer.correct && answer.kc) {
      missed.add(answer.kc);
    }
  });
  return Array.from(missed);
}

export function getWeakestKCFromScores(kcScores: KCScoreMap): string {
  let weakest = "";
  let lowestPct = Number.POSITIVE_INFINITY;

  Object.entries(kcScores).forEach(([kc, value]) => {
    if (value.total === 0) return;
    const pct = value.correct / value.total;
    if (pct < lowestPct) {
      lowestPct = pct;
      weakest = kc;
    }
  });

  return weakest;
}

// ---------- Attempt review helpers ----------

/** Question-review filter tabs. */
export type ReviewFilter = "all" | "correct" | "wrong" | "unanswered" | "weak";

export interface AttemptCounts {
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
}

/** Correct / wrong / unanswered split. selectedIdx < 0 means the question was left blank. */
export function getAttemptCounts(answers: { correct: boolean; selectedIdx: number }[]): AttemptCounts {
  let correct = 0;
  let wrong = 0;
  let unanswered = 0;
  answers.forEach((a) => {
    if (a.selectedIdx < 0) unanswered += 1;
    else if (a.correct) correct += 1;
    else wrong += 1;
  });
  return { total: answers.length, correct, wrong, unanswered };
}

export type Mastery = "Strong" | "Moderate" | "Weak";

/** Mastery band. 60% is the pass line used across the platform. */
export function masteryLabel(pct: number): Mastery {
  if (pct >= 80) return "Strong";
  if (pct >= 60) return "Moderate";
  return "Weak";
}

export interface TopicStat {
  topic: string;
  correct: number;
  total: number;
  pct: number;
  mastery: Mastery;
}

/** Per-topic correct/total aggregated from answers, weakest first. */
export function buildTopicStats(
  answers: { correct: boolean; kc: string; kcName?: string }[],
): TopicStat[] {
  const map = new Map<string, { correct: number; total: number }>();
  answers.forEach((a) => {
    const key = (a.kcName || a.kc || "General").trim() || "General";
    const cur = map.get(key) || { correct: 0, total: 0 };
    cur.total += 1;
    if (a.correct) cur.correct += 1;
    map.set(key, cur);
  });
  return Array.from(map.entries())
    .map(([topic, v]) => {
      const pct = v.total ? Math.round((v.correct / v.total) * 100) : 0;
      return { topic, correct: v.correct, total: v.total, pct, mastery: masteryLabel(pct) };
    })
    .sort((a, b) => a.pct - b.pct || a.topic.localeCompare(b.topic));
}

// ---------- Campus analytics aggregations ----------

/** Pass mark used across the platform. */
export const PASS_MARK = 60;

export interface CampusMetrics {
  totalSubmissions: number;
  activeStudents: number;
  avgScore: number;
  passPct: number;
  skillsAttempted: number;
  quizzesConducted: number;
}

export function getCampusMetrics(subs: DBSubmission[]): CampusMetrics {
  const totalSubmissions = subs.length;
  const activeStudents = new Set(subs.map((s) => s.studentUuid).filter(Boolean)).size;
  const avgScore = totalSubmissions
    ? Math.round(subs.reduce((sum, s) => sum + s.scorePct, 0) / totalSubmissions) : 0;
  const passPct = totalSubmissions
    ? Math.round((subs.filter((s) => s.scorePct >= PASS_MARK).length / totalSubmissions) * 100) : 0;
  const skillsAttempted = new Set(subs.map((s) => s.skillId).filter(Boolean)).size;
  const quizzesConducted = new Set(
    subs.map((s) => `${s.skillId ?? "?"}|${s.levelId ?? "?"}|${s.quizNumber ?? 1}`),
  ).size;
  return { totalSubmissions, activeStudents, avgScore, passPct, skillsAttempted, quizzesConducted };
}

export interface SkillAverage { skillId: string; attempts: number; avgScore: number; }

/** Average score per skill, highest first. */
export function getSkillAverages(subs: DBSubmission[]): SkillAverage[] {
  const map = new Map<string, { sum: number; n: number }>();
  subs.forEach((s) => {
    if (!s.skillId) return;
    const cur = map.get(s.skillId) || { sum: 0, n: 0 };
    cur.sum += s.scorePct; cur.n += 1;
    map.set(s.skillId, cur);
  });
  return Array.from(map.entries())
    .map(([skillId, v]) => ({ skillId, attempts: v.n, avgScore: Math.round(v.sum / v.n) }))
    .sort((a, b) => b.avgScore - a.avgScore);
}

export interface TrendPoint { date: string; label: string; attempts: number; avgScore: number; }

/** Attempts and average score grouped by calendar day, oldest first. */
export function getAttemptsTrend(subs: DBSubmission[]): TrendPoint[] {
  const map = new Map<string, { sum: number; n: number }>();
  subs.forEach((s) => {
    const d = new Date(s.date);
    if (isNaN(d.getTime())) return;
    const key = d.toISOString().slice(0, 10);
    const cur = map.get(key) || { sum: 0, n: 0 };
    cur.sum += s.scorePct; cur.n += 1;
    map.set(key, cur);
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      label: new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      attempts: v.n,
      avgScore: Math.round(v.sum / v.n),
    }));
}

export function getPassFail(subs: DBSubmission[]): { pass: number; fail: number } {
  let pass = 0;
  let fail = 0;
  subs.forEach((s) => { if (s.scorePct >= PASS_MARK) pass += 1; else fail += 1; });
  return { pass, fail };
}

export interface WeakTopicStat { topic: string; accuracyPct: number; wrongCount: number; total: number; }

/** Weakest topics across submissions, aggregated from kc_scores. */
export function getTopWeakTopics(subs: DBSubmission[], limit = 8): WeakTopicStat[] {
  const map = new Map<string, { correct: number; total: number }>();
  subs.forEach((s) => {
    Object.entries(s.kcScores || {}).forEach(([topic, v]) => {
      if (!v || v.total === 0) return;
      const cur = map.get(topic) || { correct: 0, total: 0 };
      cur.correct += v.correct; cur.total += v.total;
      map.set(topic, cur);
    });
  });
  return Array.from(map.entries())
    .map(([topic, v]) => ({
      topic,
      accuracyPct: v.total ? Math.round((v.correct / v.total) * 100) : 0,
      wrongCount: v.total - v.correct,
      total: v.total,
    }))
    .sort((a, b) => a.accuracyPct - b.accuracyPct)
    .slice(0, limit);
}

export interface CampusStudentRow {
  studentUuid: string;
  name: string;
  externalId: string;
  attempts: number;
  avgScore: number;
  strongestSkillId: string | null;
  weakestSkillId: string | null;
  latestDate: string | null;
  terminationCount: number;
}

/** Per-student performance rows aggregated from their submissions, weakest first. */
export function getCampusStudentRows(subs: DBSubmission[]): CampusStudentRow[] {
  const byStudent = new Map<string, DBSubmission[]>();
  subs.forEach((s) => {
    if (!s.studentUuid) return;
    const arr = byStudent.get(s.studentUuid) || [];
    arr.push(s);
    byStudent.set(s.studentUuid, arr);
  });
  return Array.from(byStudent.entries())
    .map(([studentUuid, list]) => {
      const attempts = list.length;
      const avgScore = Math.round(list.reduce((sum, s) => sum + s.scorePct, 0) / attempts);
      const skillMap = new Map<string, { sum: number; n: number }>();
      list.forEach((s) => {
        if (!s.skillId) return;
        const cur = skillMap.get(s.skillId) || { sum: 0, n: 0 };
        cur.sum += s.scorePct; cur.n += 1;
        skillMap.set(s.skillId, cur);
      });
      const skillAvgs = Array.from(skillMap.entries())
        .map(([id, v]) => ({ id, avg: v.sum / v.n }))
        .sort((a, b) => b.avg - a.avg);
      const latest = [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      return {
        studentUuid,
        name: list[0].studentName || "Student",
        externalId: list[0].studentExternalId || "",
        attempts,
        avgScore,
        strongestSkillId: skillAvgs[0]?.id ?? null,
        weakestSkillId: skillAvgs.length ? skillAvgs[skillAvgs.length - 1].id : null,
        latestDate: latest?.date ?? null,
        terminationCount: list.filter((s) => !!s.terminationReason).length,
      };
    })
    .sort((a, b) => a.avgScore - b.avgScore);
}

// ---------- Global (super-admin) analytics aggregations ----------

export interface IntegrityStats {
  totalViolations: number;
  integrityTerminations: number;
  timeExpired: number;
  terminatedAttempts: number;
}

/** Exam-integrity rollup across submissions. */
export function getIntegrityStats(subs: DBSubmission[]): IntegrityStats {
  let totalViolations = 0;
  let integrityTerminations = 0;
  let timeExpired = 0;
  let terminatedAttempts = 0;
  subs.forEach((s) => {
    totalViolations += s.violations ?? 0;
    const reason = (s.terminationReason ?? "").toLowerCase();
    if (reason) terminatedAttempts += 1;
    if (reason.includes("integrity")) integrityTerminations += 1;
    if (reason.includes("time_expired") || reason.includes("time expired")) timeExpired += 1;
  });
  return { totalViolations, integrityTerminations, timeExpired, terminatedAttempts };
}

export interface CampusRankRow {
  campusId: string;
  attempts: number;
  avgScore: number;
  passPct: number;
  activeStudents: number;
  strongestSkillId: string | null;
  weakestSkillId: string | null;
  violations: number;
}

/** Per-campus performance rollup, highest average first. */
export function getCampusRanking(subs: DBSubmission[]): CampusRankRow[] {
  const byCampus = new Map<string, DBSubmission[]>();
  subs.forEach((s) => {
    if (!s.campusId) return;
    const arr = byCampus.get(s.campusId) || [];
    arr.push(s);
    byCampus.set(s.campusId, arr);
  });
  return Array.from(byCampus.entries())
    .map(([campusId, list]) => {
      const attempts = list.length;
      const avgScore = Math.round(list.reduce((a, s) => a + s.scorePct, 0) / attempts);
      const passPct = Math.round((list.filter((s) => s.scorePct >= PASS_MARK).length / attempts) * 100);
      const activeStudents = new Set(list.map((s) => s.studentUuid).filter(Boolean)).size;
      const skillAvgs = getSkillAverages(list);
      return {
        campusId,
        attempts,
        avgScore,
        passPct,
        activeStudents,
        strongestSkillId: skillAvgs[0]?.skillId ?? null,
        weakestSkillId: skillAvgs.length ? skillAvgs[skillAvgs.length - 1].skillId : null,
        violations: list.reduce((a, s) => a + (s.violations ?? 0), 0),
      };
    })
    .sort((a, b) => b.avgScore - a.avgScore);
}

export interface IntegrityTrendPoint { date: string; label: string; violations: number; terminations: number; }

/** Daily integrity violations and terminations, oldest first. */
export function getIntegrityTrend(subs: DBSubmission[]): IntegrityTrendPoint[] {
  const map = new Map<string, { violations: number; terminations: number }>();
  subs.forEach((s) => {
    const d = new Date(s.date);
    if (isNaN(d.getTime())) return;
    const key = d.toISOString().slice(0, 10);
    const cur = map.get(key) || { violations: 0, terminations: 0 };
    cur.violations += s.violations ?? 0;
    if (s.terminationReason) cur.terminations += 1;
    map.set(key, cur);
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      label: new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      violations: v.violations,
      terminations: v.terminations,
    }));
}

export interface SkillPassFail {
  skillId: string;
  pass: number;
  fail: number;
  attempts: number;
  avgScore: number;
}

/** Pass/fail split and average per skill, weakest average first. */
export function getSkillPassFail(subs: DBSubmission[]): SkillPassFail[] {
  const map = new Map<string, { pass: number; fail: number; sum: number }>();
  subs.forEach((s) => {
    if (!s.skillId) return;
    const cur = map.get(s.skillId) || { pass: 0, fail: 0, sum: 0 };
    if (s.scorePct >= PASS_MARK) cur.pass += 1;
    else cur.fail += 1;
    cur.sum += s.scorePct;
    map.set(s.skillId, cur);
  });
  return Array.from(map.entries())
    .map(([skillId, v]) => {
      const attempts = v.pass + v.fail;
      return { skillId, pass: v.pass, fail: v.fail, attempts, avgScore: Math.round(v.sum / attempts) };
    })
    .sort((a, b) => a.avgScore - b.avgScore);
}

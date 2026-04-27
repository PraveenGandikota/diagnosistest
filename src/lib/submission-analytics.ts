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

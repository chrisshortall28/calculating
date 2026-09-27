import type { Id } from '../domain/types';
import {
  SUM_PER_POINT,
  type JudgeTie,
  type PlacementRule,
  type PlacementStep,
  type RuleApplication,
} from './types';

export const RULES: Record<PlacementRule, { name: string; description: string }> = {
  '5': {
    name: 'Majority victories',
    description:
      'Most majority victories: a majority of judges gave it a higher sum than each entry it beat.',
  },
  '6A': {
    name: 'Separate victories',
    description:
      'Three or more tied: judges’ victories counted between the tied entries only; the most takes the place.',
  },
  '6B': {
    name: 'Separate victories',
    description: 'Two tied: the entry more judges placed above the other takes the place.',
  },
  '7B': {
    name: 'B marks',
    description:
      'Highest total of all judges’ B (artistic impression) marks takes the place: the free dance’s, or the long then the short programme’s.',
  },
  '7C': {
    name: 'Total victories',
    description: 'Most judge victories over all other entries takes the place.',
  },
  '7A': {
    name: 'Total sums',
    description: 'Highest total of all judges’ sums takes the place.',
  },
  '8': {
    name: 'Tie',
    description:
      'Still equal after every rule: the entries share the place, and the places below are used up.',
  },
};

/** How a rule number is presented: 6B carries the manual's abbreviation, "6B (S.M.V.)". */
export function ruleLabel(rule: PlacementRule): string {
  return rule === '6B' ? '6B (S.M.V.)' : rule;
}

/** 3½, 21, 0½ → ½ */
export function formatVictories(n: number): string {
  const whole = Math.floor(n);
  const half = n - whole === 0.5;
  return half ? (whole ? `${whole}½` : '½') : String(whole);
}

const fmtTenths = (tenths: number) => (tenths / 10).toFixed(1);

/** A judge sum (thousandths of a mark) with at least one decimal: 35.7, 35.0, 10.625. */
export function formatSum(sum: number): string {
  return (sum / SUM_PER_POINT).toFixed(3).replace(/0{1,2}$/, '');
}

export function formatRuleValue(rule: RuleApplication['rule'], value: number): string {
  return rule === '7B' ? fmtTenths(value) : rule === '7A' ? formatSum(value) : formatVictories(value);
}

/** "B marks", or "Long programme B marks" for a 7B step. */
export function ruleName(a: Pick<RuleApplication, 'rule' | 'label'>): string {
  return a.label
    ? `${a.label[0]!.toUpperCase()}${a.label.slice(1)} ${RULES[a.rule].name}`
    : RULES[a.rule].name;
}

export function ordinalLabel(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}

/**
 * A sentence per tie-break rule applied for one place, e.g.
 * "6B Separate victories: Amy 3½, Beth 3½ — still tied."
 */
export function explainStep(step: PlacementStep, name: (id: Id) => string): string[] {
  if (step.rule === '5') return [];
  const lines = step.trail.map((a, i) => {
    // The entries this step's path carries on with after the rule.
    const next = step.trail[i + 1]?.values.map((v) => v.entryId) ?? step.entryIds;
    const shown = a.values.map((v) => `${name(v.entryId)} ${formatRuleValue(a.rule, v.value)}`).join(', ');
    const outcome =
      next.length === a.values.length
        ? 'still tied'
        : next.length === 1
          ? `${name(next[0]!)} takes ${ordinalLabel(step.place)}`
          : `${next.map(name).join(' and ')} still level`;
    return `${ruleLabel(a.rule)} ${ruleName(a)}: ${shown} — ${outcome}.`;
  });
  if (step.rule === '8') lines.push(`8 ${RULES['8'].description}`);
  return lines;
}

/**
 * Rule 3, e.g. "J2 gave Amy and Beth equal sums (15.2): Amy takes that judge’s victory on the free
 * dance B mark (7.8 v 7.6)." — or "…and equal long programme B marks, on the short programme B mark…".
 */
export function explainJudgeTie(t: JudgeTie, name: (id: Id) => string, judge: (id: Id) => string): string {
  const [a, b] = t.entryIds;
  const start = `${judge(t.judgeId)} gave ${name(a)} and ${name(b)} equal sums (${formatSum(t.sum)})`;
  const compared = t.bMarks ?? [];
  const equal = t.winner ? compared.slice(0, -1) : compared;
  const equalText = equal.length ? ` and equal ${equal.map((m) => m.label).join(' and ')} B marks` : '';
  const decider = compared.at(-1);
  if (t.winner && decider)
    return `${start}${equalText}: ${name(t.winner)} takes that judge’s victory on the ${decider.label} B mark (${fmtTenths(decider.marks[0])} v ${fmtTenths(decider.marks[1])}).`;
  return `${start}${equalText}: half a victory each.`;
}

/**
 * The total B marks each entry was compared on under rule 7B, in the order applied (e.g. the long,
 * then the short programme). Entries no 7B step compared are absent.
 */
export function bTotalsUsed(steps: PlacementStep[]): Map<Id, { label: string; value: number }[]> {
  const totals = new Map<Id, { label: string; value: number }[]>();
  for (const step of steps)
    for (const a of step.trail) {
      if (a.rule !== '7B') continue;
      for (const { entryId, value } of a.values) {
        const list = totals.get(entryId) ?? [];
        if (!list.some((t) => t.label === a.label)) list.push({ label: a.label ?? '', value });
        totals.set(entryId, list);
      }
    }
  return totals;
}

import type { Id } from '../domain/types';
import type { JudgeTie, PlacementRule, PlacementStep, RuleApplication } from './types';

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
    name: 'Free dance B marks',
    description: 'Highest total of all judges’ free dance B (artistic impression) marks takes the place.',
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

/** Rules that show a value in tenths of a mark rather than a count of victories. */
const inTenths = (rule: RuleApplication['rule']) => rule === '7B' || rule === '7A';

/** 3½, 21, 0½ → ½ */
export function formatVictories(n: number): string {
  const whole = Math.floor(n);
  const half = n - whole === 0.5;
  return half ? (whole ? `${whole}½` : '½') : String(whole);
}

const fmtTenths = (tenths: number) => (tenths / 10).toFixed(1);

export function formatRuleValue(rule: RuleApplication['rule'], value: number): string {
  return inTenths(rule) ? fmtTenths(value) : formatVictories(value);
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
    return `${ruleLabel(a.rule)} ${RULES[a.rule].name}: ${shown} — ${outcome}.`;
  });
  if (step.rule === '8') lines.push(`8 ${RULES['8'].description}`);
  return lines;
}

/** Rule 3, e.g. "J2 gave Amy and Beth equal sums (15.2): Amy takes that judge’s victory on the free dance B mark (7.8 v 7.6)." */
export function explainJudgeTie(t: JudgeTie, name: (id: Id) => string, judge: (id: Id) => string): string {
  const [a, b] = t.entryIds;
  const start = `${judge(t.judgeId)} gave ${name(a)} and ${name(b)} equal sums (${fmtTenths(t.sum)})`;
  if (t.winner)
    return `${start}: ${name(t.winner)} takes that judge’s victory on the free dance B mark (${fmtTenths(t.bMarks![0])} v ${fmtTenths(t.bMarks![1])}).`;
  return `${start}${t.bMarks ? ' and equal free dance B marks' : ''}: half a victory each.`;
}

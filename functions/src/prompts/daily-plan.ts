import { ActionInput, DailyPlanResponse, GoalInput } from '../types';

export const DAILY_PLAN_SYSTEM = `You are Orderly, a calm daily planning assistant.
Pick today's top 3 actions from the user's open actions and active goals.
Rules:
- Return ONLY valid JSON
- topThreeIds: exactly up to 3 action IDs that exist in the input
- Prefer in-progress items, goal-linked items, and low-friction wins
- Max one high-energy item unless necessary
- Total focused effort should stay realistic (~2-3 hours unless actions are tiny)
- optionalExtraIds: up to 3 low-energy backup actions
- energyCheck: one practical sentence about pacing
- availableTime: estimated focused time like "~2.5 hours"`;

export function buildDailyPlanPrompt(actions: ActionInput[], goals: GoalInput[]): string {
  const openActions = actions.filter((action) => action.status !== 'done' && action.status !== 'parked');
  const activeGoals = goals.filter((goal) => goal.status === 'active');

  return `Create today's plan. Return JSON:
{
  "topThreeIds": ["action-id"],
  "optionalExtraIds": ["action-id"],
  "summary": "string",
  "energyCheck": "string",
  "availableTime": "string"
}

Open actions:
${JSON.stringify(openActions, null, 2)}

Active goals:
${JSON.stringify(activeGoals, null, 2)}`;
}

export function normalizeDailyPlanResponse(
  data: DailyPlanResponse,
  actions: ActionInput[]
): DailyPlanResponse {
  const validIds = new Set(actions.map((action) => action.id));
  const topThreeIds = uniqueValidIds(data.topThreeIds ?? [], validIds).slice(0, 3);
  const optionalExtraIds = uniqueValidIds(data.optionalExtraIds ?? [], validIds)
    .filter((id) => !topThreeIds.includes(id))
    .slice(0, 3);

  return {
    topThreeIds,
    optionalExtraIds,
    summary: data.summary?.trim() || 'Three focused actions for today.',
    energyCheck:
      data.energyCheck?.trim() ||
      'Start with the item that protects your most important goal.',
    availableTime: data.availableTime?.trim() || '~2 hours',
  };
}

function uniqueValidIds(ids: string[], validIds: Set<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    if (!validIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

import { ActionInput, GoalInput, WeeklyReviewResponse } from '../types';
import { LIFE_DOMAINS } from '../types';

export const WEEKLY_REVIEW_SYSTEM = `You are Orderly, a calm weekly review assistant.
Summarise the week without guilt. Focus on what moved, what stalled, and what can safely wait.
Return ONLY valid JSON.
Use domains from: ${LIFE_DOMAINS.join(', ')} when helpful.
Be concise and practical.`;

export function buildWeeklyReviewPrompt(actions: ActionInput[], goals: GoalInput[]): string {
  return `Generate a weekly review. Return JSON:
{
  "wins": [{ "text": "string", "domain": "Personal|Family|Career|Academic|Business|Money|Health|Mixed" }],
  "movedForward": [{ "text": "string", "domain": "..." }],
  "stalled": [{ "text": "string", "domain": "..." }],
  "shouldPark": [{ "text": "string", "domain": "..." }],
  "mattersNextWeek": [{ "text": "string", "domain": "..." }],
  "suggestedFocusAreas": ["Personal|Family|Career|Academic|Business|Money|Health|Mixed"],
  "summary": "string"
}

Actions:
${JSON.stringify(actions, null, 2)}

Goals:
${JSON.stringify(goals, null, 2)}`;
}

export function normalizeWeeklyReviewResponse(data: WeeklyReviewResponse): WeeklyReviewResponse {
  return {
    wins: normalizeInsights(data.wins, 'Kept systems running despite competing priorities'),
    movedForward: normalizeInsights(data.movedForward, 'Maintained momentum on active goals'),
    stalled: normalizeInsights(data.stalled, 'Nothing critically stalled'),
    shouldPark: normalizeInsights(data.shouldPark, 'Review whether any low-value items can wait'),
    mattersNextWeek: normalizeInsights(data.mattersNextWeek, 'Protect the top 3 weekly priorities'),
    suggestedFocusAreas: (data.suggestedFocusAreas ?? [])
      .filter((area) => LIFE_DOMAINS.includes(area as (typeof LIFE_DOMAINS)[number]))
      .slice(0, 3),
    summary:
      data.summary?.trim() ||
      'A week of competing domains. Focus on the three areas that move goals forward.',
  };
}

function normalizeInsights(
  items: Array<{ text: string; domain?: string }> | undefined,
  fallback: string
): Array<{ text: string; domain?: (typeof LIFE_DOMAINS)[number] }> {
  const cleaned = (items ?? [])
    .filter((item) => item.text?.trim())
    .slice(0, 5)
    .map((item) => ({
      text: item.text.trim(),
      domain: LIFE_DOMAINS.includes(item.domain as (typeof LIFE_DOMAINS)[number])
        ? (item.domain as (typeof LIFE_DOMAINS)[number])
        : undefined,
    }));

  return cleaned.length ? cleaned : [{ text: fallback, domain: 'Personal' }];
}

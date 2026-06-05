import { LIFE_DOMAINS, ProcessedBrainDumpResponse } from '../types';

export const BRAIN_DUMP_SYSTEM = `You are Orderly, a calm personal planning assistant.
Extract structure from brain dumps and annual life plans.
Return ONLY valid JSON matching the schema.
Rules:
- weeklyFocus: max 3 concrete actions for THIS week only
- suggestedActions: max 12 actionable items, no duplicates
- goalSuggestions: extract real goals when present; empty array for quick thoughts
- parkedItems: things explicitly deferred or "off the table"
- mustWinItems: highest-priority outcomes for the year or period
- documentType: "annual_plan" for long multi-silo plans; otherwise "quick_thought"
- domains must be one of: ${LIFE_DOMAINS.join(', ')}
- Respect "max 3 priority actions per week" when the source mentions it
- Be concise. No markdown. No commentary outside JSON.`;

export function buildBrainDumpPrompt(rawText: string): string {
  return `Analyze this brain dump and return JSON with this exact shape:
{
  "suggestedDomain": "Personal|Family|Career|Academic|Business|Money|Health|Mixed",
  "suggestedPriority": "Low|Medium|High",
  "suggestedActions": ["string"],
  "summary": "string",
  "documentType": "quick_thought|annual_plan",
  "themes": ["Personal|Professional|Academic|Business"],
  "weeklyFocus": ["string"],
  "quarterFocus": ["string"],
  "parkedItems": ["string"],
  "mustWinItems": ["string"],
  "goalSuggestions": [{
    "code": "string",
    "title": "string",
    "domain": "Personal|Family|Career|Academic|Business|Money|Health|Mixed",
    "why": "string",
    "nextAction": "string",
    "horizon": "today|week|month|quarter|year"
  }]
}

Brain dump:
"""
${rawText}
"""`;
}

export function normalizeBrainDumpResponse(data: ProcessedBrainDumpResponse): ProcessedBrainDumpResponse {
  const domain = LIFE_DOMAINS.includes(data.suggestedDomain) ? data.suggestedDomain : 'Mixed';
  const priority = ['Low', 'Medium', 'High'].includes(data.suggestedPriority)
    ? data.suggestedPriority
    : 'Medium';
  const documentType = data.documentType === 'annual_plan' ? 'annual_plan' : 'quick_thought';

  return {
    suggestedDomain: domain,
    suggestedPriority: priority as ProcessedBrainDumpResponse['suggestedPriority'],
    suggestedActions: uniqueStrings(data.suggestedActions ?? []).slice(0, 12),
    summary: (data.summary ?? 'Processed brain dump.').trim(),
    documentType,
    themes: uniqueStrings(data.themes ?? []).slice(0, 6),
    weeklyFocus: uniqueStrings(data.weeklyFocus ?? []).slice(0, 3),
    quarterFocus: uniqueStrings(data.quarterFocus ?? []).slice(0, 6),
    parkedItems: uniqueStrings(data.parkedItems ?? []).slice(0, 10),
    mustWinItems: uniqueStrings(data.mustWinItems ?? []).slice(0, 6),
    goalSuggestions: (data.goalSuggestions ?? [])
      .filter((goal: ProcessedBrainDumpResponse['goalSuggestions'][number]) => goal.title && goal.nextAction)
      .slice(0, 12)
      .map((goal: ProcessedBrainDumpResponse['goalSuggestions'][number]) => ({
        code: goal.code?.trim() || 'G',
        title: goal.title.trim(),
        domain: LIFE_DOMAINS.includes(goal.domain) ? goal.domain : domain,
        why: goal.why?.trim() || goal.title.trim(),
        nextAction: goal.nextAction.trim(),
        horizon: ['today', 'week', 'month', 'quarter', 'year'].includes(goal.horizon)
          ? goal.horizon
          : 'year',
      })) as ProcessedBrainDumpResponse['goalSuggestions'],
  };
}

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const cleaned = item.trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

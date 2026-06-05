/** Default model: cheapest capable Gemini tier for structured planning tasks. */
export const AI_MODEL = 'gemini-2.0-flash-lite';

export const LIFE_DOMAINS = [
  'Personal',
  'Family',
  'Career',
  'Academic',
  'Business',
  'Money',
  'Health',
  'Mixed',
] as const;

export type LifeDomain = (typeof LIFE_DOMAINS)[number];

export interface ProcessedBrainDumpResponse {
  suggestedDomain: LifeDomain;
  suggestedPriority: 'Low' | 'Medium' | 'High';
  suggestedActions: string[];
  summary: string;
  documentType: 'quick_thought' | 'annual_plan';
  themes: string[];
  weeklyFocus: string[];
  quarterFocus: string[];
  parkedItems: string[];
  mustWinItems: string[];
  goalSuggestions: Array<{
    code: string;
    title: string;
    domain: LifeDomain;
    why: string;
    nextAction: string;
    horizon: 'today' | 'week' | 'month' | 'quarter' | 'year';
  }>;
}

export interface DailyPlanResponse {
  topThreeIds: string[];
  optionalExtraIds: string[];
  summary: string;
  energyCheck: string;
  availableTime: string;
}

export interface WeeklyReviewResponse {
  wins: Array<{ text: string; domain?: LifeDomain }>;
  movedForward: Array<{ text: string; domain?: LifeDomain }>;
  stalled: Array<{ text: string; domain?: LifeDomain }>;
  shouldPark: Array<{ text: string; domain?: LifeDomain }>;
  mattersNextWeek: Array<{ text: string; domain?: LifeDomain }>;
  suggestedFocusAreas: string[];
  summary: string;
}

export interface ActionInput {
  id: string;
  title: string;
  domain: LifeDomain;
  status: string;
  effort: string;
  energy: string;
  source: string;
}

export interface GoalInput {
  id: string;
  title: string;
  domain: LifeDomain;
  status: string;
  nextAction: string;
  horizon: string;
}

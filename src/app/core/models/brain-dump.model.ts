import { LifeDomain } from './life-domain.model';
import { GoalHorizon } from './goal.model';

export type BrainDumpDocumentType = 'quick_thought' | 'annual_plan';
export type SuggestedPriority = 'Low' | 'Medium' | 'High';
export type BrainDumpStatus = 'unprocessed' | 'processed' | 'parked' | 'converted';

export interface ExtractedGoalSuggestion {
  code: string;
  title: string;
  domain: LifeDomain;
  why: string;
  nextAction: string;
  horizon: GoalHorizon;
}

export interface ProcessedBrainDump {
  suggestedDomain: LifeDomain;
  suggestedPriority: SuggestedPriority;
  suggestedActions: string[];
  summary: string;
  documentType: BrainDumpDocumentType;
  themes: string[];
  weeklyFocus: string[];
  quarterFocus: string[];
  parkedItems: string[];
  mustWinItems: string[];
  goalSuggestions: ExtractedGoalSuggestion[];
}

export interface BrainDumpItem {
  id: string;
  rawText: string;
  createdAt: string;
  suggestedDomain: LifeDomain;
  suggestedPriority: SuggestedPriority;
  suggestedActions: string[];
  status: BrainDumpStatus;
  documentType?: BrainDumpDocumentType;
  processingSummary?: string;
  themes?: string[];
  weeklyFocus?: string[];
  quarterFocus?: string[];
  parkedItems?: string[];
  mustWinItems?: string[];
  goalSuggestions?: ExtractedGoalSuggestion[];
}

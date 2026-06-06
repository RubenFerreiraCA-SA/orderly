import { LifeAction } from './action.model';
import { LifeDomain } from './life-domain.model';

export interface ReviewInsight {
  text: string;
  domain?: LifeDomain;
}

export interface DailyPlan {
  topThree: LifeAction[];
  optionalExtras: LifeAction[];
  parkedItems: LifeAction[];
  energyCheck: string;
  availableTime: string;
  summary: string;
}

/** Stored in Firestore — action objects are rebuilt from current action list. */
export interface PersistedDailyPlan {
  planDate: string;
  topThreeIds: string[];
  optionalExtraIds: string[];
  summary: string;
  energyCheck: string;
  availableTime: string;
}

export interface WeeklyReview {
  wins: ReviewInsight[];
  movedForward: ReviewInsight[];
  stalled: ReviewInsight[];
  shouldPark: ReviewInsight[];
  mattersNextWeek: ReviewInsight[];
  suggestedFocusAreas: string[];
  summary: string;
}

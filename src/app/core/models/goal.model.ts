import { LifeDomain } from './life-domain.model';

export type GoalHorizon = 'today' | 'week' | 'month' | 'quarter' | 'year';
export type GoalStatus = 'active' | 'parked' | 'completed';

export interface LifeGoal {
  id: string;
  title: string;
  domain: LifeDomain;
  why: string;
  horizon: GoalHorizon;
  status: GoalStatus;
  nextAction: string;
}

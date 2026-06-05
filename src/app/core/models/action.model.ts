import { LifeDomain } from './life-domain.model';

export type ActionSource = 'brain_dump' | 'goal' | 'manual' | 'review';
export type EffortLevel = '5 min' | '15 min' | '30 min' | '45 min' | '90 min';
export type EnergyLevel = 'low' | 'medium' | 'high';
export type ActionStatus = 'not_started' | 'in_progress' | 'done' | 'parked';

export interface LifeAction {
  id: string;
  title: string;
  domain: LifeDomain;
  source: ActionSource;
  effort: EffortLevel;
  energy: EnergyLevel;
  status: ActionStatus;
  dueDate?: string;
  reason?: string;
}

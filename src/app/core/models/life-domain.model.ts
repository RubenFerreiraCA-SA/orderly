export type LifeDomain =
  | 'Personal'
  | 'Family'
  | 'Career'
  | 'Academic'
  | 'Business'
  | 'Money'
  | 'Health'
  | 'Mixed';

export type LifeStatus =
  | 'not_started'
  | 'in_progress'
  | 'done'
  | 'parked'
  | 'active'
  | 'completed'
  | 'processed'
  | 'unprocessed'
  | 'converted';

export const LIFE_DOMAINS: LifeDomain[] = [
  'Personal',
  'Family',
  'Career',
  'Academic',
  'Business',
  'Money',
  'Health',
];

export const DOMAIN_COLORS: Record<LifeDomain, string> = {
  Personal: '#8b9dc3',
  Family: '#c4a882',
  Career: '#6b9bd1',
  Academic: '#9b7ec8',
  Business: '#5cb8a5',
  Money: '#d4a853',
  Health: '#7ec88b',
  Mixed: '#a0a0a0',
};

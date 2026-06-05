import { Injectable, inject } from '@angular/core';
import { LifeAction } from '../models/action.model';
import { ProcessedBrainDump } from '../models/brain-dump.model';
import { LifeGoal } from '../models/goal.model';
import { LifeDomain } from '../models/life-domain.model';
import { DailyPlan, WeeklyReview } from '../models/planning.model';
import { AiBackendService } from './ai-backend.service';
import { BrainDumpParserService } from './brain-dump-parser.service';

export type AiSource = 'gemini' | 'local';

@Injectable({ providedIn: 'root' })
export class AiPlanningService {
  private readonly backend = inject(AiBackendService);
  private readonly parser = inject(BrainDumpParserService);

  lastSource: AiSource = 'local';

  /**
   * Processes brain dump text. Uses Gemini via Cloud Functions when available,
   * otherwise falls back to the local parser.
   */
  async processBrainDump(rawText: string): Promise<ProcessedBrainDump> {
    if (this.backend.isAvailable) {
      try {
        const remote = await this.backend.processBrainDump(rawText);
        if (remote) {
          this.lastSource = 'gemini';
          return remote;
        }
      } catch (error) {
        console.warn('Gemini brain dump failed, using local parser', error);
      }
    }

    this.lastSource = 'local';
    return this.processBrainDumpLocally(rawText);
  }

  /**
   * Generates today's plan. Uses Gemini when available, otherwise local rules.
   */
  async generateDailyPlan(actions: LifeAction[], goals: LifeGoal[]): Promise<DailyPlan> {
    if (this.backend.isAvailable) {
      try {
        const remote = await this.backend.generateDailyPlan(actions, goals);
        if (remote) {
          this.lastSource = 'gemini';
          return remote;
        }
      } catch (error) {
        console.warn('Gemini daily plan failed, using local rules', error);
      }
    }

    this.lastSource = 'local';
    return this.generateDailyPlanLocally(actions, goals);
  }

  /**
   * Generates a weekly review. Uses Gemini when available, otherwise local rules.
   */
  async summariseWeek(actions: LifeAction[], goals: LifeGoal[]): Promise<WeeklyReview> {
    if (this.backend.isAvailable) {
      try {
        const remote = await this.backend.summariseWeek(actions, goals);
        if (remote) {
          this.lastSource = 'gemini';
          return remote;
        }
      } catch (error) {
        console.warn('Gemini weekly review failed, using local rules', error);
      }
    }

    this.lastSource = 'local';
    return this.summariseWeekLocally(actions, goals);
  }

  private processBrainDumpLocally(rawText: string): ProcessedBrainDump {
    const documentType = this.parser.detectDocumentType(rawText);
    if (documentType === 'annual_plan') {
      return this.parser.parseAnnualPlan(rawText);
    }

    return this.processQuickThought(rawText);
  }

  private generateDailyPlanLocally(actions: LifeAction[], goals: LifeGoal[]): DailyPlan {
    const activeGoals = goals.filter((g) => g.status === 'active');
    const goalDomains = new Set(activeGoals.map((g) => g.domain));
    const goalNextActions = new Set(activeGoals.map((g) => g.nextAction.toLowerCase()));

    const candidates = actions.filter(
      (a) => a.status === 'not_started' || a.status === 'in_progress'
    );

    const scored = candidates.map((action) => {
      let score = 0;
      if (action.status === 'in_progress') score += 3;
      if (goalDomains.has(action.domain)) score += 2;
      if (goalNextActions.has(action.title.toLowerCase())) score += 4;
      if (action.source === 'goal') score += 2;
      if (action.source === 'brain_dump') score += 1;
      if (action.energy === 'low') score += 1;
      if (action.effort === '5 min' || action.effort === '15 min') score += 1;
      return { action, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const topThree: LifeAction[] = [];
    let highEnergyCount = 0;
    let totalMinutes = 0;

    for (const { action } of scored) {
      if (topThree.length >= 3) break;
      if (action.energy === 'high' && highEnergyCount >= 1) continue;

      const minutes = this.effortToMinutes(action.effort);
      if (totalMinutes + minutes > 180 && topThree.length >= 2) continue;

      topThree.push(action);
      if (action.energy === 'high') highEnergyCount++;
      totalMinutes += minutes;
    }

    while (topThree.length < 3 && scored.length > topThree.length) {
      const next = scored.find(({ action }) => !topThree.includes(action));
      if (next) topThree.push(next.action);
      else break;
    }

    const topThreeIds = new Set(topThree.map((a) => a.id));
    const optionalExtras = candidates
      .filter((a) => !topThreeIds.has(a.id) && a.energy === 'low')
      .slice(0, 3);
    const parkedItems = actions.filter((a) => a.status === 'parked').slice(0, 4);

    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
    const highEnergyInPlan = topThree.filter((a) => a.energy === 'high').length;

    let energyCheck: string;
    if (highEnergyInPlan >= 2) {
      energyCheck = 'This plan includes demanding work. Do the high-energy item first while fresh.';
    } else if (totalMinutes <= 90) {
      energyCheck = 'Light day — good for clearing admin and building momentum.';
    } else {
      energyCheck = 'Balanced mix. Start with the item that matters most, not the easiest.';
    }

    const summary =
      topThree.length === 3
        ? `Three focused actions across ${new Set(topThree.map((a) => a.domain)).size} domains. Total effort: ~${totalHours}h.`
        : 'Not enough open actions to fill a full plan. Capture more or process your brain dump.';

    return {
      topThree,
      optionalExtras,
      parkedItems,
      energyCheck,
      availableTime: `~${totalHours} hours of focused work`,
      summary,
    };
  }

  private summariseWeekLocally(actions: LifeAction[], goals: LifeGoal[]): WeeklyReview {
    const done = actions.filter((a) => a.status === 'done');
    const inProgress = actions.filter((a) => a.status === 'in_progress');
    const stalled = actions.filter(
      (a) => a.status === 'not_started' && a.source === 'goal'
    );
    const parked = actions.filter((a) => a.status === 'parked');
    const activeGoals = goals.filter((g) => g.status === 'active');

    const wins = done.length
      ? done.slice(0, 4).map((a) => ({ text: a.title, domain: a.domain }))
      : [{ text: 'Kept systems running despite competing priorities', domain: 'Personal' as LifeDomain }];

    const movedForward = inProgress.length
      ? inProgress.map((a) => ({ text: `${a.title} — in progress`, domain: a.domain }))
      : activeGoals.slice(0, 3).map((g) => ({
          text: `${g.title}: ${g.nextAction}`,
          domain: g.domain,
        }));

    const stalledItems = stalled.slice(0, 3).map((a) => ({
      text: `${a.title} — not started yet`,
      domain: a.domain,
    }));
    if (stalledItems.length === 0) {
      stalledItems.push({ text: 'Nothing critically stalled', domain: 'Personal' });
    }

    const shouldPark = parked.slice(0, 2).map((a) => ({
      text: a.title,
      domain: a.domain,
    }));
    if (shouldPark.length === 0) {
      shouldPark.push({
        text: 'Garage organisation — no urgency this week',
        domain: 'Personal',
      });
    }

    const domainCounts = new Map<LifeDomain, number>();
    for (const g of activeGoals) {
      domainCounts.set(g.domain, (domainCounts.get(g.domain) ?? 0) + 1);
    }
    const sortedDomains = [...domainCounts.entries()].sort((a, b) => b[1] - a[1]);
    const suggestedFocusAreas = sortedDomains.slice(0, 3).map(([d]) => d);

    const mattersNextWeek = activeGoals.slice(0, 4).map((g) => ({
      text: `${g.title}: ${g.nextAction}`,
      domain: g.domain,
    }));

    const summary =
      'A week of competing domains. Focus on the three areas that move goals forward — the rest can wait safely.';

    return {
      wins,
      movedForward,
      stalled: stalledItems,
      shouldPark,
      mattersNextWeek,
      suggestedFocusAreas,
      summary,
    };
  }

  private processQuickThought(rawText: string): ProcessedBrainDump {
    const lower = rawText.toLowerCase();
    const suggestedActions: string[] = [];
    let suggestedDomain: LifeDomain = 'Mixed';
    let suggestedPriority: ProcessedBrainDump['suggestedPriority'] = 'Medium';

    const domainKeywords: Record<LifeDomain, string[]> = {
      Personal: ['personal', 'garage', 'organise', 'home'],
      Family: ['kids', 'school', 'family', 'admin'],
      Career: ['work', 'sprint', 'email', 'job', 'deliverable', 'momentum'],
      Academic: ['paper', 'research', 'uj', 'rpl', 'masters', 'publication'],
      Business: ['orderly', 'awning', 'awnpro', 'mvp', 'product', 'b2b', 'startup'],
      Money: ['sars', 'tax', 'net worth', 'finance', 'credit', 'payment'],
      Health: ['exercise', 'gym', 'health', 'routine', 'sleep'],
      Mixed: [],
    };

    const domainScores = new Map<LifeDomain, number>();
    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (domain === 'Mixed') continue;
      const score = keywords.filter((kw) => lower.includes(kw)).length;
      if (score > 0) domainScores.set(domain as LifeDomain, score);
    }

    const sortedDomains = [...domainScores.entries()].sort((a, b) => b[1] - a[1]);
    if (sortedDomains.length === 1) {
      suggestedDomain = sortedDomains[0][0];
    } else if (sortedDomains.length > 1) {
      suggestedDomain = 'Mixed';
    }

    if (lower.includes('sars') || lower.includes('urgent') || lower.includes('forget')) {
      suggestedPriority = 'High';
    } else if (lower.includes('wondering') || lower.includes('maybe') || lower.includes('should i')) {
      suggestedPriority = 'Low';
    }

    if (lower.includes('sars') || lower.includes('tax')) {
      suggestedActions.push('Create SARS payment target');
    }
    if (lower.includes('paper') || lower.includes('research')) {
      suggestedActions.push('Block 45 minutes for paper revision');
    }
    if (lower.includes('school') || lower.includes('kids')) {
      suggestedActions.push('Add school reminder to family admin');
    }
    if (lower.includes('orderly') || lower.includes('daily plan')) {
      suggestedActions.push('Build daily planning screen for Orderly');
    }
    if (lower.includes('awning') || lower.includes('awnpro') || lower.includes('b2b')) {
      suggestedActions.push('Advance AwnPro MVP workflow');
    }
    if (lower.includes('exercise') || lower.includes('gym')) {
      suggestedActions.push('Schedule three weekly exercise blocks');
    }
    if (lower.includes('net worth') || lower.includes('finance')) {
      suggestedActions.push('Update net worth tracker');
    }

    if (suggestedActions.length === 0) {
      const sentences = rawText.split(/[.!?]+/).filter((s) => s.trim().length > 5);
      for (const sentence of sentences.slice(0, 3)) {
        suggestedActions.push(`Define next step: ${sentence.trim().slice(0, 80)}`);
      }
    }

    if (suggestedActions.length > 3) {
      suggestedActions.length = 3;
    }

    while (suggestedActions.length < 2 && suggestedActions.length < 3) {
      suggestedActions.push('Review and clarify the most urgent part of this thought');
    }

    const preview = rawText.slice(0, 80).trim();
    const summary = `Captured ${suggestedDomain.toLowerCase()} concern: "${preview}${rawText.length > 80 ? '…' : ''}". ${suggestedActions.length} actionable steps identified.`;

    return {
      suggestedDomain,
      suggestedPriority,
      suggestedActions,
      summary,
      documentType: 'quick_thought',
      themes: [],
      weeklyFocus: suggestedActions.slice(0, 3),
      quarterFocus: [],
      parkedItems: [],
      mustWinItems: [],
      goalSuggestions: [],
    };
  }

  private effortToMinutes(effort: LifeAction['effort']): number {
    const map: Record<LifeAction['effort'], number> = {
      '5 min': 5,
      '15 min': 15,
      '30 min': 30,
      '45 min': 45,
      '90 min': 90,
    };
    return map[effort];
  }
}

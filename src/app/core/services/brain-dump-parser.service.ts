import { Injectable } from '@angular/core';
import {
  BrainDumpDocumentType,
  ExtractedGoalSuggestion,
  ProcessedBrainDump,
} from '../models/brain-dump.model';
import { LifeDomain } from '../models/life-domain.model';

const GOAL_CODE_PATTERN = /^(P[1-3]|PR[1-3]|A[1-3]|B[1-3])\b/m;

const GOAL_DOMAIN_MAP: Record<string, LifeDomain> = {
  P1: 'Money',
  P2: 'Health',
  P3: 'Personal',
  PR1: 'Career',
  PR2: 'Career',
  PR3: 'Career',
  A1: 'Academic',
  A2: 'Academic',
  A3: 'Academic',
  B1: 'Business',
  B2: 'Business',
  B3: 'Business',
};

@Injectable({ providedIn: 'root' })
export class BrainDumpParserService {
  detectDocumentType(rawText: string): BrainDumpDocumentType {
    const trimmed = rawText.trim();
    if (trimmed.length < 1500) {
      return 'quick_thought';
    }

    const planMarkers = [
      /game plan/i,
      /rubenos/i,
      /where things stand/i,
      /what'?s off the table/i,
      /the things that must go right/i,
      /monthly control panel/i,
      /financial systems automation architect/i,
    ];

    return planMarkers.some((pattern) => pattern.test(trimmed)) ? 'annual_plan' : 'quick_thought';
  }

  parseAnnualPlan(rawText: string): ProcessedBrainDump {
    const themes = this.extractThemes(rawText);
    const mustWinItems = this.extractMustWinItems(rawText);
    const parkedItems = this.extractParkedItems(rawText);
    const quarterFocus = this.extractQuarterFocus(rawText);
    const goalSuggestions = this.extractGoals(rawText);
    const weeklyFocus = this.buildWeeklyFocus(mustWinItems, quarterFocus, goalSuggestions);
    const suggestedActions = this.buildSuggestedActions(
      weeklyFocus,
      quarterFocus,
      mustWinItems,
      goalSuggestions
    );

    const domainScores = this.scoreDomains(rawText, goalSuggestions);
    const suggestedDomain = this.pickPrimaryDomain(domainScores);
    const suggestedPriority: ProcessedBrainDump['suggestedPriority'] =
      mustWinItems.length >= 4 || /momentum|credit|sars|net worth/i.test(rawText)
        ? 'High'
        : 'Medium';

    const summary = this.buildPlanSummary(rawText, themes, mustWinItems, goalSuggestions);

    return {
      suggestedDomain,
      suggestedPriority,
      suggestedActions,
      summary,
      documentType: 'annual_plan',
      themes,
      weeklyFocus,
      quarterFocus,
      parkedItems,
      mustWinItems,
      goalSuggestions,
    };
  }

  private extractThemes(rawText: string): string[] {
    const themes: string[] = [];
    const siloMatch = rawText.match(
      /Four silos\. Three goals each\.[^\n]*\n([\s\S]*?)(?:\n\n|RubenOS status)/i
    );

    if (siloMatch) {
      const block = siloMatch[1];
      for (const silo of ['Personal', 'Professional', 'Academic', 'Business']) {
        if (block.includes(silo)) {
          themes.push(silo);
        }
      }
    }

    if (themes.length === 0) {
      if (/personal|wealth|family|health|rubenOS/i.test(rawText)) themes.push('Personal');
      if (/professional|momentum|java|angular|automation/i.test(rawText)) themes.push('Professional');
      if (/academic|rpl|master|supervisor|publish/i.test(rawText)) themes.push('Academic');
      if (/business|awnpro|attaché|vulpex|mvp/i.test(rawText)) themes.push('Business');
    }

    return [...new Set(themes)];
  }

  private extractMustWinItems(rawText: string): string[] {
    const section = this.extractSection(
      rawText,
      /11\.?\s*The Things That Must Go Right/i,
      /12\.?\s*Stretch Goals/i
    );
    if (!section) {
      return [];
    }

    const items: string[] = [];
    const lines = section.split('\n').map((line) => line.trim()).filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      if (/^\d+$/.test(lines[i]) && lines[i + 1]) {
        const title = lines[i + 1];
        if (title.length > 8 && !/rank|the goal|why it matters/i.test(title)) {
          items.push(this.cleanLine(title));
        }
      }
    }

    return this.uniqueItems(items).slice(0, 6);
  }

  private extractParkedItems(rawText: string): string[] {
    const section = this.extractSection(
      rawText,
      /What stays off the list this year/i,
      /3\.?\s*The Big Picture/i
    );
    if (!section) {
      return [];
    }

    const items: string[] = [];
    const lines = section.split('\n').map((line) => line.trim()).filter(Boolean);

    for (const line of lines) {
      if (/^no /i.test(line) || /^not this year/i.test(line)) {
        continue;
      }
      if (line.length > 12 && !/the call|what stays off/i.test(line)) {
        items.push(this.cleanLine(line));
      }
    }

    return this.uniqueItems(items).slice(0, 8);
  }

  private extractQuarterFocus(rawText: string): string[] {
    const section = this.extractSection(
      rawText,
      /8\.?\s*What Happens When/i,
      /9\.?\s*How the Year Actually Runs/i
    );
    if (!section) {
      return [];
    }

    const q1Block = section.match(/Q1[^\n]*\n([\s\S]*?)(?=Q2|$)/i)?.[1] ?? section;
    const actions: string[] = [];

    const siloPatterns = [
      {
        label: 'Personal',
        pattern: /(?:^|\n)(?:Personal[^\n]*\n)?([^\n]+(?:tracker|review|debit order|baseline)[^\n]*)/i,
      },
      {
        label: 'Professional',
        pattern: /(?:^|\n)(?:Professional[^\n]*\n)?([^\n]+(?:20\/30\/50|java|spring boot|momentum)[^\n]*)/i,
      },
      {
        label: 'Academic',
        pattern: /(?:^|\n)(?:Academic[^\n]*\n)?([^\n]+(?:uj|rpl|concept note|supervisor)[^\n]*)/i,
      },
      {
        label: 'Business',
        pattern: /(?:^|\n)(?:Business[^\n]*\n)?([^\n]+(?:awnpro|drawing|quote|mvp)[^\n]*)/i,
      },
    ];

    for (const { label, pattern } of siloPatterns) {
      const match = q1Block.match(pattern);
      if (match?.[1]) {
        actions.push(`${label}: ${this.cleanLine(match[1])}`);
      }
    }

    if (actions.length === 0) {
      const chunks = q1Block
        .split(/[.;\n]+/)
        .map((chunk) => this.cleanLine(chunk))
        .filter((chunk) => chunk.length > 20);
      actions.push(...chunks.slice(0, 4));
    }

    return this.uniqueItems(actions).slice(0, 6);
  }

  private extractGoals(rawText: string): ExtractedGoalSuggestion[] {
    const goals: ExtractedGoalSuggestion[] = [];
    const lines = rawText.split('\n').map((line) => line.trim());

    for (let i = 0; i < lines.length; i++) {
      const codeMatch = lines[i].match(/^(P[1-3]|PR[1-3]|A[1-3]|B[1-3])$/);
      if (!codeMatch) {
        continue;
      }

      const code = codeMatch[1];
      const title = lines[i + 1];
      const detail = lines[i + 2];
      if (!title || GOAL_CODE_PATTERN.test(title)) {
        continue;
      }

      goals.push({
        code,
        title: this.cleanLine(title),
        domain: GOAL_DOMAIN_MAP[code] ?? 'Mixed',
        why: detail ? this.cleanLine(detail) : `Annual plan goal ${code}`,
        nextAction: this.inferNextAction(code, title, detail, rawText),
        horizon: 'year',
      });
    }

    return this.deduplicateGoals(goals);
  }

  private inferNextAction(
    code: string,
    title: string,
    detail: string | undefined,
    rawText: string
  ): string {
    const defaults: Record<string, string> = {
      P1: 'Update net worth tracker including SARS and review Discovery utilisation',
      P2: 'Complete monthly health/family review and log sleep, steps, and balance scores',
      P3: 'Run RubenOS monthly review using the seven questions',
      PR1: 'Update Momentum delivery evidence log for the current sprint',
      PR2: 'Block time for Java/Spring Boot learning and automation case study',
      PR3: 'Update LinkedIn, CV, and rubenferreira.co.za with automation architect positioning',
      A1: 'Obtain written UJ guidance on RPL route to 2028 intake',
      A2: 'Send concept note to one potential supervisor and identify a backup',
      A3: 'Check paper pipeline status and schedule next revision block',
      B1: 'Advance AwnPro MVP: save/load project and basic drawing workflow',
      B2: 'Keep Attaché in private beta scope only — max 5 users',
      B3: 'Draft Vulpex sample report and schedule first SME/adviser interview',
    };

    if (defaults[code]) {
      return defaults[code];
    }

    if (detail && detail.length <= 120) {
      return this.cleanLine(detail);
    }

    if (/q1/i.test(rawText) && code.startsWith('B')) {
      return 'Focus Q1 on AwnPro setup, save/load, and basic drawing workflow';
    }

    return `Define the next concrete step for ${title}`;
  }

  private buildWeeklyFocus(
    mustWinItems: string[],
    quarterFocus: string[],
    goalSuggestions: ExtractedGoalSuggestion[]
  ): string[] {
    const focus: string[] = [];

    if (mustWinItems.length) {
      focus.push(`Protect must-win #1: ${mustWinItems[0]}`);
    }

    const q1Personal = quarterFocus.find((item) => item.startsWith('Personal:'));
    if (q1Personal) {
      focus.push(q1Personal.replace(/^Personal:\s*/, 'Q1 personal: '));
    } else if (quarterFocus[0]) {
      focus.push(`Q1 focus: ${quarterFocus[0]}`);
    }

    const priorityGoal =
      goalSuggestions.find((goal) => goal.code === 'PR1') ??
      goalSuggestions.find((goal) => goal.code === 'B1') ??
      goalSuggestions[0];

    if (priorityGoal) {
      focus.push(priorityGoal.nextAction);
    }

    return this.uniqueItems(focus).slice(0, 3);
  }

  private buildSuggestedActions(
    weeklyFocus: string[],
    quarterFocus: string[],
    mustWinItems: string[],
    goalSuggestions: ExtractedGoalSuggestion[]
  ): string[] {
    const actions = [
      ...weeklyFocus,
      ...quarterFocus.map((item) => `Q1 — ${item}`),
      ...mustWinItems.slice(0, 3).map((item) => `Must-win: ${item}`),
      ...goalSuggestions.slice(0, 6).map((goal) => `${goal.code} ${goal.title}: ${goal.nextAction}`),
    ];

    return this.uniqueItems(actions).slice(0, 12);
  }

  private buildPlanSummary(
    rawText: string,
    themes: string[],
    mustWinItems: string[],
    goalSuggestions: ExtractedGoalSuggestion[]
  ): string {
    const title =
      rawText.match(/My Game Plan/i)?.[0] ??
      rawText.split('\n').find((line) => line.trim().length > 0)?.trim() ??
      'Annual plan';

    const themeText = themes.length ? themes.join(', ') : 'multiple life areas';
    const goalCount = goalSuggestions.length;
    const mustWinText = mustWinItems.length
      ? `Top must-win: ${mustWinItems[0]}.`
      : 'Review the must-win priorities for this year.';

    return `${title} detected across ${themeText}. ${goalCount} goals identified with Q1 foundations and weekly focus candidates. ${mustWinText} Remember: max 3 priority actions per week.`;
  }

  private scoreDomains(
    rawText: string,
    goalSuggestions: ExtractedGoalSuggestion[]
  ): Map<LifeDomain, number> {
    const scores = new Map<LifeDomain, number>();
    const lower = rawText.toLowerCase();

    const keywords: Record<LifeDomain, string[]> = {
      Personal: ['personal', 'rubenos', 'family presence', 'operating rhythm'],
      Family: ['family', 'kids', 'home'],
      Career: ['momentum', 'professional', 'dvt', 'java', 'angular', 'automation architect'],
      Academic: ['academic', 'rpl', 'master', 'uj', 'supervisor', 'paper', 'publish'],
      Business: ['awnpro', 'attaché', 'vulpex', 'mvp', 'installer', 'beta'],
      Money: ['net worth', 'sars', 'credit', 'discovery', 'wealth', 'financial'],
      Health: ['health', 'sleep', 'steps', 'medication', 'appointment', 'energy'],
      Mixed: [],
    };

    for (const [domain, words] of Object.entries(keywords)) {
      if (domain === 'Mixed') continue;
      const score = words.filter((word) => lower.includes(word)).length;
      if (score > 0) {
        scores.set(domain as LifeDomain, score);
      }
    }

    for (const goal of goalSuggestions) {
      scores.set(goal.domain, (scores.get(goal.domain) ?? 0) + 2);
    }

    return scores;
  }

  private pickPrimaryDomain(scores: Map<LifeDomain, number>): LifeDomain {
    const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
      return 'Mixed';
    }
    if (sorted.length === 1) {
      return sorted[0][0];
    }
    const topScore = sorted[0][1];
    const topDomains = sorted.filter(([, score]) => score === topScore);
    return topDomains.length === 1 ? topDomains[0][0] : 'Mixed';
  }

  private extractSection(rawText: string, startPattern: RegExp, endPattern: RegExp): string | null {
    const start = rawText.search(startPattern);
    if (start === -1) {
      return null;
    }

    const fromStart = rawText.slice(start);
    const end = fromStart.slice(1).search(endPattern);
    return end === -1 ? fromStart : fromStart.slice(0, end + 1);
  }

  private cleanLine(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  private uniqueItems(items: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const item of items) {
      const key = item.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }

    return result;
  }

  private deduplicateGoals(goals: ExtractedGoalSuggestion[]): ExtractedGoalSuggestion[] {
    const seen = new Set<string>();
    return goals.filter((goal) => {
      if (seen.has(goal.code)) {
        return false;
      }
      seen.add(goal.code);
      return true;
    });
  }
}

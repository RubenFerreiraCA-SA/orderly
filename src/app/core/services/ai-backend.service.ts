import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { LifeAction } from '../models/action.model';
import { ProcessedBrainDump } from '../models/brain-dump.model';
import { LifeGoal } from '../models/goal.model';
import { DailyPlan, WeeklyReview } from '../models/planning.model';
import { AuthService } from './auth.service';

interface DailyPlanResponse {
  topThreeIds: string[];
  optionalExtraIds: string[];
  summary: string;
  energyCheck: string;
  availableTime: string;
}

interface ActionInput {
  id: string;
  title: string;
  domain: LifeAction['domain'];
  status: string;
  effort: string;
  energy: string;
  source: string;
}

interface GoalInput {
  id: string;
  title: string;
  domain: LifeGoal['domain'];
  status: string;
  nextAction: string;
  horizon: string;
}

@Injectable({ providedIn: 'root' })
export class AiBackendService {
  private readonly functions = inject(Functions, { optional: true });
  private readonly auth = inject(AuthService);

  get isAvailable(): boolean {
    return this.auth.firebaseEnabled && !!this.functions && this.auth.isAuthenticated();
  }

  async processBrainDump(rawText: string): Promise<ProcessedBrainDump | null> {
    if (!this.functions || !this.auth.isAuthenticated()) {
      return null;
    }

    const callable = httpsCallable<{ rawText: string }, ProcessedBrainDump>(
      this.functions,
      'aiProcessBrainDump'
    );
    const result = await callable({ rawText });
    return result.data;
  }

  async generateDailyPlan(actions: LifeAction[], goals: LifeGoal[]): Promise<DailyPlan | null> {
    if (!this.functions || !this.auth.isAuthenticated()) {
      return null;
    }

    const callable = httpsCallable<
      { actions: ActionInput[]; goals: GoalInput[] },
      DailyPlanResponse
    >(this.functions, 'aiGenerateDailyPlan');

    const result = await callable({
      actions: actions.map((action) => this.toActionInput(action)),
      goals: goals.map((goal) => this.toGoalInput(goal)),
    });

    return this.mapDailyPlanResponse(result.data, actions);
  }

  async summariseWeek(actions: LifeAction[], goals: LifeGoal[]): Promise<WeeklyReview | null> {
    if (!this.functions || !this.auth.isAuthenticated()) {
      return null;
    }

    const callable = httpsCallable<
      { actions: ActionInput[]; goals: GoalInput[] },
      WeeklyReview
    >(this.functions, 'aiSummariseWeek');

    const result = await callable({
      actions: actions.map((action) => this.toActionInput(action)),
      goals: goals.map((goal) => this.toGoalInput(goal)),
    });

    return result.data;
  }

  private mapDailyPlanResponse(response: DailyPlanResponse, actions: LifeAction[]): DailyPlan {
    const byId = new Map(actions.map((action) => [action.id, action]));
    const topThree = response.topThreeIds
      .map((id) => byId.get(id))
      .filter((action): action is LifeAction => !!action);
    const optionalExtras = response.optionalExtraIds
      .map((id) => byId.get(id))
      .filter((action): action is LifeAction => !!action);
    const parkedItems = actions.filter((action) => action.status === 'parked').slice(0, 4);

    return {
      topThree,
      optionalExtras,
      parkedItems,
      energyCheck: response.energyCheck,
      availableTime: response.availableTime,
      summary: response.summary,
    };
  }

  private toActionInput(action: LifeAction): ActionInput {
    return {
      id: action.id,
      title: action.title,
      domain: action.domain,
      status: action.status,
      effort: action.effort,
      energy: action.energy,
      source: action.source,
    };
  }

  private toGoalInput(goal: LifeGoal): GoalInput {
    return {
      id: goal.id,
      title: goal.title,
      domain: goal.domain,
      status: goal.status,
      nextAction: goal.nextAction,
      horizon: goal.horizon,
    };
  }
}

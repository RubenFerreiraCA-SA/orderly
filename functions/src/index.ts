import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { generateJson, truncateText } from './gemini';
import {
  BRAIN_DUMP_SYSTEM,
  buildBrainDumpPrompt,
  normalizeBrainDumpResponse,
} from './prompts/brain-dump';
import {
  DAILY_PLAN_SYSTEM,
  buildDailyPlanPrompt,
  normalizeDailyPlanResponse,
} from './prompts/daily-plan';
import {
  WEEKLY_REVIEW_SYSTEM,
  buildWeeklyReviewPrompt,
  normalizeWeeklyReviewResponse,
} from './prompts/weekly-review';
import {
  ActionInput,
  DailyPlanResponse,
  GoalInput,
  ProcessedBrainDumpResponse,
  WeeklyReviewResponse,
} from './types';

const geminiApiKey = defineSecret('GEMINI_API_KEY');

function requireAuth(auth: { uid: string } | undefined): string {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in to use AI features.');
  }
  return auth.uid;
}

export const aiProcessBrainDump = onCall(
  {
    secrets: [geminiApiKey],
    cors: true,
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => {
    requireAuth(request.auth);
    const rawText = request.data?.rawText;
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      throw new HttpsError('invalid-argument', 'rawText is required.');
    }

    const prompt = buildBrainDumpPrompt(truncateText(rawText.trim()));
    const parsed = await generateJson<ProcessedBrainDumpResponse>(
      geminiApiKey.value(),
      BRAIN_DUMP_SYSTEM,
      prompt
    );

    return normalizeBrainDumpResponse(parsed);
  }
);

export const aiGenerateDailyPlan = onCall(
  {
    secrets: [geminiApiKey],
    cors: true,
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (request) => {
    requireAuth(request.auth);
    const actions = request.data?.actions as ActionInput[] | undefined;
    const goals = request.data?.goals as GoalInput[] | undefined;

    if (!Array.isArray(actions) || !Array.isArray(goals)) {
      throw new HttpsError('invalid-argument', 'actions and goals arrays are required.');
    }

    const prompt = buildDailyPlanPrompt(actions, goals);
    const parsed = await generateJson<DailyPlanResponse>(
      geminiApiKey.value(),
      DAILY_PLAN_SYSTEM,
      prompt
    );

    return normalizeDailyPlanResponse(parsed, actions);
  }
);

export const aiSummariseWeek = onCall(
  {
    secrets: [geminiApiKey],
    cors: true,
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (request) => {
    requireAuth(request.auth);
    const actions = request.data?.actions as ActionInput[] | undefined;
    const goals = request.data?.goals as GoalInput[] | undefined;

    if (!Array.isArray(actions) || !Array.isArray(goals)) {
      throw new HttpsError('invalid-argument', 'actions and goals arrays are required.');
    }

    const prompt = buildWeeklyReviewPrompt(actions, goals);
    const parsed = await generateJson<WeeklyReviewResponse>(
      geminiApiKey.value(),
      WEEKLY_REVIEW_SYSTEM,
      prompt
    );

    return normalizeWeeklyReviewResponse(parsed);
  }
);

import { GoogleGenerativeAI } from '@google/generative-ai';
import { AI_MODEL } from './types';

export async function generateJson<T>(apiKey: string, systemPrompt: string, userPrompt: string): Promise<T> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: AI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
      maxOutputTokens: 4096,
    },
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent(userPrompt);
  const text = result.response.text()?.trim();
  if (!text) {
    throw new Error('Empty response from AI model');
  }

  return JSON.parse(text) as T;
}

export function truncateText(text: string, maxChars = 120_000): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}\n\n[Document truncated for processing]`;
}

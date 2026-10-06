import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiError } from '../common/errors/api-error';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
// Tried in order. The free tier often answers 503 "high demand" for one model
// while the next works, and Google retires models for new keys without
// notice (404) — so fall through instead of failing the doctor's click.
// Override with GEMINI_MODEL (comma-separated) without a deploy of code.
const DEFAULT_GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash'];
const FALLTHROUGH_STATUSES = new Set([404, 429, 500, 503]);
const REQUEST_TIMEOUT_MS = 30_000;

interface GenerateTextParams {
  systemInstruction: string;
  prompt: string;
  maxOutputTokens?: number;
}

// Thin wrapper over the Gemini REST API (generateContent). Raw fetch rather
// than an SDK, same as EmailService does for Resend.
@Injectable()
export class GeminiService {
  private readonly logger = new Logger('GeminiService');

  constructor(private readonly config: ConfigService) {}

  async generateText({ systemInstruction, prompt, maxOutputTokens = 2048 }: GenerateTextParams): Promise<string> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new ApiError(503, 'AI notes are not set up on this server yet.');
    }
    const configured = this.config.get<string>('GEMINI_MODEL');
    const models = configured
      ? configured.split(',').map((m) => m.trim()).filter(Boolean)
      : DEFAULT_GEMINI_MODELS;

    let lastStatus: number | undefined;
    for (const model of models) {
      let response: Response;
      try {
        response = await fetch(`${GEMINI_BASE_URL}/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens,
              // Reformatting notes doesn't need a reasoning pass — skipping it
              // keeps the response fast and inside the free-tier token budget.
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (error) {
        this.logger.warn(`Gemini ${model} request failed: ${(error as Error).message}`);
        lastStatus = 503;
        continue;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.warn(`Gemini ${model} ${response.status}: ${body.slice(0, 300)}`);
        lastStatus = response.status;
        if (FALLTHROUGH_STATUSES.has(response.status)) continue;
        throw new ApiError(502, 'The AI service could not generate notes. Please try again.');
      }

      const data: any = await response.json();
      const candidate = data?.candidates?.[0];
      const text: string = (candidate?.content?.parts ?? [])
        .map((part: any) => part?.text ?? '')
        .join('')
        .trim();

      if (!text) {
        this.logger.warn(
          `Gemini ${model} returned no text (finishReason=${candidate?.finishReason}, blockReason=${data?.promptFeedback?.blockReason})`,
        );
        throw new ApiError(502, 'The AI service returned an empty draft. Please try again.');
      }
      return text;
    }

    this.logger.error(`All Gemini models failed (${models.join(', ')}), last status ${lastStatus}`);
    if (lastStatus === 429) {
      throw new ApiError(429, 'AI usage limit reached for now. Please try again in a minute.');
    }
    throw new ApiError(503, 'The AI service is busy right now. Please try again in a moment.');
  }
}

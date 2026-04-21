import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV1 } from 'ai';
import type { AppSettings } from '../store/settings.ts';

export function createModel(settings: AppSettings): LanguageModelV1 {
  const provider = settings.providers.find(p => p.id === settings.selectedProviderId);
  if (!provider) {
    throw new Error('No AI provider selected. Please configure a provider in settings.');
  }
  if (!provider.apiKey) {
    throw new Error(`No API key configured for ${provider.name}. Please add one in settings.`);
  }
  if (!settings.selectedModel) {
    throw new Error('No model selected. Please choose a model in settings.');
  }

  switch (provider.id) {
    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: provider.apiKey,
        baseURL: `${window.location.origin}/api/anthropic/v1`,
      });
      return anthropic(settings.selectedModel);
    }
    case 'openai': {
      const openai = createOpenAI({
        apiKey: provider.apiKey,
        baseURL: `${window.location.origin}/api/openai/v1`,
      });
      return openai(settings.selectedModel);
    }
    case 'openai-compatible': {
      const openai = createOpenAI({
        apiKey: provider.apiKey,
        baseURL: provider.baseUrl || undefined,
      });
      return openai(settings.selectedModel);
    }
    default:
      throw new Error(`Unknown provider: ${provider.id}`);
  }
}

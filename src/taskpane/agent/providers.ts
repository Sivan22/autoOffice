import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import type { AppSettings } from '../store/settings.ts';

export function createModel(settings: AppSettings): LanguageModel {
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
        headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
      });
      return anthropic(settings.selectedModel);
    }
    case 'openai': {
      const openai = createOpenAI({
        apiKey: provider.apiKey,
      });
      return openai(settings.selectedModel);
    }
    case 'google': {
      const google = createGoogleGenerativeAI({
        apiKey: provider.apiKey,
      });
      return google(settings.selectedModel);
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

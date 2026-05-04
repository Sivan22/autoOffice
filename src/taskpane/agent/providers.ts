import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createXai } from '@ai-sdk/xai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGateway } from '@ai-sdk/gateway';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOllama } from 'ollama-ai-provider-v2';
import type { LanguageModel } from 'ai';
import type { AppSettings } from '../store/settings.ts';
import { ConfigError } from './errors.ts';

export function createModel(settings: AppSettings): LanguageModel {
  const provider = settings.providers.find(p => p.id === settings.selectedProviderId);
  if (!provider) {
    throw new ConfigError('No AI provider selected. Please configure a provider in settings.');
  }
  if (!provider.apiKey && provider.id !== 'ollama') {
    throw new ConfigError(`No API key configured for ${provider.name}. Please add one in settings.`);
  }
  if (!settings.selectedModel) {
    throw new ConfigError('No model selected. Please choose a model in settings.');
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
    case 'groq': {
      const groq = createGroq({
        apiKey: provider.apiKey,
      });
      return groq(settings.selectedModel);
    }
    case 'xai': {
      const xai = createXai({
        apiKey: provider.apiKey,
      });
      return xai(settings.selectedModel);
    }
    case 'deepseek': {
      const deepseek = createDeepSeek({
        apiKey: provider.apiKey,
      });
      return deepseek(settings.selectedModel);
    }
    case 'gateway': {
      const gateway = createGateway({
        apiKey: provider.apiKey,
      });
      return gateway(settings.selectedModel);
    }
    case 'openai-compatible': {
      if (!provider.baseUrl) {
        throw new ConfigError('Base URL is required for OpenAI-Compatible providers.');
      }
      const compat = createOpenAICompatible({
        name: 'openai-compatible',
        apiKey: provider.apiKey,
        baseURL: provider.baseUrl,
      });
      return compat(settings.selectedModel);
    }
    case 'openrouter': {
      const openrouter = createOpenRouter({
        apiKey: provider.apiKey,
        ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}),
      });
      return openrouter(settings.selectedModel);
    }
    case 'ollama': {
      const ollama = createOllama({
        ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}),
      });
      return ollama(settings.selectedModel);
    }
    default:
      throw new ConfigError(`Unknown provider: ${provider.id}`);
  }
}

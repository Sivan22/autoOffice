import { generateText, type LanguageModel } from 'ai';
import { isCliBridge, getKnownModels, type ProviderKind } from '@autooffice/shared';
import type { ProvidersRepo } from '../db/providers';
import { makeAnthropic } from './factories/anthropic';
import { makeOpenAI } from './factories/openai';
import { makeGoogle } from './factories/google';
import { makeGroq } from './factories/groq';
import { makeXai } from './factories/xai';
import { makeDeepSeek } from './factories/deepseek';
import { makeOpenRouter } from './factories/openrouter';
import { makeOllama } from './factories/ollama';
import { makeOpenAICompatible } from './factories/openai-compatible';
import { makeVercelGateway } from './factories/vercel-gateway';
import { makeClaudeCode } from './factories/claude-code';
import { makeGeminiCli } from './factories/gemini-cli';
import { makeOpencode } from './factories/opencode';
import { probeForKind, type ProbeStatus } from './readiness';
import { listModelsForProvider, type ListModelsResult } from './list-models';

export class ProviderRegistry {
  constructor(private readonly repo: ProvidersRepo) {}

  async resolve(providerId: string, modelId: string): Promise<LanguageModel | null> {
    const cfg = this.repo.get(providerId);
    if (!cfg) return null;

    if (!isCliBridge(cfg.kind)) {
      const apiKey = this.repo.getDecryptedKey(providerId);
      if (apiKey == null) {
        throw new Error(`Provider '${cfg.label}' requires an API key`);
      }
      return this.buildDirect(cfg.kind, modelId, apiKey, cfg.config as Record<string, unknown>);
    }
    return this.buildCli(cfg.kind, modelId, cfg.config as Record<string, unknown>);
  }

  async listModels(providerId: string): Promise<ListModelsResult> {
    const cfg = this.repo.get(providerId);
    if (!cfg) return { models: [], source: 'fallback', message: 'provider not found' };
    const apiKey = isCliBridge(cfg.kind) ? null : this.repo.getDecryptedKey(providerId);
    return listModelsForProvider(cfg.kind, apiKey, cfg.config);
  }

  async getStatus(providerId: string): Promise<ProbeStatus> {
    const cfg = this.repo.get(providerId);
    if (!cfg) return 'unknown';
    if (isCliBridge(cfg.kind)) return probeForKind(cfg.kind);
    return this.repo.getDecryptedKey(providerId) ? 'ready' : 'needs-key' as ProbeStatus;
  }

  // Actively verify a provider can authenticate. For CLI bridges this probes the
  // binary (same as getStatus). For direct API providers, runs a 1-token generation
  // against modelIdOverride, the first known model for the kind, or fails with
  // 'no-model'. Returns a free-form status plus an optional error message so the
  // UI can surface the upstream rejection text.
  async verifyAuth(
    providerId: string,
    modelIdOverride?: string,
  ): Promise<{ status: string; message?: string }> {
    const cfg = this.repo.get(providerId);
    if (!cfg) return { status: 'unknown', message: 'provider not found' };
    if (isCliBridge(cfg.kind)) {
      return { status: await probeForKind(cfg.kind) };
    }
    const apiKey = this.repo.getDecryptedKey(providerId);
    if (!apiKey) return { status: 'needs-key' };
    const modelId = modelIdOverride?.trim() || getKnownModels(cfg.kind)[0];
    if (!modelId) {
      return { status: 'no-model', message: 'no model id supplied for this provider kind' };
    }
    try {
      const model = this.buildDirect(
        cfg.kind,
        modelId,
        apiKey,
        cfg.config as Record<string, unknown>,
      );
      await generateText({ model, prompt: 'ping', maxOutputTokens: 1 });
      return { status: 'ready' };
    } catch (err) {
      return { status: 'invalid', message: (err as Error).message };
    }
  }

  private buildDirect(
    kind: ProviderKind,
    modelId: string,
    apiKey: string,
    config: Record<string, unknown>,
  ): LanguageModel {
    switch (kind) {
      case 'anthropic': return makeAnthropic({ apiKey, baseURL: config.baseURL as string | undefined })(modelId);
      case 'openai': return makeOpenAI({
        apiKey,
        baseURL: config.baseURL as string | undefined,
        organization: config.organization as string | undefined,
      })(modelId);
      case 'google': return makeGoogle({ apiKey })(modelId);
      case 'groq': return makeGroq({ apiKey })(modelId);
      case 'xai': return makeXai({ apiKey })(modelId);
      case 'deepseek': return makeDeepSeek({ apiKey })(modelId);
      case 'openrouter': return makeOpenRouter({ apiKey })(modelId);
      case 'openai-compatible': return makeOpenAICompatible({
        name: (config.name as string) ?? 'compat',
        apiKey,
        baseURL: config.baseURL as string,
      })(modelId);
      case 'vercel-gateway': return makeVercelGateway({ apiKey })(modelId);
      case 'ollama': return makeOllama({ baseURL: config.baseURL as string | undefined })(modelId);
      default:
        throw new Error(`Unhandled direct provider kind: ${kind}`);
    }
  }

  private buildCli(
    kind: ProviderKind,
    modelId: string,
    config: Record<string, unknown>,
  ): LanguageModel {
    switch (kind) {
      case 'claude-code': return makeClaudeCode({ binaryPath: config.binaryPath as string | undefined })(modelId);
      case 'gemini-cli': return makeGeminiCli({
        authType: (config.authType as 'oauth-personal' | 'gemini-api-key' | undefined) ?? 'oauth-personal',
        apiKey: config.apiKey as string | undefined,
      })(modelId);
      case 'opencode': return makeOpencode(config)(modelId);
      default:
        throw new Error(`Unhandled CLI provider kind: ${kind}`);
    }
  }
}

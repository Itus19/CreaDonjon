import "server-only";
import type { AiCapabilities, AiProvider, AiToolCall, CompletionRequest, CompletionResult } from "../provider";

export interface OpenAiCompatibleConfig {
  baseUrl: string;
  model: string;
  contextWindow?: number;
  embedDim?: number;
}

interface OpenAiToolCall {
  function: { name: string; arguments: string };
}

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string | null; tool_calls?: OpenAiToolCall[] };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

interface OpenAiEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

function parseToolArguments(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Adaptateur partage pour Ollama et LM Studio : les deux exposent un point
 * d'acces compatible OpenAI (specs/cible-locale-et-ia.md §3 — "deux
 * implementations seulement a ecrire, le troisieme est l'API distante").
 * Configure par variables d'environnement pour l'instant, pas encore un
 * reglage par monde/utilisateur — un seul fournisseur actif dans ce ticket
 * (V1-F2), la configurabilite par monde n'a pas encore de deuxieme cas
 * concret pour la justifier (meme raisonnement que le formulaire dedie de
 * V1-D4).
 */
export class OpenAiCompatibleProvider implements AiProvider {
  readonly model: string;
  private readonly baseUrl: string;
  private readonly contextWindow: number;
  private readonly embedDim: number;

  constructor(config: OpenAiCompatibleConfig) {
    this.model = config.model;
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.contextWindow = config.contextWindow ?? 8192;
    this.embedDim = config.embedDim ?? 1024;
  }

  capabilities(): AiCapabilities {
    return { toolCalls: true, contextWindow: this.contextWindow, embedDim: this.embedDim, isLocal: true };
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    };
    if (request.maxOutputTokens !== undefined) body.max_tokens = request.maxOutputTokens;
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.inputSchema },
      }));
      // "auto", pas "required" : verifie contre un vrai modele de raisonnement local
      // (qwen3 distill) que "required" le pousse a ecrire l'appel d'outil en texte
      // brut dans `reasoning_content` au lieu de la reponse structuree `tool_calls`
      // — pire que de le laisser libre. L'absence d'appel d'outil reste geree en
      // echec par l'appelant (meme mecanisme de nouvelle tentative que toute autre
      // proposition invalide, specs/regles-couche.md §5.1).
      body.tool_choice = "auto";
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Fournisseur IA local (${this.model}) : ${res.status} ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as OpenAiChatCompletionResponse;
    const message = data.choices?.[0]?.message;
    const toolCalls: AiToolCall[] = (message?.tool_calls ?? []).map((tc) => ({
      name: tc.function.name,
      input: parseToolArguments(tc.function.arguments),
    }));

    return {
      text: message?.content ?? "",
      toolCalls,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      cachedTokens: 0,
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Fournisseur IA local (${this.model}) : ${res.status} ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as OpenAiEmbeddingResponse;
    return data.data.map((d) => d.embedding);
  }
}

/** Lit la config depuis l'environnement (V1-F2) : aucune valeur par defaut devinee — un port par defaut favoriserait silencieusement soit Ollama soit LM Studio. */
export function getOpenAiCompatibleProviderFromEnv(): OpenAiCompatibleProvider {
  const baseUrl = process.env.AI_LOCAL_BASE_URL;
  const model = process.env.AI_LOCAL_MODEL;
  if (!baseUrl || !model) {
    throw new Error("AI_LOCAL_BASE_URL et AI_LOCAL_MODEL doivent etre definis (.env.local) pour utiliser l'editeur de regle assiste.");
  }
  return new OpenAiCompatibleProvider({ baseUrl, model });
}

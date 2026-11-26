import "server-only";
import { classerReponseFournisseur, extraireMessageFournisseur } from "@/src/core/ai/providerError";
import { estAdresseLocale } from "@/src/core/ai/providerUrl";
import { AiProviderError, type AiCapabilities, type AiProvider, type AiToolCall, type CompletionRequest, type CompletionResult } from "../provider";

/**
 * Délai d'un appel (ADR 0103 : « délai court »). Assez pour un gros modèle
 * distant qui raconte un tour, assez court pour qu'un fournisseur pendu ne
 * retienne pas la requête jusqu'à ce que l'hébergeur la coupe.
 */
const DELAI_PAR_DEFAUT_MS = 45_000;

/** Taille maximale d'une réponse lue (ADR 0103 : « taille de réponse bornée »). Une narration pèse quelques kilo-octets. */
const TAILLE_MAX_REPONSE = 4 * 1024 * 1024;

export interface OpenAiCompatibleConfig {
  baseUrl: string;
  model: string;
  contextWindow?: number;
  embedDim?: number;
  /** Jeton exigé par le serveur local (LM Studio « Require Authentication ») ; absent : aucun en-tête. Serveur uniquement (règle 1). */
  apiKey?: string;
  /** Délai maximal d'un appel, en millisecondes. */
  timeoutMs?: number;
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
  } catch (erreur) {
    // Arguments illisibles : `{}` est refuse ensuite par le schema Zod de l'outil.
    console.error("Arguments d'outil illisibles dans la réponse du modèle", erreur);
    return {};
  }
}

/**
 * Adaptateur partage pour Ollama et LM Studio, et pour tout fournisseur
 * distant compatible OpenAI (OpenAI, OpenRouter, Venice — ADR 0103) : tous
 * exposent un point d'acces compatible OpenAI (specs/cible-locale-et-ia.md §3 — "deux
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
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;
  private readonly isLocal: boolean;

  constructor(config: OpenAiCompatibleConfig) {
    this.model = config.model;
    // Une adresse collée avec son chemin final (`…/v1/chat/completions`, erreur
    // fréquente en copiant la doc d'un fournisseur) : on le retire, puisque ce
    // chemin est ajouté à chaque appel.
    this.baseUrl = config.baseUrl.trim().replace(/\/+$/, "").replace(/\/(chat\/completions|embeddings)$/, "");
    this.contextWindow = config.contextWindow ?? 8192;
    this.embedDim = config.embedDim ?? 1024;
    this.apiKey = config.apiKey?.trim() || undefined;
    this.timeoutMs = config.timeoutMs ?? DELAI_PAR_DEFAUT_MS;
    this.isLocal = estAdresseLocale(this.baseUrl);
  }

  private headers(): Record<string, string> {
    return { "Content-Type": "application/json", ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}) };
  }

  capabilities(): AiCapabilities {
    return { toolCalls: true, contextWindow: this.contextWindow, embedDim: this.embedDim, isLocal: this.isLocal };
  }

  /**
   * Le seul endroit qui appelle le fournisseur. Les gardes de l'ADR 0103 :
   * aucune redirection suivie (une adresse publique pourrait renvoyer vers une
   * adresse privée), un délai, une réponse bornée. Toute défaillance devient
   * une `AiProviderError` qui dit pourquoi.
   */
  private async post(chemin: string, body: unknown): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${chemin}`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
        redirect: "manual",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (erreur) {
      const delai = erreur instanceof Error && (erreur.name === "TimeoutError" || erreur.name === "AbortError");
      throw new AiProviderError(delai ? "delai" : "echec", `Fournisseur IA (${this.model}) : ${delai ? "délai dépassé" : "injoignable"}`);
    }
    if (!res.ok) {
      const text = res.status >= 300 && res.status < 400 ? "" : await res.text().catch(() => "");
      throw new AiProviderError(
        classerReponseFournisseur(res.status, text),
        `Fournisseur IA (${this.model}) : ${res.status} ${text.slice(0, 300)}`,
        extraireMessageFournisseur(res.status, text),
      );
    }
    const longueur = Number(res.headers.get("content-length") ?? "0");
    if (longueur > TAILLE_MAX_REPONSE) throw new AiProviderError("echec", `Fournisseur IA (${this.model}) : réponse trop lourde`);
    const text = await res.text();
    if (text.length > TAILLE_MAX_REPONSE) throw new AiProviderError("echec", `Fournisseur IA (${this.model}) : réponse trop lourde`);
    try {
      return JSON.parse(text);
    } catch {
      // catch-attendu : un corps qui n'est pas du JSON est une réponse invalide du fournisseur, dite comme telle.
      throw new AiProviderError("echec", `Fournisseur IA (${this.model}) : réponse illisible`);
    }
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

    const data = (await this.post("/chat/completions", body)) as OpenAiChatCompletionResponse;
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
    const data = (await this.post("/embeddings", { model: this.model, input: texts })) as OpenAiEmbeddingResponse;
    return data.data.map((d) => d.embedding);
  }
}

/** Lit la config depuis l'environnement (V1-F2) : aucune valeur par defaut devinee — un port par defaut favoriserait silencieusement soit Ollama soit LM Studio. */
export function getOpenAiCompatibleProviderFromEnv(): OpenAiCompatibleProvider {
  const baseUrl = process.env.AI_LOCAL_BASE_URL;
  const model = process.env.AI_LOCAL_MODEL;
  if (!baseUrl || !model) {
    throw new Error("AI_LOCAL_BASE_URL et AI_LOCAL_MODEL doivent être définis (.env.local) pour utiliser l'éditeur de règle assisté.");
  }
  return new OpenAiCompatibleProvider({ baseUrl, model, apiKey: process.env.AI_LOCAL_API_KEY });
}

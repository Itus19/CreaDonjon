import "server-only";
import type { RaisonSansNarration } from "@/src/core/ai/providerError";

export type AiCompletionRole = "system" | "user" | "assistant";

export interface AiCompletionMessage {
  role: AiCompletionRole;
  content: string;
}

export interface AiToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface CompletionRequest {
  messages: AiCompletionMessage[];
  tools?: AiToolDefinition[];
  maxOutputTokens?: number;
}

export interface AiToolCall {
  name: string;
  input: unknown;
}

export interface CompletionResult {
  text: string;
  toolCalls: AiToolCall[];
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

export interface AiCapabilities {
  toolCalls: boolean;
  contextWindow: number;
  embedDim: number;
  /** Propriete de confidentialite, pas une capacite technique (specs/cible-locale-et-ia.md §4.5) : conditionne l'acces au collage assiste de contenu d'ouvrage possede par l'utilisateur, qui ne doit jamais quitter la machine. */
  isLocal: boolean;
}

/**
 * Interface unique derriere laquelle vivent les fournisseurs de modele —
 * Ollama et LM Studio partagent un adaptateur compatible OpenAI, le
 * troisieme est l'API distante (specs/cible-locale-et-ia.md §3). Aucun appel
 * d'IA hors de `src/server/ai/` (CLAUDE.md regle 16 ter) : c'est le seul
 * type que le reste du code est autorise a connaitre, et tout appel passe
 * par `runAiCompletion`/`runAiEmbedding` (./callAi.ts), jamais directement.
 */
export interface AiProvider {
  readonly model: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
  embed(texts: string[]): Promise<number[][]>;
  capabilities(): AiCapabilities;
}

/**
 * Un appel refusé ou perdu par le fournisseur, avec sa raison lisible par
 * l'écran (crédit épuisé, clé refusée, délai dépassé…). Le message, lui, reste
 * pour la console du serveur : il peut contenir un extrait du corps d'erreur.
 * `detail` est la phrase du fournisseur, nettoyée (`extraireMessageFournisseur`),
 * que l'écran montre sous le voyant.
 */
export class AiProviderError extends Error {
  constructor(
    public readonly raison: Exclude<RaisonSansNarration, "aucun_fournisseur">,
    message: string,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

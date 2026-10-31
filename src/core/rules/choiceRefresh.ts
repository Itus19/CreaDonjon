import type { OpenChoice } from "./choices";

/**
 * V3.1-119 — Les choix qu'un repos rouvre (`refresh` d'un choix accordé :
 * terrain du Cercle de la Terre au repos long, Résilience fiélonne au repos
 * court). Rouvrir ne change rien : la fiche propose de choisir à nouveau, et
 * sans réponse le choix d'avant reste.
 */
export function choicesToRefresh(open: readonly OpenChoice[], rest: "short_rest" | "long_rest"): string[] {
  return open
    .filter((c) => c.chosen.length > 0 && !c.preset)
    .filter((c) => c.refresh === "short_rest" || (c.refresh === "long_rest" && rest === "long_rest"))
    .map((c) => c.key);
}

/**
 * Une nouvelle réponse vaut si le moteur, résolu AVEC elle, la retient entière :
 * le bon nombre de valeurs, toutes valides (une valeur hors options est écartée
 * par `resolveChoices`, et la réponse est alors refusée, jamais tronquée).
 */
export function isValidRefreshAnswer(resolved: OpenChoice | undefined, values: readonly string[]): boolean {
  if (!resolved || values.length !== resolved.count) return false;
  const retenues = new Set(resolved.chosen);
  return values.every((v) => retenues.has(v)) && retenues.size === values.length;
}

export function withoutRefresh(toRefresh: readonly string[], key: string): string[] {
  return toRefresh.filter((k) => k !== key);
}

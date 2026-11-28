/**
 * V3.2-80 (ADR 0122) — Ce que les PNJ savent du personnage joué.
 *
 * Le miroir des indices (ADR 0118) : un PNJ apprend une facette du
 * personnage (`item:<id>`, `ability:str`…) en le voyant ou par un jet, ou on
 * la lui dit ; il peut aussi croire une rumeur, vraie ou fausse. `claim` est
 * ce qu'il en retient en mots, figé au moment où il l'apprend : un PNJ peut
 * savoir quelque chose qui n'est plus vrai.
 *
 * Tout ceci est un secret du MJ : la personne qui joue ne le lit jamais.
 */

export type KnowledgeSource = "observation" | "told" | "rumour";

export interface KnowledgeFact {
  knowerId: string;
  facet: string | null;
  claim: string | null;
  isTrue: boolean;
  source: KnowledgeSource;
  toldById: string | null;
}

/** Ce qui se voit d'un coup d'œil : les objets portés et non cachés, comme dans l'autre sens (ADR 0118). */
export function visibleFacetsAtSight(gear: { items: readonly { id: string; equipped?: boolean; concealed?: boolean }[] } | null): string[] {
  return (gear?.items ?? []).filter((i) => i.equipped === true && i.concealed !== true).map((i) => `item:${i.id}`);
}

const memeFait = (a: KnowledgeFact, b: KnowledgeFact) => (a.facet !== null ? a.facet === b.facet : b.facet === null && a.claim === b.claim);

/**
 * Un PNJ raconte à un autre ce qu'il sait : l'autre le tient de lui, vrai ou
 * faux, sauf ce qu'il savait déjà. La source d'origine se perd, comme dans la
 * vie : on retient qui nous l'a dit.
 */
export function factsToShare(from: readonly KnowledgeFact[], toKnown: readonly KnowledgeFact[], toId: string): KnowledgeFact[] {
  const out: KnowledgeFact[] = [];
  for (const fait of from) {
    if ([...toKnown, ...out].some((k) => memeFait(k, fait))) continue;
    out.push({ ...fait, knowerId: toId, source: "told", toldById: fait.knowerId });
  }
  return out;
}

/** Une rumeur proposée par le récit : une phrase de 1 à 300 caractères, espaces resserrés ; sinon refusée. */
export function rumourClaim(text: string): string | null {
  const net = text.replace(/\s+/g, " ").trim();
  return net.length >= 1 && net.length <= 300 ? net : null;
}

/** La ligne que reçoit la narration, dans la partie réservée au MJ (ADR 0117). */
export function describeKnowledge(facts: readonly KnowledgeFact[], nameOf: (entityId: string) => string): string | null {
  const dit = (f: KnowledgeFact) => `${f.claim ?? f.facet ?? ""}${f.toldById ? ` (tenu de ${nameOf(f.toldById)})` : ""}`;
  const vrais = facts.filter((f) => f.isTrue).map(dit);
  const faux = facts.filter((f) => !f.isTrue).map((f) => `« ${f.claim ?? f.facet ?? ""} »${f.toldById ? ` (tenu de ${nameOf(f.toldById)})` : ""}`);
  const parts = [...(vrais.length > 0 ? [`sait : ${vrais.join(" ; ")}`] : []), ...(faux.length > 0 ? [`croit à tort : ${faux.join(" ; ")}`] : [])];
  return parts.length > 0 ? `${parts.join(". ")}.` : null;
}

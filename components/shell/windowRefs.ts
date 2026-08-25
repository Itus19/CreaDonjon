import type { EntityWindowData } from "@/src/server/services/entityWindow";
import type { RuleEntryDetail } from "@/src/server/services/rules";

/**
 * Adressage d'une fenetre ouverte (ADR-0011) : `?avec=` melange desormais
 * des entites de monde et des entrees de regle. Prefixe explicite
 * (`entite:`/`regle:`) plutot que deviner le type en cherchant la cle dans
 * les deux tables — plus rapide, jamais ambigu si un slug existe des deux
 * cotes.
 */
export type WindowRef = { kind: "entity"; key: string } | { kind: "rule"; key: string };

const PREFIX: Record<WindowRef["kind"], string> = {
  entity: "entite",
  rule: "regle",
};

export function refId(ref: WindowRef): string {
  return `${PREFIX[ref.kind]}:${ref.key}`;
}

export function parseRefId(id: string): WindowRef | null {
  const sep = id.indexOf(":");
  if (sep < 0) return null;
  const prefix = id.slice(0, sep);
  const key = id.slice(sep + 1);
  if (key.length === 0) return null;
  if (prefix === PREFIX.entity) return { kind: "entity", key };
  if (prefix === PREFIX.rule) return { kind: "rule", key };
  return null;
}

export function parseAvecParam(value: string | null): WindowRef[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(parseRefId)
    .filter((ref): ref is WindowRef => ref !== null);
}

export function serializeAvecParam(refs: WindowRef[]): string {
  return refs.map(refId).join(",");
}

export function refsEqual(a: WindowRef, b: WindowRef): boolean {
  return a.kind === b.kind && a.key === b.key;
}

export function windowHref(worldSlug: string, ref: WindowRef): string {
  return ref.kind === "entity" ? `/m/${worldSlug}/f/${ref.key}` : `/m/${worldSlug}/regles/${ref.key}`;
}

export function sectionHomeHref(worldSlug: string, kind: WindowRef["kind"]): string {
  return kind === "entity" ? `/m/${worldSlug}` : `/m/${worldSlug}/regles`;
}

/** Nom/badge d'une fenetre secondaire a partir de sa donnee recuperee — le meme calcul servait deux fois (rendu, onglet reduit V2-K4). */
export function windowContentLabel(
  data: EntityWindowData | RuleEntryDetail | undefined,
  fallbackKey: string
): { name: string; badge: string | null } {
  if (!data) return { name: fallbackKey, badge: null };
  if ("entity" in data) return { name: data.entity.name, badge: data.entity.entity_kind };
  return { name: data.name, badge: data.entryType };
}

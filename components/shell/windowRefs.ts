import type { EntityWindowData } from "@/src/server/services/entityWindow";
import type { RuleEntryDetail } from "@/src/server/services/rules";
import type { MjToolWindowData } from "./mjToolWindows";

/** Cles fixes des neuf outils MJ (retour utilisateur, V2-M7 suite : "les fenetres des outils MJ [...] comme celles des regles ou du wiki") — jamais dynamiques (contrairement a une entite/regle, tirees d'une table), donc une union litterale plutot qu'un `string` libre. */
export const MJ_TOOL_KEYS = [
  "chat",
  "gestion-campagne",
  "journal-historique",
  "probabilites",
  "rencontres",
  "initiative",
  "creation-personnage",
  "calendrier",
  "personnalisation",
  "regles-actives",
  "publication",
] as const;
export type MjToolKey = (typeof MJ_TOOL_KEYS)[number];

export const MJ_TOOL_LABELS: Record<MjToolKey, string> = {
  chat: "Chat",
  "gestion-campagne": "Gestion de campagne",
  "journal-historique": "Journal d'historique",
  probabilites: "Probabilités",
  rencontres: "Rencontres",
  initiative: "Initiative",
  "creation-personnage": "Création de personnage",
  calendrier: "Calendrier",
  personnalisation: "Personnalisation",
  "regles-actives": "Règles actives",
  publication: "Publication",
};

/**
 * Adressage d'une fenetre ouverte (ADR-0011) : `?avec=` melange desormais
 * des entites de monde, des entrees de regle et des outils MJ. Prefixe
 * explicite (`entite:`/`regle:`/`outil:`) plutot que deviner le type en
 * cherchant la cle dans plusieurs tables — plus rapide, jamais ambigu si un
 * slug existe des deux cotes.
 */
export type WindowRef = { kind: "entity"; key: string } | { kind: "rule"; key: string } | { kind: "mj"; key: MjToolKey };

const PREFIX: Record<WindowRef["kind"], string> = {
  entity: "entite",
  rule: "regle",
  mj: "outil",
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
  if (prefix === PREFIX.mj && (MJ_TOOL_KEYS as readonly string[]).includes(key)) return { kind: "mj", key: key as MjToolKey };
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

export function mjToolHref(worldSlug: string, key: MjToolKey): string {
  // `/mj` (racine) est desormais l'accueil neutre de la section, jamais un
  // outil precis (retour utilisateur : "les boutons rouges pour fermer les
  // fenetres MJ ne fonctionnent pas" — "Gestion de campagne" vivait sur
  // cette racine, donc fermer sa fenetre y renaviguait vers elle-meme).
  return `/m/${worldSlug}/mj/${key}`;
}

export function windowHref(worldSlug: string, ref: WindowRef): string {
  if (ref.kind === "entity") return `/m/${worldSlug}/f/${ref.key}`;
  if (ref.kind === "rule") return `/m/${worldSlug}/regles/${ref.key}`;
  return mjToolHref(worldSlug, ref.key);
}

export function sectionHomeHref(worldSlug: string, kind: WindowRef["kind"]): string {
  if (kind === "entity") return `/m/${worldSlug}`;
  if (kind === "rule") return `/m/${worldSlug}/regles`;
  return `/m/${worldSlug}/mj`;
}

/** Nom/badge d'une fenetre a partir de son ref et, pour entite/regle, de sa donnee recuperee — le meme calcul servait deux fois (rendu, onglet reduit V2-K4). Un outil MJ a un nom fixe (`MJ_TOOL_LABELS`), jamais de badge — il n'a pas de "type" au sens d'une entite/regle. */
export function windowContentLabel(
  ref: WindowRef,
  data: EntityWindowData | RuleEntryDetail | MjToolWindowData | undefined
): { name: string; badge: string | null } {
  if (ref.kind === "mj") return { name: MJ_TOOL_LABELS[ref.key], badge: null };
  if (!data || !("entity" in data || "entryType" in data)) return { name: ref.key, badge: null };
  if ("entity" in data) return { name: data.entity.name, badge: data.entity.entity_kind };
  return { name: data.name, badge: data.entryType };
}

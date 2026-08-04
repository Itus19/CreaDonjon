import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import {
  listRulesetEntryChipsByKeys,
  listTranslationsForEntries,
  type RulesetEntryChipRow,
} from "@/src/server/repos/rules";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { entryNameFrom, walkRulesetChain } from "./rules";

type TypedClient = SupabaseClient<Database>;

export interface ResolvedChip {
  kind: "rule" | "entity";
  /** entry_key pour une regle, id pour une entite — la meme valeur que dans la `BlockReference` d'origine. */
  key: string;
  name: string;
  summary: string | null;
  href: string;
  /** false = cible disparue ou hors du monde courant : l'affichage decide quoi en faire, jamais retire silencieusement. */
  found: boolean;
}

async function resolveRuleChips(
  supabase: TypedClient,
  worldSlug: string,
  rulesetId: string,
  locale: Locale,
  keys: string[]
): Promise<Map<string, ResolvedChip>> {
  const result = new Map<string, ResolvedChip>();
  if (keys.length === 0) return result;

  const chain = await walkRulesetChain(supabase, rulesetId);
  const remaining = new Set(keys);
  const found: RulesetEntryChipRow[] = [];

  for (const link of chain) {
    if (remaining.size === 0) break;
    const rows = await listRulesetEntryChipsByKeys(supabase, link.rulesetId, [...remaining]);
    for (const row of rows) {
      found.push(row);
      remaining.delete(row.entry_key);
    }
  }

  const translationByEntryId = new Map<string, string>();
  if (locale !== "en" && found.length > 0) {
    const translations = await listTranslationsForEntries(supabase, found.map((e) => e.id), locale);
    for (const t of translations) translationByEntryId.set(t.entry_id, t.name);
  }

  for (const row of found) {
    result.set(row.entry_key, {
      kind: "rule",
      key: row.entry_key,
      name: translationByEntryId.get(row.id) ?? entryNameFrom(row),
      summary: row.ai_digest,
      href: `/m/${worldSlug}/regles/${row.entry_key}`,
      found: true,
    });
  }
  for (const key of remaining) {
    result.set(key, {
      kind: "rule",
      key,
      name: key,
      summary: null,
      href: `/m/${worldSlug}/regles/${key}`,
      found: false,
    });
  }
  return result;
}

async function resolveEntityChips(
  supabase: TypedClient,
  world: { id: string; slug: string },
  ids: string[]
): Promise<Map<string, ResolvedChip>> {
  const result = new Map<string, ResolvedChip>();
  if (ids.length === 0) return result;

  const entities = await listEntitiesByIds(supabase, ids);
  const byId = new Map(entities.filter((e) => e.world_id === world.id).map((e) => [e.id, e]));

  for (const id of ids) {
    const entity = byId.get(id);
    result.set(
      id,
      entity
        ? { kind: "entity", key: id, name: entity.name, summary: null, href: `/m/${world.slug}/f/${entity.slug}`, found: true }
        : { kind: "entity", key: id, name: id, summary: null, href: "#", found: false }
    );
  }
  return result;
}

/**
 * Resout un lot de `BlockReference` (specs/wiki-blocs.md §4.1, §4.3) en
 * fiches d'affichage pretes pour `<RuleChip>`/`<EntityChip>` : nom, resume
 * (`ai_digest` pour une regle), lien vers la fiche. C'est le mecanisme
 * demande explicitement pour les sorts et etendu ici a toute reference —
 * maitrises d'armes, dons, traits d'espece, objets (specs/wiki-blocs.md
 * §4.3). Une reference introuvable reste dans le resultat (`found: false`)
 * plutot que d'etre retiree silencieusement.
 */
export async function resolveBlockReferences(
  supabase: TypedClient,
  world: { id: string; slug: string },
  rulesetId: string | null,
  locale: Locale,
  refs: BlockReference[]
): Promise<ResolvedChip[]> {
  const ruleKeys = [...new Set(refs.filter((r) => r.kind === "rule").map((r) => r.key))];
  const entityIds = [...new Set(refs.filter((r) => r.kind === "entity").map((r) => r.id))];

  const [ruleChips, entityChips] = await Promise.all([
    rulesetId ? resolveRuleChips(supabase, world.slug, rulesetId, locale, ruleKeys) : new Map<string, ResolvedChip>(),
    resolveEntityChips(supabase, world, entityIds),
  ]);

  return refs.map((ref) =>
    ref.kind === "rule"
      ? (ruleChips.get(ref.key) ?? {
          kind: "rule",
          key: ref.key,
          name: ref.key,
          summary: null,
          href: `/m/${world.slug}/regles/${ref.key}`,
          found: false,
        })
      : (entityChips.get(ref.id) ?? { kind: "entity", key: ref.id, name: ref.id, summary: null, href: "#", found: false })
  );
}

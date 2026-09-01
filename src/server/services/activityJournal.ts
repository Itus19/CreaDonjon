import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import {
  getDisplayNamesForUsers,
  listEntityRevisionsForEntities,
  listEntityRevisionsForWorld,
  listSessionEventsForWorld,
  type EntityRevisionJournalRow,
  type SessionEventJournalRow,
} from "@/src/server/repos/activityJournal";
import { listPcEntityIdsForWorld } from "@/src/server/repos/campaigns";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { listRevisionSnapshotsInRange } from "@/src/server/repos/entityRevisions";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";
import { listRulesetEntryChipsByKeys, listTranslationsForEntries } from "@/src/server/repos/rules";
import { walkRulesetChain, entryNameFrom } from "@/src/server/services/rules";
import { normalizeStoredSnapshot } from "@/src/server/services/entityHistory";
import { diffEntitySnapshots } from "@/src/core/history/diff";
import { zInventoryBlockData, type InventoryBlockData, type InventoryItem } from "@/src/core/schemas/blocks/inventory";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";

type TypedClient = SupabaseClient<Database>;

const SESSION_EVENT_LABELS_FR: Record<string, string> = {
  player_action: "Action de joueur",
  narration: "Narration",
  roll: "Jet de dés",
  rule_application: "Application de règle",
  world_update: "Mise à jour du monde",
  note: "Note",
  system: "Système",
};

const ENTITY_FIELD_LABELS_FR: Record<string, string> = {
  name: "nom",
  entityKind: "type",
  aliases: "alias",
};

export interface JournalEntry {
  source: "wiki" | "jeu";
  label: string;
  accountName: string;
  createdAt: string;
  /** `null` si l'evenement ne reference aucune fiche (la plupart des `combat`/`narration`/`roll`) — sinon la fiche concernee. */
  entitySlug: string | null;
  entityName: string | null;
  /** V2 (retour utilisateur) : quel bloc (ou quel champ de la fiche) a change, pour une entree "wiki" — `null` pour la toute premiere revision (rien a comparer) ou pour une entree "jeu" (le detail vit dans `label` via `payload.note`, voir ci-dessous). */
  blockLabel: string | null;
  /** V2 (retour utilisateur : "si il y a des choses dans l'inventaire qui ont ete modifiees, ajout ou retrait, quel type et combien") — detail objet par objet pour un bloc `inventory` modifie, `null` sinon (aucun bloc inventaire touche, ou rien de plus precis a dire). */
  blockDetail: string | null;
}

const CURRENCY_LABELS_FR: Record<keyof InventoryBlockData["currency"], string> = { pp: "pp", gp: "po", ep: "pe", sp: "pa", cp: "pc" };

const EMPTY_INVENTORY: InventoryBlockData = { __v: 1, items: [], containers: [], currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } };

function inventoryRefKey(ref: BlockReference): string {
  return ref.kind === "rule" ? `rule:${ref.key}` : `entity:${ref.id}`;
}

/** Trois natures d'objet (specs/wiki-blocs.md §4.1) : reference de regle, reference d'entite, ou objet en ligne avec son propre `label` — jamais les trois en meme temps sur un item. */
function inventoryItemRef(item: InventoryItem): BlockReference | null {
  return (item as { ref?: BlockReference }).ref ?? null;
}
function inventoryItemInlineLabel(item: InventoryItem): string | null {
  return (item as { label?: string }).label ?? null;
}

interface InventoryItemChange {
  item: InventoryItem;
  status: "added" | "removed" | "qty";
  qtyBefore?: number;
  qtyAfter?: number;
}

/** Objets ajoutes/retires/dont la quantite a change entre deux instantanes du meme bloc `inventory`, appaires par `id` — jamais par position (un reordonnancement pur ne doit rien produire ici). */
function diffInventoryItems(before: InventoryBlockData, after: InventoryBlockData): InventoryItemChange[] {
  const beforeById = new Map(before.items.map((i) => [i.id, i]));
  const afterById = new Map(after.items.map((i) => [i.id, i]));
  const changes: InventoryItemChange[] = [];
  for (const item of before.items) {
    if (!afterById.has(item.id)) changes.push({ item, status: "removed" });
  }
  for (const item of after.items) {
    const prior = beforeById.get(item.id);
    if (!prior) changes.push({ item, status: "added" });
    else if (prior.qty !== item.qty) changes.push({ item, status: "qty", qtyBefore: prior.qty, qtyAfter: item.qty });
  }
  return changes;
}

function diffInventoryCurrency(
  before: InventoryBlockData["currency"],
  after: InventoryBlockData["currency"]
): { denom: keyof InventoryBlockData["currency"]; before: number; after: number }[] {
  const denoms = Object.keys(CURRENCY_LABELS_FR) as (keyof InventoryBlockData["currency"])[];
  return denoms.filter((d) => before[d] !== after[d]).map((d) => ({ denom: d, before: before[d], after: after[d] }));
}

/**
 * Noms affichables pour un lot de references d'objets d'inventaire — une
 * regle passe par la chaine de ruleset (meme motif que `referenceChips.ts`,
 * sans le lien/resume, inutiles ici), une entite par un lot direct. `null`
 * `rulesetId` (monde sans ruleset par defaut, cas degenere) laisse toute
 * reference de regle affichee par sa cle brute plutot que d'echouer.
 */
async function resolveInventoryRefNames(supabase: TypedClient, rulesetId: string | null, refs: BlockReference[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const ruleKeys = [...new Set(refs.filter((r) => r.kind === "rule").map((r) => r.key))];
  const entityIds = [...new Set(refs.filter((r) => r.kind === "entity").map((r) => r.id))];

  if (ruleKeys.length > 0 && rulesetId) {
    const chain = await walkRulesetChain(supabase, rulesetId);
    const remaining = new Set(ruleKeys);
    const found: { id: string; entry_key: string; source_raw: unknown }[] = [];
    for (const link of chain) {
      if (remaining.size === 0) break;
      const rows = await listRulesetEntryChipsByKeys(supabase, link.rulesetId, [...remaining]);
      for (const row of rows) {
        found.push(row);
        remaining.delete(row.entry_key);
      }
    }
    // Le nom brut d'une regle SRD est en anglais (`source_raw`) — retour
    // utilisateur : "tout en francais par defaut" — resolu ici via la meme
    // table de traductions que `RuleChip`/`resolveRuleChips`, jamais affiche
    // tel quel des lors qu'une traduction francaise existe.
    const translationByEntryId = new Map<string, string>();
    if (found.length > 0) {
      const translations = await listTranslationsForEntries(supabase, found.map((e) => e.id), "fr");
      for (const t of translations) translationByEntryId.set(t.entry_id, t.name);
    }
    for (const row of found) {
      result.set(`rule:${row.entry_key}`, translationByEntryId.get(row.id) ?? entryNameFrom(row));
    }
    for (const key of remaining) result.set(`rule:${key}`, key);
  } else {
    for (const key of ruleKeys) result.set(`rule:${key}`, key);
  }

  if (entityIds.length > 0) {
    const entities = await listEntitiesByIds(supabase, entityIds);
    const byId = new Map(entities.map((e) => [e.id, e]));
    for (const id of entityIds) result.set(`entity:${id}`, byId.get(id)?.name ?? id);
  }

  return result;
}

function inventoryItemName(item: InventoryItem, names: Map<string, string>): string {
  const ref = inventoryItemRef(item);
  if (ref) return names.get(inventoryRefKey(ref)) ?? (ref.kind === "rule" ? ref.key : ref.id);
  return inventoryItemInlineLabel(item) ?? "objet";
}

/** Ligne "+2 Potion de soins", "−1 Épée courte", "Torche : 3 → 5 (+2)", "po : 61 → 111 (+50)" — jamais de valeur avant/apres brute sans son delta signe, pour rester lisible d'un coup d'oeil dans le journal. */
async function formatInventoryDetail(
  supabase: TypedClient,
  rulesetId: string | null,
  before: InventoryBlockData,
  after: InventoryBlockData
): Promise<string | null> {
  const itemChanges = diffInventoryItems(before, after);
  const currencyChanges = diffInventoryCurrency(before.currency, after.currency);
  if (itemChanges.length === 0 && currencyChanges.length === 0) return null;

  const refs = itemChanges.map((c) => inventoryItemRef(c.item)).filter((r): r is BlockReference => r !== null);
  const names = await resolveInventoryRefNames(supabase, rulesetId, refs);

  const lines: string[] = [];
  for (const change of itemChanges) {
    const name = inventoryItemName(change.item, names);
    if (change.status === "added") lines.push(`+${change.item.qty} ${name}`);
    else if (change.status === "removed") lines.push(`−${change.item.qty} ${name}`);
    else {
      const delta = change.qtyAfter! - change.qtyBefore!;
      lines.push(`${name} : ${change.qtyBefore} → ${change.qtyAfter} (${delta > 0 ? "+" : ""}${delta})`);
    }
  }
  for (const change of currencyChanges) {
    const delta = change.after - change.before;
    lines.push(`${CURRENCY_LABELS_FR[change.denom]} : ${change.before} → ${change.after} (${delta > 0 ? "+" : ""}${delta})`);
  }
  return lines.join(", ");
}

/** Certains `session_events` (ex. `world_update`, quand une case a cocher touche un bloc de quete lie a une fiche) portent un `entity_id` de premier niveau dans leur payload — jamais interprete plus finement (`combat` imbrique le sien dans before/after, sans rapport avec une fiche du wiki). */
function extractEventEntityId(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "entity_id" in payload) {
    const value = (payload as Record<string, unknown>).entity_id;
    return typeof value === "string" ? value : null;
  }
  return null;
}

/** La plupart des `session_events` portent un `note` deja redige en francais (ex. "Dégâts subis : 8", "CA +1") — c'est deja le detail "avant -> apres" pour les evenements de jeu, jamais reconstruit ici a partir de before/after (dont la forme varie par `kind`). */
function extractEventNote(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "note" in payload) {
    const value = (payload as Record<string, unknown>).note;
    return typeof value === "string" && value.trim() !== "" ? value : null;
  }
  return null;
}

/**
 * Quel(s) bloc(s) (ou quel champ de la fiche) ont change entre la revision
 * precedente et chacune des revisions listees (retour utilisateur : "le type
 * de bloc qui a ete modifie"). Une requete par entite distincte du lot
 * (`listRevisionSnapshotsInRange`, une seule plage couvrant tout le lot),
 * jamais une par revision. Cle du resultat : `${entity_id}:${revision_number}`.
 *
 * S'arrete au bloc/champ modifie — jamais la valeur avant/apres a
 * l'interieur d'un bloc (stats, quantites...) : `diffEntitySnapshots` ne
 * compare que des blocs entiers (SCHEMA.md §15, un instantane est un
 * snapshot complet, pas un diff par champ). Une vraie comparaison "10 PV ->
 * 8 PV" a l'interieur d'un bloc demanderait un differ propre a chaque type
 * de bloc — hors de portee de ce journal, a discuter comme un ticket a part.
 */
async function computeBlockLabels(
  supabase: TypedClient,
  worldId: string,
  revisions: EntityRevisionJournalRow[]
): Promise<{ labels: Map<string, string>; details: Map<string, string> }> {
  const byEntity = new Map<string, number[]>();
  for (const r of revisions) {
    const list = byEntity.get(r.entity_id) ?? [];
    list.push(r.revision_number);
    byEntity.set(r.entity_id, list);
  }

  const labels = new Map<string, string>();
  const details = new Map<string, string>();
  if (byEntity.size === 0) return { labels, details };

  // Un seul ruleset par monde ("un monde = une campagne", V2-G1) — recupere
  // une fois pour tout le lot, jamais par revision.
  const rulesetId = await getWorldDefaultRulesetId(supabase, worldId);

  await Promise.all(
    [...byEntity.entries()].map(async ([entityId, numbers]) => {
      const min = Math.min(...numbers);
      const max = Math.max(...numbers);
      const rows = await listRevisionSnapshotsInRange(supabase, entityId, min - 1, max);
      const snapshotByNumber = new Map(rows.map((row) => [row.revision_number, normalizeStoredSnapshot(row.snapshot as Json)]));

      for (const n of numbers) {
        const prev = snapshotByNumber.get(n - 1);
        const curr = snapshotByNumber.get(n);
        if (!prev || !curr) continue;
        const diff = diffEntitySnapshots(prev, curr);
        const blockLabels = diff.blocks.map((b) => b.label || b.blockType);
        const fieldLabels = diff.entityChanges.map((c) => ENTITY_FIELD_LABELS_FR[c.field] ?? c.field);
        const allLabels = [...blockLabels, ...fieldLabels];
        if (allLabels.length > 0) {
          labels.set(`${entityId}:${n}`, [...new Set(allLabels)].join(", "));
        }

        const inventoryDiffs = diff.blocks.filter((b) => b.blockType === "inventory" && b.status !== "removed");
        for (const blockDiff of inventoryDiffs) {
          const currBlock = curr.blocks.find((b) => b.id === blockDiff.id);
          if (!currBlock) continue;
          const afterParsed = zInventoryBlockData.safeParse(currBlock.data);
          if (!afterParsed.success) continue;
          const prevBlock = prev.blocks.find((b) => b.id === blockDiff.id);
          const beforeParsed = prevBlock ? zInventoryBlockData.safeParse(prevBlock.data) : null;
          const before = beforeParsed?.success ? beforeParsed.data : EMPTY_INVENTORY;
          const detail = await formatInventoryDetail(supabase, rulesetId, before, afterParsed.data);
          if (detail) details.set(`${entityId}:${n}`, detail);
        }
      }
    })
  );
  return { labels, details };
}

/**
 * `allowedEventEntityIds` : `null` pour la vue MJ (aucune restriction) ou un
 * ensemble d'id pour la vue joueur — meme fiches PJ que celles utilisees pour
 * filtrer les revisions (`getPlayerJournalForWorld`), jamais un evenement de
 * jeu ne doit reveler une fiche que le joueur ne pourrait pas deja voir cote
 * wiki.
 */
async function mergeJournal(
  supabase: TypedClient,
  worldId: string,
  revisions: EntityRevisionJournalRow[],
  events: SessionEventJournalRow[],
  allowedEventEntityIds: Set<string> | null
): Promise<JournalEntry[]> {
  const accountIds = [
    ...revisions.map((r) => r.changed_by).filter((id): id is string => id !== null),
    ...events.map((e) => e.actor_user_id).filter((id): id is string => id !== null),
  ];
  const [namesByAccount, blockInfo] = await Promise.all([
    getDisplayNamesForUsers(supabase, accountIds),
    computeBlockLabels(supabase, worldId, revisions),
  ]);
  const nameFor = (id: string | null) => (id ? (namesByAccount.get(id) || "Compte sans nom") : "IA / système");

  const revisionEntries: JournalEntry[] = revisions.map((r) => ({
    source: "wiki",
    label: `Révision #${r.revision_number} (${r.change_source === "ai" ? "proposée par l'IA" : "manuelle"})`,
    accountName: nameFor(r.changed_by),
    createdAt: r.created_at,
    entitySlug: r.entity_slug,
    entityName: r.entity_name,
    blockLabel: blockInfo.labels.get(`${r.entity_id}:${r.revision_number}`) ?? null,
    blockDetail: blockInfo.details.get(`${r.entity_id}:${r.revision_number}`) ?? null,
  }));

  const eventEntityIds = events
    .map((e) => extractEventEntityId(e.payload))
    .filter((id): id is string => id !== null && (allowedEventEntityIds === null || allowedEventEntityIds.has(id)));
  const eventEntities = await listEntitiesByIds(supabase, [...new Set(eventEntityIds)]);
  const eventEntityById = new Map(eventEntities.map((e) => [e.id, e]));

  const eventEntries: JournalEntry[] = events.map((e) => {
    const rawEntityId = extractEventEntityId(e.payload);
    const entity =
      rawEntityId && (allowedEventEntityIds === null || allowedEventEntityIds.has(rawEntityId))
        ? eventEntityById.get(rawEntityId)
        : undefined;
    const note = extractEventNote(e.payload);
    const baseLabel = SESSION_EVENT_LABELS_FR[e.kind] ?? e.kind;
    return {
      source: "jeu",
      label: note ? `${baseLabel} — ${note}` : baseLabel,
      accountName: nameFor(e.actor_user_id),
      createdAt: e.created_at,
      entitySlug: entity?.slug ?? null,
      entityName: entity?.name ?? null,
      blockLabel: null,
      blockDetail: null,
    };
  });

  return [...revisionEntries, ...eventEntries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/**
 * Journal fusionne (V2-M6/M7) : `entity_revisions` (edition redactionnelle)
 * et `session_events` (mutation de jeu) sont deux canaux distincts depuis V1
 * (specs/module-joueur-et-solo.md §A3, jamais confondus) — fusionnes ici
 * uniquement pour l'AFFICHAGE, tries par date, chaque ligne indiquant sa
 * source. Vue complete, jamais filtree — reservee au MJ/superadmin (verifie
 * par l'appelant), voir `getPlayerJournalForWorld` pour la vue joueur.
 */
export async function getMergedJournalForWorld(supabase: TypedClient, worldId: string): Promise<JournalEntry[]> {
  const [revisions, events] = await Promise.all([
    listEntityRevisionsForWorld(supabase, worldId),
    listSessionEventsForWorld(supabase, worldId),
  ]);
  return mergeJournal(supabase, worldId, revisions, events, null);
}

/**
 * Variante cote joueur (retour utilisateur, ecran d'accueil 3 colonnes) :
 * memes evenements de jeu (une seule campagne par monde, V2-G1 — rien a
 * filtrer de plus que ce que `session_events_select` autorise deja), mais
 * les revisions ET la resolution de fiche des evenements sont restreintes
 * aux fiches PJ de la campagne (`listPcEntityIdsForWorld`) — jamais les
 * PNJ/lieux du MJ, qui pourraient reveler un secret pas encore decouvert.
 * Correspond a l'intention d'origine du suivi en direct
 * (specs/module-joueur-et-solo.md §A3 : "le MJ voit les modifications des
 * fiches PJ"), ici cote joueur.
 */
export async function getPlayerJournalForWorld(supabase: TypedClient, worldId: string): Promise<JournalEntry[]> {
  const pcEntityIds = await listPcEntityIdsForWorld(supabase, worldId);
  const [revisions, events] = await Promise.all([
    listEntityRevisionsForEntities(supabase, pcEntityIds),
    listSessionEventsForWorld(supabase, worldId),
  ]);
  return mergeJournal(supabase, worldId, revisions, events, new Set(pcEntityIds));
}

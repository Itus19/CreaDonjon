"use client";

import { useEffect, useMemo, useState } from "react";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData, InventoryItem } from "@/src/core/schemas/blocks/inventory";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import type { ResourcesBlockData } from "@/src/core/schemas/blocks/resources";
import type { InfoboxBlockData } from "@/src/core/schemas/blocks/infobox";
import type { DerivedSheet } from "@/src/core/rules/sheet";
import type { RuntimeState } from "@/src/core/schemas/runtimeState";
import type { AdvantageState } from "@/src/core/rules/action";
import type { BlockItem } from "@/components/blocks/EntityBlocks";
import { XP_LEVEL_THRESHOLDS } from "@/src/core/rules/experience";
import { useCharacterSheetContext } from "@/components/blocks/useCharacterSheetContext";
import { useReferenceChips, refIdentity } from "@/components/blocks/useReferenceChips";
import { useDiceRoll } from "@/components/shell/DiceRollPanel";
import BinderTabs from "@/components/shared/BinderTabs";
import ActionsTab, { type PreparedSpellView } from "@/components/blocks/ActionsTab";
import MagicTab, { type KnownSpellView } from "@/components/blocks/MagicTab";
import TraitsTab from "@/components/blocks/TraitsTab";
import MasteriesTab from "@/components/blocks/MasteriesTab";
import { ABILITY_LABELS } from "@/components/blocks/PlayableCharacterSheet";
import FicheJouableEnTete, { CaracteristiquesEtCompetences } from "./FicheJouableEnTete";
import FicheJouableSac from "./FicheJouableSac";

/**
 * V3-D5 — La colonne droite de l'écran solo : la fiche jouable, au format
 * étroit.
 *
 * **Ce fichier se charge lui-même**, au lieu de recevoir ses blocs déjà
 * résolus du rendu serveur de la page (comme `EntityBlocks.tsx`) : même
 * motif que `ParticipantCharacterSheet.tsx` (dérouleur "Caractéristiques"
 * de l'écran Initiative), le seul autre endroit qui ouvre une fiche jouable
 * avec un `campaignId` RÉEL — les jets et changements de PV faits ici
 * doivent compter pour de vrai dans la campagne, pas rester des essais non
 * enregistrés comme depuis la fiche du wiki (`campaignId: null`).
 *
 * **Duplication assumée, et où elle s'arrête.** Le chargement des blocs et
 * `postAction` (attaque, dégâts, incantation, ressources) sont recopiés de
 * `ParticipantCharacterSheet.tsx`/`PlayableCharacterSheet.tsx` plutôt
 * qu'extraits en hook partagé : cette colonne est encore le DEUXIÈME
 * endroit à en avoir besoin, et « la règle des trois » (CLAUDE.md) dit de
 * généraliser au troisième cas concret, pas au deuxième — et le risque de
 * toucher `PlayableCharacterSheet.tsx`, la fiche réellement jouée
 * aujourd'hui, pour un refactor non demandé, l'emporte sur le confort d'un
 * hook. Ce que le ticket demande explicitement — « mêmes composants,
 * aucun code dupliqué » — porte sur la PRÉSENTATION (`ActionsTab`,
 * `MagicTab`, `TraitsTab`, `MasteriesTab`, et `ActionButton` qu'ils
 * importent) : ceux-là sont réutilisés tels quels, sans une ligne recopiée.
 *
 * **Ce qui n'est délibérément PAS repris de la fiche large** : l'édition du
 * personnage (score de base, choix de compétence, classes), le repos, et
 * les deltas manuels de PV/XP/épuisement/inspiration. Rien de tout ça
 * n'est demandé par ce ticket, et cette colonne sert une partie EN COURS —
 * la fiche complète (`/joueur/wiki/:slug`) reste l'endroit où construire
 * le personnage.
 */

interface SheetApiResponse {
  sheet: DerivedSheet;
  hitDiceTotals: Record<string, number>;
  runtimeState: { state: RuntimeState; hpMax: number; hitDiceTotals: Record<string, number> };
}

/**
 * Repli pour les fiches ecrites avant V3-Z1, dont l'age ne vit que dans une
 * entree d'infobox nommee « Âge ». Le champ type `character.age` passe
 * toujours devant : ce repli ne sert qu'a ne pas faire disparaitre un age
 * deja saisi, il n'est pas une seconde source a entretenir.
 */
function ageFromInfobox(infobox: InfoboxBlockData | undefined): string | null {
  const entry = infobox?.entries.find((e) => ["âge", "age"].includes(e.label.trim().toLowerCase()));
  return entry?.value ?? null;
}

export default function FicheJouableSolo({
  worldSlug,
  entityId,
  campaignId,
  entityName,
}: {
  worldSlug: string;
  entityId: string;
  campaignId: string;
  /** Le nom vient de l'entité, jamais du bloc `character` — qui ne porte pas ce champ. */
  entityName: string;
}) {
  const [blocks, setBlocks] = useState<BlockItem[] | "loading" | "error">("loading");
  const [remote, setRemote] = useState<SheetApiResponse | null>(null);
  const [tab, setTab] = useState<"actions" | "inventaire" | "magie" | "traits" | "maitrise">("actions");
  const [advantage, setAdvantage] = useState<AdvantageState>("normal");
  const [pendingCrit, setPendingCrit] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const { rollAbility, rollSkill, rollSave } = useDiceRoll();

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/entities/${entityId}/blocks`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: BlockItem[] | null) => {
        if (!cancelled) setBlocks(data ?? "error");
      })
      .catch(() => {
        if (!cancelled) setBlocks("error");
      });
    return () => {
      cancelled = true;
    };
  }, [entityId]);

  async function reloadRemote() {
    const res = await fetch(`/api/entities/${entityId}/sheet?campaignId=${campaignId}`);
    if (res.ok) setRemote(await res.json());
  }

  /**
   * V3-B5 Phase 2 — constaté en vérification en direct (24 septembre) : un
   * seul chargement au montage laissait cette colonne ignorer toute demande
   * posée APRÈS coup par `IntentBar` — la colonne voisine, pas cette même
   * fiche. Comme les deux colonnes sont deux arbres React indépendants sans
   * canal live entre eux, ce n'est pas un cas bord : c'est le déroulé normal
   * (les deux colonnes sont ouvertes en même temps, par construction de
   * l'écran). Un sondage léger referme l'écart sans construire un canal
   * Realtime dédié — le coût est celui d'un GET déjà bon marché, répété.
   */
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const res = await fetch(`/api/entities/${entityId}/sheet?campaignId=${campaignId}`);
      if (!cancelled && res.ok) setRemote(await res.json());
    }
    poll();
    const interval = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [entityId, campaignId]);

  function patchBlock(id: string, data: unknown) {
    setBlocks((prev) => (Array.isArray(prev) ? prev.map((b) => (b.id === id ? { ...b, data } : b)) : prev));
  }

  async function saveBlock(id: string, data: unknown) {
    if (!Array.isArray(blocks)) return;
    const block = blocks.find((b) => b.id === id);
    if (!block) return;
    const res = await fetch(`/api/blocks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: block.version,
        display: block.display,
        data,
        visibility: { level: block.visibilityLevel, scopeId: block.visibilityScopeId ?? null },
      }),
    });
    if (!res.ok) return;
    const updated = (await res.json()) as BlockItem;
    setBlocks((prev) => (Array.isArray(prev) ? prev.map((b) => (b.id === updated.id ? updated : b)) : prev));
  }

  async function createBlockWithData(blockType: string, label: string, data: unknown): Promise<BlockItem | null> {
    const res = await fetch(`/api/entities/${entityId}/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityId, blockType, label, visibility: { level: "public", scopeId: null } }),
    });
    if (!res.ok) return null;
    const block = (await res.json()) as BlockItem;
    const patchRes = await fetch(`/api/blocks/${block.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: block.version, display: block.display, data, visibility: { level: block.visibilityLevel, scopeId: block.visibilityScopeId ?? null } }),
    });
    return patchRes.ok ? ((await patchRes.json()) as BlockItem) : block;
  }

  const characterBlock = Array.isArray(blocks) ? blocks.find((b) => b.blockType === "character") : undefined;
  const inventoryBlock = Array.isArray(blocks) ? blocks.find((b) => b.blockType === "inventory") : undefined;
  const spellcastingBlock = Array.isArray(blocks) ? blocks.find((b) => b.blockType === "spellcasting") : undefined;
  const resourcesBlock = Array.isArray(blocks) ? blocks.find((b) => b.blockType === "resources") : undefined;
  const infoboxBlock = Array.isArray(blocks) ? blocks.find((b) => b.blockType === "infobox") : undefined;

  const character = characterBlock?.data as CharacterBlockData | undefined;
  const inventory = inventoryBlock?.data as InventoryBlockData | undefined;
  const spellcasting = spellcastingBlock?.data as SpellcastingBlockData | undefined;
  const resources = resourcesBlock?.data as ResourcesBlockData | undefined;
  const infobox = infoboxBlock?.data as InfoboxBlockData | undefined;

  const {
    sheet,
    traits,
    traitChips,
    traitSourceLabel,
    itemChips,
    equippedWeapons,
    buildChips,
    weaponMasteryChips,
    masteredWeaponKeys,
    proficiencies,
    weaponByKey,
    isMonk,
    remainingChoices,
    languageChoices,
    allLanguages,
    spellLevels,
  } = useCharacterSheetContext(worldSlug, character, inventory, spellcasting);

  const knownSpellRefs = useMemo(() => (spellcasting?.known ?? []).map((k) => k.ref), [spellcasting]);
  const spellChips = useReferenceChips(worldSlug, knownSpellRefs);

  const sortedKnownSpells: KnownSpellView[] = useMemo(() => {
    return (spellcasting?.known ?? [])
      .map((known) => {
        const chip = spellChips.get(refIdentity(known.ref));
        const label = chip?.found ? chip.name : known.ref.kind === "rule" ? known.ref.key : known.ref.id;
        const level = known.ref.kind === "rule" ? (spellLevels[known.ref.key] ?? 0) : 0;
        return { known, label, level };
      })
      .sort((a, b) => a.level - b.level || a.label.localeCompare(b.label));
  }, [spellcasting, spellChips, spellLevels]);

  const preparedSpells: PreparedSpellView[] = sortedKnownSpells
    .filter((s) => s.known.ref.kind === "rule" && (spellcasting?.prepared ?? []).includes(s.known.ref.key))
    .map((s) => ({ ref: s.known.ref, label: s.label, level: s.level }));

  function togglePrepared(key: string) {
    if (!spellcasting) return;
    const prepared = spellcasting.prepared.includes(key) ? spellcasting.prepared.filter((k) => k !== key) : [...spellcasting.prepared, key];
    saveCharDependent("spellcasting", spellcastingBlock, { ...spellcasting, prepared });
  }

  /** Bootstrap-si-absent (même motif que `ParticipantCharacterSheet.tsx`) : l'onglet Sac/Magie s'affiche toujours, même sans bloc encore créé. */
  async function saveCharDependent(blockType: "inventory" | "spellcasting", block: BlockItem | undefined, data: unknown) {
    if (block) {
      patchBlock(block.id, data);
      await saveBlock(block.id, data);
      return;
    }
    const label = blockType === "inventory" ? "Inventaire" : "Incantation";
    const created = await createBlockWithData(blockType, label, data);
    if (created) setBlocks((prev) => (Array.isArray(prev) ? [...prev, created] : prev));
  }

  function updateInventory(data: InventoryBlockData) {
    saveCharDependent("inventory", inventoryBlock, data);
  }

  async function postAction<T>(path: string, body: unknown): Promise<T | null> {
    setBusy(true);
    try {
      const res = await fetch(`/api/entities/${entityId}/actions/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      if (res.status === 204) return {} as T;
      return (await res.json()) as T;
    } finally {
      setBusy(false);
    }
  }

  /**
   * V3-B5 Phase 2 — « un bouton de sa fiche répond à la demande en cours. »
   * `pending` vient de l'état de jeu (`entity_runtime_state.pending_request`,
   * déjà dans `remote` via `/api/entities/:id/sheet` — rien de plus à
   * charger) : quand il correspond au bouton cliqué, ce clic n'est plus un
   * jet immédiat mais un ENCAISSEMENT, avec un naturel tiré côté serveur.
   * Sans correspondance, le chemin d'avant ce ticket continue tel quel.
   */
  async function resolveFromFiche() {
    setBusy(true);
    try {
      const res = await fetch("/api/solo/tour/encaisser-fiche", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, campaignId, worldSlug }),
      });
      if (res.ok) await reloadRemote();
    } finally {
      setBusy(false);
    }
  }

  async function attack(item: InventoryItem) {
    if (pending?.kind === "weapon_attack" && pending.action_id === item.id) {
      await resolveFromFiche();
      return;
    }
    const result = await postAction<{ attack?: { isCritical: boolean } }>("attack", { campaignId, itemId: item.id, advantage });
    if (!result?.attack) return;
    setPendingCrit((prev) => ({ ...prev, [item.id]: result.attack!.isCritical }));
  }

  async function damage(item: InventoryItem, versatile: boolean) {
    if (pending?.kind === "weapon_damage" && pending.action_id === item.id) {
      await resolveFromFiche();
      return;
    }
    const critical = pendingCrit[item.id] ?? false;
    await postAction("damage", { campaignId, itemId: item.id, critical, versatile });
  }

  function spellCritKey(spellKey: string): string {
    return `spell:${spellKey}`;
  }

  async function castSpellAttack(spellKey: string) {
    const result = await postAction<{ attack?: { isCritical: boolean } }>("roll-spell-attack", { campaignId, spellKey, advantage });
    if (!result?.attack) return;
    setPendingCrit((prev) => ({ ...prev, [spellCritKey(spellKey)]: result.attack!.isCritical }));
  }

  async function cast(spellKey: string, slotLevel: number) {
    const critical = pendingCrit[spellCritKey(spellKey)] ?? false;
    const result = await postAction("cast-spell", { campaignId, spellKey, slotLevel, critical });
    if (!result) return;
    reloadRemote();
  }

  async function changeResource(trackerId: string, delta: number) {
    await postAction("resource", { campaignId, trackerId, delta });
    reloadRemote();
  }

  if (blocks === "loading") return <p className="text-sm text-ink-muted">Chargement…</p>;
  if (blocks === "error" || !character) {
    return <p className="text-sm text-ink-muted">Aucune fiche de personnage — ouvre l&apos;onglet Personnage pour la créer.</p>;
  }

  const runtimeState = remote?.runtimeState.state;
  // V3-B5 Phase 2 — deja dans `remote` (RuntimeState porte `pending_request`
  // depuis la Phase 1) : rien de plus a charger pour que cette colonne sache
  // qu'une demande attend.
  const pending = runtimeState?.pending_request ?? null;
  const hpMax = remote?.runtimeState.hpMax ?? sheet.hitPoints.max;
  const hpCurrent = runtimeState?.hp.current ?? hpMax;
  const exhaustion = runtimeState?.exhaustion ?? 0;
  const inspiration = runtimeState?.inspiration ?? 0;
  const conditions = runtimeState?.conditions ?? [];

  const totalLevel = Math.max(1, character.classes.reduce((sum, c) => sum + c.level, 0));
  const levelIndex = Math.min(totalLevel, XP_LEVEL_THRESHOLDS.length) - 1;
  const xpFloor = XP_LEVEL_THRESHOLDS[levelIndex] ?? 0;
  const xpCeiling = XP_LEVEL_THRESHOLDS[levelIndex + 1] ?? xpFloor;
  const xpCurrent = runtimeState?.xp ?? 0;

  const speciesName = character.species ? (buildChips.get(refIdentity(character.species))?.name ?? null) : null;
  const backgroundName = character.background ? (buildChips.get(refIdentity(character.background))?.name ?? null) : null;
  const classSummary = character.classes
    .map((c) => `${buildChips.get(refIdentity(c.class))?.name ?? "?"} ${c.level}`)
    .join(" / ");
  const age = character.age !== undefined ? String(character.age) : ageFromInfobox(infobox);
  const identityLine = [speciesName, classSummary || null, backgroundName, age ? `${age} ans` : null].filter(Boolean).join(" · ");

  const weaponMasteryChoices = remainingChoices.filter((c) => c.kind === "weapon_mastery");

  function patchCharacter(fields: Partial<CharacterBlockData>) {
    if (!characterBlock) return;
    const data = { ...character, ...fields };
    patchBlock(characterBlock.id, data);
    saveBlock(characterBlock.id, data);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <FicheJouableEnTete
        name={entityName}
        identityLine={identityLine}
        conditions={conditions}
        ac={sheet.ac.value}
        hpCurrent={hpCurrent}
        hpMax={hpMax}
        level={totalLevel}
        xpCurrent={xpCurrent - xpFloor}
        xpCeiling={xpCeiling - xpFloor}
        exhaustion={exhaustion}
        speed={`${sheet.speed.value} m`}
        proficiencyBonus={`${sheet.proficiencyBonus >= 0 ? "+" : ""}${sheet.proficiencyBonus}`}
        inspiration={inspiration}
      />

      {pending && (
        <div className="flex items-center gap-2 rounded-full border border-accent px-2.5 py-1 text-xs text-accent">
          <span className="font-medium">Jet demandé</span>
          <span className="truncate text-ink">{pending.what}</span>
        </div>
      )}

      <CaracteristiquesEtCompetences
        sheet={sheet}
        onRollAbility={(ability) =>
          pending?.kind === "ability_check" && pending.action_id === ability ? resolveFromFiche() : rollAbility(entityId, ability, advantage)
        }
        onRollSave={(ability) =>
          pending?.kind === "saving_throw" && pending.action_id === ability ? resolveFromFiche() : rollSave(entityId, ability, advantage)
        }
        onRollSkill={(skill) =>
          pending?.kind === "skill_check" && pending.action_id === skill ? resolveFromFiche() : rollSkill(entityId, skill, advantage)
        }
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <BinderTabs
          aria-label="Sections de la fiche"
          value={tab}
          onChange={setTab}
          items={(["actions", "inventaire", "magie", "traits", "maitrise"] as const)
            .filter((t) => t !== "magie" || spellcasting)
            .map((t) => ({
              value: t,
              label: { actions: "Actions", inventaire: "Sac", magie: "Magie", traits: "Traits", maitrise: "Maîtrises" }[t],
            }))}
        />
        <div className="min-h-0 flex-1 overflow-y-auto rounded-b-lg border border-t-0 border-edge-strong p-3">
          {tab === "actions" && (
            <ActionsTab
              worldSlug={worldSlug}
              busy={busy}
              advantage={advantage}
              setAdvantage={setAdvantage}
              equippedWeapons={equippedWeapons}
              itemChips={itemChips}
              weaponByKey={weaponByKey}
              masteredWeaponKeys={masteredWeaponKeys}
              strMod={sheet.abilities.str.mod}
              dexMod={sheet.abilities.dex.mod}
              proficiencyBonus={sheet.proficiencyBonus}
              isMonk={isMonk}
              onAttack={attack}
              onDamage={damage}
              spellcasting={spellcasting}
              preparedSpells={preparedSpells}
              spellSlots={sheet.spellcasting?.slots ?? {}}
              spellSlotsUsed={runtimeState?.spell_slots_used ?? {}}
              spellAttackBonus={sheet.spellcasting?.attackBonus ?? 0}
              spellSaveDc={sheet.spellcasting?.saveDc ?? 0}
              spellAbilityLabel={sheet.spellcasting ? ABILITY_LABELS[sheet.spellcasting.ability] : ""}
              onCast={cast}
              onCastAttack={castSpellAttack}
              resources={resources}
              resourcesUsed={runtimeState?.resources ?? {}}
              onChangeResource={changeResource}
            />
          )}

          {tab === "inventaire" && (
            <FicheJouableSac inventory={inventory} onUpdateInventory={updateInventory} itemChips={itemChips} encumbrance={sheet.encumbrance} />
          )}

          {tab === "magie" && spellcasting && (
            <MagicTab worldSlug={worldSlug} sortedKnownSpells={sortedKnownSpells} spellChips={spellChips} spellcasting={spellcasting} onTogglePrepared={togglePrepared} />
          )}

          {tab === "traits" && <TraitsTab traits={traits} traitChips={traitChips} traitSourceLabel={traitSourceLabel} />}

          {tab === "maitrise" && (
            <MasteriesTab
              proficiencies={proficiencies}
              masteryChoices={weaponMasteryChoices}
              masteryChips={weaponMasteryChips}
              languageChoices={languageChoices}
              allLanguages={allLanguages}
              character={character}
              patchCharacter={patchCharacter}
            />
          )}
        </div>
      </div>
    </div>
  );
}

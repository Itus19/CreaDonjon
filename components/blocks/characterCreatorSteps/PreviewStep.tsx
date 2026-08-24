"use client";

import { useMemo, useState } from "react";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import type { DerivedSheet, ResolvedFeature } from "@/src/core/rules/sheet";
import type { AdvantageState } from "@/src/core/rules/action";
import type { ArmorData, ItemCost, WeaponData } from "@/src/core/rules/srdMapping";
import { XP_LEVEL_THRESHOLDS } from "@/src/core/rules/experience";
import type { RemainingChoiceView, TraitGrantView } from "../useResolvedRuleset";
import { useReferenceChips, refIdentity, type ResolvedChipView } from "../useReferenceChips";
import CharacterSheetHeader from "../CharacterSheetHeader";
import ActionsTab, { type PreparedSpellView } from "../ActionsTab";
import MagicTab, { type KnownSpellView } from "../MagicTab";
import InventoryTab from "../InventoryTab";
import TraitsTab from "../TraitsTab";

type PreviewTab = "actions" | "magie" | "inventaire" | "traits";

function noop() {}

/**
 * Etape 7 (specs/wiki-liens-et-personnages.md §B8) : apercu complet, pas
 * seulement quelques badges — sur demande explicite de l'utilisateur, en
 * reutilisant les VRAIS composants de la fiche jouable (en-tete + onglets
 * Actions/Inventaire/Traits) plutot qu'une mini-fiche construite a part :
 * meme moteur, aucune divergence future possible.
 *
 * Le personnage n'existe pas encore (pas d'`entityId`, pas d'`entity_runtime_state`)
 * donc tout ce qui exige une entite reelle est neutralise : `busy=true` en
 * permanence desactive repos/PV/PX/epuisement/attaque/degats dans l'en-tete
 * et l'onglet Actions (ils resteraient sans effet — un `postAction` vers un
 * entityId qui n'existe pas echouerait silencieusement) ; PV et PX affichent
 * un personnage flambant neuf (PV max, 0 PX). L'inventaire, lui, reste
 * pleinement editable : c'est la meme donnee que l'etape Equipement.
 */
export default function PreviewStep({
  worldSlug,
  character,
  patchCharacter,
  inventory,
  onUpdateInventory,
  spellcasting,
  onUpdateSpellcasting,
  spellLevels,
  sheet,
  traits,
  traitChips,
  traitSourceLabel,
  proficiencies,
  languageChoices,
  allLanguages,
  remainingChoices,
  weaponByKey,
  equipment,
  weight,
  cost,
  itemChips,
  equippedWeapons,
  isMonk,
  buildChips,
}: {
  worldSlug: string;
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
  inventory: InventoryBlockData;
  onUpdateInventory: (data: InventoryBlockData) => void;
  spellcasting: SpellcastingBlockData;
  onUpdateSpellcasting: (data: SpellcastingBlockData) => void;
  spellLevels: Record<string, number | null>;
  sheet: DerivedSheet;
  traits: ResolvedFeature[];
  traitChips: Map<string, ResolvedChipView>;
  traitSourceLabel: (f: ResolvedFeature) => string;
  proficiencies: TraitGrantView[];
  languageChoices: Map<string, RemainingChoiceView>;
  allLanguages: TraitGrantView[];
  remainingChoices: RemainingChoiceView[];
  weaponByKey: Record<string, WeaponData | null>;
  equipment: Record<string, ArmorData | null>;
  weight: Record<string, number | null>;
  cost: Record<string, ItemCost | null>;
  itemChips: Map<string, ResolvedChipView>;
  equippedWeapons: InventoryBlockData["items"];
  isMonk: boolean;
  buildChips: Map<string, ResolvedChipView>;
}) {
  const [tab, setTab] = useState<PreviewTab>("actions");
  const [advantage, setAdvantage] = useState<AdvantageState>("normal");

  function updateClass(index: number, patch: Partial<CharacterBlockData["classes"][number]>) {
    patchCharacter({ classes: character.classes.map((c, i) => (i === index ? { ...c, ...patch } : c)) });
  }

  function removeClass(index: number) {
    patchCharacter({ classes: character.classes.filter((_, i) => i !== index) });
  }

  function addClass() {
    patchCharacter({ classes: [...character.classes, { class: { kind: "rule", key: "" }, level: 1, subclass: null }] });
  }

  const totalLevel = Math.max(1, character.classes.reduce((sum, c) => sum + c.level, 0));
  const xpCeiling = XP_LEVEL_THRESHOLDS[totalLevel] ?? XP_LEVEL_THRESHOLDS[XP_LEVEL_THRESHOLDS.length - 1];

  const knownSpellRefs = useMemo(() => spellcasting.known.map((k) => k.ref), [spellcasting]);
  const spellChips = useReferenceChips(worldSlug, knownSpellRefs);

  // Le choix de maitrise d'armes se fait a l'etape 6 (Competences,
  // `RemainingChoicesStep`) — repeter un editeur ici ferait doublon (meme
  // motif que l'equipement d'historique, cf. commentaire dans
  // `BackgroundStep.tsx`). Seul ce qui est deja choisi sert ici, pour la
  // botte disponible sur une arme equipee.
  const masteredWeaponKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const choice of remainingChoices) {
      if (choice.kind !== "weapon_mastery") continue;
      const chosen = (character.choices[choice.id] as string[] | undefined) ?? [];
      for (const key of chosen) keys.add(key);
    }
    return keys;
  }, [remainingChoices, character.choices]);

  const sortedKnownSpells: KnownSpellView[] = useMemo(() => {
    return spellcasting.known
      .map((known) => {
        const chip = spellChips.get(refIdentity(known.ref));
        const label = chip?.found ? chip.name : known.ref.kind === "rule" ? known.ref.key : known.ref.id;
        const level = known.ref.kind === "rule" ? (spellLevels[known.ref.key] ?? 0) : 0;
        return { known, label, level };
      })
      .sort((a, b) => a.level - b.level || a.label.localeCompare(b.label));
  }, [spellcasting, spellChips, spellLevels]);

  const preparedSpells: PreparedSpellView[] = sortedKnownSpells
    .filter((s) => s.known.ref.kind === "rule" && spellcasting.prepared.includes(s.known.ref.key))
    .map((s) => ({ ref: s.known.ref, label: s.label }));

  function togglePrepared(key: string) {
    const prepared = spellcasting.prepared.includes(key) ? spellcasting.prepared.filter((k) => k !== key) : [...spellcasting.prepared, key];
    onUpdateSpellcasting({ ...spellcasting, prepared });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-edge/60 bg-panel-raised p-3">
      <CharacterSheetHeader
        worldSlug={worldSlug}
        character={character}
        patchCharacter={patchCharacter}
        updateClass={updateClass}
        removeClass={removeClass}
        addClass={addClass}
        buildChips={buildChips}
        refIdentity={refIdentity}
        sheet={sheet}
        busy={true}
        exhaustion={0}
        onChangeExhaustion={noop}
        hpCurrent={sheet.hitPoints.max}
        hpMax={sheet.hitPoints.max}
        hpLow={false}
        hpPct={100}
        hpDelta=""
        setHpDelta={noop}
        applyHpDelta={noop}
        xpCurrent={0}
        xpCeiling={xpCeiling}
        xpPct={0}
        totalLevel={totalLevel}
        xpLevelThresholdsLength={XP_LEVEL_THRESHOLDS.length}
        xpDelta=""
        setXpDelta={noop}
        applyXpDelta={noop}
        onRest={noop}
        onExportJson={noop}
        error={null}
      />

      <div className="flex gap-1 border-b border-edge/60 text-xs">
        {(["actions", "magie", "inventaire", "traits"] as PreviewTab[])
          .filter((t) => t !== "magie" || spellcasting.known.length > 0)
          .map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-t-md px-3 py-1.5 capitalize transition-colors ${
              tab === t ? "border-b-2 border-accent text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "actions" && (
        <ActionsTab
          worldSlug={worldSlug}
          busy={true}
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
          onAttack={noop}
          onDamage={noop}
          spellcasting={spellcasting.known.length > 0 ? spellcasting : undefined}
          preparedSpells={preparedSpells}
          spellSlots={sheet.spellcasting?.slots ?? {}}
          spellSlotsUsed={{}}
          onCast={noop}
          resources={undefined}
          resourcesUsed={{}}
          onChangeResource={noop}
          rollLog={[]}
        />
      )}

      {tab === "magie" && spellcasting.known.length > 0 && (
        <MagicTab sortedKnownSpells={sortedKnownSpells} spellcasting={spellcasting} onTogglePrepared={togglePrepared} />
      )}

      {tab === "inventaire" && (
        <InventoryTab
          worldSlug={worldSlug}
          inventory={inventory}
          onUpdateInventory={onUpdateInventory}
          strMod={sheet.abilities.str.mod}
          dexMod={sheet.abilities.dex.mod}
          proficiencyBonus={sheet.proficiencyBonus}
          isMonk={isMonk}
          weaponByKey={weaponByKey}
          equipment={equipment}
          weight={weight}
          cost={cost}
          encumbrance={sheet.encumbrance}
        />
      )}

      {tab === "traits" && (
        <TraitsTab
          traits={traits}
          traitChips={traitChips}
          traitSourceLabel={traitSourceLabel}
          proficiencies={proficiencies}
          languageChoices={languageChoices}
          character={character}
          patchCharacter={patchCharacter}
          allLanguages={allLanguages}
        />
      )}
    </div>
  );
}

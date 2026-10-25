"use client";

import { useState } from "react";
import type { InventoryItem } from "@/src/core/schemas/blocks/inventory";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import type { ResourcesBlockData } from "@/src/core/schemas/blocks/resources";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import type { AdvantageState } from "@/src/core/rules/action";
import { evaluate } from "@/src/core/formula/evaluate";
import { formatFormulaNode } from "@/src/core/formula/format";
import { resolveScaledFormulaText } from "@/src/core/rules/scaling";
import type { DescriptionBlockData, EffectsBlockData, ScalingBlockData } from "@/src/core/schemas/rule-blocks";
import { itemLabel, itemRef } from "./inventoryItem";
import { armeFiche, type ArmeFiche, type SortFiche } from "@/lib/ui/ficheDes";
import { classerSort } from "@/lib/ui/initiative";
import { ActionButton, ItemCard, withModifier } from "./InventoryPanel";
import NomDeRegle from "./NomDeRegle";
import { refIdentity, type ResolvedChipView } from "./useReferenceChips";
import { useRuleEntryBlocks, type RuleEntryBlockData } from "./useRuleEntryBlocks";
import Dropdown from "@/components/shared/Dropdown";
import Egaliseur from "./Egaliseur";
import { colonnesEgaliseur, type GesteColonne } from "@/lib/ui/egaliseur";
import type { WeaponData } from "@/src/core/rules/srdMapping";

function findBlock<T>(blocks: RuleEntryBlockData[] | undefined, blockType: string): T | null {
  const found = blocks?.find((b) => b.blockType === blockType);
  return found ? (found.data as T) : null;
}

/** Meme troncature que `SpellSelectionStep.tsx` (assistant de creation) — un seul apercu court, jamais deux styles de resume pour le meme sort selon l'ecran. */
function descriptionPreview(blocks: RuleEntryBlockData[] | undefined): string {
  const data = findBlock<DescriptionBlockData>(blocks, "description");
  const text = data?.segments.map((s) => s.text).join(" ") ?? "";
  return text.length > 130 ? `${text.slice(0, 130)}…` : text;
}

function resourceMax(tracker: { max: { formula: import("@/src/core/formula/ast").FormulaNode } }): number {
  const neverRolls = { nextInt: () => { throw new Error("le mode max n'appelle jamais le RNG"); } };
  try {
    return evaluate(tracker.max.formula, {}, neverRolls, "max").value;
  } catch (erreur) {
    console.error("Formule de maximum de ressource illisible", erreur);
    return 0;
  }
}

export interface PreparedSpellView {
  ref: BlockReference;
  label: string;
  /** 0 = sort mineur (retour utilisateur, V2-G1 suite) — jamais d'emplacement, distinct des niveaux 1-9. */
  level: number;
}

/**
 * Un sort prepare, en carte (retour utilisateur, V2-G1 suite : "même
 * esthétique que pour l'action des objets équipés") — meme squelette que
 * `ItemCard` en mode non repliable (titre+tags a gauche, boutons `ActionButton`
 * a droite), sans reutiliser le composant lui-meme : un sort n'a ni poids ni
 * arme a resoudre, seulement un niveau, une eventuelle attaque/sauvegarde et
 * des emplacements.
 *
 * Deux boutons comme une arme equipee (retour utilisateur, suite) :
 * "Attaquer" (1d20+bonus d'incantation, uniquement si le sort porte un jet
 * d'attaque — `effects.attack`, jamais fabrique pour un sort a sauvegarde)
 * puis un bouton de degats/lancer qui S'ADAPTE :
 *  - sort mineur : niveau fixe (0), pas de selecteur, juste le bouton ;
 *  - sort avec niveau : un `Dropdown` choisit l'emplacement a depenser (au
 *    moins le niveau du sort, surclassement possible vers un niveau
 *    superieur — jamais un niveau inferieur, meme filtre que la V1 de ce
 *    bouton) ; la formule affichee est recalculee pour le niveau choisi via
 *    `resolveScaledFormulaText` (src/core/rules/scaling.ts), LA MEME fonction
 *    pure que le serveur (`castSpell`) — jamais un second calcul qui
 *    pourrait diverger du jet reellement effectue au clic.
 * Un sort a sauvegarde affiche son DD en etiquette (informatif : c'est la
 * CIBLE qui sauvegarde, jamais le lanceur qui la lance a sa place).
 * Sans formule de degats (sort utilitaire, ex. Detection de la magie) le
 * bouton de lancer reste seul, sans ligne de degats — rien a adapter.
 */
function PreparedSpellCard({
  worldSlug,
  spell,
  blocks,
  spellSlots,
  spellSlotsUsed,
  spellAttackBonus,
  spellSaveDc,
  spellAbilityLabel,
  busy,
  onCast,
  onCastAttack,
}: {
  worldSlug: string;
  spell: PreparedSpellView;
  blocks: RuleEntryBlockData[] | undefined;
  spellSlots: Record<string, number>;
  spellSlotsUsed: Record<string, number>;
  spellAttackBonus: number;
  spellSaveDc: number;
  spellAbilityLabel: string;
  busy: boolean;
  onCast: (spellKey: string, slotLevel: number, sort: SortFiche) => void;
  onCastAttack: (spellKey: string, sort: SortFiche) => void;
}) {
  const { ref, label, level } = spell;
  const isCantrip = level === 0;
  const validSlotLevels = isCantrip
    ? []
    : Object.keys(spellSlots)
        .map(Number)
        .filter((slotLevel) => slotLevel >= level)
        .sort((a, b) => a - b);
  const [selectedLevel, setSelectedLevel] = useState(isCantrip ? 0 : (validSlotLevels[0] ?? level));
  const castLevel = isCantrip ? 0 : selectedLevel;

  const effectsData = findBlock<EffectsBlockData>(blocks, "effects");
  const scalingData = findBlock<ScalingBlockData>(blocks, "scaling");
  const effect = effectsData?.effects[0];
  const hasAttack = Boolean(effect?.attack);
  const hasSave = Boolean(effect?.save);
  const resolvedDamage = effect?.formula
    ? scalingData
      ? resolveScaledFormulaText(scalingData, castLevel, effectsData ?? undefined, effect.formula)
      : formatFormulaNode(effect.formula)
    : null;

  const attackResolved = withModifier("1d20", spellAttackBonus);
  const attackDetail = `1d20+${spellAbilityLabel}+maîtrise`;
  const preview = descriptionPreview(blocks);

  const available = !isCantrip ? Math.max(0, (spellSlots[String(castLevel)] ?? 0) - (spellSlotsUsed[String(castLevel)] ?? 0)) : Infinity;

  /** V3.1-106 : ce que l'outil de dés doit savoir du sort pour s'ouvrir pré-rempli. */
  const sortFiche = (spellKey: string): SortFiche => ({
    spellKey,
    nom: label,
    niveauLance: castLevel,
    formuleDegats: resolvedDamage,
    genre: classerSort(blocks).genre,
    modificateurAttaque: spellAttackBonus,
  });

  return (
    <div className="flex flex-col gap-2 rounded-md border border-edge/60 bg-panel-raised px-2.5 py-2.5">
      {/* Nom et badges sur toute la largeur, boutons dessous — et non plus le
          nom a gauche, une colonne de boutons a droite : sur telephone, cette
          colonne de droite ecrasait le nom du sort. Meme disposition que la
          carte d'arme (`ItemCard`), qui empile deja de cette facon. */}
      <div className="flex min-w-0 flex-col gap-1.5">
        {ref.kind === "rule" ? (
          <NomDeRegle worldSlug={worldSlug} ruleKey={ref.key} className="truncate text-sm font-semibold">
            {label}
          </NomDeRegle>
        ) : (
          <span className="truncate text-sm font-semibold text-ink">{label}</span>
        )}
        <div className="flex flex-wrap gap-1">
          <span className="w-fit rounded-full border border-edge px-1.5 py-0 text-[10px] text-ink-muted">
            {isCantrip ? "Sort mineur" : `Niv. ${level}`}
          </span>
          {hasSave && effect?.save && (
            <span className="w-fit rounded-full border border-edge px-1.5 py-0 text-[10px] text-ink-muted">
              DD {spellSaveDc} ({(effect.save.ability ?? "").toUpperCase()})
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-2">
        {hasAttack && (
          <ActionButton
            label="Attaquer"
            resolvedFormula={attackResolved}
            detailFormula={attackDetail}
            busy={busy}
            primary
            onClick={() => ref.kind === "rule" && onCastAttack(ref.key, sortFiche(ref.key))}
          />
        )}
        {!isCantrip && validSlotLevels.length === 0 && <span className="text-xs text-ink-muted">Aucun emplacement de ce niveau.</span>}
        {(isCantrip || validSlotLevels.length > 0) && (
          <div className="flex flex-col gap-1">
            {!isCantrip && (
              <Dropdown
                value={String(selectedLevel)}
                options={validSlotLevels.map((l) => ({ value: String(l), label: `Niv. ${l}` }))}
                onChange={(v) => setSelectedLevel(Number(v))}
                aria-label={`Emplacement pour ${label}`}
                triggerClassName="w-fit rounded-md border border-edge px-2 py-0.5 text-xs text-ink outline-none transition-colors hover:bg-panel"
              />
            )}
            <ActionButton
              label={resolvedDamage ? "Dégâts" : "Lancer"}
              resolvedFormula={resolvedDamage ?? (isCantrip ? "Sort mineur" : `${available}/${spellSlots[String(castLevel)] ?? 0}`)}
              detailFormula={resolvedDamage ? "au niveau choisi" : isCantrip ? "sans emplacement" : "emplacements"}
              busy={busy || (!isCantrip && available === 0)}
              onClick={() => ref.kind === "rule" && onCast(ref.key, castLevel, sortFiche(ref.key))}
            />
          </div>
        )}
      </div>
      {preview && <p className="text-xs leading-relaxed text-ink-muted">{preview}</p>}
    </div>
  );
}

/**
 * Onglet Actions de la fiche jouable (V1-B5, extrait de
 * `PlayableCharacterSheet.tsx` par V2-G5 — pur découpage, aucun changement de
 * comportement) : attaques d'arme équipée, sorts préparés à lancer,
 * ressources, journal des jets.
 */
export default function ActionsTab({
  worldSlug,
  busy,
  advantage,
  setAdvantage,
  equippedWeapons,
  itemChips,
  weaponByKey,
  masteredWeaponKeys,
  strMod,
  dexMod,
  proficiencyBonus,
  isMonk,
  onAttack,
  onDamage,
  spellcasting,
  preparedSpells,
  spellSlots,
  spellSlotsUsed,
  spellAttackBonus,
  spellSaveDc,
  spellAbilityLabel,
  onCast,
  onCastAttack,
  resources,
  resourcesUsed,
  onChangeResource,
  pact,
  pactUsed,
  classKeys,
  onGesteEmplacement,
  emplacementsDesactives,
}: {
  worldSlug: string;
  busy: boolean;
  advantage: AdvantageState;
  setAdvantage: (a: AdvantageState) => void;
  equippedWeapons: InventoryItem[];
  itemChips: Map<string, ResolvedChipView>;
  weaponByKey: Record<string, WeaponData | null>;
  /** Armes actuellement maitrisees (V2-G1, retour utilisateur) — choix vit dans l'onglet dedie "Maîtrise d'armes", ici seulement pour savoir quelle botte afficher comme disponible. */
  masteredWeaponKeys: Set<string>;
  strMod: number;
  dexMod: number;
  proficiencyBonus: number;
  isMonk: boolean;
  /** `arme` : la description pour l'outil de dés (V3.1-106) ; l'écran du solo, qui a son propre circuit, l'ignore. */
  onAttack: (item: InventoryItem, arme: ArmeFiche) => void;
  onDamage: (item: InventoryItem, versatile: boolean, arme: ArmeFiche) => void;
  spellcasting: SpellcastingBlockData | undefined;
  preparedSpells: PreparedSpellView[];
  spellSlots: Record<string, number>;
  spellSlotsUsed: Record<string, number>;
  spellAttackBonus: number;
  spellSaveDc: number;
  spellAbilityLabel: string;
  onCast: (spellKey: string, slotLevel: number, sort: SortFiche) => void;
  onCastAttack: (spellKey: string, sort: SortFiche) => void;
  resources: ResourcesBlockData | undefined;
  resourcesUsed: Record<string, number>;
  onChangeResource: (trackerId: string, delta: number) => void;
  /** V3.1-114 : la réserve de pacte (`sheet.spellcasting.pactSlots`), montrée à part dans l'égaliseur. */
  pact: { count: number; slotLevel: number } | null;
  pactUsed: number;
  /** Classes et sous-classes du personnage (clés de règle) : une ressource d'une de ces sources va au groupe « Classe ». */
  classKeys: readonly string[];
  /** Dépenser (+1) ou rendre (-1) un emplacement ou une utilisation de pacte. */
  onGesteEmplacement: (geste: { pool: "slots"; level: number } | { pool: "pact" }, delta: number) => void;
  /** Sans la commande `spell_slots` (V3.1-109), ou sans écriture possible : les colonnes d'emplacement ne se touchent pas. */
  emplacementsDesactives: boolean;
}) {
  const cantripSpells = preparedSpells.filter((s) => s.level === 0);
  const leveledSpells = preparedSpells.filter((s) => s.level > 0);
  const preparedSpellKeys = preparedSpells.map((s) => (s.ref.kind === "rule" ? s.ref.key : null)).filter((k): k is string => k !== null);
  const spellBlocksByKey = useRuleEntryBlocks(worldSlug, preparedSpellKeys);
  const groupes = colonnesEgaliseur({
    slots: Object.fromEntries(Object.entries(spellSlots).map(([niveau, total]) => [Number(niveau), total])),
    slotsUsed: spellSlotsUsed,
    pact,
    pactUsed,
    trackers: (resources?.trackers ?? []).map((tracker) => ({
      id: tracker.id,
      label: tracker.label,
      max: resourceMax(tracker),
      recharge: tracker.recharge,
      sourceKey: tracker.source?.kind === "rule" ? tracker.source.key : null,
    })),
    resourcesUsed,
    classKeys,
  });

  function geste(g: GesteColonne, delta: number) {
    if ("tracker" in g) onChangeResource(g.tracker, delta);
    else onGesteEmplacement(g, delta);
  }

  return (
    <div className="flex flex-col gap-3 pt-3">
      <div className="flex items-center gap-1 text-xs">
        <span className="text-ink-muted">Prochain jet :</span>
        {(["disadvantage", "normal", "advantage"] as AdvantageState[]).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAdvantage(a)}
            className={`rounded-full border px-2 py-0.5 ${advantage === a ? "border-accent text-accent" : "border-edge text-ink-muted"}`}
          >
            {a === "normal" ? "normal" : a === "advantage" ? "avantage" : "désavantage"}
          </button>
        ))}
      </div>

      <Egaliseur groupes={groupes} onGeste={geste} desactive={busy} emplacementsDesactives={emplacementsDesactives} />

      {equippedWeapons.length === 0 && <p className="text-sm text-ink-muted">Aucune arme équipée.</p>}
      {equippedWeapons.map((item) => {
        const ref = itemRef(item);
        const weapon = ref?.kind === "rule" ? weaponByKey[ref.key] : null;
        // Botte disponible (V2-G1, retour utilisateur) : purement informatif —
        // annonce que la botte de cette arme est debloquee tant qu'elle reste
        // maitrisee, mais son EFFET (jet, poussee, chute...) reste a resoudre
        // a la main, comme le reste des regles non encore simulees. L'arbitrage
        // reste ici : seul cet onglet connait les choix de maitrise du
        // personnage ; `ItemCard` ne sait qu'afficher la pastille et son
        // explication, au meme titre que les proprietes de l'arme.
        const masteryKey =
          ref?.kind === "rule" && weapon?.masteryKey && masteredWeaponKeys.has(ref.key) ? weapon.masteryKey : null;
        // V3.1-106 : l'outil de dés s'ouvre pré-rempli avec cette arme (nom, touche, formule de dégâts).
        const chip = ref ? itemChips.get(refIdentity(ref)) : undefined;
        const arme = weapon ? armeFiche({ itemId: item.id, nom: chip?.found ? chip.name : itemLabel(item), weapon, strMod, dexMod, proficiencyBonus }) : null;
        return (
          <div key={item.id} className="flex flex-col gap-1">
            <ItemCard
              worldSlug={worldSlug}
              item={item}
              chip={chip}
              weapon={weapon}
              armor={null}
              weightLb={null}
              cost={null}
              strMod={strMod}
              dexMod={dexMod}
              proficiencyBonus={proficiencyBonus}
              isMonk={isMonk}
              masteryKey={masteryKey}
              showAttackInfo={true}
              collapsible={false}
              busy={busy}
              onAttack={() => arme && onAttack(item, arme)}
              onDamage={(versatile) => arme && onDamage(item, versatile, arme)}
            />
          </div>
        );
      })}

      {spellcasting && (
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Sorts préparés</span>
          {preparedSpells.length === 0 && (
            <p className="text-sm text-ink-muted">Aucun sort préparé — sélectionnez-les dans l&apos;onglet Magie.</p>
          )}
          {cantripSpells.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Sorts mineurs — sans emplacement</span>
              {cantripSpells.map((spell) => (
                <PreparedSpellCard
                  key={refIdentity(spell.ref)}
                  worldSlug={worldSlug}
                  spell={spell}
                  blocks={spell.ref.kind === "rule" ? spellBlocksByKey[spell.ref.key] : undefined}
                  spellSlots={spellSlots}
                  spellSlotsUsed={spellSlotsUsed}
                  spellAttackBonus={spellAttackBonus}
                  spellSaveDc={spellSaveDc}
                  spellAbilityLabel={spellAbilityLabel}
                  busy={busy}
                  onCast={onCast}
                  onCastAttack={onCastAttack}
                />
              ))}
            </div>
          )}
          {leveledSpells.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Sorts avec emplacement</span>
              {leveledSpells.map((spell) => (
                <PreparedSpellCard
                  key={refIdentity(spell.ref)}
                  worldSlug={worldSlug}
                  spell={spell}
                  blocks={spell.ref.kind === "rule" ? spellBlocksByKey[spell.ref.key] : undefined}
                  spellSlots={spellSlots}
                  spellSlotsUsed={spellSlotsUsed}
                  spellAttackBonus={spellAttackBonus}
                  spellSaveDc={spellSaveDc}
                  spellAbilityLabel={spellAbilityLabel}
                  busy={busy}
                  onCast={onCast}
                  onCastAttack={onCastAttack}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

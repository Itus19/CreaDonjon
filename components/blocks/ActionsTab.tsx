"use client";

import { useState } from "react";
import type { InventoryItem } from "@/src/core/schemas/blocks/inventory";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import type { ResourcesBlockData } from "@/src/core/schemas/blocks/resources";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import type { AdvantageState } from "@/src/core/rules/action";
import type { TraceStep } from "@/src/core/formula/evaluate";
import { evaluate } from "@/src/core/formula/evaluate";
import { formatFormulaNode } from "@/src/core/formula/format";
import { resolveScaledFormulaText } from "@/src/core/rules/scaling";
import type { DescriptionBlockData, EffectsBlockData, ScalingBlockData } from "@/src/core/schemas/rule-blocks";
import { itemRef } from "./inventoryItem";
import { ActionButton, ItemCard, withModifier } from "./InventoryPanel";
import { refIdentity, type ResolvedChipView } from "./useReferenceChips";
import { useRuleEntryBlocks, type RuleEntryBlockData } from "./useRuleEntryBlocks";
import Dropdown from "@/components/shared/Dropdown";
import type { WeaponData } from "@/src/core/rules/srdMapping";
import { WEAPON_MASTERY_LABELS_FR } from "@/src/i18n/fr";
import type { RollLogEntry } from "./PlayableCharacterSheet";

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

const RECHARGE_LABELS: Record<string, string> = {
  short_rest: "repos court",
  long_rest: "repos long",
  dawn: "à l'aube",
  never: "jamais",
};

function resourceMax(tracker: { max: { formula: import("@/src/core/formula/ast").FormulaNode } }): number {
  const neverRolls = { nextInt: () => { throw new Error("le mode max n'appelle jamais le RNG"); } };
  try {
    return evaluate(tracker.max.formula, {}, neverRolls, "max").value;
  } catch {
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
 * Emplacements de sort restants, entre les sorts mineurs et les sorts avec
 * niveau (retour utilisateur) — pastilles pleines = disponible, creuses =
 * deja depense, meme langage visuel que les ronds de maitrise de competence
 * (`PlayableCharacterSheet.tsx`). Un niveau sans emplacement du tout (classe
 * qui n'y a pas encore acces) n'apparait pas — jamais une ligne a "0/0".
 */
function SpellSlotsTracker({
  spellSlots,
  spellSlotsUsed,
}: {
  spellSlots: Record<string, number>;
  spellSlotsUsed: Record<string, number>;
}) {
  const levels = Object.entries(spellSlots)
    .map(([level, total]) => ({ level: Number(level), total, used: spellSlotsUsed[level] ?? 0 }))
    .filter((s) => s.total > 0)
    .sort((a, b) => a.level - b.level);
  if (levels.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border border-edge/60 bg-panel-sunken px-2.5 py-2">
      {levels.map(({ level, total, used }) => {
        const available = Math.max(0, total - used);
        return (
          <div key={level} className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Niv. {level}</span>
            <div className="flex gap-0.5">
              {Array.from({ length: total }, (_, i) => (
                <span key={i} className={`h-2 w-2 rounded-full ${i < available ? "bg-accent" : "border border-edge bg-transparent"}`} />
              ))}
            </div>
            <span className="mech text-[10px] text-ink-muted">
              {available}/{total}
            </span>
          </div>
        );
      })}
    </div>
  );
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
  spell: PreparedSpellView;
  blocks: RuleEntryBlockData[] | undefined;
  spellSlots: Record<string, number>;
  spellSlotsUsed: Record<string, number>;
  spellAttackBonus: number;
  spellSaveDc: number;
  spellAbilityLabel: string;
  busy: boolean;
  onCast: (spellKey: string, label: string, slotLevel: number) => void;
  onCastAttack: (spellKey: string, label: string) => void;
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

  return (
    <div className="flex flex-col gap-2 rounded-md border border-edge/60 bg-panel-raised px-2.5 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="truncate text-sm font-semibold text-ink">{label}</span>
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
        <div className="flex flex-wrap items-start justify-end gap-2">
          {hasAttack && (
            <ActionButton
              label="Attaquer"
              resolvedFormula={attackResolved}
              detailFormula={attackDetail}
              busy={busy}
              onClick={() => ref.kind === "rule" && onCastAttack(ref.key, label)}
            />
          )}
          {!isCantrip && validSlotLevels.length === 0 && <span className="text-xs text-ink-muted">Aucun emplacement de ce niveau.</span>}
          {(isCantrip || validSlotLevels.length > 0) && (
            <div className="flex flex-col items-end gap-1">
              {!isCantrip && (
                <Dropdown
                  value={String(selectedLevel)}
                  options={validSlotLevels.map((l) => ({ value: String(l), label: `Niv. ${l}` }))}
                  onChange={(v) => setSelectedLevel(Number(v))}
                  aria-label={`Emplacement pour ${label}`}
                  className="rounded-md border border-edge px-2 py-0.5 text-xs text-ink outline-none transition-colors hover:bg-panel"
                />
              )}
              <ActionButton
                label={resolvedDamage ? "Dégâts" : "Lancer"}
                resolvedFormula={resolvedDamage ?? (isCantrip ? "Sort mineur" : `${available}/${spellSlots[String(castLevel)] ?? 0}`)}
                detailFormula={resolvedDamage ? "au niveau choisi" : isCantrip ? "sans emplacement" : "emplacements"}
                busy={busy || (!isCantrip && available === 0)}
                onClick={() => ref.kind === "rule" && onCast(ref.key, label, castLevel)}
              />
            </div>
          )}
        </div>
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
  rollLog,
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
  onAttack: (item: InventoryItem) => void;
  onDamage: (item: InventoryItem, versatile: boolean) => void;
  spellcasting: SpellcastingBlockData | undefined;
  preparedSpells: PreparedSpellView[];
  spellSlots: Record<string, number>;
  spellSlotsUsed: Record<string, number>;
  spellAttackBonus: number;
  spellSaveDc: number;
  spellAbilityLabel: string;
  onCast: (spellKey: string, label: string, slotLevel: number) => void;
  onCastAttack: (spellKey: string, label: string) => void;
  resources: ResourcesBlockData | undefined;
  resourcesUsed: Record<string, number>;
  onChangeResource: (trackerId: string, delta: number) => void;
  rollLog: RollLogEntry[];
}) {
  const cantripSpells = preparedSpells.filter((s) => s.level === 0);
  const leveledSpells = preparedSpells.filter((s) => s.level > 0);
  const preparedSpellKeys = preparedSpells.map((s) => (s.ref.kind === "rule" ? s.ref.key : null)).filter((k): k is string => k !== null);
  const spellBlocksByKey = useRuleEntryBlocks(worldSlug, preparedSpellKeys);

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

      {equippedWeapons.length === 0 && <p className="text-sm text-ink-muted">Aucune arme équipée.</p>}
      {equippedWeapons.map((item) => {
        const ref = itemRef(item);
        const weapon = ref?.kind === "rule" ? weaponByKey[ref.key] : null;
        // Botte disponible (V2-G1, retour utilisateur) : purement informatif —
        // annonce que la botte de cette arme est debloquee tant qu'elle reste
        // maitrisee, mais son EFFET (jet, poussee, chute...) reste a resoudre
        // a la main, comme le reste des regles non encore simulees.
        const masteryLabel =
          ref?.kind === "rule" && weapon?.masteryKey && masteredWeaponKeys.has(ref.key)
            ? (WEAPON_MASTERY_LABELS_FR[weapon.masteryKey] ?? weapon.masteryKey)
            : null;
        return (
          <div key={item.id} className="flex flex-col gap-1">
            {masteryLabel && (
              <span className="w-fit rounded-full border border-accent px-2 py-0.5 text-[10px] text-accent">
                Botte disponible : {masteryLabel}
              </span>
            )}
            <ItemCard
              worldSlug={worldSlug}
              item={item}
              chip={ref ? itemChips.get(refIdentity(ref)) : undefined}
              weapon={weapon}
              armor={null}
              weightLb={null}
              cost={null}
              strMod={strMod}
              dexMod={dexMod}
              proficiencyBonus={proficiencyBonus}
              isMonk={isMonk}
              showAttackInfo={true}
              collapsible={false}
              busy={busy}
              onAttack={() => onAttack(item)}
              onDamage={(versatile) => onDamage(item, versatile)}
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
          {leveledSpells.length > 0 && <SpellSlotsTracker spellSlots={spellSlots} spellSlotsUsed={spellSlotsUsed} />}
          {leveledSpells.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Sorts avec emplacement</span>
              {leveledSpells.map((spell) => (
                <PreparedSpellCard
                  key={refIdentity(spell.ref)}
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

      {(resources?.trackers.length ?? 0) > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Ressources</span>
          {resources!.trackers.map((tracker) => {
            const max = resourceMax(tracker);
            const used = resourcesUsed[tracker.id] ?? 0;
            return (
              <div key={tracker.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 text-ink">{tracker.label}</span>
                <span className="text-ink-muted">
                  {Math.max(0, max - used)}/{max} · {RECHARGE_LABELS[tracker.recharge] ?? tracker.recharge}
                </span>
                <button type="button" disabled={busy || used >= max} onClick={() => onChangeResource(tracker.id, 1)} className="rounded border border-edge px-1.5 text-xs disabled:opacity-50">
                  utiliser
                </button>
                <button type="button" disabled={busy || used <= 0} onClick={() => onChangeResource(tracker.id, -1)} className="rounded border border-edge px-1.5 text-xs disabled:opacity-50">
                  annuler
                </button>
              </div>
            );
          })}
        </div>
      )}

      {rollLog.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-md border border-edge/60 bg-panel-sunken p-2">
          {rollLog.map((entry) => (
            <div key={entry.id} className="text-xs">
              <p className="text-ink">
                <span className="font-semibold">{entry.label} : {entry.total}</span>
                {entry.isCritical && <span className="ml-1 text-accent">critique !</span>}
                {entry.isCriticalFail && <span className="ml-1 text-danger">échec critique</span>}
              </p>
              {entry.trace.length > 0 && <p className="text-ink-muted">{entry.trace.map((s: TraceStep) => s.text).join(" ; ")}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import type { InventoryItem } from "@/src/core/schemas/blocks/inventory";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import type { ResourcesBlockData } from "@/src/core/schemas/blocks/resources";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import type { AdvantageState } from "@/src/core/rules/action";
import type { TraceStep } from "@/src/core/formula/evaluate";
import { evaluate } from "@/src/core/formula/evaluate";
import { itemRef } from "./inventoryItem";
import { ActionButton, ItemCard } from "./InventoryPanel";
import { refIdentity, type ResolvedChipView } from "./useReferenceChips";
import type { WeaponData } from "@/src/core/rules/srdMapping";
import { WEAPON_MASTERY_LABELS_FR } from "@/src/i18n/fr";
import type { RollLogEntry } from "./PlayableCharacterSheet";

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
 * Un sort prepare, en carte (retour utilisateur, V2-G1 suite : "même
 * esthétique que pour l'action des objets équipés") — meme squelette que
 * `ItemCard` en mode non repliable (titre+tags a gauche, boutons `ActionButton`
 * a droite), sans reutiliser le composant lui-meme : un sort n'a ni poids ni
 * arme a resoudre, seulement un niveau et des emplacements.
 *
 * Sort mineur (`spell.level === 0`) : un seul bouton "Lancer", jamais de
 * choix d'emplacement — la regle 2024 ne lui en fait jamais consommer un
 * (`slotLevel: 0` cote serveur, cf. `castSpell`). Sort avec niveau : un
 * bouton par emplacement DISPONIBLE A CE NIVEAU OU AU-DESSUS seulement
 * (surclassement) — jamais un emplacement d'un niveau inferieur au sort,
 * bug reel corrige ici (l'ancienne liste affichait tous les niveaux
 * d'emplacement du personnage sans filtrer par le niveau du sort lui-meme).
 */
function PreparedSpellCard({
  spell,
  spellSlots,
  spellSlotsUsed,
  busy,
  onCast,
}: {
  spell: PreparedSpellView;
  spellSlots: Record<string, number>;
  spellSlotsUsed: Record<string, number>;
  busy: boolean;
  onCast: (spellKey: string, label: string, slotLevel: number) => void;
}) {
  const { ref, label, level } = spell;
  const isCantrip = level === 0;
  const validSlotLevels = isCantrip
    ? []
    : Object.entries(spellSlots)
        .map(([slotLevel, total]) => ({ slotLevel: Number(slotLevel), total }))
        .filter((s) => s.slotLevel >= level)
        .sort((a, b) => a.slotLevel - b.slotLevel);

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-edge/60 bg-panel-raised px-2.5 py-2.5">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="truncate text-sm font-semibold text-ink">{label}</span>
        <span className="w-fit rounded-full border border-edge px-1.5 py-0 text-[10px] text-ink-muted">
          {isCantrip ? "Sort mineur" : `Niv. ${level}`}
        </span>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {isCantrip && (
          <ActionButton
            label="Lancer"
            resolvedFormula="Sort mineur"
            detailFormula="sans emplacement"
            busy={busy}
            onClick={() => ref.kind === "rule" && onCast(ref.key, label, 0)}
          />
        )}
        {!isCantrip && validSlotLevels.length === 0 && <span className="text-xs text-ink-muted">Aucun emplacement de ce niveau.</span>}
        {!isCantrip &&
          validSlotLevels.map(({ slotLevel, total }) => {
            const used = spellSlotsUsed[String(slotLevel)] ?? 0;
            const available = Math.max(0, total - used);
            return (
              <ActionButton
                key={slotLevel}
                label={`Niv. ${slotLevel}`}
                resolvedFormula={`${available}/${total}`}
                detailFormula="emplacements"
                busy={busy || available === 0}
                onClick={() => ref.kind === "rule" && onCast(ref.key, label, slotLevel)}
              />
            );
          })}
      </div>
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
  onCast,
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
  onCast: (spellKey: string, label: string, slotLevel: number) => void;
  resources: ResourcesBlockData | undefined;
  resourcesUsed: Record<string, number>;
  onChangeResource: (trackerId: string, delta: number) => void;
  rollLog: RollLogEntry[];
}) {
  const cantripSpells = preparedSpells.filter((s) => s.level === 0);
  const leveledSpells = preparedSpells.filter((s) => s.level > 0);

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
                  spellSlots={spellSlots}
                  spellSlotsUsed={spellSlotsUsed}
                  busy={busy}
                  onCast={onCast}
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
                  spell={spell}
                  spellSlots={spellSlots}
                  spellSlotsUsed={spellSlotsUsed}
                  busy={busy}
                  onCast={onCast}
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

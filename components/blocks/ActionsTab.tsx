"use client";

import type { InventoryItem } from "@/src/core/schemas/blocks/inventory";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import type { ResourcesBlockData } from "@/src/core/schemas/blocks/resources";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import type { AdvantageState } from "@/src/core/rules/action";
import type { TraceStep } from "@/src/core/formula/evaluate";
import { evaluate } from "@/src/core/formula/evaluate";
import { itemRef } from "./inventoryItem";
import { ItemCard } from "./InventoryPanel";
import { refIdentity, type ResolvedChipView } from "./useReferenceChips";
import type { WeaponData } from "@/src/core/rules/srdMapping";
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
        return (
          <ItemCard
            key={item.id}
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
        );
      })}

      {spellcasting && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Sorts préparés</span>
          {preparedSpells.length === 0 && (
            <p className="text-sm text-ink-muted">Aucun sort préparé — sélectionnez-les dans l&apos;onglet Magie.</p>
          )}
          {preparedSpells.map(({ ref, label }) => (
            <div key={refIdentity(ref)} className="flex flex-wrap items-center gap-2 rounded-md border border-edge/60 px-2.5 py-1.5 text-sm">
              <span className="flex-1 text-ink">{label}</span>
              {Object.entries(spellSlots).map(([level, total]) => {
                const used = spellSlotsUsed[level] ?? 0;
                const available = total - used > 0;
                return (
                  <button
                    key={level}
                    type="button"
                    disabled={busy || !available}
                    title={available ? `Lancer au niveau ${level}` : "Aucun emplacement disponible"}
                    onClick={() => ref.kind === "rule" && onCast(ref.key, label, Number(level))}
                    className="rounded-full border border-edge px-2 py-0.5 text-xs disabled:opacity-30"
                  >
                    niv. {level} ({Math.max(0, total - used)}/{total})
                  </button>
                );
              })}
            </div>
          ))}
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

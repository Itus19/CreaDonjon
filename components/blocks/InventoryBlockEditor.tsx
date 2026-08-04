"use client";

import { useMemo } from "react";
import type { InventoryBlockData, InventoryItem } from "@/src/core/schemas/blocks/inventory";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import { characterSheet, type CharacterBuild, type EquippedItem, type Modifier, type ResolvedRuleset } from "@/src/core/rules/sheet";
import { useReferenceChips, refIdentity } from "./useReferenceChips";
import ReferenceChipDisplay from "./ReferenceChipDisplay";

function newItem(): InventoryItem {
  return { id: crypto.randomUUID(), label: "", qty: 1 };
}

// Verifie la valeur, pas seulement la presence de la cle : apres un
// changement de nature (setNature), l'ancienne cle peut rester presente
// avec une valeur `undefined` le temps d'un rendu, avant d'etre elaguee
// par Zod a l'enregistrement.
function itemRef(item: InventoryItem): BlockReference | null {
  return (item as { ref?: BlockReference }).ref ?? null;
}

function itemLabel(item: InventoryItem): string {
  const label = (item as { label?: string }).label;
  if (label) return label;
  const ref = itemRef(item);
  if (ref) return ref.kind === "rule" ? ref.key : ref.id;
  return "";
}

/**
 * Personnage fixe pour la demonstration de recalcul (voir plus bas) : ce
 * ticket (V1-B2) prouve le mecanisme — recalcul client, sans aller-retour
 * reseau — pas l'assemblage complet d'un `ResolvedRuleset` depuis les
 * regles SRD reellement importees. Cet assemblage general (mapper chaque
 * armure/arme du SRD vers ses modificateurs) est hors perimetre : il
 * suppose un bloc de regle `armor`/`weapon` qui n'existe pas encore
 * (specs/regles-blocs.md — "vient quand un cas concret le reclame").
 */
const DEMO_BUILD: CharacterBuild = {
  species: "human",
  classes: [{ key: "fighter", level: 1 }],
  abilities: { assigned: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 } },
  featureKeys: [],
};
const DEMO_RULESET: ResolvedRuleset = {
  classes: { fighter: { key: "fighter", label: "Guerrier", hitDie: 10, savingThrowProficiencies: ["str", "con"] } },
  features: {},
};

/** Reconnaissance grossiere par mot-cle, uniquement pour la demonstration — voir le commentaire sur DEMO_BUILD. */
function demoAcModifiers(item: InventoryItem): Modifier[] {
  const needle = itemLabel(item).toLowerCase();
  const source = `item:${item.id}`;
  const label = itemLabel(item);
  if (/chain.?mail|cotte de mailles/.test(needle)) {
    return [{ target: "ac", op: "set", value: 16, layer: 6, source, label }];
  }
  if (/leather|cuir(?! clout)/.test(needle)) {
    return [{ target: "ac", op: "set", value: 11, layer: 6, source, label }];
  }
  if (/shield|bouclier/.test(needle)) {
    return [{ target: "ac", op: "add", value: 2, layer: 6, source, label }];
  }
  return [];
}

export default function InventoryBlockEditor({
  data,
  onChange,
  worldSlug,
}: {
  data: InventoryBlockData;
  onChange: (data: InventoryBlockData) => void;
  worldSlug: string;
}) {
  const refsToResolve = useMemo(() => data.items.map(itemRef).filter((r): r is BlockReference => r !== null), [data.items]);
  const chips = useReferenceChips(worldSlug, refsToResolve);

  const acPreview = useMemo(() => {
    const equipment: EquippedItem[] = data.items.map((item) => ({
      key: item.id,
      label: itemLabel(item),
      equipped: item.equipped ?? false,
      modifiers: demoAcModifiers(item),
    }));
    return characterSheet(DEMO_BUILD, DEMO_RULESET, equipment, []).ac;
  }, [data.items]);

  function updateItem(index: number, patch: Partial<InventoryItem>) {
    onChange({ ...data, items: data.items.map((it, i) => (i === index ? ({ ...it, ...patch } as InventoryItem) : it)) });
  }

  function removeItem(index: number) {
    onChange({ ...data, items: data.items.filter((_, i) => i !== index) });
  }

  function addItem() {
    onChange({ ...data, items: [...data.items, newItem()] });
  }

  function setNature(index: number, nature: "inline" | "ref") {
    const item = data.items[index];
    const { id, qty, equipped, attuned, slot, weight, notes } = item;
    const common = { id, qty, equipped, attuned, slot, weight, notes };
    const next: InventoryItem =
      nature === "inline" ? { ...common, label: itemLabel(item) || "Objet" } : { ...common, ref: { kind: "rule", key: "" } };
    onChange({ ...data, items: data.items.map((it, i) => (i === index ? next : it)) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {data.items.map((item, index) => {
          const itemReference = itemRef(item);
          return (
            <div key={item.id} className="flex flex-wrap items-center gap-2 border-b border-edge/40 py-1.5">
              <select
                value={itemReference ? "ref" : "inline"}
                onChange={(e) => setNature(index, e.target.value as "inline" | "ref")}
                className="rounded-md border border-edge bg-transparent px-1 py-1 text-xs text-ink outline-none"
              >
                <option value="inline">Objet en ligne</option>
                <option value="ref">Reference de regle</option>
              </select>
              {itemReference ? (
                <>
                  <input
                    value={itemReference.kind === "rule" ? itemReference.key : ""}
                    onChange={(e) => updateItem(index, { ref: { kind: "rule", key: e.target.value } } as Partial<InventoryItem>)}
                    placeholder="scimitar"
                    className="w-32 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
                  />
                  <ReferenceChipDisplay reference={itemReference} chip={chips.get(refIdentity(itemReference))} />
                </>
              ) : (
                <input
                  value={itemLabel(item)}
                  onChange={(e) => updateItem(index, { label: e.target.value } as Partial<InventoryItem>)}
                  placeholder="Fiole de sable noir"
                  className="flex-1 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
                />
              )}
              <input
                type="number"
                min={0}
                value={item.qty}
                onChange={(e) => updateItem(index, { qty: Number(e.target.value) || 0 })}
                className="w-16 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
                aria-label="Quantite"
              />
              <label className="flex items-center gap-1 text-xs text-ink-muted">
                <input
                  type="checkbox"
                  checked={item.equipped ?? false}
                  onChange={(e) => updateItem(index, { equipped: e.target.checked })}
                />
                Equipe
              </label>
              <button type="button" onClick={() => removeItem(index)} className="text-xs text-danger hover:underline">
                ×
              </button>
            </div>
          );
        })}
        {data.items.length === 0 && <p className="text-sm text-ink-muted">Aucun objet pour l&apos;instant.</p>}
        <button
          type="button"
          onClick={addItem}
          className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
        >
          + Ajouter un objet
        </button>
      </div>

      <div className="rounded-md border border-edge/60 bg-panel-raised px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Apercu CA (demonstration) — CA {acPreview.value}
        </p>
        <p className="text-xs text-ink-muted">
          {acPreview.sources.map((s) => `${s.label} (${s.value})`).join(" + ") || "aucun objet equipe"}
        </p>
        <p className="mt-1 text-[10px] italic text-ink-muted">
          Recalcule instantanement, sans rechargement, en decochant « Equipe » — reconnaissance par mot-cle
          (« cotte de mailles », « cuir », « bouclier ») en attendant le bloc de regle armure/arme.
        </p>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {(["pp", "gp", "ep", "sp", "cp"] as const).map((coin) => (
          <label key={coin} className="flex flex-col gap-1 text-xs text-ink-muted">
            {coin.toUpperCase()}
            <input
              type="number"
              min={0}
              value={data.currency[coin]}
              onChange={(e) => onChange({ ...data, currency: { ...data.currency, [coin]: Number(e.target.value) || 0 } })}
              className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

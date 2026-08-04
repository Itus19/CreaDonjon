"use client";

import { useMemo } from "react";
import type { InventoryBlockData, InventoryItem } from "@/src/core/schemas/blocks/inventory";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import { useReferenceChips, refIdentity } from "./useReferenceChips";
import ReferenceChipDisplay from "./ReferenceChipDisplay";
import RuleEntryAutocomplete from "./RuleEntryAutocomplete";

const ITEM_REF_TYPES = ["weapon", "armor", "item"] as const;

function newItem(): InventoryItem {
  return { id: crypto.randomUUID(), label: "", qty: 1 };
}

// Verifie la valeur, pas seulement la presence de la cle : apres un
// changement de nature (setNature), l'ancienne cle peut rester presente
// avec une valeur `undefined` le temps d'un rendu, avant d'etre elaguee
// par Zod a l'enregistrement. Exporte : reutilise par CharacterSheetPreview
// (V1-B4) pour traduire l'inventaire en `EquippedItem[]`.
export function itemRef(item: InventoryItem): BlockReference | null {
  return (item as { ref?: BlockReference }).ref ?? null;
}

export function itemLabel(item: InventoryItem): string {
  const label = (item as { label?: string }).label;
  if (label) return label;
  const ref = itemRef(item);
  if (ref) return ref.kind === "rule" ? ref.key : ref.id;
  return "";
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
                  <div className="w-32">
                    <RuleEntryAutocomplete
                      worldSlug={worldSlug}
                      entryTypes={ITEM_REF_TYPES}
                      value={itemReference.kind === "rule" ? itemReference.key : ""}
                      onChange={(key) => updateItem(index, { ref: { kind: "rule", key } } as Partial<InventoryItem>)}
                      placeholder="scimitar"
                    />
                  </div>
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

      <p className="text-[10px] italic text-ink-muted">
        L&apos;aperçu de la fiche de jeu (CA, PV, avertissements) s&apos;affiche en haut de la fiche des qu&apos;un
        bloc « Personnage » existe sur cette entité.
      </p>

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

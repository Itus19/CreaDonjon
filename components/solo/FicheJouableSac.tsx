"use client";

import type { InventoryBlockData, InventoryItem } from "@/src/core/schemas/blocks/inventory";
import type { EncumbranceResult } from "@/src/core/rules/encumbrance";
import { itemLabel, itemRef } from "@/components/blocks/inventoryItem";
import { refIdentity, type ResolvedChipView } from "@/components/blocks/useReferenceChips";
import { CURRENCY_ORDER } from "@/src/core/rules/currency";
import { CURRENCY_LABELS_FR } from "@/src/i18n/fr";
import Checkbox from "@/components/shared/Checkbox";
import { JaugeCirculaire } from "./FicheJouableEnTete";

/**
 * V3-D5 — L'onglet Sac de la fiche jouable étroite.
 *
 * Aucun composant existant à réutiliser ici : contrairement à Actions et
 * Magie, le ticket ne demande pas `InventoryPanel` tel quel (718 lignes
 * d'édition complète — ajout d'objets, conteneurs, dépense de monnaie —
 * pensées pour la fiche complète, pas pour 280 px). Il demande une
 * ouverture précise (bourse + charge sur une ligne) que rien n'a
 * aujourd'hui ; le reste — équiper — reste la même mutation que
 * `InventoryPanel.updateInventoryItem`, recopiée à l'identique plutôt que
 * réimportée : un composant de 718 lignes pour une seule fonction de dix.
 */

function displayName(item: InventoryItem, itemChips: Map<string, ResolvedChipView>): string {
  const ref = itemRef(item);
  if (ref) {
    const chip = itemChips.get(refIdentity(ref));
    if (chip?.found) return chip.name;
  }
  return itemLabel(item) || "Objet";
}

export default function FicheJouableSac({
  inventory,
  onUpdateInventory,
  itemChips,
  encumbrance,
}: {
  inventory: InventoryBlockData | undefined;
  onUpdateInventory: (data: InventoryBlockData) => void;
  itemChips: Map<string, ResolvedChipView>;
  encumbrance: EncumbranceResult;
}) {
  const items = inventory?.items ?? [];
  const currency = inventory?.currency ?? { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };

  function toggleEquipped(itemId: string) {
    const base = inventory ?? { __v: 1 as const, items: [], containers: [], currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } };
    onUpdateInventory({
      ...base,
      items: base.items.map((it) => (it.id === itemId ? { ...it, equipped: !it.equipped } : it)),
    });
  }

  const pctCharge = encumbrance.capacity > 0 ? Math.round((encumbrance.carried / encumbrance.capacity) * 100) : 0;

  return (
    <div className="flex flex-col gap-2">
      {/* La bourse et la charge, sur une seule ligne : les deux choses
          qu'on vient y vérifier en jouant (auteur, 23 septembre). */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {CURRENCY_ORDER.map((coin) => (
            <span key={coin} className={`rounded-full border border-edge px-2 py-0.5 text-xs ${currency[coin] > 0 ? "text-ink" : "text-ink-muted"}`}>
              {currency[coin]} {CURRENCY_LABELS_FR[coin]}
            </span>
          ))}
        </div>

        {/* Le poids arrondi au kilo pour l'affichage : `23,5` mesure 25 px
            dans l'anneau, `24` en mesure 14 — la valeur exacte reste dans
            l'infobulle. */}
        <JaugeCirculaire
          petite
          valeur={
            <span className="flex flex-col items-center leading-none">
              <span>{Math.round(encumbrance.carried)}</span>
              <span className="w-3.5 border-t border-ink-muted" />
              <span className="text-ink-muted">{encumbrance.capacity}</span>
            </span>
          }
          pct={pctCharge}
          ton={encumbrance.tier === "none" ? "accent" : "danger"}
          titre={`Charge : ${encumbrance.carried.toLocaleString("fr-FR")} / ${encumbrance.capacity} kg${encumbrance.tier !== "none" ? " — encombré" : ""}`}
        />
      </div>

      {items.length === 0 && <p className="text-sm text-ink-muted">Le sac est vide.</p>}
      {items.map((item) => (
        <div key={item.id} className="flex items-start justify-between gap-2 rounded-md border border-edge p-2">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm text-ink">{displayName(item, itemChips)}</span>
            {item.qty !== 1 && <span className="text-xs text-ink-muted">× {item.qty}</span>}
          </div>
          <Checkbox aria-label={`Équiper ${displayName(item, itemChips)}`} checked={item.equipped ?? false} onChange={() => toggleEquipped(item.id)} />
        </div>
      ))}
      {items.length > 0 && <p className="text-xs text-ink-muted">La case équipe l&apos;objet — une arme équipée entre dans Actions.</p>}
    </div>
  );
}

"use client";

import type { GeneratorSlotItem } from "@/src/server/services/generators";
import { formatTableEntryPrice } from "@/src/i18n/fr";

/**
 * Un emplacement a tirage multiple (V2-J9, `count`) s'affiche en tableau :
 * `price` est un champ structure de l'entree de table, jamais reparse. Colonnes
 * a largeur fixe (`table-fixed`) : le prix reste aligne quel que soit le nom.
 */
export default function TableauItems({ items }: { items: GeneratorSlotItem[] }) {
  return (
    <table className="w-full table-fixed text-xs">
      <colgroup>
        <col />
        <col className="w-16" />
      </colgroup>
      <tbody>
        {items.map((item, i) => (
          <tr key={i} className="border-b border-edge/20 last:border-b-0">
            <td className="truncate py-0.5 pr-2 text-ink">{item.text}</td>
            <td className="whitespace-nowrap py-0.5 text-right text-ink-muted">{formatTableEntryPrice(item.price) ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

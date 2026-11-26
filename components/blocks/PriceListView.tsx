import { formatTableEntryPrice } from "@/src/i18n/fr";
import { libelleRichesse, rubriquesDeLaCarte } from "@/lib/ui/carteTarifs";
import type { PriceListBlockData } from "@/src/core/schemas/blocks/priceList";

/**
 * V3.2-9 — le bloc « Carte et tarifs » en lecture : une rubrique par
 * intertitre, le libellé à gauche, le prix aligné à droite (colonnes fixes,
 * même dessin que le Menu de l'outil Générateurs). Les prix sont ceux du
 * bloc, jamais recalculés.
 */
export default function PriceListView({ data }: { data: PriceListBlockData }) {
  const richesse = libelleRichesse(data.wealth);
  const rubriques = rubriquesDeLaCarte(data.offers);
  if (rubriques.length === 0) return <p className="text-sm text-ink-muted">Aucune offre sur cette carte.</p>;
  return (
    <div className="flex flex-col gap-3 text-sm">
      {richesse && <p className="text-xs text-ink-muted">Établissement {richesse.toLowerCase()}</p>}
      {rubriques.map((r) => (
        <div key={r.rubrique} className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{r.libelle}</span>
          <table className="w-full table-fixed">
            <colgroup>
              <col />
              <col className="w-20" />
            </colgroup>
            <tbody>
              {r.offres.map((o) => (
                <tr key={o.id} className="border-b border-edge/20 last:border-b-0">
                  <td className="truncate py-0.5 pr-2 text-ink">{o.label}</td>
                  <td className="whitespace-nowrap py-0.5 text-right font-mech text-ink-soft">{formatTableEntryPrice(o.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

"use client";

import { formatTableEntryPrice } from "@/src/i18n/fr";
import { structureMenu } from "@/lib/ui/generateurs";
import BoutonRelance from "./BoutonRelance";
import TableauItems from "./TableauItems";
import { sectionOccupee, type EtatSection } from "./useTirages";

const MENU = structureMenu();

/**
 * Menu de taverne (V2-J9, V3.1-45) dans l'apercu : deux colonnes — les plats
 * par palier de prix a gauche, les boissons a droite ; une seule colonne sur
 * telephone (requete de conteneur). Chaque plat et chaque groupe de boissons se
 * relance par son emplacement.
 */
export default function MenuTaverne({ etat, onRelancer }: { etat: EtatSection; onRelancer: (slotKey: string) => void }) {
  const occupee = sectionOccupee(etat);
  return (
    <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold text-ink">Plats</span>
        {MENU.plats.map((categorie) => (
          <div key={categorie.libelle} className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">{categorie.libelle}</span>
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col className="w-14" />
                <col />
                <col className="w-14" />
                <col className="w-8" />
              </colgroup>
              <tbody>
                {categorie.paliers.map((palier) => {
                  const resultat = etat.slotResults[palier.cle];
                  return (
                    <tr key={palier.cle} className="border-b border-edge/20 last:border-b-0">
                      <td className="py-0.5 pr-2 text-ink-muted">{palier.libelle}</td>
                      <td className="truncate py-0.5 pr-2 text-ink">{resultat?.text ?? "—"}</td>
                      <td className="whitespace-nowrap py-0.5 pr-1 text-right text-ink-muted">{formatTableEntryPrice(resultat?.price) ?? ""}</td>
                      <td className="py-0.5 text-right">
                        <BoutonRelance
                          onClick={() => onRelancer(palier.cle)}
                          desactive={occupee}
                          enCours={etat.relance === palier.cle}
                          titre={`Relancer ${categorie.libelle} (${palier.libelle})`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold text-ink">Boissons</span>
        {MENU.boissons.map((groupe) => (
          <div key={groupe.cle} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-muted">{groupe.libelle}</span>
              <BoutonRelance
                onClick={() => onRelancer(groupe.cle)}
                desactive={occupee}
                enCours={etat.relance === groupe.cle}
                titre={`Relancer les boissons ${groupe.libelle.toLowerCase()}`}
              />
            </div>
            <TableauItems items={etat.slotResults[groupe.cle]?.items ?? []} />
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import VisibilityPill from "@/components/shared/VisibilityPill";
import { VISIBILITY_PILL_FALLBACK, VISIBILITY_PILL_STYLES, isVisibilityLevelKey } from "@/components/shared/visibilityOptions";
import { marqueurElement, objetPastille, type ElementCarte, type GenreElement, type GroupeCouche } from "@/lib/ui/carte";

/**
 * V3.1-78 — la carte à gauche, sa liste à droite (270 px) ; sous la largeur
 * d'un téléphone (conteneur du bloc), la liste passe sous la carte.
 */
export function DispositionCarte({ carte, liste }: { carte: ReactNode; liste: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 @xl/bloc:grid-cols-[minmax(0,1fr)_270px]">
      <div className="min-w-0">{carte}</div>
      <div className="min-w-0">{liste}</div>
    </div>
  );
}

/** Écrit la visibilité d'un élément (punaise, zone) ou d'une couche par sa propre route ; répond `true` si ça a réussi. */
export type EcrireVisibilite = (genre: GenreElement | "layer", id: string, niveau: string) => Promise<boolean>;

/**
 * La liste de la carte, rangée par couches : en-tête de couche avec sa
 * pastille, puis ses punaises et zones. Toucher un nom centre la carte dessus
 * et l'allume. Éditeur : pastilles qui écrivent et boutons « + » ; référent
 * (`titreSource`) : lecture seule, pastilles figées ; wiki public : sans
 * niveaux. Les éléments arrivent déjà filtrés par le serveur.
 */
export default function CarteListe({
  groupes,
  allumeId,
  onChoisir,
  ecrire,
  afficherNiveaux = true,
  sansPrive = false,
  actions,
  titreSource,
}: {
  groupes: GroupeCouche[];
  allumeId: string | null;
  onChoisir: (element: ElementCarte) => void;
  /** Absent : les pastilles sont figées (référent, lecture). */
  ecrire?: EcrireVisibilite;
  /** Faux sur le wiki public : le lecteur n'a pas à voir les niveaux. */
  afficherNiveaux?: boolean;
  sansPrive?: boolean;
  /** Absent : aucun « + » (référent, public). */
  actions?: { onAjouterPunaise: () => void; onAjouterZone: () => void; onAjouterCouche: (nom: string) => Promise<boolean> };
  /** Mode référent : « Carte de <fiche source> ». */
  titreSource?: string;
}) {
  const t = useTranslations("fiche.carte");
  const tn = useTranslations("fiche");
  const [nouvelleCouche, setNouvelleCouche] = useState<string | null>(null);
  const [creation, setCreation] = useState(false);
  const libelles = { punaise: t("punaise"), zone: t("zone"), couche: t("couche"), suffixePunaise: t("suffixePunaise") };
  const total = groupes.reduce((n, g) => n + g.elements.length, 0);

  function niveau(genre: GenreElement | "layer", id: string, nom: string, valeur: string) {
    if (!afficherNiveaux) return null;
    if (ecrire) {
      return (
        <VisibilityPill
          niveau={valeur}
          objet={objetPastille(genre, nom, libelles)}
          sansPrive={sansPrive}
          onChange={(n) => ecrire(genre, id, n)}
        />
      );
    }
    const style = VISIBILITY_PILL_STYLES[valeur] ?? VISIBILITY_PILL_FALLBACK;
    return (
      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${style.pill}`}>
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
        {isVisibilityLevelKey(valeur) ? tn(`niveaux.${valeur}`) : valeur}
      </span>
    );
  }

  async function creer() {
    const nom = (nouvelleCouche ?? "").trim();
    if (!nom || !actions || creation) return;
    setCreation(true);
    const ok = await actions.onAjouterCouche(nom);
    setCreation(false);
    if (ok) setNouvelleCouche(null);
  }

  return (
    <section aria-label={t("liste")} className="flex flex-col gap-2">
      {titreSource && <p className="text-xs text-ink-muted">{t("carteDe", { nom: titreSource })}</p>}
      {actions && (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={actions.onAjouterPunaise} className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised">
            {t("ajouterPunaise")}
          </button>
          <button type="button" onClick={actions.onAjouterZone} className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised">
            {t("ajouterZone")}
          </button>
          <button type="button" onClick={() => setNouvelleCouche("")} className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised">
            {t("ajouterCouche")}
          </button>
        </div>
      )}
      {actions && nouvelleCouche !== null && (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={nouvelleCouche}
            onChange={(e) => setNouvelleCouche(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void creer();
              }
              if (e.key === "Escape") setNouvelleCouche(null);
            }}
            aria-label={t("nomCouche")}
            placeholder={t("nomCouche")}
            className="min-w-0 flex-1 rounded-md border border-edge bg-panel-sunken px-2 py-1 text-sm text-ink focus:outline focus:outline-2 focus:outline-accent"
          />
          <button type="button" aria-disabled={creation} onClick={() => void creer()} className="rounded-full border border-edge px-3 py-1 text-xs text-ink hover:bg-panel-raised">
            {t("creerCouche")}
          </button>
        </div>
      )}

      {total === 0 && groupes.every((g) => g.couche === null) ? (
        <p className="text-sm italic text-ink-muted">{t("vide")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {groupes.map((g) => (
            <li key={g.couche?.id ?? "sans-couche"} className="flex flex-col gap-1">
              {g.couche ? (
                <div className="flex items-center justify-between gap-2">
                  <h4 className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-ink-muted">{g.couche.name}</h4>
                  {niveau("layer", g.couche.id, g.couche.name, g.couche.visibilityLevel)}
                </div>
              ) : (
                groupes.length > 1 && <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("sansCouche")}</h4>
              )}
              <ul className="flex flex-col">
                {g.elements.map((el) => {
                  const m = marqueurElement(el.genre, el.visibilityLevel);
                  const allume = el.id === allumeId;
                  return (
                    <li key={el.id} className={`flex items-center justify-between gap-2 rounded-md px-1 ${allume ? "bg-accent/15" : ""}`}>
                      <button
                        type="button"
                        onClick={() => onChoisir(el)}
                        aria-pressed={allume}
                        aria-label={t("centrer", { nom: el.nom })}
                        className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-sm text-ink hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        <span aria-hidden className={`h-2 w-2 shrink-0 ${m.classe} ${m.forme === "point" ? "rounded-full" : "rounded-[2px]"}`} />
                        <span className="truncate">{el.nom || t("sansNom")}</span>
                      </button>
                      {niveau(el.genre, el.id, el.nom, el.visibilityLevel)}
                    </li>
                  );
                })}
                {g.elements.length === 0 && <li className="px-1 py-1 text-xs italic text-ink-muted">{t("coucheVide")}</li>}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

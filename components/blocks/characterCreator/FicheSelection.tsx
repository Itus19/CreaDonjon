"use client";

import { useTranslations } from "next-intl";
import type { SousEtape } from "@/lib/ui/cheminCreation";

export interface LigneFiche {
  nom: string;
  /** Une phrase : la ligne est tronquée à la largeur de l'écran. */
  texte?: string;
}

/**
 * V3.1-50 — La fiche de la sélection (espèce, historique) sous les cartes :
 * ses traits en une ligne chacun, puis « Ce qui en naît » en pastilles. Une
 * pastille ouvre la sous-étape correspondante.
 */
export default function FicheSelection({
  titre,
  resume,
  lignes,
  naissent,
  onAller,
}: {
  titre: string;
  /** Une ligne de repères (type, taille, vitesse). */
  resume?: string | null;
  lignes: readonly LigneFiche[];
  naissent: readonly SousEtape[];
  onAller: (position: string) => void;
}) {
  const t = useTranslations("creation.fiche");
  const tc = useTranslations("creation");
  return (
    <article aria-label={titre} className="flex flex-col gap-2 rounded-md border border-edge/60 bg-panel-sunken p-3">
      <header className="flex flex-col gap-0.5">
        <h3 className="font-display text-base font-bold text-ink">{titre}</h3>
        {resume && <p className="text-xs text-ink-muted">{resume}</p>}
      </header>

      {lignes.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {lignes.map((l) => (
            <li key={l.nom} className="truncate text-sm text-ink-soft">
              <span className="font-semibold text-ink">{l.nom}</span>
              {l.texte ? ` — ${l.texte}` : ""}
            </li>
          ))}
        </ul>
      )}

      {naissent.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-edge/60 pt-2">
          <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">{t("naissent")}</span>
          <div className="flex flex-wrap gap-1.5">
            {naissent.map((s) => (
              <button
                key={s.cle}
                type="button"
                onClick={() => onAller(`c:${s.cle}`)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors hover:bg-panel-raised ${
                  s.fait ? "border-success/60 text-ink" : "border-accent text-accent"
                }`}
              >
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${s.fait ? "bg-success" : "bg-accent"}`} />
                {s.genre === "groupe" ? tc("don", { nom: s.libelle }) : s.libelle}
                <span className="sr-only">{s.fait ? tc("fait") : tc("aFaireUn")}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

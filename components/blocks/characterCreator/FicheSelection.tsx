"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { SousEtape } from "@/lib/ui/cheminCreation";
import { renderBlockData } from "@/components/rules/blockContentRenderer";
import { useRuleEntryBlocks } from "../useRuleEntryBlocks";

export interface LigneFiche {
  nom: string;
  /** Une phrase : la ligne fermée est tronquée à la largeur de l'écran. */
  texte?: string;
  /** V3.1-172 : le texte entier, déjà chargé (un trait d'espèce, résolu par le serveur). */
  entier?: string;
  /** V3.1-172 : ou les fiches de règle à lire au dépliage (le don, les compétences, l'outil d'un historique). */
  fiches?: readonly { cle: string; nom?: string }[];
}

function depliable(l: LigneFiche): boolean {
  return Boolean(l.entier) || (l.fiches?.length ?? 0) > 0;
}

/**
 * V3.1-50 — La fiche de la sélection (espèce, historique) sous les cartes :
 * ses traits en une ligne chacun, puis « Ce qui en naît » en pastilles. Une
 * pastille ouvre la sous-étape correspondante.
 *
 * V3.1-172 (esquisse, solution A) : chaque ligne se déplie sur place et
 * montre le texte entier (gras et listes compris, rendu de la page de
 * règle) ; « Tout déplier » au-dessus. Le parent remonte la fiche (`key`)
 * quand la sélection change, ce qui referme tout.
 */
export default function FicheSelection({
  worldSlug,
  titre,
  resume,
  lignes,
  naissent,
  onAller,
}: {
  worldSlug: string;
  titre: string;
  /** Une ligne de repères (type, taille, vitesse). */
  resume?: string | null;
  lignes: readonly LigneFiche[];
  naissent: readonly SousEtape[];
  onAller: (position: string) => void;
}) {
  const t = useTranslations("creation.fiche");
  const tc = useTranslations("creation");
  const [ouvertes, setOuvertes] = useState<ReadonlySet<string>>(() => new Set());
  const aDeplier = lignes.filter(depliable).map((l) => l.nom);
  const toutOuvert = aDeplier.length > 0 && aDeplier.every((n) => ouvertes.has(n));

  function basculer(nom: string) {
    setOuvertes((avant) => {
      const apres = new Set(avant);
      if (apres.has(nom)) apres.delete(nom);
      else apres.add(nom);
      return apres;
    });
  }

  return (
    <article aria-label={titre} className="flex flex-col gap-2 rounded-md border border-edge/60 bg-panel-sunken p-3">
      <header className="flex flex-col gap-0.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 font-display text-base font-bold text-ink">{titre}</h3>
          {aDeplier.length > 0 && (
            <button
              type="button"
              onClick={() => setOuvertes(toutOuvert ? new Set() : new Set(aDeplier))}
              className="shrink-0 text-xs font-medium text-accent hover:underline"
            >
              {toutOuvert ? t("toutReplier") : t("toutDeplier")}
            </button>
          )}
        </div>
        {resume && <p className="text-xs text-ink-muted">{resume}</p>}
      </header>

      {lignes.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {lignes.map((l) => {
            const ouverte = ouvertes.has(l.nom);
            // Ouverte, la ligne n'écrit que le nom d'un trait : le texte entier suit (la phrase ne se répète pas). Un résumé qui n'est pas le début du texte (le don, l'outil) reste.
            const resumeRepete = ouverte && Boolean(l.entier);
            const entete = (
              <>
                <span className="font-semibold text-ink">{l.nom}</span>
                {l.texte && !resumeRepete ? ` — ${l.texte}` : ""}
              </>
            );
            if (!depliable(l)) {
              return (
                <li key={l.nom} className="truncate px-2 py-1 text-sm text-ink-soft">
                  {entete}
                </li>
              );
            }
            return (
              <li key={l.nom} className={`flex flex-col gap-1.5 rounded-md ${ouverte ? "border-l-[3px] border-accent bg-panel-raised px-2.5 py-2" : "px-2 py-1"}`}>
                <button type="button" aria-expanded={ouverte} onClick={() => basculer(l.nom)} className="flex w-full min-w-0 items-baseline gap-2 text-left text-sm text-ink-soft">
                  <span className={`min-w-0 flex-1 ${ouverte ? "" : "truncate"}`}>{entete}</span>
                  <span aria-hidden="true" className="shrink-0 text-xs text-ink-muted">
                    {ouverte ? "▴" : "▾"}
                  </span>
                </button>
                {ouverte && <TexteEntier worldSlug={worldSlug} ligne={l} />}
              </li>
            );
          })}
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

/**
 * V3.1-172 — Le texte entier d'une ligne dépliée : le sien s'il est déjà là,
 * sinon celui de ses fiches de règle, demandé au dépliage seulement (une
 * requête pour les fiches de la ligne, en cache ; docs/CABLAGE.md, C1-C2).
 */
function TexteEntier({ worldSlug, ligne }: { worldSlug: string; ligne: LigneFiche }) {
  const t = useTranslations("creation.fiche");
  const fiches = useRuleEntryBlocks(
    worldSlug,
    ligne.entier ? [] : (ligne.fiches ?? []).map((f) => f.cle)
  );
  if (ligne.entier) {
    return <div className="text-sm text-ink-soft">{renderBlockData("description", { segments: [{ text: ligne.entier }] }, worldSlug)}</div>;
  }
  return (
    <div className="flex flex-col gap-2">
      {(ligne.fiches ?? []).map((f) => {
        const blocs = fiches[f.cle];
        const description = blocs?.find((b) => b.blockType === "description");
        return (
          <div key={f.cle} className="flex flex-col gap-0.5">
            {f.nom && <span className="text-sm font-semibold text-ink">{f.nom}</span>}
            {blocs === undefined ? (
              <span className="text-xs text-ink-muted">{t("chargement")}</span>
            ) : description ? (
              <div className="text-sm text-ink-soft">{renderBlockData("description", description.data, worldSlug)}</div>
            ) : (
              <span className="text-xs text-ink-muted">{t("sansTexte")}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { RuleEntryBlockData } from "../useRuleEntryBlocks";
import FicheSort, { ecoleDuSort } from "./FicheSort";

export interface CandidatSort {
  cle: string;
  nom: string;
  niveau: number | null;
}

/** Insensible à la casse et aux accents. */
function correspond(nom: string, requete: string): boolean {
  if (requete.trim() === "") return true;
  const norme = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return norme(nom).includes(norme(requete));
}

/**
 * V3.1-50 — LE sélecteur de sorts de la création : des cartes, un compteur,
 * la fiche du sort touché. Celui de l'étape Sorts (budget de la classe) et de
 * tout choix de sorts né d'un trait, d'un don ou d'une sous-classe. Il ne
 * décide de rien : l'appelant dit qui est choisi, combien on peut en choisir,
 * et ce qu'un clic change (`onBasculer`).
 *
 * Un clic choisit (ou retire) ET montre la fiche. La fiche s'affiche sous les
 * cartes, sauf si l'appelant la place ailleurs (`onToucher` : l'écran du don
 * la met à côté des sections).
 */
export default function SelecteurSorts({
  worldSlug,
  titre,
  candidats,
  blocs,
  choisis,
  max,
  onBasculer,
  touche,
  onToucher,
}: {
  worldSlug: string;
  /** Titre de la rangée de cartes (« Deux sorts mineurs »). */
  titre?: string;
  candidats: readonly CandidatSort[];
  blocs: Record<string, RuleEntryBlockData[]>;
  choisis: readonly string[];
  /** Le plafond. À 1, un autre sort remplace le premier d'un clic. */
  max: number;
  onBasculer: (cle: string) => void;
  /** Le sort dont la fiche est montrée, si l'appelant la montre lui-même. */
  touche?: string | null;
  onToucher?: (cle: string) => void;
}) {
  const t = useTranslations("creation.sorts");
  const tc = useTranslations("creation");
  const [recherche, setRecherche] = useState("");
  const [niveau, setNiveau] = useState<number | "tous">("tous");
  const [toucheInterne, setToucheInterne] = useState<string | null>(null);
  const fiche = onToucher ? touche ?? null : toucheInterne;

  const niveaux = useMemo(() => [...new Set(candidats.map((c) => c.niveau).filter((n): n is number => n !== null))].sort((a, b) => a - b), [candidats]);
  const visibles = useMemo(
    () => candidats.filter((c) => (niveau === "tous" || c.niveau === niveau) && correspond(c.nom, recherche)),
    [candidats, niveau, recherche]
  );
  const complet = choisis.length >= max;

  function toucher(cle: string) {
    if (onToucher) onToucher(cle);
    else setToucheInterne(cle);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {titre && <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">{titre}</span>}
        <span className="text-sm font-semibold text-accent">{tc("compte", { fait: choisis.length, total: max })}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder={t("rechercher")}
          aria-label={t("rechercher")}
          className="min-w-0 flex-1 rounded-md border border-edge bg-transparent px-2.5 py-1.5 text-sm text-ink outline-none"
        />
        {niveaux.length > 1 &&
          (["tous", ...niveaux] as const).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={niveau === n}
              onClick={() => setNiveau(n)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                niveau === n ? "border-accent bg-accent/10 text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
              }`}
            >
              {n === "tous" ? t("tous") : n === 0 ? t("mineurs") : t("niveau", { n })}
            </button>
          ))}
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-md border border-dashed border-edge px-3 py-2 text-sm text-ink-muted">{t("aucunSort")}</p>
      ) : (
        <div className="grid max-h-80 grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2 overflow-y-auto pr-1">
          {visibles.map((c) => {
            const estChoisi = choisis.includes(c.cle);
            const ecole = ecoleDuSort(blocs[c.cle]);
            const bloque = !estChoisi && complet && max > 1;
            return (
              <button
                key={c.cle}
                type="button"
                aria-pressed={estChoisi}
                disabled={bloque}
                onClick={() => {
                  toucher(c.cle);
                  onBasculer(c.cle);
                }}
                onFocus={() => toucher(c.cle)}
                className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                  estChoisi ? "border-accent bg-accent/10 font-semibold text-accent" : "border-edge bg-panel-sunken text-ink hover:bg-panel-raised"
                } ${fiche === c.cle && !estChoisi ? "border-edge-strong" : ""}`}
              >
                {c.nom}
                <span className="flex flex-wrap items-center gap-x-2 text-xs font-normal text-ink-muted">
                  {ecole && <span style={{ color: `var(${ecole.couleur})` }}>{ecole.libelle}</span>}
                  {c.niveau !== null && <span>{c.niveau === 0 ? t("mineur") : t("niveau", { n: c.niveau })}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!onToucher && <FicheSort worldSlug={worldSlug} cle={fiche} nom={candidats.find((c) => c.cle === fiche)?.nom ?? fiche ?? ""} blocs={fiche ? blocs[fiche] : undefined} />}
    </div>
  );
}

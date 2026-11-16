"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import EmptyState from "@/components/shell/EmptyState";
import type { UnplayableRule } from "@/src/server/services/rulePlayableBlocks";
import { COVERAGE_BRICKS, type CoverageBrick } from "@/src/core/rules/coverage";

/**
 * V3.1-132, étendue en V3.1-215 — la liste des règles non jouables, groupée par
 * catégorie (espèces, sous-classes et monstres compris), avec un filtre texte,
 * un filtre par brique (état local, aucune requête de plus), les briques de
 * chaque règle en pastilles et un lien vers sa fiche.
 */
export default function ReglesNonJouables({ worldSlug, regles }: { worldSlug: string; regles: UnplayableRule[] }) {
  const tb = useTranslations("regles.briques");
  const [filtre, setFiltre] = useState("");

  const [brique, setBrique] = useState<CoverageBrick | null>(null);

  const briquesDe = (r: UnplayableRule): CoverageBrick[] => [...new Set(r.gaps.map((g) => g.brick))];

  // Les briques qui existent dans la liste, avec le nombre de règles qu'elles touchent.
  const parBrique = useMemo(() => {
    const n = new Map<CoverageBrick, number>();
    for (const r of regles) for (const b of new Set(r.gaps.map((g) => g.brick))) n.set(b, (n.get(b) ?? 0) + 1);
    return COVERAGE_BRICKS.filter((b) => n.has(b)).map((b) => ({ brique: b, n: n.get(b) ?? 0 }));
  }, [regles]);

  const groupes = useMemo(() => {
    const f = filtre.trim().toLowerCase();
    const visibles = regles.filter((r) => (f === "" || r.name.toLowerCase().includes(f)) && (brique === null || r.gaps.some((g) => g.brick === brique)));
    const parCategorie = new Map<string, UnplayableRule[]>();
    for (const r of visibles) parCategorie.set(r.category, [...(parCategorie.get(r.category) ?? []), r]);
    return [...parCategorie];
  }, [regles, filtre, brique]);

  if (regles.length === 0) return <EmptyState title={tb("nonJouables.videTitre")} description={tb("nonJouables.videDescription")} />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="entity-title">{tb("nonJouables.titre")}</h1>
        <p className="text-sm text-ink-muted">{tb("nonJouables.aide", { n: regles.length })}</p>
      </div>
      <label className="flex max-w-sm flex-col gap-1 text-xs text-ink-soft">
        {tb("nonJouables.filtre")}
        <input value={filtre} onChange={(e) => setFiltre(e.target.value)} className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none" />
      </label>
      {parBrique.length > 0 && (
        <div role="group" aria-label={tb("nonJouables.filtreBrique")} className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-soft">{tb("nonJouables.filtreBrique")}</span>
          <button
            type="button"
            aria-pressed={brique === null}
            onClick={() => setBrique(null)}
            className={`min-h-11 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-panel-raised sm:min-h-0 ${brique === null ? "border-edge-strong bg-panel-raised text-ink" : "border-edge text-ink-soft"}`}
          >
            {tb("nonJouables.toutesBriques")}
          </button>
          {parBrique.map((b) => (
            <button
              key={b.brique}
              type="button"
              aria-pressed={brique === b.brique}
              onClick={() => setBrique(brique === b.brique ? null : b.brique)}
              className={`min-h-11 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-panel-raised sm:min-h-0 ${brique === b.brique ? "border-edge-strong bg-panel-raised text-ink" : "border-edge text-ink-soft"}`}
            >
              {tb(`brique.${b.brique}`)} <span className="text-ink-muted">({b.n})</span>
            </button>
          ))}
        </div>
      )}
      {groupes.length === 0 && <p className="text-sm text-ink-muted">{tb("nonJouables.aucune")}</p>}
      {groupes.map(([categorie, liste]) => (
        <section key={categorie} className="flex flex-col gap-2">
          <h2 className="block-title">
            {tb(`nonJouables.categorie.${categorie}`)} <span className="font-normal text-ink-muted">({liste.length})</span>
          </h2>
          <ul className="flex flex-col">
            {liste.map((r) => (
              <li key={r.key} className="flex flex-wrap items-center gap-3 border-b border-edge/60 py-2 last:border-b-0">
                <Link href={`/m/${encodeURIComponent(worldSlug)}/regles/${encodeURIComponent(r.key)}`} className="min-w-0 flex-1 truncate text-sm text-link-rule hover:underline">
                  {r.name}
                </Link>
                {briquesDe(r).map((b) => (
                  <span key={b} className="shrink-0 whitespace-nowrap rounded-full border border-edge px-2 py-0.5 text-xs text-ink-soft">
                    {tb(`brique.${b}`)}
                  </span>
                ))}
                <span className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${r.state === "partial" ? "border-accent text-accent" : "border-edge text-ink-muted"}`}>
                  {r.state === "partial" ? tb("badge.partial") : tb("badge.unevaluated")}
                  {r.state === "partial" && <span className="font-normal"> · {tb("badge.lacunes", { n: r.gaps.length })}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

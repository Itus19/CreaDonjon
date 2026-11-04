"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import EmptyState from "@/components/shell/EmptyState";
import type { UnplayableRule } from "@/src/server/services/rulePlayableBlocks";

/** V3.1-132 — la liste des règles non jouables, groupée par type, avec un filtre texte et un lien vers chaque fiche. */
export default function ReglesNonJouables({ worldSlug, regles }: { worldSlug: string; regles: UnplayableRule[] }) {
  const t = useTranslations("regles");
  const tb = useTranslations("regles.briques");
  const typeLabels = t.raw("entryTypes") as Record<string, string>;
  const [filtre, setFiltre] = useState("");

  const groupes = useMemo(() => {
    const f = filtre.trim().toLowerCase();
    const visibles = f === "" ? regles : regles.filter((r) => r.name.toLowerCase().includes(f));
    const parType = new Map<string, UnplayableRule[]>();
    for (const r of visibles) parType.set(r.entryType, [...(parType.get(r.entryType) ?? []), r]);
    return [...parType];
  }, [regles, filtre]);

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
      {groupes.length === 0 && <p className="text-sm text-ink-muted">{tb("nonJouables.aucune")}</p>}
      {groupes.map(([type, liste]) => (
        <section key={type} className="flex flex-col gap-2">
          <h2 className="block-title">
            {typeLabels[type] ?? type} <span className="font-normal text-ink-muted">({liste.length})</span>
          </h2>
          <ul className="flex flex-col">
            {liste.map((r) => (
              <li key={r.key} className="flex items-center gap-3 border-b border-edge/60 py-2 last:border-b-0">
                <Link href={`/m/${encodeURIComponent(worldSlug)}/regles/${encodeURIComponent(r.key)}`} className="min-w-0 flex-1 truncate text-sm text-link-rule hover:underline">
                  {r.name}
                </Link>
                <span className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${r.state === "partial" ? "border-accent text-accent" : "border-edge text-ink-muted"}`}>
                  {r.state === "partial" ? tb("badge.partial") : tb("badge.unevaluated")}
                  {r.state === "partial" && <span className="font-normal"> · {tb("badge.lacunes", { n: r.gaps })}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

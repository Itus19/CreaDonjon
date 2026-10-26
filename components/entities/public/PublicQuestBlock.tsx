"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import QuestLigne from "@/components/entities/quest/QuestLigne";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import type { QuestBlockData, QuestNote } from "@/src/core/schemas/blocks/quest";

/**
 * Rendu public du bloc `quest` (V3.1-76) : la même ligne repliable que
 * l'éditeur, en lecture seule — aucune case, aucun champ. Rien n'est ajouté à
 * ce que le serveur rend déjà (`questRefs`).
 */
export default function PublicQuestBlock({
  data,
  questRefs,
  hrefBase,
}: {
  data: QuestBlockData;
  questRefs: Record<string, { name: string; slug: string }> | undefined;
  hrefBase: string;
}) {
  const t = useTranslations("fiche.quete");
  const [ouvert, setOuvert] = useState(false);

  function lien(ref: BlockReference | null | undefined) {
    if (!ref || ref.kind !== "entity") return null;
    const trouve = questRefs?.[ref.id];
    if (!trouve) return null;
    return (
      /* `prefetch={false}` : meme raison qu'au lien d'entite (V2.1-20 lot 6). */
      <Link href={`${hrefBase}/${trouve.slug}`} prefetch={false} className="rich-ref-mention">
        {trouve.name}
      </Link>
    );
  }

  function notes(items: QuestNote[], titre: string) {
    if (items.length === 0) return null;
    return (
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{titre}</span>
        <ul className="mt-1 list-disc pl-5 text-sm">
          {items.map((item) => (
            <li key={item.id}>
              {item.text} {lien(item.ref)}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <QuestLigne etat={data.state} objectifs={data.objectives} commanditaire={lien(data.giver)} ouvert={ouvert} onBascule={() => setOuvert(!ouvert)} />
      {ouvert && (
        <div className="flex flex-col gap-3">
          {data.objectives.length > 0 && (
            <ul className="flex flex-col gap-1">
              {data.objectives.map((objectif) => (
                <li key={objectif.id} className={`flex items-start gap-2 ${objectif.done ? "text-ink-muted line-through" : ""}`}>
                  <span aria-hidden>{objectif.done ? "☑" : "☐"}</span>
                  <span>
                    {objectif.text} {lien(objectif.ref)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-1 gap-3 @xl/bloc:grid-cols-2">
            {notes(data.rewards, t("recompenses"))}
            {notes(data.prerequisites, t("prerequis"))}
          </div>
        </div>
      )}
    </div>
  );
}

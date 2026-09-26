"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BinderTabs from "@/components/shared/BinderTabs";
import PlayerRulesSidebar from "@/components/rules/PlayerRulesSidebar";
import { ZONE_LABELS } from "@/components/solo/ScenePanel";
import type { QuestColumnEntry, SceneView, WikiColumnGroup } from "@/lib/solo/types";

/**
 * V3-D3 — La colonne gauche : le monde connu. Quatre onglets de classeur,
 * repris à l'identique de l'esquisse (`components/solo/esquisse/`, jetable,
 * jamais importée ici) : Wiki, Quêtes, Présents, Règles.
 *
 * **Aucun marqueur de découverte.** Dépend d'une donnée que rien n'écrit
 * encore — `entity_discoveries` (V3-C4). Ce composant l'omet plutôt que
 * d'inventer une marque sans donnée derrière, même principe que la météo
 * omise en V3-D2.
 *
 * **V3-C2 — les esquisses rejoignent les Présents**, avec « garder cette
 * fiche » : le seul des quatre déclencheurs d'ancrage qui est un geste du
 * joueur plutôt qu'une règle automatique (`sceneSketches.ts`).
 *
 * Le Wiki de cette colonne montre exactement ce qu'un joueur peut déjà
 * ouvrir depuis `/joueur/wiki` — la même visibilité, calculée côté serveur
 * (`buildWikiColumn`) — ni plus, ni moins.
 */

const CLASSEUR = "rounded-b-lg border border-t-0 border-edge-strong p-3";
const LIGNE_CLIQUABLE =
  "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-panel-sunken";

type Onglet = "wiki" | "quetes" | "presents" | "regles";

function OngletWiki({ worldSlug, groups }: { worldSlug: string; groups: WikiColumnGroup[] }) {
  const [ouverteId, setOuverteId] = useState<string | null>(null);
  const ouverte = groups.flatMap((g) => g.entries.map((e) => ({ ...e, groupLabel: g.label }))).find((e) => e.id === ouverteId);

  if (groups.length === 0) {
    return <p className="text-sm text-ink-muted">Rien n&apos;est encore visible dans ce monde.</p>;
  }

  if (ouverte) {
    return (
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => setOuverteId(null)} className="self-start py-1 text-xs text-ink-muted hover:text-ink">
          ← {ouverte.groupLabel}
        </button>
        <span className="font-chrome text-base font-medium text-ink">{ouverte.name}</span>
        <p className="text-sm leading-snug text-ink-soft">{ouverte.excerpt ?? "Rien d'écrit pour l'instant."}</p>
        <Link href={`/m/${worldSlug}/joueur/wiki/${ouverte.slug}`} className="mt-1 text-xs text-link-entity hover:underline">
          ouvrir la fiche entière
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <div key={group.kind} className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{group.label}</span>
          {group.entries.map((entry) => (
            <button key={entry.id} type="button" onClick={() => setOuverteId(entry.id)} className={LIGNE_CLIQUABLE}>
              <span className="truncate text-sm text-ink">{entry.name}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function OngletQuetes({ quests }: { quests: QuestColumnEntry[] }) {
  if (quests.length === 0) {
    return <p className="text-sm text-ink-muted">Aucune quête en cours.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {quests.map((q) => {
        const faits = q.objectives.filter((o) => o.done).length;
        return (
          <div key={q.id} className="flex flex-col gap-1 rounded-md border border-edge p-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-ink">{q.title}</span>
              <span className="shrink-0 text-xs text-ink-muted">
                {faits}/{q.objectives.length}
              </span>
            </div>
            {q.giverName && <span className="text-xs text-ink-muted">donnée par {q.giverName}</span>}
            <ul className="mt-1 flex flex-col gap-0.5">
              {q.objectives.map((o) => (
                <li key={o.id} className={`text-sm ${o.done ? "text-ink-muted line-through" : "text-ink-soft"}`}>
                  {o.done ? "✓" : "○"} {o.text}
                </li>
              ))}
            </ul>
            {q.rewardText && <span className="mt-1 text-xs text-ink-muted">Récompense : {q.rewardText}</span>}
          </div>
        );
      })}
    </div>
  );
}

function OngletPresents({
  present,
  sketches,
  worldSlug,
  campaignId,
}: {
  present: SceneView["present"];
  sketches: SceneView["sketches"];
  worldSlug: string;
  campaignId: string;
}) {
  const router = useRouter();
  const [ancrageEnCours, setAncrageEnCours] = useState<string | null>(null);

  // `ColonneMonde` reçoit sa scène du composant serveur (`page.tsx`), pas
  // d'un état local partagé avec `SoloScreen` (une colonne voisine, un arbre
  // React distinct) — `router.refresh()` la relit fraîche, même geste que
  // `ScenePanel.onChanged` pour la même raison.
  async function garder(sketchId: string) {
    setAncrageEnCours(sketchId);
    try {
      const res = await fetch(`/api/solo/scene/sketches/${sketchId}/garder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, worldSlug }),
      });
      if (res.ok) router.refresh();
    } finally {
      setAncrageEnCours(null);
    }
  }

  if (present.length === 0 && sketches.length === 0) {
    return <p className="text-sm text-ink-muted">Personne d&apos;autre dans la scène pour l&apos;instant.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {present.map((p) => (
        <div key={p.entityId} className="flex flex-col gap-0.5 rounded-md border border-edge p-2">
          <span className="text-sm text-ink">{p.name}</span>
          <span className="text-xs text-ink-muted">
            {p.disposition ? `${p.disposition} · ` : ""}
            {ZONE_LABELS[p.zone]}
          </span>
        </div>
      ))}
      {sketches.map((s) => (
        <div key={s.id} className="flex flex-col gap-1 rounded-md border border-dashed border-edge p-2">
          <span className="text-sm text-ink">{s.name}</span>
          <span className="text-xs text-ink-muted">
            {s.trait} · {ZONE_LABELS[s.zone]}
          </span>
          <button
            type="button"
            onClick={() => void garder(s.id)}
            disabled={ancrageEnCours === s.id}
            className="self-start text-xs text-link-entity hover:underline disabled:opacity-50"
          >
            {ancrageEnCours === s.id ? "…" : "garder cette fiche"}
          </button>
        </div>
      ))}
    </div>
  );
}

export default function ColonneMonde({
  worldSlug,
  campaignId,
  wiki,
  quests,
  present,
  sketches,
}: {
  worldSlug: string;
  campaignId: string;
  wiki: WikiColumnGroup[];
  quests: QuestColumnEntry[];
  present: SceneView["present"];
  sketches: SceneView["sketches"];
}) {
  const [onglet, setOnglet] = useState<Onglet>("wiki");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <BinderTabs
        aria-label="Colonne du monde"
        value={onglet}
        onChange={setOnglet}
        items={[
          { value: "wiki", label: "Wiki" },
          { value: "quetes", label: "Quêtes" },
          { value: "presents", label: "Présents" },
          { value: "regles", label: "Règles" },
        ]}
      />
      <div className={`${CLASSEUR} min-h-0 flex-1 overflow-y-auto`}>
        {onglet === "wiki" && <OngletWiki worldSlug={worldSlug} groups={wiki} />}
        {onglet === "quetes" && <OngletQuetes quests={quests} />}
        {onglet === "presents" && <OngletPresents present={present} sketches={sketches} worldSlug={worldSlug} campaignId={campaignId} />}
        {onglet === "regles" && <PlayerRulesSidebar worldSlug={worldSlug} />}
      </div>
    </div>
  );
}

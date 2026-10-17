"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { EspaceRecents } from "@/lib/ui/recents";
import { useRecents } from "./useRecents";

/** Libellés de type d'un espace : types d'entité (Monde, Wiki) ou types de règle (Règles). */
function useLibellesType(espace: EspaceRecents): Record<string, string> {
  const tShell = useTranslations("shell");
  const tRegles = useTranslations("regles");
  const estRegle = espace === "mj-regles" || espace === "joueur-regles";
  return (estRegle ? tRegles.raw("entryTypes") : tShell.raw("kindLabelsSingular")) as Record<string, string>;
}

/**
 * Liste de liens vers les fiches consultées récemment (V3.1-30), lue dans le
 * navigateur (`useRecents`). `limite` : « Récemment » de la feuille ☰ n'en
 * montre que 5. Liste vide : rien n'est rendu si `messageVide` est absent
 * (la feuille), sinon le message de l'accueil.
 */
export default function ListeRecents({
  worldSlug,
  espace,
  limite,
  messageVide,
  onNavigate,
}: {
  worldSlug: string;
  espace: EspaceRecents;
  limite?: number;
  messageVide?: string;
  /** Appelé au clic sur un lien (ferme la feuille qui contient la liste). */
  onNavigate?: () => void;
}) {
  const recents = useRecents(worldSlug, espace);
  const libelles = useLibellesType(espace);
  const visibles = limite === undefined ? recents : recents.slice(0, limite);

  if (visibles.length === 0) {
    return messageVide ? <p className="text-sm text-ink-muted">{messageVide}</p> : null;
  }
  return (
    <ul className="flex flex-col">
      {visibles.map((e) => (
        <li key={e.href}>
          <Link
            href={e.href}
            prefetch={false}
            onClick={onNavigate}
            className="flex items-baseline justify-between gap-3 rounded px-2 py-2 text-sm text-ink-soft transition-colors hover:bg-panel-raised hover:text-ink"
          >
            <span className="min-w-0 truncate">{e.titre}</span>
            {e.type && <span className="shrink-0 text-xs text-ink-muted">{libelles[e.type] ?? e.type}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * « Récemment » en tête des feuilles ☰ (V3.1-30) : les 5 premières fiches,
 * ou rien du tout quand la liste est vide (le sommaire complet suit).
 */
export function SectionRecemment({
  worldSlug,
  espace,
  onNavigate,
}: {
  worldSlug: string;
  espace: EspaceRecents;
  onNavigate: () => void;
}) {
  const t = useTranslations("lecteur");
  const recents = useRecents(worldSlug, espace);
  if (recents.length === 0) return null;
  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("recemment")}</h2>
      <ListeRecents worldSlug={worldSlug} espace={espace} limite={5} onNavigate={onNavigate} />
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useWorldRuleEntries } from "@/components/blocks/useWorldRuleEntries";

/**
 * Polarite inversee de `useCollapsedGroups.ts` (retour utilisateur : "par
 * defaut, les categories de regles dans la sidebar sont fermees") — celui-ci
 * memorise quelles categories sont REPLIEES (defaut : aucune, tout ouvert),
 * celui-la memorise quelles categories sont DEPLIEES (defaut : aucune, tout
 * ferme). Necessaire ici specifiquement : les cles de categorie n'existent
 * qu'une fois `entries` charge (fetch client asynchrone), un
 * `defaultCollapsed` fige au montage comme celui de `useCollapsedGroups`
 * ne pourrait jamais les connaitre a temps.
 */
function useExpandedGroups(storageKey: string) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture de localStorage, disponible seulement cote client, au premier montage
        setExpanded(new Set(JSON.parse(raw)));
      }
    } catch {
      // Stockage indisponible (navigation privee stricte) : tout reste ferme.
    }
  }, [storageKey]);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // Rien a faire si le stockage est indisponible : le depli reste actif pour cette session.
      }
      return next;
    });
  }

  return { isExpanded: (key: string) => expanded.has(key), toggle };
}

/**
 * Sommaire de l'onglet Regles, coquille joueur (retour utilisateur, suite)
 * — meme presentation que le wiki (recherche + liste groupee, sommaire
 * etroit, categories repliables comme `EntityTree.tsx`) plutot que
 * `RulesSidebar.tsx` (outils MJ, fenetres flottantes, tiroir mobile plein
 * ecran : hors de propos ici, PlayerShell gere deja sa propre navigation
 * responsive). Groupement simple par `entryType`, jamais l'imbrication
 * sous-classe/sous-espece de la sidebar MJ — un joueur cherche une regle
 * precise, pas ne navigue pas le catalogue entier (meme motif que
 * l'ancienne liste plate de cet onglet).
 *
 * Tri alphabetique explicite (retour utilisateur : "les fiches de regles a
 * l'interieur des categories sont par ordre alphabetique") : `localeCompare`
 * avec la locale "fr" nommee, jamais la locale par defaut du moteur JS —
 * seule facon de garantir le meme ordre partout, y compris le tri des
 * GROUPES par leur libelle affiche (pas leur cle brute `entryType`, qui ne
 * suit pas le meme alphabet une fois traduite).
 */
export default function PlayerRulesSidebar({ worldSlug }: { worldSlug: string }) {
  const entries = useWorldRuleEntries(worldSlug);
  const tRegles = useTranslations("regles");
  const entryTypeLabels = tRegles.raw("entryTypes") as Record<string, string>;
  const [query, setQuery] = useState("");
  const { isExpanded, toggle } = useExpandedGroups(`creadonjon:expanded:regles-joueur:${worldSlug}`);
  const pathname = usePathname();
  const base = `/m/${worldSlug}/joueur/regles`;
  const currentKey = pathname.startsWith(`${base}/`) ? decodeURIComponent(pathname.slice(base.length + 1)) : null;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q === "" ? entries : entries.filter((e) => e.name.toLowerCase().includes(q));
    const byType = new Map<string, typeof entries>();
    for (const entry of filtered) {
      const list = byType.get(entry.entryType) ?? [];
      list.push(entry);
      byType.set(entry.entryType, list);
    }
    for (const list of byType.values()) list.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return [...byType.entries()].sort(([a], [b]) =>
      (entryTypeLabels[a] ?? a).localeCompare(entryTypeLabels[b] ?? b, "fr")
    );
  }, [entries, query, entryTypeLabels]);

  return (
    <div className="flex flex-col gap-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={tRegles("rechercherRegle")}
        className="w-full rounded-md border border-edge bg-transparent px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted"
      />
      {groups.length === 0 && <p className="text-sm text-ink-muted">{tRegles("aucuneRegleTrouvee")}</p>}
      {groups.map(([entryType, items]) => {
        const expanded = isExpanded(entryType);
        return (
          <div key={entryType}>
            <button
              type="button"
              onClick={() => toggle(entryType)}
              className="mb-1 flex w-full items-center gap-1 px-1 text-xs font-semibold uppercase tracking-wide text-ink-muted"
            >
              <span className="w-3 text-[10px]">{expanded ? "▾" : "▸"}</span>
              {entryTypeLabels[entryType] ?? entryType}
            </button>
            {expanded && (
              <ul>
                {items.map((entry) => (
                  <li key={entry.key}>
                    <Link
                      href={`${base}/${entry.key}`}
                      className={`block truncate rounded px-2 py-1 text-sm transition-colors hover:bg-panel-raised ${
                        entry.key === currentKey ? "bg-panel-raised text-accent" : "text-ink-soft"
                      }`}
                    >
                      {entry.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

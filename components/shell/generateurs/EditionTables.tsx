"use client";

import { useEffect, useRef, useState } from "react";
import type { VisibleBlock } from "@/src/server/services/blocks";
import type { RandomTableBlockData } from "@/src/core/schemas/blocks/randomTable";
import RandomTableBlockEditor from "@/components/blocks/RandomTableBlockEditor";

type TableBlock = Omit<VisibleBlock, "data"> & { data: RandomTableBlockData };

/**
 * « Éditer les tables » (V2-J9bis, V3.1-45) : prend la place des tirages dans
 * la colonne de gauche (plus de modale ; retour par ×). Meme contenu et memes
 * requetes qu'avant : liste les tables REELLEMENT tirees par la section pour la
 * variante choisie (`/api/blocks/[id]/tables`), un `RandomTableBlockEditor` par
 * table — l'editeur standard de tout bloc `random_table`.
 *
 * Sauvegarde par debounce (800 ms apres la derniere frappe, `tablesRef` pour
 * eviter la fermeture perimee d'un debounce adosse a du `useState`). Fermer
 * vide d'abord les sauvegardes en attente : supprimer une ligne puis fermer
 * aussitot ne doit rien perdre. Pas de gestion de conflit de version : un seul
 * MJ edite ce contenu a la fois, une erreur affiche un message.
 */
export default function EditionTables({
  blockId,
  libelle,
  variant,
  onFermer,
}: {
  blockId: string;
  libelle: string;
  variant: Record<string, string>;
  onFermer: () => void;
}) {
  const [tables, setTables] = useState<TableBlock[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Variante figee a l'ouverture (initialiseur paresseux) : le panneau recree
  // son objet `variant` a chaque tirage d'une section soeur — sans ce gel,
  // l'effet de chargement se redeclencherait et ecraserait une edition en cours.
  const [snapshotVariant] = useState(variant);
  const tablesRef = useRef<TableBlock[] | null>(null);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/blocks/${blockId}/tables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variant: snapshotVariant }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Impossible de charger les tables.");
        }
        return (await res.json()) as { tables: TableBlock[] };
      })
      .then((body) => {
        if (!cancelled) setTables(body.tables);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Impossible de charger les tables.");
      });
    return () => {
      cancelled = true;
    };
  }, [blockId, snapshotVariant]);

  async function saveTable(id: string) {
    const table = tablesRef.current?.find((t) => t.id === id);
    if (!table) return;
    const res = await fetch(`/api/blocks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: table.version,
        display: table.display,
        data: table.data,
        visibility: { level: table.visibilityLevel, scopeId: table.visibilityScopeId },
      }),
    });
    if (!res.ok) {
      setSaveError(`Échec de la sauvegarde de « ${table.data.key} » — rechargez avant de réessayer.`);
      return;
    }
    setSaveError(null);
    const updated = (await res.json()) as { version: number };
    setTables((prev) => prev?.map((t) => (t.id === id ? { ...t, version: updated.version } : t)) ?? prev);
  }

  function updateTableData(id: string, data: RandomTableBlockData) {
    setTables((prev) => prev?.map((t) => (t.id === id ? { ...t, data } : t)) ?? prev);
    clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(() => void saveTable(id), 800);
  }

  function fermer() {
    // Sauvegarde immediate de toute frappe encore en attente de debounce.
    for (const id of Object.keys(saveTimers.current)) {
      clearTimeout(saveTimers.current[id]);
      void saveTable(id);
    }
    onFermer();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">Tables · {libelle}</span>
        <button
          type="button"
          onClick={fermer}
          aria-label="Fermer l'édition des tables"
          className="rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted transition-colors hover:bg-panel-raised"
        >
          ×
        </button>
      </div>
      <p className="text-xs text-ink-muted">Les tables sont des fiches de règles du ruleset : pondérées, modifiables.</p>
      {loadError && <p className="text-xs text-danger">{loadError}</p>}
      {saveError && <p className="text-xs text-danger">{saveError}</p>}
      {!tables && !loadError && <p className="text-xs italic text-ink-muted">Chargement…</p>}
      {tables && tables.length === 0 && (
        <p className="text-xs italic text-ink-muted">Aucune table trouvée pour cette section avec la sélection actuelle.</p>
      )}
      {tables?.map((table) => (
        <div key={table.id} className="rounded-md border border-edge/60 p-2">
          <p className="mb-2 text-xs font-semibold text-ink-muted">{table.data.key}</p>
          <RandomTableBlockEditor blockId={table.id} data={table.data} onChange={(d) => updateTableData(table.id, d)} />
        </div>
      ))}
    </div>
  );
}

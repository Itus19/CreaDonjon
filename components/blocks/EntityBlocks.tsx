"use client";

import { useRef, useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import { VISIBILITY_OPTIONS } from "@/components/shared/visibilityOptions";
import DescriptionBlockEditor from "./DescriptionBlockEditor";
import InfoboxBlockEditor from "./InfoboxBlockEditor";
import GalleryBlockEditor from "./GalleryBlockEditor";
import CustomTableBlockEditor from "./CustomTableBlockEditor";
import type { DescriptionBlockData } from "@/src/core/schemas/blocks/description";
import type { InfoboxBlockData } from "@/src/core/schemas/blocks/infobox";
import type { GalleryBlockData } from "@/src/core/schemas/blocks/gallery";
import type { CustomTableBlockData } from "@/src/core/schemas/blocks/customTable";
import type { BlockDisplay } from "@/src/core/schemas/blocks/envelope";

export interface BlockItem {
  id: string;
  entityId: string;
  blockType: string;
  display: BlockDisplay;
  data: unknown;
  displayOrder: number;
  version: number;
  visibilityLevel: string;
  visibilityScopeId: string | null;
}

const BLOCK_TYPE_LABELS: Record<string, string> = {
  description: "Description",
  infobox: "Encadré",
  gallery: "Galerie",
  custom_table: "Tableau",
};

function BlockDataEditor({
  block,
  onChange,
}: {
  block: BlockItem;
  onChange: (data: unknown) => void;
}) {
  switch (block.blockType) {
    case "description":
      return (
        <DescriptionBlockEditor
          data={block.data as DescriptionBlockData}
          onChange={(d) => onChange(d)}
        />
      );
    case "infobox":
      return (
        <InfoboxBlockEditor data={block.data as InfoboxBlockData} onChange={(d) => onChange(d)} />
      );
    case "gallery":
      return (
        <GalleryBlockEditor data={block.data as GalleryBlockData} onChange={(d) => onChange(d)} />
      );
    case "custom_table":
      return (
        <CustomTableBlockEditor
          data={block.data as CustomTableBlockData}
          onChange={(d) => onChange(d)}
        />
      );
    default:
      return <p className="text-sm text-danger">Type de bloc inconnu : {block.blockType}</p>;
  }
}

/**
 * Blocs discrets, toujours editables en place — comme l'ancienne
 * application (master, EntityDetail.tsx) : pas d'encadre par bloc, juste
 * un separateur ; la sauvegarde se declenche a la perte de focus, jamais
 * par un bouton "Enregistrer" a chercher.
 */
export default function EntityBlocks({
  entityId,
  initialBlocks,
}: {
  entityId: string;
  initialBlocks: BlockItem[];
}) {
  const [blocks, setBlocks] = useState<BlockItem[]>(initialBlocks);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [conflictedIds, setConflictedIds] = useState<Set<string>>(new Set());
  const versionsRef = useRef<Record<string, number>>(
    Object.fromEntries(initialBlocks.map((b) => [b.id, b.version])),
  );
  const saveChainsRef = useRef<Record<string, Promise<void>>>({});

  const sortedBlocks = [...blocks].sort((a, b) => a.displayOrder - b.displayOrder);

  function patchBlock(id: string, patch: Partial<BlockItem>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addBlock(blockType: string) {
    const res = await fetch(`/api/entities/${entityId}/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityId,
        blockType,
        label: BLOCK_TYPE_LABELS[blockType],
        visibility: { level: "public", scopeId: null },
      }),
    });
    if (!res.ok) return;
    const block = (await res.json()) as BlockItem;
    versionsRef.current[block.id] = block.version;
    setBlocks((prev) => [...prev, block]);
  }

  /**
   * Sauvegardes serialisees par bloc (via versionsRef + une chaine de
   * promesses par id) : un blur et un changement de visibilite peuvent se
   * declencher a quelques millisecondes d'intervalle sur le meme bloc, et
   * s'ils partaient en parallele avec la version lue depuis le state React,
   * le second arrivait toujours avec une version deja perimee (409) et son
   * changement disparaissait sans message clair. La chaine garantit que le
   * second n'part qu'une fois le premier resolu, avec la version a jour.
   */
  function saveBlock(
    id: string,
    overrides?: { visibilityLevel?: string; visibilityScopeId?: string | null },
  ) {
    const run = () => doSaveBlock(id, overrides);
    const previous = saveChainsRef.current[id] ?? Promise.resolve();
    const next = previous.then(run, run);
    saveChainsRef.current[id] = next;
    return next;
  }

  async function doSaveBlock(
    id: string,
    overrides?: { visibilityLevel?: string; visibilityScopeId?: string | null },
  ) {
    const block = blocks.find((b) => b.id === id);
    if (!block) return;

    const res = await fetch(`/api/blocks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: versionsRef.current[id],
        display: block.display,
        data: block.data,
        visibility: {
          level: overrides?.visibilityLevel ?? block.visibilityLevel,
          scopeId: overrides?.visibilityScopeId ?? block.visibilityScopeId ?? null,
        },
      }),
    });

    if (res.status === 409) {
      setConflictedIds((prev) => new Set(prev).add(id));
      return;
    }
    if (!res.ok) return;

    const updated = (await res.json()) as BlockItem;
    versionsRef.current[id] = updated.version;
    patchBlock(id, { version: updated.version });
    setConflictedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleBlockBlur(id: string) {
    return (e: React.FocusEvent<HTMLDivElement>) => {
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      saveBlock(id);
    };
  }

  async function deleteBlockLocal(id: string) {
    if (!window.confirm("Supprimer ce bloc ?")) return;
    await fetch(`/api/blocks/${id}`, { method: "DELETE" });
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  async function moveBlock(id: string, direction: "up" | "down") {
    const index = sortedBlocks.findIndex((b) => b.id === id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sortedBlocks.length) return;

    const current = sortedBlocks[index];
    const neighbor = sortedBlocks[swapIndex];
    const beyond = direction === "up" ? sortedBlocks[swapIndex - 1] : sortedBlocks[swapIndex + 1];
    const newOrder = beyond
      ? (beyond.displayOrder + neighbor.displayOrder) / 2
      : neighbor.displayOrder + (direction === "up" ? -1000 : 1000);

    const res = await fetch(`/api/blocks/${id}/order`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: current.version, displayOrder: newOrder }),
    });
    if (!res.ok) return;
    const updated = (await res.json()) as BlockItem;
    versionsRef.current[id] = updated.version;
    patchBlock(id, { displayOrder: updated.displayOrder, version: updated.version });
  }

  return (
    <div className="flex flex-col">
      {sortedBlocks.map((block, index) => {
        const isCollapsed = collapsed.has(block.id);
        const hasConflict = conflictedIds.has(block.id);
        return (
          <div
            key={block.id}
            onBlur={handleBlockBlur(block.id)}
            className="border-b border-edge/60 py-4 first:pt-0 last:border-b-0"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-1 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleCollapsed(block.id)}
                  className="shrink-0 text-ink-muted transition-transform hover:text-ink"
                  style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
                  title={isCollapsed ? "Déplier" : "Replier"}
                >
                  ▾
                </button>
                <input
                  value={block.display.label}
                  placeholder={BLOCK_TYPE_LABELS[block.blockType] ?? block.blockType}
                  onChange={(e) =>
                    patchBlock(block.id, { display: { ...block.display, label: e.target.value } })
                  }
                  className="block-title flex-1 bg-transparent outline-none placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:italic placeholder:text-ink-muted focus:border-b focus:border-accent"
                />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-edge bg-panel-raised px-2 py-0.5 text-xs text-ink-muted">
                  {BLOCK_TYPE_LABELS[block.blockType] ?? block.blockType}
                </span>
                <Dropdown
                  value={block.visibilityLevel}
                  options={VISIBILITY_OPTIONS}
                  onChange={(v) => {
                    patchBlock(block.id, { visibilityLevel: v });
                    saveBlock(block.id, { visibilityLevel: v });
                  }}
                  aria-label="Visibilité du bloc"
                  className="rounded-full border border-edge bg-panel-raised px-2 py-0.5 text-xs text-ink transition-colors hover:bg-panel"
                />
                <button
                  type="button"
                  onClick={() => moveBlock(block.id, "up")}
                  disabled={index === 0}
                  className="text-xs text-ink-muted transition-colors hover:text-ink disabled:opacity-30"
                  aria-label="Monter"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveBlock(block.id, "down")}
                  disabled={index === sortedBlocks.length - 1}
                  className="text-xs text-ink-muted transition-colors hover:text-ink disabled:opacity-30"
                  aria-label="Descendre"
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => deleteBlockLocal(block.id)}
                  className="text-xs text-ink-muted transition-colors hover:text-danger"
                >
                  ×
                </button>
              </div>
            </div>

            {hasConflict && (
              <p className="mb-2 text-xs text-danger">
                Modifié entre-temps. Rechargez la page avant de réessayer.
              </p>
            )}

            {!isCollapsed && (
              <BlockDataEditor block={block} onChange={(data) => patchBlock(block.id, { data })} />
            )}
          </div>
        );
      })}
      {sortedBlocks.length === 0 && (
        <p className="py-4 text-center text-xs italic text-ink-muted">
          Aucun bloc. Utilisez la barre ci-dessous pour en ajouter.
        </p>
      )}

      <div className="flex flex-col gap-2 border-t border-edge pt-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">
          Ajouter un bloc :
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(BLOCK_TYPE_LABELS).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => addBlock(type)}
              className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
            >
              + {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

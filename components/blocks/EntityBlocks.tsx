"use client";

import { useState } from "react";
import BlockShell from "./BlockShell";
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

export default function EntityBlocks({
  entityId,
  initialBlocks,
}: {
  entityId: string;
  initialBlocks: BlockItem[];
}) {
  const [blocks, setBlocks] = useState<BlockItem[]>(initialBlocks);
  const [statusByBlock, setStatusByBlock] = useState<
    Record<string, "idle" | "saving" | "saved" | "conflict" | "error">
  >({});

  const sortedBlocks = [...blocks].sort((a, b) => a.displayOrder - b.displayOrder);

  function patchBlock(id: string, patch: Partial<BlockItem>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
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
    setBlocks((prev) => [...prev, block]);
  }

  async function saveBlock(id: string) {
    const block = blocks.find((b) => b.id === id);
    if (!block) return;
    setStatusByBlock((s) => ({ ...s, [id]: "saving" }));

    const res = await fetch(`/api/blocks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: block.version,
        display: block.display,
        data: block.data,
        visibility: { level: block.visibilityLevel, scopeId: block.visibilityScopeId },
      }),
    });

    if (res.status === 409) {
      setStatusByBlock((s) => ({ ...s, [id]: "conflict" }));
      return;
    }
    if (!res.ok) {
      setStatusByBlock((s) => ({ ...s, [id]: "error" }));
      return;
    }
    const updated = (await res.json()) as BlockItem;
    patchBlock(id, { version: updated.version });
    setStatusByBlock((s) => ({ ...s, [id]: "saved" }));
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
    patchBlock(id, { displayOrder: updated.displayOrder, version: updated.version });
  }

  return (
    <div className="flex flex-col gap-4">
      {sortedBlocks.map((block, index) => {
        const status = statusByBlock[block.id] ?? "idle";
        return (
          <BlockShell
            key={block.id}
            title={block.display.label || BLOCK_TYPE_LABELS[block.blockType]}
            visibilityLevel={block.visibilityLevel}
          >
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={block.display.label}
                  onChange={(e) =>
                    patchBlock(block.id, { display: { ...block.display, label: e.target.value } })
                  }
                  className="w-48 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm text-ink transition-colors hover:border-edge focus:border-edge focus:outline-none"
                />
                <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <Dropdown
                    value={block.visibilityLevel}
                    options={VISIBILITY_OPTIONS}
                    onChange={(v) => patchBlock(block.id, { visibilityLevel: v })}
                    aria-label="Visibilité du bloc"
                  />
                  <button
                    type="button"
                    onClick={() => moveBlock(block.id, "up")}
                    disabled={index === 0}
                    className="rounded-md border border-edge px-1.5 py-0.5 text-xs text-ink disabled:opacity-30"
                    aria-label="Monter"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(block.id, "down")}
                    disabled={index === sortedBlocks.length - 1}
                    className="rounded-md border border-edge px-1.5 py-0.5 text-xs text-ink disabled:opacity-30"
                    aria-label="Descendre"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteBlockLocal(block.id)}
                    className="ml-1 text-xs text-danger hover:underline"
                  >
                    Supprimer
                  </button>
                </div>
              </div>

              <BlockDataEditor block={block} onChange={(data) => patchBlock(block.id, { data })} />

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => saveBlock(block.id)}
                  disabled={status === "saving"}
                  className="self-start rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  {status === "saving" ? "Enregistrement..." : "Enregistrer le bloc"}
                </button>
                {status === "conflict" && (
                  <span className="text-xs text-danger">
                    Modifie entre-temps. Rechargez avant de reessayer.
                  </span>
                )}
                {status === "error" && <span className="text-xs text-danger">Erreur.</span>}
                {status === "saved" && <span className="text-xs text-ink-muted">Enregistre.</span>}
              </div>
            </div>
          </BlockShell>
        );
      })}

      <div className="flex flex-wrap gap-2 border-t border-edge pt-3">
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
  );
}

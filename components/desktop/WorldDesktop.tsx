"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import WindowFrame, { type WindowGeometry } from "./WindowFrame";
import EntityDetail from "./EntityDetail";
import { entityKindColor } from "@/lib/entityKindColors";
import { createEntity } from "@/lib/actions/entities";

type EntitySummary = {
  id: string;
  name: string;
  entity_kind: string | null;
  summary: string | null;
};

type EntityWindow = WindowGeometry & {
  entityId: string;
  name: string;
  entityKind: string | null;
};

const DEFAULT_WIDTH = 460;
const DEFAULT_HEIGHT = 540;
const UNSORTED_LABEL = "Sans type";

export default function WorldDesktop({
  worldId,
  worldName,
  entities,
}: {
  worldId: string;
  worldName: string;
  entities: EntitySummary[];
}) {
  const router = useRouter();
  const [entityList, setEntityList] = useState(entities);
  const [search, setSearch] = useState("");
  const [windows, setWindows] = useState<EntityWindow[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const desktopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEntityList(entities);
  }, [entities]);

  const openWindow = useCallback(
    (entityId: string, name: string, entityKind: string | null) => {
      setWindows((prev) => {
        if (prev.some((w) => w.entityId === entityId)) return prev;
        const offset = (prev.length % 6) * 28;
        return [
          ...prev,
          {
            entityId,
            name,
            entityKind,
            x: 40 + offset,
            y: 32 + offset,
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
            isMaximized: false,
          },
        ];
      });
      setFocusedId(entityId);
    },
    [],
  );

  const closeWindow = useCallback((entityId: string) => {
    setWindows((prev) => prev.filter((w) => w.entityId !== entityId));
  }, []);

  const updateWindow = useCallback((entityId: string, updates: Partial<EntityWindow>) => {
    setWindows((prev) => prev.map((w) => (w.entityId === entityId ? { ...w, ...updates } : w)));
  }, []);

  async function handleCreateEntity() {
    const created = await createEntity(worldId);
    if (!created) return;
    setEntityList((prev) => [...prev, created]);
    openWindow(created.id, created.name, created.entity_kind);
  }

  const filteredEntities = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entityList;
    return entityList.filter((e) => e.name.toLowerCase().includes(query));
  }, [entityList, search]);

  const groups = useMemo(() => {
    const byKind = new Map<string, EntitySummary[]>();
    for (const entity of filteredEntities) {
      const key = entity.entity_kind ?? UNSORTED_LABEL;
      const list = byKind.get(key) ?? [];
      list.push(entity);
      byKind.set(key, list);
    }
    return [...byKind.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredEntities]);

  return (
    <div className="flex flex-1 overflow-hidden font-sans">
      <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-black/10">
        <div className="flex items-center justify-between px-4 pt-6">
          <h1 className="truncate font-display text-lg font-semibold text-foreground">
            {worldName}
          </h1>
          <Link href="/" className="shrink-0 text-xs text-muted hover:text-foreground">
            ← Mondes
          </Link>
        </div>

        <div className="px-4 py-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="input-field w-full text-sm"
          />
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-3">
          {groups.map(([kind, group]) => (
            <div key={kind} className="flex flex-col gap-1">
              <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                {kind}
              </span>
              {group.map((entity) => (
                <button
                  key={entity.id}
                  onClick={() => openWindow(entity.id, entity.name, entity.entity_kind)}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-surface-hover"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: entityKindColor(entity.entity_kind) }}
                  />
                  <span className="truncate">{entity.name}</span>
                </button>
              ))}
            </div>
          ))}
          {filteredEntities.length === 0 && (
            <p className="px-1 text-sm text-muted">Aucune entité.</p>
          )}
        </div>

        <div className="border-t border-border p-4">
          <button onClick={handleCreateEntity} className="btn-accent w-full text-center text-sm">
            + Nouvelle fiche
          </button>
        </div>
      </aside>

      <div ref={desktopRef} className="relative flex-1 overflow-hidden">
        {windows.map((win) => (
          <WindowFrame
            key={win.entityId}
            win={win}
            isFocused={focusedId === win.entityId}
            containerRef={desktopRef}
            title={win.name}
            subtitle={win.entityKind}
            onFocus={() => setFocusedId(win.entityId)}
            onClose={() => closeWindow(win.entityId)}
            onUpdate={(updates) => updateWindow(win.entityId, updates)}
          >
            <EntityDetail
              worldId={worldId}
              entityId={win.entityId}
              onOpenEntity={openWindow}
              onLoaded={(updated) => {
                updateWindow(win.entityId, { name: updated.name, entityKind: updated.entity_kind });
                setEntityList((prev) =>
                  prev.map((e) =>
                    e.id === win.entityId
                      ? { ...e, name: updated.name, entity_kind: updated.entity_kind }
                      : e,
                  ),
                );
              }}
              onDeleted={() => {
                closeWindow(win.entityId);
                setEntityList((prev) => prev.filter((e) => e.id !== win.entityId));
                router.refresh();
              }}
            />
          </WindowFrame>
        ))}
      </div>
    </div>
  );
}

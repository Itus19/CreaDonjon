"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import WindowFrame, { type WindowGeometry } from "./WindowFrame";
import EntityDetail from "./EntityDetail";
import { entityKindColor } from "@/lib/entityKindColors";

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
  const [windows, setWindows] = useState<EntityWindow[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const desktopRef = useRef<HTMLDivElement>(null);

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

  const groups = useMemo(() => {
    const byKind = new Map<string, EntitySummary[]>();
    for (const entity of entities) {
      const key = entity.entity_kind ?? UNSORTED_LABEL;
      const list = byKind.get(key) ?? [];
      list.push(entity);
      byKind.set(key, list);
    }
    return [...byKind.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [entities]);

  return (
    <div className="flex flex-1 overflow-hidden font-sans">
      <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-black/10 px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="truncate font-display text-lg font-semibold text-foreground">
            {worldName}
          </h1>
          <Link href="/" className="shrink-0 text-xs text-muted hover:text-foreground">
            ← Mondes
          </Link>
        </div>

        <Link href={`/worlds/${worldId}/entities/new`} className="btn-accent text-center text-sm">
          Créer une entité
        </Link>

        <div className="flex flex-col gap-4">
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
          {entities.length === 0 && (
            <p className="px-1 text-sm text-muted">Aucune entité pour l&apos;instant.</p>
          )}
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
            <EntityDetail worldId={worldId} entityId={win.entityId} onOpenEntity={openWindow} />
          </WindowFrame>
        ))}
      </div>
    </div>
  );
}

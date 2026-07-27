"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import WindowFrame, { type WindowGeometry } from "./WindowFrame";
import EntityDetail from "./EntityDetail";

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

  return (
    <div ref={desktopRef} className="relative flex-1 overflow-hidden font-sans">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-8 py-16">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">{worldName}</h1>
          <Link href="/" className="text-sm text-muted hover:text-foreground">
            ← Mes mondes
          </Link>
        </div>

        <Link href={`/worlds/${worldId}/entities/new`} className="btn-accent self-start">
          Créer une entité
        </Link>

        <ul className="flex flex-col gap-2">
          {entities.map((entity) => (
            <li key={entity.id}>
              <button
                onClick={() => openWindow(entity.id, entity.name, entity.entity_kind)}
                className="card block w-full text-left transition-colors hover:bg-surface-hover"
              >
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{entity.name}</p>
                  {entity.entity_kind && <span className="chip">{entity.entity_kind}</span>}
                </div>
                {entity.summary && <p className="text-sm text-muted">{entity.summary}</p>}
              </button>
            </li>
          ))}
          {entities.length === 0 && (
            <p className="text-muted">Aucune entité pour l&apos;instant.</p>
          )}
        </ul>
      </div>

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
  );
}

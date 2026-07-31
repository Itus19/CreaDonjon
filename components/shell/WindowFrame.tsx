"use client";

import { useCallback, useRef } from "react";

export interface WindowGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

const SNAP_THRESHOLD = 28;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 240;

/**
 * Fenetre deplacable/redimensionnable d'une fiche (ADR-0006), reprise de
 * l'ancienne application (`master`, components/desktop/WindowFrame.tsx)
 * et adaptee aux jetons de tokens.css. Position/taille sont un etat
 * purement client (`onUpdate`) — jamais dans l'URL, pour ne pas polluer
 * l'historique de navigation a chaque glissement.
 */
export default function WindowFrame({
  win,
  isFocused,
  containerRef,
  title,
  subtitle,
  onFocus,
  onClose,
  onUpdate,
  children,
}: {
  win: WindowGeometry;
  isFocused: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  title: string;
  subtitle?: string | null;
  onFocus: () => void;
  onClose: () => void;
  onUpdate: (updates: Partial<WindowGeometry>) => void;
  children: React.ReactNode;
}) {
  const dragStart = useRef({ mx: 0, my: 0, wx: 0, wy: 0 });
  const resizeStart = useRef({ mx: 0, my: 0, ww: 0, wh: 0 });

  const toggleMaximize = useCallback(() => {
    onUpdate({ isMaximized: !win.isMaximized });
  }, [win.isMaximized, onUpdate]);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (win.isMaximized) return;
      if ((e.target as HTMLElement).closest("button")) return;
      e.preventDefault();
      dragStart.current = { mx: e.clientX, my: e.clientY, wx: win.x, wy: win.y };
      onFocus();

      const onMove = (ev: MouseEvent) => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const mouseX = ev.clientX - rect.left;

        // Aimante sur la moitie gauche/droite pres d'un bord du conteneur,
        // comme Aero Snap / le carrelage de fenetres macOS.
        if (mouseX <= SNAP_THRESHOLD) {
          onUpdate({ x: 0, y: 0, width: rect.width / 2, height: rect.height, isMaximized: false });
          return;
        }
        if (mouseX >= rect.width - SNAP_THRESHOLD) {
          onUpdate({
            x: rect.width / 2,
            y: 0,
            width: rect.width / 2,
            height: rect.height,
            isMaximized: false,
          });
          return;
        }

        const dx = ev.clientX - dragStart.current.mx;
        const dy = ev.clientY - dragStart.current.my;
        const newX = Math.max(0, Math.min(dragStart.current.wx + dx, rect.width - 80));
        const newY = Math.max(0, Math.min(dragStart.current.wy + dy, rect.height - 40));
        onUpdate({ x: newX, y: newY });
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [win.x, win.y, win.isMaximized, onFocus, onUpdate, containerRef]
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      if (win.isMaximized) return;
      e.preventDefault();
      e.stopPropagation();
      resizeStart.current = { mx: e.clientX, my: e.clientY, ww: win.width, wh: win.height };
      onFocus();

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - resizeStart.current.mx;
        const dy = ev.clientY - resizeStart.current.my;
        onUpdate({
          width: Math.max(MIN_WIDTH, resizeStart.current.ww + dx),
          height: Math.max(MIN_HEIGHT, resizeStart.current.wh + dy),
        });
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [win.width, win.height, win.isMaximized, onFocus, onUpdate]
  );

  return (
    <div
      className={`absolute flex flex-col overflow-hidden rounded-2xl border bg-panel shadow-2xl backdrop-blur-[var(--blur)] transition-[border-color] ${
        isFocused ? "border-accent/40" : "border-edge"
      }`}
      style={
        win.isMaximized
          ? { left: 0, top: 0, width: "100%", height: "100%", zIndex: isFocused ? 30 : 20 }
          : {
              left: win.x,
              top: win.y,
              width: win.width,
              height: win.height,
              zIndex: isFocused ? 30 : 20,
            }
      }
      onMouseDown={onFocus}
    >
      <div
        className="flex h-[38px] shrink-0 cursor-move items-center justify-between gap-2 border-b border-edge bg-panel-sunken px-3"
        onMouseDown={handleDragStart}
        onDoubleClick={toggleMaximize}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-chrome text-sm font-medium text-ink">{title}</span>
          {subtitle && (
            <span className="shrink-0 rounded-full border border-edge bg-panel-raised px-2 py-0.5 text-[10px] text-ink-muted">
              {subtitle}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={toggleMaximize}
            title="Agrandir / Restaurer"
            className="h-[11px] w-[11px] rounded-full bg-accent/75 transition-all hover:scale-110 hover:bg-accent"
          />
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            title="Fermer"
            className="h-[11px] w-[11px] rounded-full bg-danger/75 transition-all hover:scale-110 hover:bg-danger"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">{children}</div>

      {!win.isMaximized && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
        />
      )}
    </div>
  );
}

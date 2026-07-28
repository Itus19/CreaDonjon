"use client";

import { useCallback, useRef } from "react";

export type WindowGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
};

const SNAP_THRESHOLD = 28;

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

        // Snap to left/right half when dragged near a container edge,
        // like Windows Aero Snap / macOS window tiling.
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
    [win.x, win.y, win.isMaximized, onFocus, onUpdate, containerRef],
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
          width: Math.max(320, resizeStart.current.ww + dx),
          height: Math.max(240, resizeStart.current.wh + dy),
        });
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [win.width, win.height, win.isMaximized, onFocus, onUpdate],
  );

  return (
    <div
      className={`absolute flex flex-col overflow-hidden rounded-2xl border bg-surface-glass backdrop-blur-2xl backdrop-saturate-150 shadow-2xl shadow-black/50 transition-[border-color] ${
        isFocused ? "border-accent/40" : "border-border"
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
        className="flex h-[38px] shrink-0 cursor-move items-center justify-between gap-2 border-b border-border bg-black/10 px-3"
        onMouseDown={handleDragStart}
        onDoubleClick={toggleMaximize}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-display text-sm font-medium text-foreground">{title}</span>
          {subtitle && <span className="chip shrink-0">{subtitle}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={toggleMaximize}
            title="Agrandir / Restaurer"
            className="h-[11px] w-[11px] rounded-full bg-accent/75 transition-all hover:scale-110 hover:bg-accent"
          />
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            title="Fermer"
            className="h-[11px] w-[11px] rounded-full bg-danger/75 transition-all hover:scale-110 hover:bg-danger"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">{children}</div>

      {!win.isMaximized && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
        />
      )}
    </div>
  );
}

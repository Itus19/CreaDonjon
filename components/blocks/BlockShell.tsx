"use client";

import { useState } from "react";
import VisibilityBadge from "@/components/entities/VisibilityBadge";

/**
 * Cadre commun d'un bloc : titre, visibilite, repli (specs/coquille-et-
 * design.md §5). Un composant, jamais un par type de bloc — les vrais
 * types de blocs (description, character, ...) arrivent en V0-04 ; ce
 * ticket construit le contenant.
 */
export default function BlockShell({
  title,
  visibilityLevel,
  defaultCollapsed = false,
  children,
}: {
  title: string;
  visibilityLevel?: string;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section className="group rounded-lg border border-edge bg-panel-sunken">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
        aria-expanded={!collapsed}
      >
        <span className="flex items-center gap-2">
          <span className="font-chrome text-sm font-semibold text-ink">{title}</span>
          {visibilityLevel && <VisibilityBadge level={visibilityLevel} />}
        </span>
        <span className="text-ink-muted transition-transform" aria-hidden="true">
          {collapsed ? "▸" : "▾"}
        </span>
      </button>
      {!collapsed && <div className="border-t border-edge px-4 py-3">{children}</div>}
    </section>
  );
}

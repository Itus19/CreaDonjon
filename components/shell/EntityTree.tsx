"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { EntityTreeGroup, EntityTreeNode } from "@/src/core/entity-tree/build-tree";

const KIND_LABELS: Record<string, string> = {
  character: "Personnages",
  location: "Lieux",
  faction: "Factions",
  item: "Objets",
  creature: "Créatures",
  quest: "Quêtes",
  event: "Événements",
  other: "Autre",
};

function NodeRow({
  node,
  worldSlug,
  depth,
  currentSlug,
}: {
  node: EntityTreeNode;
  worldSlug: string;
  depth: number;
  currentSlug: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isActive = node.slug === currentSlug;

  return (
    <li>
      <div className="flex items-center" style={{ paddingLeft: `${depth * 14}px` }}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? "Replier" : "Déplier"}
            className="w-4 text-xs text-ink-muted"
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <Link
          href={`/m/${worldSlug}/f/${node.slug}`}
          className={`flex-1 truncate rounded px-2 py-1 text-sm transition-colors hover:bg-panel-raised ${
            isActive ? "bg-panel-raised text-accent" : "text-ink-soft"
          }`}
        >
          {node.name}
        </Link>
      </div>
      {hasChildren && expanded && (
        <ul>
          {node.children.map((child) => (
            <NodeRow key={child.id} node={child} worldSlug={worldSlug} depth={depth + 1} currentSlug={currentSlug} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function EntityTree({
  groups,
  worldSlug,
}: {
  groups: EntityTreeGroup[];
  worldSlug: string;
}) {
  const pathname = usePathname();
  const match = pathname.match(/\/f\/([^/]+)/);
  const currentSlug = match ? decodeURIComponent(match[1]) : null;

  if (groups.length === 0) {
    return <p className="px-2 text-sm text-ink-muted">Aucune entité pour l&apos;instant.</p>;
  }

  return (
    <nav aria-label="Entités du monde" className="flex flex-col gap-3">
      {groups.map((group) => (
        <div key={group.kind}>
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {KIND_LABELS[group.kind] ?? group.kind}
          </p>
          <ul>
            {group.items.map((node) => (
              <NodeRow key={node.id} node={node} worldSlug={worldSlug} depth={0} currentSlug={currentSlug} />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

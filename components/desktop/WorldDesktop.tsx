"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import WindowFrame, { type WindowGeometry } from "./WindowFrame";
import EntityDetail from "./EntityDetail";
import CompendiumEntryDetail from "./CompendiumEntryDetail";
import Dropdown from "./Dropdown";
import { entityKindColor } from "@/lib/entityKindColors";
import { createEntity } from "@/lib/actions/entities";
import { createClient } from "@/lib/supabase/client";
import { COMPENDIUM_CATEGORIES } from "@/lib/compendiumCategories";

type EntitySummary = {
  id: string;
  name: string;
  entity_kind: string | null;
  summary: string | null;
};

type Ruleset = {
  id: string;
  name: string;
};

type CompendiumEntrySummary = {
  id: string;
  name: string;
  entry_type: string;
};

type DesktopWindow = WindowGeometry & {
  id: string;
  name: string;
  subtitle: string | null;
  kind: "entity" | "compendium";
  entityId?: string;
  entryId?: string;
};

const DEFAULT_WIDTH = 460;
const DEFAULT_HEIGHT = 540;
const UNSORTED_LABEL = "Sans type";

export default function WorldDesktop({
  worldId,
  worldName,
  entities,
  rulesets,
  defaultRulesetId,
}: {
  worldId: string;
  worldName: string;
  entities: EntitySummary[];
  rulesets: Ruleset[];
  defaultRulesetId: string | null;
}) {
  const router = useRouter();
  const [entityList, setEntityList] = useState(entities);
  const [search, setSearch] = useState("");
  const [windows, setWindows] = useState<DesktopWindow[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const desktopRef = useRef<HTMLDivElement>(null);

  const [sidebarTab, setSidebarTab] = useState<"wiki" | "compendium">("wiki");
  const [rulesetId, setRulesetId] = useState(defaultRulesetId ?? rulesets[0]?.id ?? "");
  const [activeCategory, setActiveCategory] = useState(COMPENDIUM_CATEGORIES[0].id);
  const [compendiumEntries, setCompendiumEntries] = useState<CompendiumEntrySummary[]>([]);
  const [compendiumLoading, setCompendiumLoading] = useState(false);

  useEffect(() => {
    setEntityList(entities);
  }, [entities]);

  useEffect(() => {
    if (sidebarTab !== "compendium" || !rulesetId) return;
    const category = COMPENDIUM_CATEGORIES.find((c) => c.id === activeCategory);
    if (!category) return;

    let cancelled = false;
    setCompendiumLoading(true);
    const supabase = createClient();
    let query = supabase
      .from("ruleset_entries")
      .select("id, entry_type, human_readable")
      .eq("ruleset_id", rulesetId)
      .in("entry_type", category.entryTypes)
      .limit(500);
    const trimmedSearch = search.trim();
    if (trimmedSearch) {
      query = query.ilike("human_readable->>name", `%${trimmedSearch}%`);
    }
    query.then(({ data, error }) => {
      if (cancelled) return;
      if (error) console.error("compendium query error", error);
      const mapped = (data ?? [])
        .map((row) => ({
          id: row.id as string,
          name: (row.human_readable as { name?: string })?.name ?? "Sans nom",
          entry_type: row.entry_type as string,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setCompendiumEntries(mapped);
      setCompendiumLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [sidebarTab, rulesetId, activeCategory, search]);

  const openWindow = useCallback(
    (entityId: string, name: string, entityKind: string | null) => {
      setWindows((prev) => {
        if (prev.some((w) => w.id === entityId)) return prev;
        const offset = (prev.length % 6) * 28;
        return [
          ...prev,
          {
            id: entityId,
            kind: "entity",
            entityId,
            name,
            subtitle: entityKind,
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

  const openCompendiumWindow = useCallback((entryId: string, name: string, categoryLabel: string) => {
    setWindows((prev) => {
      if (prev.some((w) => w.id === entryId)) return prev;
      const offset = (prev.length % 6) * 28;
      return [
        ...prev,
        {
          id: entryId,
          kind: "compendium",
          entryId,
          name,
          subtitle: categoryLabel,
          x: 40 + offset,
          y: 32 + offset,
          width: DEFAULT_WIDTH,
          height: DEFAULT_HEIGHT,
          isMaximized: false,
        },
      ];
    });
    setFocusedId(entryId);
  }, []);

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const updateWindow = useCallback((id: string, updates: Partial<DesktopWindow>) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)));
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

  const activeCategoryData = COMPENDIUM_CATEGORIES.find((c) => c.id === activeCategory);

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

        <div className="flex gap-1 px-4 pt-4">
          <button
            onClick={() => setSidebarTab("wiki")}
            className={`flex-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              sidebarTab === "wiki"
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border text-muted hover:bg-surface-hover hover:text-foreground"
            }`}
          >
            Fiches
          </button>
          <button
            onClick={() => setSidebarTab("compendium")}
            className={`flex-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              sidebarTab === "compendium"
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border text-muted hover:bg-surface-hover hover:text-foreground"
            }`}
          >
            Règles
          </button>
        </div>

        <div className="px-4 py-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="input-field w-full text-sm"
          />
        </div>

        {sidebarTab === "compendium" && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-3">
            {COMPENDIUM_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`chip transition-colors ${
                  activeCategory === cat.id
                    ? "border-accent/60 bg-surface-hover"
                    : "hover:border-accent/40 hover:bg-surface-hover"
                }`}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: cat.color }} />
                {cat.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-3">
          {sidebarTab === "wiki" ? (
            <>
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
            </>
          ) : (
            <div className="flex flex-col gap-1">
              {compendiumEntries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() =>
                    openCompendiumWindow(entry.id, entry.name, activeCategoryData?.label ?? "")
                  }
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-surface-hover"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: activeCategoryData?.color }}
                  />
                  <span className="truncate">{entry.name}</span>
                </button>
              ))}
              {!compendiumLoading && compendiumEntries.length === 0 && (
                <p className="px-1 text-sm text-muted">Aucune entrée.</p>
              )}
              {compendiumLoading && <p className="px-1 text-sm text-muted">Chargement...</p>}
            </div>
          )}
        </div>

        <div className="border-t border-border p-4">
          {sidebarTab === "wiki" ? (
            <button onClick={handleCreateEntity} className="btn-accent w-full text-center text-sm">
              + Nouvelle fiche
            </button>
          ) : (
            <Dropdown
              key={rulesetId}
              defaultValue={rulesetId}
              onChange={setRulesetId}
              options={rulesets.map((r) => ({ value: r.id, label: r.name }))}
              className="input-field w-full text-center text-sm"
            />
          )}
        </div>
      </aside>

      <div ref={desktopRef} className="relative flex-1 overflow-hidden">
        {windows.map((win) => (
          <WindowFrame
            key={win.id}
            win={win}
            isFocused={focusedId === win.id}
            containerRef={desktopRef}
            title={win.name}
            subtitle={win.subtitle}
            onFocus={() => setFocusedId(win.id)}
            onClose={() => closeWindow(win.id)}
            onUpdate={(updates) => updateWindow(win.id, updates)}
          >
            {win.kind === "entity" ? (
              <EntityDetail
                worldId={worldId}
                entityId={win.entityId!}
                onOpenEntity={openWindow}
                onLoaded={(updated) => {
                  updateWindow(win.id, { name: updated.name, subtitle: updated.entity_kind });
                  setEntityList((prev) =>
                    prev.map((e) =>
                      e.id === win.entityId
                        ? { ...e, name: updated.name, entity_kind: updated.entity_kind }
                        : e,
                    ),
                  );
                }}
                onDeleted={() => {
                  closeWindow(win.id);
                  setEntityList((prev) => prev.filter((e) => e.id !== win.entityId));
                  router.refresh();
                }}
              />
            ) : (
              <CompendiumEntryDetail entryId={win.entryId!} />
            )}
          </WindowFrame>
        ))}
      </div>
    </div>
  );
}

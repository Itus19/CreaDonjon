"use client";

import { Fragment, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { categoryForEntryType } from "@/lib/compendiumCategories";

type Entry = {
  id: string;
  entry_type: string;
  human_readable: { name?: string; desc?: unknown };
  structured_data: Record<string, unknown>;
  ruleset: { name: string } | null;
};

const SKIP_KEYS = new Set(["index", "url", "desc", "name", "higher_level"]);

// human_readable.desc is inconsistent across the imported SRD data:
// sometimes an array of paragraphs, sometimes a single string, sometimes null.
function normalizeDesc(desc: unknown): string[] {
  if (Array.isArray(desc)) return desc.filter((p): p is string => typeof p === "string");
  if (typeof desc === "string" && desc.length > 0) return [desc];
  return [];
}

function formatValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value.map(formatValue).filter((v): v is string => v !== null);
    return parts.length ? parts.join(", ") : null;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.name === "string") return obj.name;
    return null;
  }
  return null;
}

export default function CompendiumEntryDetail({ entryId }: { entryId: string }) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("ruleset_entries")
      .select("id, entry_type, human_readable, structured_data, ruleset:ruleset_id(name)")
      .eq("id", entryId)
      .single()
      .then(({ data }) => {
        setEntry((data as unknown as Entry) ?? null);
        setLoading(false);
      });
  }, [entryId]);

  if (loading) {
    return <p className="p-6 text-muted">Chargement...</p>;
  }

  if (!entry) {
    return <p className="p-6 text-muted">Entrée introuvable.</p>;
  }

  const category = categoryForEntryType(entry.entry_type);
  const desc = normalizeDesc(entry.human_readable?.desc);
  const detailEntries = Object.entries(entry.structured_data ?? {})
    .filter(([key]) => !SKIP_KEYS.has(key))
    .map(([key, value]) => [key, formatValue(value)] as const)
    .filter((pair): pair is [string, string] => pair[1] !== null);

  return (
    <div className="flex flex-col gap-5 p-6">
      <h1 className="entity-title">{entry.human_readable?.name ?? "Sans nom"}</h1>

      <div className="flex flex-wrap items-center gap-1.5">
        {category && (
          <span className="chip">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: category.color }}
            />
            {category.label}
          </span>
        )}
        {entry.ruleset?.name && <span className="chip">{entry.ruleset.name}</span>}
      </div>

      {desc.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border pt-4 text-sm text-foreground/90">
          {desc.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      )}

      {detailEntries.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Détails :
          </span>
          <div className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
            {detailEntries.map(([key, value]) => (
              <Fragment key={key}>
                <span className="text-muted">{key.replace(/_/g, " ")}</span>
                <span className="text-foreground">{value}</span>
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";

export interface ResolvedChipView {
  kind: "rule" | "entity";
  key: string;
  name: string;
  summary: string | null;
  href: string;
  found: boolean;
}

function refIdentity(ref: BlockReference): string {
  return ref.kind === "rule" ? `rule:${ref.key}` : `entity:${ref.id}`;
}

/**
 * Resout un lot de references en fiches d'affichage (V1-B2, specs/wiki-blocs.md
 * §4.3) : "chaque reference porte son lien". Un seul appel groupe par rendu
 * plutot qu'un par reference — indexe par `refIdentity` pour un lookup direct
 * depuis les editeurs (`chips.get(refIdentity(ref))`).
 */
export function useReferenceChips(worldSlug: string, refs: BlockReference[]): Map<string, ResolvedChipView> {
  const [chips, setChips] = useState<Map<string, ResolvedChipView>>(new Map());
  const dedupeKey = refs.map(refIdentity).join(",");

  useEffect(() => {
    let cancelled = false;
    const request: Promise<{ chips: ResolvedChipView[] } | null> =
      refs.length === 0
        ? Promise.resolve({ chips: [] })
        : fetch(`/api/worlds/${worldSlug}/reference-chips`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refs }),
          }).then((res) => (res.ok ? res.json() : null));

    request
      .then((body) => {
        if (cancelled || !body) return;
        setChips(new Map(body.chips.map((c) => [`${c.kind}:${c.key}`, c])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldSlug, dedupeKey]);

  return chips;
}

export { refIdentity };

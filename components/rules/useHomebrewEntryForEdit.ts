"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { HomebrewEntryForEdit } from "@/src/server/services/rules";

/**
 * Relit une fiche maison pour rouvrir son formulaire (V3.1-2), une fois la
 * variante active connue. `entry` reste `null` hors modification ; `error`
 * dit pourquoi la fiche ne peut pas etre modifiee ici (fiche heritee d'un
 * autre niveau, ou supprimee entre-temps).
 */
export function useHomebrewEntryForEdit(rulesetId: string | null, entryKey: string | undefined) {
  const t = useTranslations("regles");
  const [entry, setEntry] = useState<HomebrewEntryForEdit | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rulesetId || !entryKey) return;
    let cancelled = false;
    fetch(`/api/rulesets/${rulesetId}/entries/${entryKey}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as (HomebrewEntryForEdit & { error?: string }) | null;
        if (cancelled) return;
        if (!res.ok || !body) {
          setError(body?.error ?? t("erreurLectureFiche"));
          return;
        }
        setEntry(body);
      })
      .catch(() => {
        if (!cancelled) setError(t("erreurLectureFiche"));
      });
    return () => {
      cancelled = true;
    };
  }, [rulesetId, entryKey, t]);

  return { entry, error };
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { subclassFeatureEntryKey } from "@/src/core/rules/subclass";
import { aDesBriques } from "@/lib/ui/briquesRegle";
import { rendreAptitudeJouable } from "@/lib/ui/regleApi";
import { clearWorldRuleEntriesCache } from "@/components/blocks/useWorldRuleEntries";
import { clearRuleEntryBlocksCache, useRuleEntryBlocks } from "@/components/blocks/useRuleEntryBlocks";

interface AptitudeLue {
  nom: string;
  niveau: number;
  description: string;
}

/** Les aptitudes du bloc `subclass_features`, lues sans confiance. */
function aptitudesDuBloc(data: unknown): AptitudeLue[] {
  const features = (data as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) return [];
  return features.flatMap((f) => {
    const { name, level, description } = (f ?? {}) as { name?: unknown; level?: unknown; description?: unknown };
    return typeof name === "string" && typeof level === "number" ? [{ nom: name, niveau: level, description: typeof description === "string" ? description : "" }] : [];
  });
}

/**
 * V3.1-181 (esquisse, solution A) — Sur la page d'une sous-classe maison,
 * chaque aptitude dit si elle est jouable et porte son geste : « Rendre
 * jouable » crée sa fiche à briques (`<sous-classe>-<aptitude>`, celle que lit
 * le moteur) puis ouvre l'éditeur de briques ; « Modifier les briques » le
 * rouvre. L'état se lit dans les blocs des fiches d'aptitude, en une requête
 * (`useRuleEntryBlocks`, en cache) ; écrire ne part qu'au clic.
 */
export default function AptitudesJouables({ worldSlug, subclassKey, data }: { worldSlug: string; subclassKey: string; data: unknown }) {
  const t = useTranslations("regles.aptitudesJouables");
  const router = useRouter();
  const aptitudes = aptitudesDuBloc(data);
  const cles = aptitudes.map((a) => subclassFeatureEntryKey(subclassKey, a.nom));
  const blocs = useRuleEntryBlocks(worldSlug, cles);
  const [enCours, setEnCours] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  if (aptitudes.length === 0) return null;

  async function rendreJouable(index: number) {
    setEnCours(index);
    setErreur(null);
    const r = await rendreAptitudeJouable(worldSlug, subclassKey, index);
    setEnCours(null);
    if (!r.ok) {
      setErreur(r.message);
      return;
    }
    clearWorldRuleEntriesCache(worldSlug);
    clearRuleEntryBlocksCache(worldSlug);
    router.push(`/m/${worldSlug}/regles/${encodeURIComponent(r.valeur.entryKey)}?briques=1`);
  }

  return (
    <section aria-label={t("titre")} className="flex flex-col gap-2 border-b border-edge/60 py-4">
      <h3 className="block-title">{t("titre")}</h3>
      <p className="text-xs text-ink-muted">{t("aide")}</p>
      <ul className="flex flex-col gap-1.5">
        {aptitudes.map((a, i) => {
          const fiche = blocs[cles[i]];
          const jouable = fiche !== undefined && aDesBriques(fiche);
          return (
            <li key={`${a.niveau}-${a.nom}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-edge/60 px-3 py-2">
              <span className="w-12 shrink-0 text-xs font-bold text-accent">{t("niveau", { n: a.niveau })}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold text-ink">{a.nom}</span>
                {a.description && <span className="truncate text-xs text-ink-muted">{a.description}</span>}
              </span>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${jouable ? "border-success/60 text-success" : "border-edge text-ink-muted"}`}>
                {jouable ? t("jouable") : t("texteSeul")}
              </span>
              <button
                type="button"
                disabled={enCours !== null}
                onClick={() => void rendreJouable(i)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50 ${
                  jouable ? "border-edge text-ink hover:bg-panel-raised" : "border-accent text-accent hover:bg-accent/10"
                }`}
              >
                {enCours === i ? t("enCours") : jouable ? t("modifierBriques") : t("rendreJouable")}
              </button>
            </li>
          );
        })}
      </ul>
      {erreur && <p className="text-xs text-danger">{erreur}</p>}
    </section>
  );
}

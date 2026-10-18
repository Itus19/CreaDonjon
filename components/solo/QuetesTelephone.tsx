"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import FeuilleDuBas from "@/components/shared/FeuilleDuBas";
import Tabs from "@/components/shared/Tabs";
import { progressionQuete, trierQuetes, type FiltreQuetes } from "@/lib/ui/solo";
import type { QuestColumnEntry } from "@/lib/solo/types";

/**
 * V3.1-36 — La vue Quêtes du téléphone : une pilule En cours / Terminées sur les
 * quêtes déjà chargées par la page (`buildQuestColumn`, aucun appel de plus), et
 * une quête touchée s'ouvre en feuille du bas avec ses étapes. La page ne charge
 * que les quêtes actives : « Terminées » est celles dont toutes les étapes sont faites.
 */
export default function QuetesTelephone({ quests }: { quests: QuestColumnEntry[] }) {
  const t = useTranslations("solo");
  const [filtre, setFiltre] = useState<FiltreQuetes>("en_cours");
  const [ouverteId, setOuverteId] = useState<string | null>(null);

  const visibles = trierQuetes(quests, filtre);
  const ouverte = quests.find((q) => q.id === ouverteId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        aria-label={t("quetesFiltre")}
        value={filtre}
        onChange={setFiltre}
        items={[
          { value: "en_cours", label: t("quetesEnCours") },
          { value: "terminees", label: t("quetesTerminees") },
        ]}
      />

      {visibles.length === 0 ? (
        <p className="text-sm text-ink-muted">{filtre === "en_cours" ? t("quetesAucuneEnCours") : t("quetesAucuneTerminee")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibles.map((q) => (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => setOuverteId(q.id)}
                aria-haspopup="dialog"
                className="flex w-full flex-col gap-0.5 rounded-lg border border-edge bg-panel px-3 py-2 text-left transition-colors hover:bg-panel-raised"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{q.title}</span>
                  <span className="shrink-0 text-xs text-ink-muted">{progressionQuete(q)}</span>
                </span>
                {q.giverName && <span className="text-xs text-ink-muted">{t("queteDonneePar", { nom: q.giverName })}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {ouverte && (
        <FeuilleDuBas titre={ouverte.title} titreVisible onFermer={() => setOuverteId(null)}>
          <div className="flex flex-col gap-2 pb-2">
            {ouverte.giverName && <span className="text-xs text-ink-muted">{t("queteDonneePar", { nom: ouverte.giverName })}</span>}
            <ul className="flex flex-col gap-1">
              {ouverte.objectives.map((o) => (
                <li key={o.id} className={`text-sm ${o.done ? "text-ink-muted line-through" : "text-ink-soft"}`}>
                  {o.done ? "✓" : "○"} {o.text}
                </li>
              ))}
            </ul>
            {ouverte.rewardText && <span className="text-xs text-ink-muted">{t("queteRecompense", { texte: ouverte.rewardText })}</span>}
          </div>
        </FeuilleDuBas>
      )}
    </div>
  );
}

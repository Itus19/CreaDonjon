"use client";

import { useTranslations } from "next-intl";
import type { QuestState } from "@/src/core/schemas/blocks/quest";
import { anneau, progression, prochain, teinteEtat, type TeinteEtat } from "@/lib/ui/quete";

const TRAIT_ANNEAU: Record<TeinteEtat, string> = {
  accent: "stroke-accent",
  success: "stroke-success",
  danger: "stroke-danger",
  muted: "stroke-ink-muted",
};

/** Anneau de progression : les objectifs atteints sur le total, « 2 / 4 » au centre. */
export function AnneauQuete({ objectifs, etat }: { objectifs: readonly { done: boolean }[]; etat: QuestState }) {
  const t = useTranslations("fiche.quete");
  const p = progression(objectifs);
  const R = 16;
  const { circonference, trace } = anneau(p.fraction, R);
  return (
    <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center" role="img" aria-label={t("progressionLabel", { atteints: p.atteints, total: p.total })}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="20" cy="20" r={R} fill="none" strokeWidth={4} className="stroke-edge" />
        <circle
          cx="20"
          cy="20"
          r={R}
          fill="none"
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={`${trace} ${circonference}`}
          className={TRAIT_ANNEAU[p.complet ? "success" : teinteEtat(etat)]}
        />
      </svg>
      <span className="relative text-xs font-semibold tabular-nums text-ink">{t("progression", { atteints: p.atteints, total: p.total })}</span>
    </span>
  );
}

/**
 * La quête REPLIÉE, une seule ligne (V3.1-76) : l'anneau « 2 / 4 », l'état en
 * gras, « · confiée par » et la fiche du commanditaire (`commanditaire`, un
 * lien), dessous « Prochain : » et le premier objectif non atteint, ▾ à droite.
 * Toucher la ligne déplie — l'état replié/déplié est LOCAL, jamais enregistré.
 *
 * La ligne est cliquable : tout ce qui est posé dessus (le lien du
 * commanditaire) arrête la remontée du clic, sinon il déplierait aussi.
 */
export default function QuestLigne({
  etat,
  objectifs,
  commanditaire,
  ouvert,
  onBascule,
}: {
  etat: QuestState;
  objectifs: readonly { id: string; text: string; done: boolean }[];
  /** Le lien (ou le nom) du commanditaire, déjà rendu ; `null` : pas de « confiée par ». */
  commanditaire: React.ReactNode;
  ouvert: boolean;
  onBascule: () => void;
}) {
  const t = useTranslations("fiche.quete");
  const suivant = prochain(objectifs);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={ouvert}
      aria-label={ouvert ? t("replier") : t("deplier")}
      onClick={onBascule}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onBascule();
        }
      }}
      className="flex cursor-pointer items-center gap-3 rounded-xl border border-edge bg-panel-sunken px-3 py-2 transition-colors hover:bg-panel-raised"
    >
      <AnneauQuete objectifs={objectifs} etat={etat} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm text-ink-soft">
          <b className="font-semibold text-ink">{t(`etats.${etat}`)}</b>
          {commanditaire && (
            <>
              {" "}
              · {t("confieePar")} <span onClick={(e) => e.stopPropagation()}>{commanditaire}</span>
            </>
          )}
        </span>
        <span className="truncate text-xs text-ink-muted">
          {suivant.cle === "suivant" ? t("prochain", { texte: suivant.texte || t("objectifSansTexte") }) : suivant.cle === "tous" ? t("tousAtteints") : t("aucunObjectif")}
        </span>
      </span>
      <span aria-hidden className="shrink-0 text-ink-muted">
        {ouvert ? "▴" : "▾"}
      </span>
    </div>
  );
}

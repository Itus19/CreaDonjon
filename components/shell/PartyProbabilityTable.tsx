"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ABILITY_LABELS } from "@/src/core/rules/abilities";
import { bestIndices, PROBABILITY_DC_MAX, PROBABILITY_DC_MIN, PROBABILITY_DC_PRESETS, successProbability, type CheckLine } from "@/src/core/rules/probability";
import { SKILL_LABELS_FR } from "@/src/i18n/fr";
import type { Skill } from "@/src/core/rules/abilities";
import type { PartyMemberProbabilities } from "@/src/server/services/partyProbabilities";
import { couleursCase } from "@/lib/ui/teinteProbabilite";
import { ABREVIATION_CARAC, bornerDd, nomsCourts, signe } from "@/lib/ui/probabilites";
import Dropdown from "@/components/shared/Dropdown";

/** Quelques points de la barre de la légende : le même spectre que les cases. */
const POINTS_LEGENDE = [0, 0.25, 0.5, 0.75, 1] as const;

const NB_CARAC = 6;

function libelleJet(ligne: CheckLine): string {
  return ligne.kind === "ability" ? ABILITY_LABELS[ligne.ability] : SKILL_LABELS_FR[ligne.key as Skill];
}

function pourcent(p: number): number {
  return Math.round(p * 100);
}

/**
 * L'écran de la matrice des probabilités (V3.1-46), partagé par la page
 * `/mj/probabilites` et la fenêtre d'outil MJ : tout arrive en props (aucun
 * chargement, docs/CABLAGE.md C1). Le DD et la case touchée sont des états
 * locaux ; la probabilité se calcule à l'affichage avec `successProbability`
 * (rien n'est stocké, règle 16). Le sélecteur de campagne n'existe que sur la
 * page : la fenêtre n'a qu'une campagne.
 */
export default function PartyProbabilityTable({
  party,
  hasCampaign,
  campaigns,
  selectedCampaignId,
  worldSlug,
}: {
  party: PartyMemberProbabilities[];
  hasCampaign: boolean;
  campaigns?: { id: string; name: string }[];
  selectedCampaignId?: string;
  worldSlug?: string;
}) {
  const t = useTranslations("probabilites");
  const router = useRouter();
  const [dd, setDd] = useState(15);
  const [choix, setChoix] = useState<{ membre: number; ligne: number } | null>(null);

  const en_tete = (
    <div>
      <h1 className="block-title text-base">{t("titre")}</h1>
      <p className="text-xs text-ink-muted">{t("intro")}</p>
    </div>
  );

  if (!hasCampaign) {
    return (
      <div className="flex flex-col gap-4">
        {en_tete}
        <p className="text-sm italic text-ink-muted">{t("aucuneCampagne")}</p>
      </div>
    );
  }

  const sansSelecteur = !campaigns || campaigns.length < 2 || !worldSlug;
  const lignes = party[0]?.lines ?? [];
  const probas = party.map((m) => m.lines.map((l) => successProbability(l.mod, dd, l.rollState)));
  // Courts mais distincts (« PJ Testeuse A » et « PJ Testeur B » ne deviennent pas deux « PJ »).
  const noms = nomsCourts(party.map((m) => m.characterName), false);
  const nomsTelephone = nomsCourts(party.map((m) => m.characterName), true);

  const detail = (() => {
    if (!choix) return null;
    const membre = party[choix.membre];
    const ligne = membre?.lines[choix.ligne];
    const p = probas[choix.membre]?.[choix.ligne];
    if (!membre || !ligne || p === undefined) return null;
    return { membre, ligne, p, nom: noms[choix.membre] ?? membre.characterName };
  })();

  function changerDd(valeur: number) {
    setDd(bornerDd(valeur));
  }

  function ligneTableau(index: number, ligne: CheckLine) {
    const valeurs = party.map((_, m) => probas[m]?.[index] ?? 0);
    const meilleurs = bestIndices(valeurs);
    return (
      <tr key={`${ligne.kind}-${ligne.key}`} className="border-t border-edge/40">
        <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-panel px-2 py-1 text-left text-xs font-normal text-ink">
          {libelleJet(ligne)}
        </th>
        <td className="hidden px-2 py-1 text-center text-xs text-ink-muted md:table-cell">{ABREVIATION_CARAC[ligne.ability]}</td>
        {party.map((membre, m) => {
          const p = valeurs[m] ?? 0;
          const etat = membre.lines[index]?.rollState ?? "normal";
          const { fond, chiffre } = couleursCase(p);
          const touche = choix?.membre === m && choix.ligne === index;
          const meilleur = meilleurs.includes(m);
          return (
            <td key={membre.entityId} className="p-0.5">
              <button
                type="button"
                aria-pressed={touche}
                aria-label={`${membre.characterName}, ${libelleJet(ligne)}, ${pourcent(p)} %${etat === "advantage" ? `, ${t("avantage")}` : etat === "disadvantage" ? `, ${t("desavantage")}` : ""}`}
                onClick={() => setChoix(touche ? null : { membre: m, ligne: index })}
                style={{ backgroundColor: fond, color: chiffre }}
                className={`block w-full rounded-md px-1.5 py-1 text-center text-xs font-medium tabular-nums transition-shadow ${
                  meilleur ? "ring-2 ring-inset ring-accent" : ""
                } ${touche ? "outline outline-2 -outline-offset-2 outline-ink" : ""}`}
              >
                {pourcent(p)} %{etat === "advantage" ? " ▲" : etat === "disadvantage" ? " ▼" : ""}
              </button>
            </td>
          );
        })}
      </tr>
    );
  }

  function intertitre(texte: string) {
    return (
      <tr key={`titre-${texte}`}>
        <th
          scope="colgroup"
          colSpan={party.length + 2}
          className="sticky left-0 bg-panel-sunken px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
        >
          {texte}
        </th>
      </tr>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {en_tete}

      <div className="flex flex-wrap items-center gap-2 border-b border-edge/60 pb-3">
        {!sansSelecteur && (
          <Dropdown
            aria-label={t("campagne")}
            value={selectedCampaignId ?? campaigns[0]?.id ?? ""}
            options={campaigns.map((c) => ({ value: c.id, label: c.name }))}
            onChange={(id) => router.push(`/m/${worldSlug}/mj/probabilites?campagne=${id}`)}
          />
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t("ddMoins")}
            disabled={dd <= PROBABILITY_DC_MIN}
            onClick={() => changerDd(dd - 1)}
            className="rounded-md border border-edge px-2.5 py-1 text-sm text-ink transition-colors hover:bg-panel-raised disabled:opacity-40"
          >
            −
          </button>
          <span className="min-w-14 text-center text-sm font-medium tabular-nums text-ink" aria-live="polite">
            {t("ddPuce", { dd })}
          </span>
          <button
            type="button"
            aria-label={t("ddPlus")}
            disabled={dd >= PROBABILITY_DC_MAX}
            onClick={() => changerDd(dd + 1)}
            className="rounded-md border border-edge px-2.5 py-1 text-sm text-ink transition-colors hover:bg-panel-raised disabled:opacity-40"
          >
            +
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {PROBABILITY_DC_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={dd === preset}
              onClick={() => changerDd(preset)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                dd === preset ? "border-accent text-accent" : "border-edge text-ink-soft hover:bg-panel-raised"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {party.length === 0 ? (
        <p className="text-sm italic text-ink-muted">{t("aucunPj")}</p>
      ) : (
        <>
          <div className="min-h-16 rounded-md border border-edge/60 bg-panel px-3 py-2" aria-live="polite">
            {detail ? (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-ink">
                  {t("detailTitre", {
                    pj: detail.nom,
                    jet: libelleJet(detail.ligne),
                    dd,
                    pct: pourcent(detail.p),
                  })}
                </p>
                <p className="text-xs text-ink-soft">{detail.ligne.sources.map((s) => `${s.label} ${signe(s.value)}`).join(", ")}</p>
                <p className="text-xs text-ink-muted">
                  {detail.ligne.rollState === "advantage"
                    ? `▲ ${t("avantage")}`
                    : detail.ligne.rollState === "disadvantage"
                      ? `▼ ${t("desavantage")}`
                      : t("jetNormal")}
                </p>
              </div>
            ) : (
              <p className="text-xs italic text-ink-muted">{t("detailInvite")}</p>
            )}
          </div>

          <div className="overflow-x-auto rounded-md border border-edge/60">
            <table className="w-full border-collapse text-xs" aria-label={t("grille")}>
              <thead>
                <tr className="text-ink-muted">
                  <th scope="col" className="sticky left-0 z-10 bg-panel px-2 py-1 text-left text-xs font-normal">
                    {t("jet")}
                  </th>
                  <th scope="col" className="hidden px-2 py-1 md:table-cell">
                    <span className="sr-only">{t("caracteristique")}</span>
                  </th>
                  {party.map((membre, m) => (
                    <th key={membre.entityId} scope="col" className="px-1 py-1 text-center text-xs font-medium text-ink" title={membre.characterName}>
                      <span className="hidden md:inline">{noms[m]}</span>
                      <span className="md:hidden">{nomsTelephone[m]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {intertitre(t("caracteristiques"))}
                {lignes.slice(0, NB_CARAC).map((ligne, i) => ligneTableau(i, ligne))}
                {intertitre(t("competences"))}
                {lignes.slice(NB_CARAC).map((ligne, i) => ligneTableau(i + NB_CARAC, ligne))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 text-xs text-ink-muted">
            <div className="flex items-center gap-2">
              <span>{t("legendeZero")}</span>
              <div
                role="img"
                aria-label={t("legendeDegrade")}
                className="h-3 w-40 rounded-full border border-edge/60"
                style={{ backgroundImage: `linear-gradient(to right, ${POINTS_LEGENDE.map((p) => couleursCase(p).fond).join(", ")})` }}
              />
              <span>{t("legendeCent")}</span>
            </div>
            <p>
              ▼ {t("legendeDesavantage")}, ▲ {t("legendeAvantage")} ({t("legendeFiche")}) · {t("legendeCadre")}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

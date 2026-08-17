"use client";

import { useState } from "react";
import { SKILL_LABELS_FR } from "@/src/i18n/fr";
import { DEFAULT_PROBABILITY_DCS, type SkillProbabilityRow } from "@/src/core/rules/probability";

interface PartyMemberProbabilities {
  entityId: string;
  characterName: string;
  rows: SkillProbabilityRow[];
}

const ROLL_STATE_LABELS: Record<string, string> = { advantage: "avantage", disadvantage: "désavantage" };

function formatPercent(p: number): string {
  return `${Math.round(p * 100)}%`;
}

/**
 * Tableau MJ des probabilites de reussite (V1-E5, specs/arbitrage-modifications.md
 * §3.6) : "un tableau PJ × competence, colonnes DD 10/15/20" — choix
 * explicite de l'utilisateur (pas la fiche d'un seul personnage) de regrouper
 * tous les PJ d'une campagne sur une seule vue MJ, un bloc par PJ. Jamais
 * charge en avance : un bouton, comme le reste de `CampaignDetail`.
 */
export default function PartyProbabilityTable({ campaignId }: { campaignId: string }) {
  const [party, setParty] = useState<PartyMemberProbabilities[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/probabilities`);
    setLoading(false);
    if (!res.ok) {
      setError("Impossible de calculer les probabilités.");
      return;
    }
    const body = (await res.json()) as { party: PartyMemberProbabilities[] };
    setParty(body.party);
  }

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-edge/60 pt-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">
          Probabilités de réussite
        </span>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
        >
          {loading ? "Calcul…" : party ? "Actualiser" : "Afficher"}
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {party && party.length === 0 && (
        <p className="text-xs italic text-ink-muted">Aucun PJ avec une fiche exploitable dans cette campagne.</p>
      )}
      {party && party.length > 0 && (
        <div className="flex flex-col gap-4">
          {party.map((member) => (
            <div key={member.entityId} className="overflow-x-auto rounded-md border border-edge/60">
              <table className="w-full text-xs">
                <caption className="caption-top border-b border-edge/60 bg-panel-sunken px-2 py-1 text-left text-sm font-medium text-ink">
                  {member.characterName}
                </caption>
                <thead>
                  <tr className="text-ink-muted">
                    <th className="px-2 py-1 text-left font-normal">Compétence</th>
                    <th className="px-2 py-1 text-right font-normal">Mod.</th>
                    {DEFAULT_PROBABILITY_DCS.map((dc) => (
                      <th key={dc} className="px-2 py-1 text-right font-normal">
                        DD {dc}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {member.rows.map((row) => (
                    <tr key={row.skill} className="border-t border-edge/40">
                      <td className="px-2 py-1 text-ink">
                        {SKILL_LABELS_FR[row.skill]}
                        {row.rollState !== "normal" && (
                          <span className="ml-1 text-[10px] text-ink-muted">({ROLL_STATE_LABELS[row.rollState]})</span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right text-ink-muted">
                        {row.mod >= 0 ? `+${row.mod}` : row.mod}
                      </td>
                      {DEFAULT_PROBABILITY_DCS.map((dc) => (
                        <td key={dc} className="px-2 py-1 text-right text-ink">
                          {formatPercent(row.probabilities[dc])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

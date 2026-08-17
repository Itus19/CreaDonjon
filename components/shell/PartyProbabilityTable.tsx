import { SKILL_LABELS_FR } from "@/src/i18n/fr";
import { DEFAULT_PROBABILITY_DCS } from "@/src/core/rules/probability";
import type { PartyMemberProbabilities } from "@/src/server/services/partyProbabilities";

const ROLL_STATE_LABELS: Record<string, string> = { advantage: "avantage", disadvantage: "désavantage" };

function formatPercent(p: number): string {
  return `${Math.round(p * 100)}%`;
}

/**
 * Tableau MJ des probabilites de reussite (V1-E5, specs/arbitrage-modifications.md
 * §3.6) : "un tableau PJ × competence, colonnes DD 10/15/20" — choix
 * explicite de l'utilisateur de regrouper tous les PJ d'une campagne sur une
 * seule vue, un bloc par PJ. Purement presentatif : les donnees arrivent
 * deja calculees du composant serveur qui l'appelle (page dediee de
 * l'onglet MJ), pas de fetch cote client ici.
 */
export default function PartyProbabilityTable({ party }: { party: PartyMemberProbabilities[] }) {
  if (party.length === 0) {
    return <p className="text-sm italic text-ink-muted">Aucun PJ avec une fiche exploitable dans cette campagne.</p>;
  }

  return (
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
                  <td className="px-2 py-1 text-right text-ink-muted">{row.mod >= 0 ? `+${row.mod}` : row.mod}</td>
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
  );
}

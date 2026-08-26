"use client";

import { averageHitDie, type HpGainChoice } from "@/src/core/rules/sheet";

/** Un ou plusieurs niveaux de PV a traiter pour une classe (V2-G1) — resolu en amont par `LevelUpWizard` a partir du delta de niveau, jamais devine ici. */
export interface HpGrant {
  classKey: string;
  className: string;
  dieFaces: number;
  /** Niveaux de CETTE classe nouvellement gagnes, dans l'ordre (ex. [5, 6] pour un guerrier qui passe de 4 a 6). */
  levels: number[];
}

/**
 * Etape "Points de vie" (V2-G1) : un choix moyenne/jet par niveau
 * nouvellement gagne, jamais un choix global — deux classes ou deux niveaux
 * d'une meme classe peuvent avoir des des differents ou des choix
 * differents. Le jet reel n'a lieu qu'a la confirmation finale, cote
 * serveur (CLAUDE.md regle 6) : ce qui se choisit ici est une INTENTION,
 * jamais une valeur. L'apercu de PV max affiche donc une estimation tant
 * qu'au moins un "Jeter" est selectionne.
 */
export default function HpRollStep({
  grants,
  choiceAt,
  onChoose,
}: {
  grants: HpGrant[];
  choiceAt: (classKey: string, index: number) => HpGainChoice;
  onChoose: (classKey: string, index: number, choice: HpGainChoice) => void;
}) {
  const hasPendingRoll = grants.some((grant) => grant.levels.some((_, i) => choiceAt(grant.classKey, i) === "rolled"));

  return (
    <div className="flex flex-col gap-5">
      {grants.map((grant) => (
        <div key={grant.classKey} className="flex flex-col gap-2 rounded-md border border-edge/60 p-3">
          <p className="text-sm font-medium text-ink">
            Points de vie — {grant.className} (d{grant.dieFaces})
          </p>
          <div className="flex flex-col gap-1.5">
            {grant.levels.map((level, i) => {
              const choice = choiceAt(grant.classKey, i);
              return (
                <div key={level} className="flex items-center gap-2 text-xs">
                  <span className="w-20 shrink-0 text-ink-muted">Niveau {level}</span>
                  <button
                    type="button"
                    onClick={() => onChoose(grant.classKey, i, "average")}
                    className={`rounded-full border px-2.5 py-1 transition-colors ${
                      choice === "average" ? "border-accent text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
                    }`}
                  >
                    Moyenne ({averageHitDie(grant.dieFaces)})
                  </button>
                  <button
                    type="button"
                    onClick={() => onChoose(grant.classKey, i, "rolled")}
                    className={`rounded-full border px-2.5 py-1 transition-colors ${
                      choice === "rolled" ? "border-accent text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
                    }`}
                  >
                    Jeter (1d{grant.dieFaces})
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {hasPendingRoll && (
        <p className="text-xs text-ink-muted">
          Le maximum de PV affiché à l&apos;aperçu est une estimation (à la moyenne) — le jet réel n&apos;a lieu qu&apos;à la confirmation.
        </p>
      )}
    </div>
  );
}

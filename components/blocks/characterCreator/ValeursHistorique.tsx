"use client";

import { useTranslations } from "next-intl";
import type { Ability } from "@/src/core/rules/sheet";
import { ABILITY_LABELS as ABILITY_NAMES } from "@/src/core/rules/sheet";

type Increases = Partial<Record<Ability, number>>;

const signe = (n: number) => `${n >= 0 ? "+" : ""}${n}`;

/**
 * V3.1-50 — Les valeurs de caractéristique de l'historique : des jetons
 * « +2 et +1 » ou « +1 à chacune ». On touche la caractéristique qui reçoit
 * +2, puis celle qui reçoit +1, et le total s'affiche. Même donnée qu'avant
 * (`character.choices["background.ability_bonus"]`, `increases`) : seules les
 * deux formes officielles se composent (`isValidBackgroundAbilityBonusChoice`).
 */
export default function ValeursHistorique({
  abilities,
  valeurs,
  increases,
  onChange,
}: {
  /** Les trois caractéristiques de cet historique. */
  abilities: readonly Ability[];
  /** Valeur et modificateur calculés par le moteur (la fiche), bonus d'historique compris : rien ne se recalcule ici. */
  valeurs: Readonly<Record<Ability, { score: number; mod: number }>>;
  increases: Increases;
  onChange: (increases: Increases) => void;
}) {
  const t = useTranslations("creation.historique.valeurs");
  const plusDeux = abilities.find((a) => increases[a] === 2);
  const plusUn = abilities.find((a) => increases[a] === 1 && a !== plusDeux);
  const chacune = abilities.length > 0 && abilities.every((a) => increases[a] === 1);
  const total = abilities.reduce((n, a) => n + (increases[a] ?? 0), 0);

  function choisirChacune() {
    onChange(Object.fromEntries(abilities.map((a) => [a, 1])) as Increases);
  }

  function choisirDeuxEtUn() {
    // On quitte « +1 à chacune » : on repart d'une page blanche.
    if (chacune) onChange({});
  }

  function toucher(a: Ability) {
    if (chacune) return;
    // Un second toucher retire ; sinon +2 d'abord, puis +1 ; une troisième caractéristique remplace le +1.
    if (a === plusDeux) {
      onChange(plusUn ? { [plusUn]: 1 } : {});
    } else if (a === plusUn) {
      onChange(plusDeux ? { [plusDeux]: 2 } : {});
    } else if (!plusDeux) {
      onChange({ ...(plusUn ? { [plusUn]: 1 } : {}), [a]: 2 });
    } else {
      onChange({ [plusDeux]: 2, [a]: 1 });
    }
  }

  const consigne = chacune ? t("chacuneFait") : !plusDeux ? t("toucherDeux") : !plusUn ? t("toucherUn") : t("fait");
  const detail = abilities
    .filter((a) => (increases[a] ?? 0) > 0)
    .map((a) => `${ABILITY_NAMES[a]} +${increases[a]}`)
    .join(", ");

  return (
    <div className="flex flex-col gap-2 rounded-md border border-edge/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">{t("titre")}</p>
        <span className={`text-sm font-semibold ${total === 3 ? "text-success" : "text-accent"}`}>{t("total", { total })}</span>
      </div>

      <div role="group" aria-label={t("formes")} className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={!chacune}
          onClick={choisirDeuxEtUn}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${!chacune ? "border-accent bg-accent/10 text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"}`}
        >
          {t("deuxEtUn")}
        </button>
        <button
          type="button"
          aria-pressed={chacune}
          onClick={choisirChacune}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${chacune ? "border-accent bg-accent/10 text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"}`}
        >
          {t("chacune")}
        </button>
      </div>

      <p className="text-xs text-ink-muted">{consigne}</p>

      <div className="grid grid-cols-3 gap-2">
        {abilities.map((a) => {
          const gain = increases[a] ?? 0;
          const { score, mod } = valeurs[a];
          return (
            <button
              key={a}
              type="button"
              aria-pressed={gain > 0}
              disabled={chacune}
              onClick={() => toucher(a)}
              className={`flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2.5 text-center transition-colors disabled:cursor-default ${
                gain > 0 ? "border-accent bg-accent/10" : "border-edge/60 bg-panel-raised hover:bg-panel"
              }`}
            >
              <span className="text-xs font-bold uppercase tracking-widest text-accent">{ABILITY_NAMES[a]}</span>
              <span className="text-xl font-bold text-ink">{score}</span>
              <span className="text-xs text-ink-muted">
                {signe(mod)}
                {gain > 0 && <span className="ml-1 font-semibold text-accent">+{gain}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {detail && <p className="text-xs text-ink-soft">{detail}</p>}
    </div>
  );
}

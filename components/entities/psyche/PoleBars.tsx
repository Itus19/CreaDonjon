"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { bandTierFor } from "@/src/core/psyche/bands";
import { poleBandLabel } from "@/src/core/psyche/poles";
import type { PoleDisplayFr } from "@/src/i18n/fr";

/**
 * V3.1-70 — les barres bipolaires du bloc Personnalité et du bloc Convictions
 * (pôle gauche, barre, pôle droit, mot de la bande). AUCUN nombre n'est écrit :
 * le mot de la bande dit où l'on en est ; la valeur exacte n'est qu'au survol,
 * et seulement pour le MJ (`valeurExacte`).
 *
 * Réglage manuel mais jamais silencieux : `onCommit` n'est appelé qu'au
 * relâchement, et le parent journalise l'écart par la route des souvenirs.
 * Une barre n'est JAMAIS désactivée pendant l'écriture : elle a le focus, la
 * désactiver provoquerait un blur, donc une sauvegarde de la carte en même
 * temps que la requête (conflit de version). Pendant l'écriture (`occupe`),
 * un nouveau geste est simplement ignoré.
 *
 * Mise en page par requêtes de conteneur (`@lg/barres`, la colonne des barres elle-même) : large, une ligne
 * (★, pôle, barre, pôle, mot) ; étroit, trois lignes (les deux pôles, la
 * barre, le mot).
 */
export default function PoleBars<K extends string>({
  keys,
  table,
  descriptions,
  poles,
  onCommit,
  onLiveChange,
  occupe,
  valeurExacte,
  prioritaires,
  onEtoile,
  comparaison,
  tensionSur,
}: {
  keys: readonly K[];
  table: Record<K, PoleDisplayFr>;
  descriptions: Record<string, string>;
  poles: { key: K; value: number }[];
  onCommit: (key: K, delta: number) => Promise<void> | void;
  /** Remonte la position en cours de glissement (radar en direct) ; `null` efface. */
  onLiveChange?: (key: K, value: number | null) => void;
  /** Une écriture est en cours : les gestes sont ignorés, sans désactiver la barre. */
  occupe?: boolean;
  /** `true` pour le MJ : la valeur exacte apparaît au survol. */
  valeurExacte: boolean;
  /** Les pôles prioritaires, dans l'ordre ; avec `onEtoile`, chaque barre porte une ★. */
  prioritaires?: readonly K[];
  onEtoile?: (key: K) => void;
  /** Valeurs de la fiche comparée : un trait bleu sur chaque barre. */
  comparaison?: Partial<Record<K, number>> | null;
  /** Le pôle en tension avec la fiche comparée : son mot passe en orange. */
  tensionSur?: K | null;
}) {
  const t = useTranslations("fiche.psyche");
  const [liveValues, setLiveValues] = useState<Record<string, number>>({});
  // Miroir synchrone : sur un clic, `onChange` et `onMouseUp` tombent dans le
  // même lot React ; lire l'état de la fermeture donnerait une valeur périmée.
  const liveValuesRef = useRef<Record<string, number>>({});
  const dragStartRef = useRef<Record<string, number>>({});
  // Un commit en cours pour une clé : le blur qui suit le relâchement ne doit pas en lancer un second.
  const committingRef = useRef<Record<string, boolean>>({});

  function setLive(key: K, value: number) {
    liveValuesRef.current = { ...liveValuesRef.current, [key]: value };
    setLiveValues(liveValuesRef.current);
    onLiveChange?.(key, value);
  }
  function clearLive(key: K) {
    const next = { ...liveValuesRef.current };
    delete next[key];
    liveValuesRef.current = next;
    setLiveValues(next);
    onLiveChange?.(key, null);
  }
  function startDrag(key: K, current: number) {
    dragStartRef.current[key] = current;
  }
  async function commit(key: K) {
    if (committingRef.current[key]) return;
    const start = dragStartRef.current[key];
    const current = liveValuesRef.current[key];
    delete dragStartRef.current[key];
    if (start === undefined || current === undefined || current === start || occupe) {
      clearLive(key);
      return;
    }
    committingRef.current[key] = true;
    try {
      await onCommit(key, current - start);
    } finally {
      committingRef.current[key] = false;
      // La valeur locale ne s'efface qu'ici : succès ou non, `poles` dit la vérité.
      clearLive(key);
    }
  }

  return (
    <div className="@container/barres">
      <div className="flex flex-col gap-3 @lg/barres:gap-2">
      {keys.map((key) => {
        const stored = poles.find((p) => p.key === key)?.value ?? 0;
        const value = liveValues[key] ?? stored;
        const pole = table[key];
        const neutre = bandTierFor(value) === "neutral";
        const mot = poleBandLabel(pole, value);
        const rang = prioritaires ? prioritaires.indexOf(key) : -1;
        const autre = comparaison?.[key];
        const enTension = tensionSur === key;
        const gauche = value >= 0 ? 50 : 50 + value / 2;
        const titre = [descriptions[key], valeurExacte ? t("valeurExacte", { valeur: value }) : null]
          .filter((x): x is string => Boolean(x))
          .join("\n");
        return (
          <div
            key={key}
            className="grid grid-cols-[1.25rem_1fr_1fr] items-center gap-x-2 gap-y-0.5 @lg/barres:grid-cols-[1.25rem_7.5rem_minmax(7rem,1fr)_7.5rem_11rem]"
          >
            {onEtoile ? (
              <button
                type="button"
                aria-pressed={rang >= 0}
                aria-label={t("prioriteLabel", { pole: pole.label })}
                title={t("prioriteTitre")}
                onClick={() => onEtoile(key)}
                className={`row-span-3 row-start-1 col-start-1 self-start text-sm transition-colors @lg/barres:col-start-auto @lg/barres:row-span-1 @lg/barres:row-start-auto @lg/barres:self-center ${
                  rang >= 0 ? "text-accent" : "text-ink-muted hover:text-ink"
                }`}
              >
                ★
              </button>
            ) : (
              <span aria-hidden className="row-span-3 row-start-1 col-start-1 @lg/barres:col-start-auto @lg/barres:row-span-1 @lg/barres:row-start-auto" />
            )}
            <span
              className={`col-start-2 row-start-1 text-left text-xs @lg/barres:col-start-auto @lg/barres:row-start-auto @lg/barres:text-right ${
                value < 0 && !neutre ? "font-semibold text-ink" : "text-ink-muted"
              }`}
            >
              {pole.negative.label}
            </span>
            <div
              title={titre}
              className="relative col-span-2 col-start-2 row-start-2 h-6 @lg/barres:col-span-1 @lg/barres:col-start-auto @lg/barres:row-start-auto"
            >
              <input
                type="range"
                min={-100}
                max={100}
                step={1}
                value={value}
                aria-label={t("regler", { pole: pole.label })}
                aria-valuetext={mot}
                onMouseDown={() => startDrag(key, stored)}
                onTouchStart={() => startDrag(key, stored)}
                onFocus={() => startDrag(key, stored)}
                onChange={(e) => setLive(key, Number(e.target.value))}
                onMouseUp={() => void commit(key)}
                onTouchEnd={() => void commit(key)}
                onBlur={() => void commit(key)}
                className="peer absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
              />
              <span aria-hidden className="absolute inset-x-0 top-[9px] h-1 rounded-sm border border-edge bg-panel-sunken" />
              <span aria-hidden className="absolute bottom-1 left-1/2 top-1 w-px bg-edge-strong" />
              <span
                aria-hidden
                className="absolute top-[9px] h-1.5 rounded-sm bg-accent"
                style={{ left: `${gauche}%`, width: `${Math.abs(value) / 2}%` }}
              />
              {autre !== undefined && (
                <span
                  aria-hidden
                  className="absolute top-0.5 h-[18px] w-1 -translate-x-1/2 rounded-sm bg-players"
                  style={{ left: `${(autre + 100) / 2}%` }}
                />
              )}
              <span
                aria-hidden
                className="absolute top-1 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-accent bg-ink peer-focus-visible:ring-2 peer-focus-visible:ring-accent/60"
                style={{ left: `${(value + 100) / 2}%` }}
              />
            </div>
            <span
              className={`col-start-3 row-start-1 text-right text-xs @lg/barres:col-start-auto @lg/barres:row-start-auto @lg/barres:text-left ${
                value > 0 && !neutre ? "font-semibold text-ink" : "text-ink-muted"
              }`}
            >
              {pole.positive.label}
            </span>
            <span
              className={`col-span-2 col-start-2 row-start-3 text-xs font-semibold @lg/barres:col-span-1 @lg/barres:col-start-auto @lg/barres:row-start-auto ${
                enTension ? "text-gm" : "text-ink"
              }`}
            >
              {mot}
            </span>
          </div>
        );
      })}
      </div>
    </div>
  );
}

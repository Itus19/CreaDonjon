"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { relationshipAxisLabel } from "@/src/core/psyche/bands";
import type { RelationshipAxisKey } from "@/src/core/psyche/keys";
import { RELATIONSHIP_AXES_FR, RELATIONSHIP_AXIS_DESCRIPTIONS_FR } from "@/src/i18n/fr";
import { portionFil, positionPerle, type SouvenirDAxe } from "@/lib/ui/relationFace";

const COULEUR_PORTION = { success: "bg-success", danger: "bg-danger" } as const;

/**
 * V3.1-71 — un fil par axe de relation, sur toute la largeur : le pôle négatif
 * sous le bout gauche, le positif sous le bout droit (vers l'autre portrait),
 * un trait au milieu (neutre), la portion entre le milieu et la perle colorée
 * (vert si positif, rouge si négatif) et, DANS la perle, le mot de la bande.
 * Glisser la perle règle au point près ; au survol (au toucher sur téléphone),
 * le « pourquoi » : les deux derniers souvenirs de l'axe, ou « aucun souvenir :
 * réglage du MJ ».
 *
 * Réglage manuel mais jamais silencieux : `onCommit` n'est appelé qu'au
 * relâchement. Un fil n'est JAMAIS désactivé pendant l'écriture (il a le
 * focus : le désactiver déclencherait le blur, donc la sauvegarde de la carte
 * en même temps que la requête) ; `occupe` fait ignorer le geste. Seul
 * `lecture` (le lecteur ne peut pas écrire sur cette fiche) désactive les fils,
 * d'emblée.
 */
export default function FilsPerles({
  axes,
  valeurs,
  onCommit,
  onLiveChange,
  occupe,
  lecture,
  valeurExacte,
  pourquoi,
  onPourquoi,
  formaterDate,
}: {
  axes: readonly RelationshipAxisKey[];
  valeurs: Partial<Record<RelationshipAxisKey, number>>;
  onCommit: (axe: RelationshipAxisKey, delta: number) => Promise<void> | void;
  onLiveChange: (axe: RelationshipAxisKey, valeur: number | null) => void;
  occupe: boolean;
  lecture: boolean;
  /** Le MJ voit les écarts bruts dans le « pourquoi » ; un joueur n'en voit jamais. */
  valeurExacte: boolean;
  /** Les deux derniers souvenirs d'un axe ; `null` tant que la liste n'est pas chargée. */
  pourquoi: (axe: RelationshipAxisKey) => SouvenirDAxe[] | null;
  /** Appelé au premier survol : le parent charge alors le journal (une fois). */
  onPourquoi: () => void;
  formaterDate: (souvenir: SouvenirDAxe) => string;
}) {
  const t = useTranslations("fiche.relation");
  const [live, setLive] = useState<Record<string, number>>({});
  const liveRef = useRef<Record<string, number>>({});
  const departRef = useRef<Record<string, number>>({});
  const enCoursRef = useRef<Record<string, boolean>>({});
  const [ouvert, setOuvert] = useState<RelationshipAxisKey | null>(null);

  function poser(axe: RelationshipAxisKey, valeur: number) {
    liveRef.current = { ...liveRef.current, [axe]: valeur };
    setLive(liveRef.current);
    onLiveChange(axe, valeur);
  }
  function effacer(axe: RelationshipAxisKey) {
    const suite = { ...liveRef.current };
    delete suite[axe];
    liveRef.current = suite;
    setLive(suite);
    onLiveChange(axe, null);
  }
  function commencer(axe: RelationshipAxisKey, courant: number) {
    departRef.current[axe] = courant;
  }
  async function valider(axe: RelationshipAxisKey) {
    if (enCoursRef.current[axe]) return;
    const depart = departRef.current[axe];
    const courant = liveRef.current[axe];
    delete departRef.current[axe];
    if (depart === undefined || courant === undefined || courant === depart || occupe) {
      effacer(axe);
      return;
    }
    enCoursRef.current[axe] = true;
    try {
      await onCommit(axe, courant - depart);
    } finally {
      enCoursRef.current[axe] = false;
      effacer(axe);
    }
  }

  function montrer(axe: RelationshipAxisKey) {
    onPourquoi();
    setOuvert(axe);
  }

  return (
    <div className="flex flex-col gap-4">
      {axes.map((axe) => {
        const stocke = valeurs[axe] ?? 0;
        const valeur = live[axe] ?? stocke;
        const fil = portionFil(valeur);
        const mot = relationshipAxisLabel(axe, valeur);
        const fin = RELATIONSHIP_AXES_FR[axe];
        const souvenirs = ouvert === axe ? pourquoi(axe) : null;
        return (
          <div key={axe} className="flex flex-col gap-0.5">
            <div className="relative h-8" title={RELATIONSHIP_AXIS_DESCRIPTIONS_FR[axe]}>
              <input
                type="range"
                min={-100}
                max={100}
                step={1}
                value={valeur}
                disabled={lecture}
                aria-label={t("regler", { axe: fin.label })}
                aria-valuetext={mot}
                onMouseDown={() => commencer(axe, stocke)}
                onTouchStart={() => commencer(axe, stocke)}
                onFocus={() => {
                  commencer(axe, stocke);
                  montrer(axe);
                }}
                onChange={(e) => poser(axe, Number(e.target.value))}
                onMouseUp={() => void valider(axe)}
                onTouchEnd={() => void valider(axe)}
                onBlur={() => {
                  void valider(axe);
                  setOuvert((o) => (o === axe ? null : o));
                }}
                onMouseEnter={() => montrer(axe)}
                onMouseLeave={() => setOuvert((o) => (o === axe ? null : o))}
                onClick={() => montrer(axe)}
                className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
              />
              <span aria-hidden className="absolute inset-x-0 top-[15px] h-0.5 rounded-sm bg-edge-strong" />
              <span aria-hidden className="absolute bottom-2 left-1/2 top-2 w-px bg-edge-strong" />
              {fil.couleur && (
                <span
                  aria-hidden
                  className={`absolute top-[13px] h-1.5 rounded-sm ${COULEUR_PORTION[fil.couleur]}`}
                  style={{ left: `${fil.debut}%`, width: `${fil.largeur}%` }}
                />
              )}
              <span
                aria-hidden
                className="absolute top-0.5 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-accent bg-panel-raised px-2.5 py-0.5 text-xs font-semibold text-ink peer-focus-visible:ring-2 peer-focus-visible:ring-accent/60"
                style={{ left: `${positionPerle(valeur)}%` }}
              >
                {mot}
              </span>
              {ouvert === axe && (
                <div
                  role="tooltip"
                  className="absolute left-1/2 top-9 z-20 w-72 max-w-full -translate-x-1/2 rounded-lg border border-edge-strong bg-panel-raised p-2 text-xs text-ink-soft shadow-2xl"
                >
                  {souvenirs === null ? (
                    t("pourquoiChargement")
                  ) : souvenirs.length === 0 ? (
                    t("pourquoiAucun")
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {souvenirs.map((s) => (
                        <li key={s.id}>
                          {t("pourquoiLigne", { date: formaterDate(s), texte: s.summary })}
                          {valeurExacte && <span className="ml-1 text-ink-muted">({s.delta > 0 ? "+" : ""}{s.delta})</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span>{fin.negative}</span>
              {axe === "attraction_repulsion" && (
                <span className="uppercase tracking-wider" title={t("mjTitre")}>
                  {t("mj")}
                </span>
              )}
              <span>{fin.positive}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

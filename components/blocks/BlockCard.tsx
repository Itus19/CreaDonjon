"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { useSortable } from "@dnd-kit/sortable";
import ActionsMenu, { type ActionsMenuItem } from "@/components/shared/ActionsMenu";
import {
  VISIBILITY_PILL_FALLBACK,
  VISIBILITY_PILL_STYLES,
  isVisibilityLevelKey,
} from "@/components/shared/visibilityOptions";

/** Les quatre niveaux du choix direct (« Choisir la visibilité… ») ; campagne et utilisateur demandent un identifiant et n'y figurent pas. */
const NIVEAUX_CHOIX = ["public", "players", "gm", "private"] as const;

/**
 * V3.1-63 — la carte de verre d'un bloc : son en-tête (⠿, ▾, titre, type,
 * « Enregistré », pastille de visibilité, ⋮) et son corps en `children`.
 * Partagée par tous les blocs de la fiche ; les tickets qui suivent ne
 * dessinent que l'intérieur. Purement présentative : l'enregistrement, le
 * réordonnancement et la suppression restent à `EntityBlocks`.
 *
 * Le type en pastille disparaît quand la fenêtre est étroite (requête de
 * conteneur sur la fiche, pas la largeur de l'écran).
 */
export default function BlockCard({
  cardRef,
  style,
  onBlur,
  estGlisse,
  poignee,
  pliable,
  replie,
  onBasculerPli,
  titre,
  titrePlaceholder,
  onTitreChange,
  typeLibelle,
  etatSauvegarde,
  niveauVisibilite,
  onChoisirVisibilite,
  peutMonter,
  peutDescendre,
  onMonter,
  onDescendre,
  onDupliquer,
  onSupprimer,
  conflit,
  erreurSauvegarde,
  children,
}: {
  cardRef: React.Ref<HTMLDivElement>;
  style?: React.CSSProperties;
  onBlur: (e: React.FocusEvent<HTMLDivElement>) => void;
  estGlisse: boolean;
  /** Attributs et écouteurs de `useSortable`, posés sur ⠿ : souris, toucher et clavier. */
  poignee: { attributes: DraggableAttributes; listeners: ReturnType<typeof useSortable>["listeners"] };
  /** `false` pour la fiche de créature, qui n'a pas de ▾. */
  pliable: boolean;
  replie: boolean;
  onBasculerPli: () => void;
  titre: string;
  titrePlaceholder: string;
  onTitreChange: (titre: string) => void;
  typeLibelle: string;
  /** « pending » pendant la requête, « saved » les deux secondes qui suivent sa réussite (ADR 0023). */
  etatSauvegarde: "pending" | "saved" | null;
  niveauVisibilite: string;
  onChoisirVisibilite: (niveau: string) => void;
  peutMonter: boolean;
  peutDescendre: boolean;
  onMonter: () => void;
  onDescendre: () => void;
  onDupliquer: () => void;
  onSupprimer: () => void;
  conflit: boolean;
  erreurSauvegarde: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("fiche");
  // Au plus un panneau sous l'en-tête : l'infobulle de la pastille, ou le choix direct du ⋮.
  const [panneau, setPanneau] = useState<"info" | "choix" | null>(null);

  const style_ = VISIBILITY_PILL_STYLES[niveauVisibilite] ?? VISIBILITY_PILL_FALLBACK;
  const cleNiveau = isVisibilityLevelKey(niveauVisibilite) ? niveauVisibilite : null;
  const libelleNiveau = cleNiveau ? t(`niveaux.${cleNiveau}`) : niveauVisibilite;
  const quiLaVoit = cleNiveau ? t(`qui.${cleNiveau}`) : niveauVisibilite;

  const items: ActionsMenuItem[] = [
    ...(peutMonter ? [{ label: t("monter"), onSelect: onMonter }] : []),
    ...(peutDescendre ? [{ label: t("descendre"), onSelect: onDescendre }] : []),
    { label: t("dupliquer"), onSelect: onDupliquer },
    { label: t("choisirVisibilite"), onSelect: () => setPanneau("choix") },
    { label: t("supprimer"), onSelect: onSupprimer, danger: true },
  ];

  return (
    <div
      ref={cardRef}
      style={style}
      onBlur={onBlur}
      className={`@container/bloc relative mb-3 rounded-2xl border bg-panel backdrop-blur-[var(--blur)] ${
        estGlisse ? "z-10 border-accent opacity-90" : "border-edge"
      }`}
    >
      <div className={`flex items-center gap-2 px-2 py-2 ${replie ? "" : "border-b border-edge"}`}>
        <button
          type="button"
          {...poignee.attributes}
          {...poignee.listeners}
          className="touch-none cursor-grab px-1 text-sm text-ink-muted transition-colors hover:text-ink active:cursor-grabbing"
          title={t("poigneeTitre")}
          aria-label={t("poignee")}
        >
          ⠿
        </button>
        {pliable && (
          <button
            type="button"
            onClick={onBasculerPli}
            className="shrink-0 rounded-md px-1 text-ink-muted transition-colors hover:text-ink"
            aria-label={replie ? t("deplier") : t("replier")}
            aria-expanded={!replie}
            title={replie ? t("deplier") : t("replier")}
          >
            {replie ? "▸" : "▾"}
          </button>
        )}
        <input
          value={titre}
          placeholder={titrePlaceholder}
          aria-label={t("titreBloc")}
          onChange={(e) => onTitreChange(e.target.value)}
          className="block-title block-title-carte min-w-0 flex-1 bg-transparent outline-none placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:italic placeholder:text-ink-muted focus:border-b focus:border-accent"
        />
        <span className="hidden shrink-0 rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted @min-[40rem]:inline">
          {typeLibelle}
        </span>
        {/* Annonce polie : la région existe toujours, seul son texte change, sinon un lecteur d'écran ne l'annonce pas. */}
        <span aria-live="polite" className="shrink-0 text-xs text-success">
          {etatSauvegarde === "saved" ? t("enregistre") : ""}
          {etatSauvegarde === "pending" ? <span className="text-ink-muted">{t("enregistrement")}</span> : null}
        </span>
        <button
          type="button"
          onClick={() => setPanneau((p) => (p === "info" ? null : "info"))}
          aria-label={t("visibiliteBloc", { niveau: libelleNiveau })}
          aria-expanded={panneau === "info"}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors hover:bg-panel-raised ${style_.pill}`}
        >
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${style_.dot}`} />
          {libelleNiveau}
        </button>
        <ActionsMenu
          aria-label={t("actionsBloc")}
          items={items}
          triggerClassName="shrink-0 rounded-md px-1.5 py-1 text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink"
        />
      </div>

      {panneau === "info" && (
        <div className="flex items-center gap-2 border-b border-edge px-3 py-2 text-xs text-ink-soft">
          <span className="flex-1">{t("visibiliteQui", { qui: quiLaVoit })}</span>
          <button
            type="button"
            onClick={() => setPanneau(null)}
            className="rounded-md px-1.5 text-ink-muted transition-colors hover:text-ink"
            aria-label={t("fermer")}
          >
            ×
          </button>
        </div>
      )}
      {panneau === "choix" && (
        <div role="group" aria-label={t("choisirVisibilite")} className="flex flex-wrap items-center gap-2 border-b border-edge px-3 py-2">
          {NIVEAUX_CHOIX.map((niveau) => {
            const s = VISIBILITY_PILL_STYLES[niveau];
            return (
              <button
                key={niveau}
                type="button"
                aria-pressed={niveau === niveauVisibilite}
                title={t(`qui.${niveau}`)}
                onClick={() => {
                  setPanneau(null);
                  if (niveau !== niveauVisibilite) onChoisirVisibilite(niveau);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:bg-panel-raised ${s.pill} ${
                  niveau === niveauVisibilite ? "bg-panel-raised" : ""
                }`}
              >
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                {t(`niveaux.${niveau}`)}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setPanneau(null)}
            className="ml-auto rounded-md px-1.5 text-ink-muted transition-colors hover:text-ink"
            aria-label={t("fermer")}
          >
            ×
          </button>
        </div>
      )}

      {conflit && <p className="px-4 pt-2 text-xs text-danger">{t("conflit")}</p>}
      {erreurSauvegarde && <p className="px-4 pt-2 text-xs text-danger">{t("erreurSauvegarde")}</p>}

      {!replie && <div className="px-4 py-3">{children}</div>}
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import type { CombatRow } from "@/src/server/repos/combats";
import type { Menace, PhaseCombat } from "@/lib/ui/initiative";

const BTN = "rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50";
const BTN_PRINCIPAL = "rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50";
const ANNONCE = "flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-xs text-ink";

export interface ActionsBandeau {
  onNom: (nom: string | null) => void;
  onAjouter: () => void;
  onAnnuler: () => void;
  onCommencer: () => void;
  onRound: () => void;
  onTerminer: () => void;
  onQuitter: () => void;
  onQuitterOui: () => void;
  onQuitterNon: () => void;
  onReprendre: () => void;
  onRecommencer: () => void;
  onRouvrir: () => void;
  onTour: (sens: "next" | "previous") => void;
  onFinContinuer: () => void;
  onFinTerminer: () => void;
}

/** En-tête du combat ouvert : nom, état, menace restante, gestes de déroulé et annonces (jets, suspension, fin). */
export default function BandeauCombat({
  combat,
  phase,
  menace,
  tourDe,
  occupe,
  aDesParticipants,
  enAttente,
  peutRound,
  finProposee,
  quitterDemande,
  actions,
}: {
  combat: CombatRow;
  phase: PhaseCombat;
  menace: Menace | null;
  tourDe: string | null;
  occupe: boolean;
  aDesParticipants: boolean;
  /** Prénoms (libellés) des joueuses dont le score manque. */
  enAttente: string[];
  peutRound: boolean;
  finProposee: boolean;
  quitterDemande: boolean;
  actions: ActionsBandeau;
}) {
  const t = useTranslations("initiative");
  const statut = phase === "draft" ? t("statutDraft") : phase === "rolling" ? t("statutRolling") : phase === "running" ? t("statutRunning") : phase === "paused" ? t("statutPaused") : t("statutEnded");
  const enJeu = phase === "rolling" || phase === "running";

  return (
    <section className="flex flex-col gap-2 rounded-[18px] border border-edge bg-panel p-3 backdrop-blur-[var(--blur)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <input
          key={`nom-${combat.id}-${combat.name ?? ""}`}
          type="text"
          defaultValue={combat.name ?? ""}
          placeholder={t("combatSansNom")}
          aria-label={t("nomDuCombat")}
          onBlur={(e) => {
            const valeur = e.target.value.trim();
            if (valeur !== (combat.name ?? "")) actions.onNom(valeur || null);
          }}
          className="min-w-0 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-ink outline-none transition-colors hover:border-edge focus:border-accent"
        />
        <span className="rounded-full border border-edge px-2 py-0.5 text-xs uppercase tracking-wider text-ink-muted">{statut}</span>
        {(phase === "running" || phase === "paused") && <span className="text-xs uppercase tracking-wider text-ink-muted">{t("round", { n: combat.round })}</span>}
        {menace && (
          <span className="flex items-center gap-2" title={t("menaceAide")}>
            <svg viewBox="0 0 40 40" className="h-8 w-8 -rotate-90" fill="none" aria-hidden="true">
              <circle cx="20" cy="20" r="16" strokeWidth="4" className="stroke-panel-sunken" />
              <circle cx="20" cy="20" r="16" strokeWidth="4" strokeLinecap="round" pathLength="100" strokeDasharray={`${menace.pourcent} 100`} className="stroke-danger" />
            </svg>
            <span className="flex flex-col text-xs leading-tight text-ink-muted">
              {t("menaceRestante")}
              <b className="text-sm text-ink">{t("menaceXp", { restant: menace.restant, total: menace.total })}</b>
            </span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={actions.onAjouter} className={BTN}>
          + {t("ajouter")}
        </button>
        <button type="button" onClick={actions.onAnnuler} disabled={occupe} className={`${BTN} text-ink-soft`} title={t("annulerAide")}>
          ↶ {t("annulerAction")}
        </button>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {phase === "draft" && (
            <button type="button" onClick={actions.onCommencer} disabled={occupe || !aDesParticipants} className={BTN_PRINCIPAL}>
              {t("commencer")} ▶
            </button>
          )}
          {phase === "rolling" && (
            <button type="button" onClick={actions.onRound} disabled={occupe || !peutRound} className={BTN_PRINCIPAL}>
              {t("round1")} ▶
            </button>
          )}
          {phase === "running" && (
            <button type="button" onClick={actions.onTerminer} disabled={occupe} className={BTN}>
              ■ {t("terminer")}
            </button>
          )}
          {enJeu && (
            <button type="button" onClick={actions.onQuitter} disabled={occupe} className={BTN}>
              {t("quitter")}
            </button>
          )}
        </span>
      </div>

      {phase === "running" && (
        <div className="flex items-center justify-between rounded-xl border border-edge bg-panel-sunken px-3 py-1.5">
          <button type="button" onClick={() => actions.onTour("previous")} disabled={occupe} aria-label={t("tourPrecedent")} className="px-2 text-ink-muted hover:text-ink disabled:opacity-50">
            ◁
          </button>
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider text-ink-muted">{t("tourActuel")}</div>
            <div className="text-sm font-medium text-accent">{tourDe ?? "—"}</div>
          </div>
          <button type="button" onClick={() => actions.onTour("next")} disabled={occupe} aria-label={t("tourSuivant")} className="px-2 text-ink-muted hover:text-ink disabled:opacity-50">
            ▷
          </button>
        </div>
      )}

      {phase === "rolling" && (
        <div className={`${ANNONCE} border-edge bg-panel-sunken`}>
          <span className="min-w-0 flex-1">
            {t("invitationEnvoyee")} <b>{enAttente.length > 0 ? t("enAttente", { noms: enAttente.join(", ") }) : t("toutLeMondeALance")}</b>
            {enAttente.length > 0 && <> — {t("saisirPourUnJoueur")}</>}
          </span>
        </div>
      )}

      {quitterDemande && (
        <div className={`${ANNONCE} border-danger bg-danger/10`}>
          <span className="min-w-0 flex-1">{t("quitterQuestion")}</span>
          <button type="button" onClick={actions.onQuitterNon} className={BTN}>
            {t("rester")}
          </button>
          <button type="button" onClick={actions.onQuitterOui} disabled={occupe} className={BTN_PRINCIPAL}>
            {t("quitterOui")}
          </button>
        </div>
      )}

      {phase === "paused" && (
        <div className={`${ANNONCE} border-edge-strong bg-panel-sunken`}>
          <span className="min-w-0 flex-1">{t("suspendu", { n: combat.round })}</span>
          <button type="button" onClick={actions.onReprendre} disabled={occupe} className={BTN_PRINCIPAL}>
            {t("reprendre")} ▶
          </button>
          <button type="button" onClick={actions.onRecommencer} disabled={occupe} className={BTN}>
            {t("recommencer")}
          </button>
        </div>
      )}

      {finProposee && phase === "running" && (
        <div className={`${ANNONCE} border-success bg-success/10`}>
          <span className="min-w-0 flex-1">{t("adversairesVaincus")}</span>
          <button type="button" onClick={actions.onFinContinuer} className={BTN}>
            {t("continuer")}
          </button>
          <button type="button" onClick={actions.onFinTerminer} disabled={occupe} className={BTN_PRINCIPAL}>
            {t("terminer")}
          </button>
        </div>
      )}

      {phase === "ended" && (
        <div className={`${ANNONCE} border-edge-strong bg-panel-sunken`}>
          <span className="min-w-0 flex-1">{t("termine", { n: combat.round })}</span>
          <button type="button" onClick={actions.onRouvrir} disabled={occupe} className={BTN}>
            {t("rouvrir")}
          </button>
        </div>
      )}
    </section>
  );
}

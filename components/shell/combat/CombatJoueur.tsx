"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import type { PlayerCombatParticipant } from "@/src/core/rules/combatPlayerView";
import {
  basculerCase,
  cleBlessure,
  cleDuCycle,
  economieAffichee,
  invitationOuverte,
  modeCombat,
  monParticipant,
  type EconomieAction,
  type EconomieDuTour,
  type InfosCombatJoueur,
  type VueCombatJoueur,
} from "@/lib/ui/combatJoueur";
import InvitationInitiative from "./InvitationInitiative";
import { useCombatJoueur } from "./useCombatJoueur";
import { conditionLabel } from "@/src/core/rules/weaponMastery";

const CARTE = "rounded-[18px] border border-edge bg-panel backdrop-blur-[var(--blur)]";

/**
 * V3.1-38 — l'initiative côté joueuse, autour de la fiche de Perso.
 * - jets demandés (`rolling`) et initiative vide : l'invitation au premier plan ;
 * - combat en cours (`running`) : l'ordre du tour et l'économie d'action
 *   AU-DESSUS de la fiche, qui ne change pas (`children`) ;
 * - sinon (aucun combat, suspendu, terminé) : la fiche seule.
 * La vue arrive avec la page (C1) puis suit les changements de la table `combats`.
 */
export default function CombatJoueur({
  campaignId,
  entityId,
  vueInitiale,
  children,
}: {
  campaignId: string;
  /** La fiche réclamée : elle désigne le participant de la joueuse dans l'ordre du tour. */
  entityId: string;
  vueInitiale: VueCombatJoueur;
  children: React.ReactNode;
}) {
  const { vue, relire } = useCombatJoueur(campaignId, vueInitiale);
  // Garde la fenêtre ouverte pendant le résultat et le décompte, même si la vue dit déjà « initiative écrite ».
  const [enValidation, setEnValidation] = useState(false);
  const fermer = useCallback(() => setEnValidation(false), []);
  const ouvrir = useCallback(() => setEnValidation(true), []);
  const reliree = useCallback(() => void relire(), [relire]);

  const afficheInvitation = vue.kind === "ok" && (invitationOuverte(vue, entityId) || enValidation);

  return (
    <div className="flex flex-col gap-4">
      {vue.kind === "ok" && afficheInvitation && (
        <InvitationInitiative campaignId={campaignId} combatId={vue.combat.id} onValidation={ouvrir} onTermine={fermer} onEnvoyee={reliree} />
      )}
      {vue.kind === "ok" && modeCombat(vue) && <ModeCombat combat={vue.combat} participants={vue.participants} entityId={entityId} />}
      {children}
    </div>
  );
}

function ModeCombat({ combat, participants, entityId }: { combat: InfosCombatJoueur; participants: PlayerCombatParticipant[]; entityId: string }) {
  const moi = monParticipant(participants, entityId);
  return (
    <section className="@container flex flex-col gap-3" data-testid="combat-joueur">
      <OrdreDuTour combat={combat} participants={participants} moiId={moi?.id ?? null} />
      {moi && <Economie combat={combat} rang={moi.order} />}
    </section>
  );
}

function OrdreDuTour({ combat, participants, moiId }: { combat: InfosCombatJoueur; participants: PlayerCombatParticipant[]; moiId: string | null }) {
  const t = useTranslations("combatJoueur");
  return (
    <div className={`${CARTE} p-3`}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="font-chrome text-sm font-semibold text-ink">{t("ordreTitre")}</h2>
        <span className="font-mech text-xs text-ink-muted">{t("round", { numero: combat.round })}</span>
      </div>
      <ol className="flex flex-col gap-1">
        {participants.map((p) => (
          <LigneParticipant key={p.id} participant={p} moi={p.id === moiId} />
        ))}
      </ol>
    </div>
  );
}

function LigneParticipant({ participant: p, moi }: { participant: PlayerCombatParticipant; moi: boolean }) {
  const t = useTranslations("combatJoueur");
  const cleEtat = cleBlessure(p.wound);
  return (
    <li
      aria-current={p.isCurrent ? "step" : undefined}
      className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-xl border px-2.5 py-1.5 ${
        p.isCurrent ? "border-accent bg-accent/10" : "border-transparent"
      }`}
    >
      <span className="w-4 shrink-0 text-center font-mech text-xs text-accent" aria-hidden="true">
        {p.isCurrent ? "▶" : ""}
      </span>
      {p.isCurrent && <span className="sr-only">{t("tourEnCours")}</span>}
      <span className="w-7 shrink-0 text-right font-mech text-xs text-ink-muted">{p.initiative ?? "…"}</span>
      <span className={`min-w-0 flex-1 truncate text-sm ${p.isCurrent ? "font-semibold text-ink" : "text-ink-soft"}`}>
        {p.label}
        {moi && <span className="ml-1.5 rounded-full border border-accent/60 px-1.5 py-px text-xs font-semibold text-accent">{t("vous")}</span>}
      </span>
      {p.side === "ally" && p.hp ? (
        <span className="shrink-0 font-mech text-xs text-ink">{t("pv", { courant: p.hp.current ?? "—", max: p.hp.max ?? "—" })}</span>
      ) : (
        cleEtat && <span className={`shrink-0 text-xs ${p.wound === "down" ? "text-danger" : "text-ink-soft"}`}>{t(cleEtat)}</span>
      )}
      {p.conditions.length > 0 && (
        <span className="flex w-full flex-wrap gap-1 pl-[3.75rem]">
          {p.conditions.map((c) => (
            <span key={c} className="rounded-full border border-edge bg-panel-raised px-1.5 py-px text-xs text-ink-soft">
              {conditionLabel(c)}
            </span>
          ))}
        </span>
      )}
    </li>
  );
}

const CASES: { quelle: keyof EconomieAction; cle: string }[] = [
  { quelle: "action", cle: "action" },
  { quelle: "bonus", cle: "actionBonus" },
  { quelle: "reaction", cle: "reaction" },
];

/** Trois cases locales (rien n'est enregistré) : remises à zéro quand le tour revient à la joueuse. */
function Economie({ combat, rang }: { combat: InfosCombatJoueur; rang: number }) {
  const t = useTranslations("combatJoueur");
  const [etat, setEtat] = useState<EconomieDuTour | null>(null);
  const cle = cleDuCycle(combat, rang);
  const utilisee = economieAffichee(etat, cle);
  return (
    <div className={`${CARTE} p-3`}>
      <h2 className="mb-2 font-chrome text-sm font-semibold text-ink">{t("economieTitre")}</h2>
      <div className="grid grid-cols-3 gap-2">
        {CASES.map(({ quelle, cle: cleLibelle }) => (
          <button
            key={quelle}
            type="button"
            aria-pressed={utilisee[quelle]}
            onClick={() => setEtat((e) => basculerCase(e, cle, quelle))}
            className={`rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${
              utilisee[quelle] ? "border-edge bg-panel-sunken text-ink-muted line-through" : "border-accent bg-panel-raised text-ink hover:bg-accent/10"
            }`}
          >
            {t(cleLibelle)}
          </button>
        ))}
      </div>
    </div>
  );
}

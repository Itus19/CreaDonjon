"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useDiceRoll } from "@/components/shell/DiceRollPanel";
import { useTextesJetCible } from "@/components/shell/useTextesJetCible";
import type { PlayerCombatParticipant } from "@/src/core/rules/combatPlayerView";
import { actionsDeMonstre, type ActionAffichee } from "@/lib/ui/initiative";
import { lireMaCreature } from "@/lib/ui/initiativeApi";
import { preReglageCible } from "@/lib/ui/jetCibleOutil";

const BOUTON =
  "min-h-11 rounded-full border border-edge px-4 py-1 text-sm text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-50";

/**
 * V3.1-184 (ADR 0078) — la joueuse fait agir la créature qu'elle pilote.
 * « Faire agir » lit son bloc de stats (une requête, au geste, jamais au
 * montage) ; chaque attaque ouvre l'outil de dés pré-rempli, et « Lancer »
 * passe par `player-targeted-roll` avec l'acteur `participant` : le serveur
 * revérifie qu'elle pilote la créature, lance et applique (règle 8). Les
 * dégâts suivent une touche, par le jeton signé.
 */
export default function CreaturePilotee({
  campaignId,
  combatId,
  creature,
  participants,
}: {
  campaignId: string;
  combatId: string;
  creature: PlayerCombatParticipant;
  participants: PlayerCombatParticipant[];
}) {
  const t = useTranslations("combatJoueur");
  const ti = useTranslations("initiative");
  const textes = useTextesJetCible();
  const { openDiceTool } = useDiceRoll();
  const [actions, setActions] = useState<ActionAffichee[] | "chargement" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function ouvrir() {
    if (actions !== null && actions !== "chargement") {
      setActions(null);
      return;
    }
    setActions("chargement");
    setErreur(null);
    try {
      setActions(actionsDeMonstre(await lireMaCreature(campaignId, combatId, creature.id, t("erreurCreature"))));
    } catch (e) {
      console.error("Lecture de la créature pilotée en échec", e);
      setErreur(e instanceof Error ? e.message : t("erreurCreature"));
      setActions(null);
    }
  }

  function attaquer(a: ActionAffichee) {
    openDiceTool(
      preReglageCible({
        titre: `${a.nom} · ${ti("touche")}`,
        titreDegats: `${a.nom} · ${ti("degats")}`,
        kind: "attack",
        action: { kind: "monster_action", name: a.nom },
        acteur: { kind: "participant", participantId: creature.id },
        nomActeur: creature.label,
        formule: a.degats,
        modifier: a.touche ?? 0,
        touche: true,
        participants: [],
        joueur: participants,
        campaignId,
        combatId,
        textes,
        // La vue de la joueuse se relit par le temps réel.
        apresJet: () => {},
      })
    );
  }

  const attaques = Array.isArray(actions) ? actions.filter((a) => a.touche !== null) : [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void ouvrir()} aria-expanded={Array.isArray(actions)} disabled={actions === "chargement"} className={BOUTON}>
          {t("faireAgir", { nom: creature.label })} {Array.isArray(actions) ? "▾" : "▸"}
        </button>
        {erreur && (
          <span role="alert" className="text-xs text-danger">
            {erreur}
          </span>
        )}
      </div>
      {Array.isArray(actions) &&
        (attaques.length === 0 ? (
          <p className="text-xs text-ink-muted">{t("creatureSansAttaque")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {attaques.map((a) => (
              <li key={a.nom} className="flex flex-wrap items-center gap-2 rounded-xl border border-edge bg-panel-sunken px-2.5 py-1.5">
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate text-sm font-semibold text-ink">{a.nom}</b>
                  {a.degats && <small className="truncate text-xs text-ink-muted">{a.degats}</small>}
                </span>
                <button type="button" onClick={() => attaquer(a)} className={BOUTON}>
                  {ti("toucheBonus", { bonus: (a.touche ?? 0) >= 0 ? `+${a.touche ?? 0}` : String(a.touche) })} ▸
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

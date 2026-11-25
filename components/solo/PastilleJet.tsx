"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import DieIcon from "@/components/shared/DieIcon";
import { CarreDe, useBruit } from "@/components/shared/DeAnime";
import { DIE_SHAPES, type DieSides } from "@/src/core/dice/dieSides";
import type { EncashedTurnOutcome, PendingRequest } from "@/lib/solo/types";
import { attenteMinimale, mouvementReduit } from "@/lib/ui/animationDe";
import { deDeLaDemande, sortieJetDepuisTour } from "@/lib/ui/solo";
import { encaisserDepuisFiche } from "@/lib/ui/soloApi";

/**
 * V3.2-20 — le jet demandé, lancé depuis le récit (option C, choisie le
 * 25 novembre). Une pastille posée juste sous la phrase du joueur : un clic,
 * le dé défile, puis se fige sur le naturel tiré par le SERVEUR (règle 8 :
 * le scintillement est décoratif, `useBruit`). L'outil de dés ne s'ouvre plus
 * tout seul ; il reste derrière le bouton dé de la barre.
 *
 * Réglage coupé (`montrerIssue`, défaut), la pastille tait le DD et l'issue :
 * c'est le récit qui dit si l'on a réussi. Le moteur, lui, calcule toujours
 * l'issue et la donne au narrateur.
 *
 * Le résultat reste affiché un instant (`PAUSE_RESULTAT_MS`) avant que la
 * carte du jet ne prenne le relais dans le fil : sinon la pastille
 * disparaîtrait au moment précis où l'on veut lire son dé.
 *
 * Coût (docs/QUOTAS.md) : un appel par clic, le même que le bouton « Lancer »
 * de l'outil de dés, qu'il remplace. Aucun sondage.
 */

const PAUSE_RESULTAT_MS = 1200;

type Etat =
  | { kind: "pret" }
  | { kind: "roule" }
  | { kind: "reactions" }
  | { kind: "fait"; naturel: number | null; total: number; dc: number | null; verdict: "success" | "fail" | null };

const PASTILLE = "inline-flex min-h-11 items-center gap-2 rounded-full border bg-panel-raised py-1 pl-1.5 pr-4 text-sm font-medium text-ink";

export default function PastilleJet({
  demande,
  montrerIssue,
  entityId,
  campaignId,
  worldSlug,
  onEncaisse,
}: {
  demande: PendingRequest;
  montrerIssue: boolean;
  entityId: string;
  campaignId: string;
  worldSlug: string;
  /** Le tour est joué : le parent pose la demande chaînée (ou aucune) et recharge le fil. */
  onEncaisse: (tour: EncashedTurnOutcome) => void;
}) {
  const t = useTranslations("solo.jet");
  const [etat, setEtat] = useState<Etat>({ kind: "pret" });
  const [erreur, setErreur] = useState<string | null>(null);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  const faces = Number(deDeLaDemande(demande.die_max).slice(1));
  const bruit = useBruit([faces], etat.kind === "roule");
  // Un d100 n'a pas de silhouette à lui : l'icône du d20 en tient lieu, le chiffre dit le reste.
  const forme: DieSides = DIE_SHAPES.find((f) => f === faces) ?? 20;

  useEffect(
    () => () => {
      if (minuterie.current) clearTimeout(minuterie.current);
    },
    []
  );

  const attaque = demande.kind === "weapon_attack";
  const seuil = montrerIssue && demande.dc !== null ? ` · ${attaque ? "CA" : "DD"} ${demande.dc}` : "";

  async function lancer() {
    if (etat.kind !== "pret") return;
    setErreur(null);
    setEtat({ kind: "roule" });
    const debut = Date.now();
    const reduit = mouvementReduit(typeof window === "undefined" ? undefined : window.matchMedia.bind(window));
    try {
      const reponse = await encaisserDepuisFiche({ entityId, campaignId, worldSlug });
      const reste = attenteMinimale(reduit) - (Date.now() - debut);
      if (reste > 0) await new Promise((r) => setTimeout(r, reste));
      // V3.1-216 : une réaction peut intervenir ; le tour n'est pas joué, la demande reste posée.
      if ("fenetre" in reponse) {
        setEtat({ kind: "reactions" });
        return;
      }
      const sortie = sortieJetDepuisTour(demande, reponse);
      const naturel = sortie.trace[0]?.value ?? null;
      setEtat({ kind: "fait", naturel, total: sortie.total, dc: sortie.dc, verdict: sortie.verdict });
      minuterie.current = setTimeout(() => onEncaisse(reponse), reduit ? 0 : PAUSE_RESULTAT_MS);
    } catch (e) {
      setEtat({ kind: "pret" });
      setErreur(e instanceof Error ? e.message : t("echec"));
    }
  }

  if (etat.kind === "fait") {
    const issue =
      !montrerIssue || etat.verdict === null ? "" : ` · ${t(attaque ? (etat.verdict === "success" ? "touche" : "rate") : etat.verdict === "success" ? "reussite" : "echecJet")}`;
    const seuilFait = montrerIssue && etat.dc !== null ? ` · ${attaque ? "CA" : "DD"} ${etat.dc}` : "";
    const bord = montrerIssue && etat.verdict === "success" ? "border-success" : montrerIssue && etat.verdict === "fail" ? "border-danger" : "border-accent";
    return (
      <p className={`${PASTILLE} ${bord} self-start`} role="status">
        <CarreDe faces={faces} valeur={etat.naturel ?? undefined} bruit={undefined} petit />
        <span>
          {demande.what} : {etat.total}
          {seuilFait}
          {issue}
        </span>
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" onClick={() => void lancer()} disabled={etat.kind !== "pret"} aria-busy={etat.kind === "roule"} className={`${PASTILLE} border-accent transition-colors hover:bg-panel disabled:cursor-default`}>
        {etat.kind === "pret" ? (
          <span className="grid h-7 w-7 place-items-center text-accent">
            <DieIcon sides={forme} className="h-5 w-5" />
          </span>
        ) : (
          <CarreDe faces={faces} valeur={undefined} bruit={bruit[0]} petit />
        )}
        <span>
          {etat.kind === "roule" ? t("roule") : etat.kind === "reactions" ? t("reactions") : t("lancer", { quoi: demande.what })}
          {etat.kind === "pret" && seuil}
        </span>
      </button>
      {erreur && <p className="text-xs text-danger">{erreur}</p>}
    </div>
  );
}

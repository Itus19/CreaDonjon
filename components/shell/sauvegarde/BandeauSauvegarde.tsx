"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSauvegardes } from "@/components/shell/SauvegardesProvider";
import { DECOMPTE_VALIDATION_S } from "@/lib/ui/combatJoueur";
import { issueDepuisReponse, type DemandeSauvegarde, type IssueSauvegarde } from "@/lib/ui/sauvegardes";
import { repondreSauvegarde, type ReponseSauvegarde } from "@/lib/ui/sauvegardesApi";
import SaisieVraiDe from "./SaisieVraiDe";

type Phase = "choix" | "saisie" | "envoi" | "verdict";

/**
 * V3.1-112 (ADR 0044) — le bandeau de la cible : « Résiste à Moquerie cruelle ·
 * JS Sagesse DD 13 ». Trois façons de répondre : lancer (le SERVEUR tire, règle 8),
 * un vrai dé, ou laisser le MJ saisir (replie le bandeau, n'écrit rien). Le
 * verdict revenu s'affiche quelques secondes, puis le bandeau se referme.
 * Au premier plan, sans voile : la fiche reste utilisable. Téléphone : en feuille
 * du bas, au-dessus de la barre flottante.
 */
export default function BandeauSauvegarde({ campaignId, worldSlug }: { campaignId: string | null; worldSlug: string }) {
  const pathname = usePathname();
  const { aRepondre } = useSauvegardes();
  // Côté MJ, la liste vit dans les outils Initiative et Table, pas dans un bandeau.
  const horsMj = !pathname.startsWith(`/m/${worldSlug}/mj`);
  const [retenue, setRetenue] = useState<{ demande: DemandeSauvegarde; issue: IssueSauvegarde; changes: string[] } | null>(null);

  const courante = aRepondre[0];
  if (!campaignId || !horsMj) return null;
  // Le verdict reste affiché même si le signal temps réel a déjà retiré la demande.
  if (retenue) return <CadreVerdict retenue={retenue} onFini={() => setRetenue(null)} />;
  if (!courante) return null;
  return <Reponse key={courante.id} campaignId={campaignId} demande={courante} onRepondue={(issue, changes) => setRetenue({ demande: courante, issue, changes })} />;
}

function Cadre({ children, labelledBy }: { children: React.ReactNode; labelledBy: string }) {
  return (
    <div
      role="region"
      aria-labelledby={labelledBy}
      className="@container fixed inset-x-3 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[97] flex flex-col gap-3 rounded-[18px] border border-accent bg-panel p-4 shadow-2xl backdrop-blur-[var(--blur)] md:inset-x-auto md:bottom-4 md:left-1/2 md:w-[26rem] md:-translate-x-1/2 print:hidden"
    >
      {children}
    </div>
  );
}

function Reponse({
  campaignId,
  demande,
  onRepondue,
}: {
  campaignId: string;
  demande: DemandeSauvegarde;
  onRepondue: (issue: IssueSauvegarde, changes: string[]) => void;
}) {
  const t = useTranslations("sauvegardes");
  const { laisserAuMj } = useSauvegardes();
  const [phase, setPhase] = useState<Phase>("choix");
  const [erreur, setErreur] = useState<string | null>(null);
  const idTitre = `sauvegarde-${demande.id}`;

  async function envoyer(corps: Parameters<typeof repondreSauvegarde>[2]) {
    if (phase === "envoi") return;
    const avant = phase;
    setErreur(null);
    setPhase("envoi");
    const res = await repondreSauvegarde(campaignId, demande.id, corps, t("erreurEnvoi"));
    if (!res.ok) {
      setErreur(res.erreur);
      setPhase(avant);
      return;
    }
    const reponse: ReponseSauvegarde = res.reponse;
    onRepondue(issueDepuisReponse(reponse, demande.dc), reponse.changes);
  }

  const occupe = phase === "envoi";
  return (
    <Cadre labelledBy={idTitre}>
      <div>
        <p className="text-xs uppercase tracking-wider text-ink-muted">{t("titreBandeau")}</p>
        <h2 id={idTitre} className="font-chrome text-base font-semibold text-ink">
          {t("resiste", { label: demande.label })}
        </h2>
      </div>

      {phase !== "saisie" ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={occupe}
            onClick={() => void envoyer({ mode: "roll" })}
            className="w-full rounded-lg border border-accent bg-accent py-3 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {t("lancer")}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={occupe}
              onClick={() => setPhase("saisie")}
              className="rounded-lg border border-edge px-3 py-2 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-60"
            >
              {t("vraiDe")}
            </button>
            <button
              type="button"
              disabled={occupe}
              onClick={() => laisserAuMj(demande.id)}
              className="rounded-lg border border-edge px-3 py-2 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-60"
            >
              {t("laisserAuMj")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <SaisieVraiDe desactive={occupe} onValider={(natural, inclus) => void envoyer({ mode: "die", natural, modifierIncluded: inclus })} />
          <button type="button" onClick={() => setPhase("choix")} className="self-start text-xs text-ink-muted underline hover:text-ink">
            {t("annuler")}
          </button>
        </div>
      )}

      {erreur && (
        <p role="alert" className="text-xs text-danger">
          {erreur}
        </p>
      )}
    </Cadre>
  );
}

function CadreVerdict({
  retenue,
  onFini,
}: {
  retenue: { demande: DemandeSauvegarde; issue: IssueSauvegarde; changes: string[] };
  onFini: () => void;
}) {
  const t = useTranslations("sauvegardes");
  const [reste, setReste] = useState(DECOMPTE_VALIDATION_S);
  useEffect(() => {
    const minuteur = setInterval(() => setReste((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(minuteur);
  }, []);
  useEffect(() => {
    if (reste === 0) onFini();
  }, [reste, onFini]);

  const { issue, demande, changes } = retenue;
  const verdict = issue.reussie ? t("reussie") : t("ratee");
  return (
    <Cadre labelledBy={`verdict-${demande.id}`}>
      <div role="status">
        <h2 id={`verdict-${demande.id}`} className={`font-chrome text-base font-semibold ${issue.reussie ? "text-success" : "text-danger"}`}>
          {t("verdict", { verdict, total: issue.total, dd: issue.dc })}
        </h2>
        <p className="text-xs text-ink-muted">{demande.label}</p>
        {changes.length > 0 && (
          <ul className="mt-1 text-xs text-ink-soft">
            {changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-center text-xs text-ink-soft">{t("seReferme", { secondes: reste })}</p>
    </Cadre>
  );
}

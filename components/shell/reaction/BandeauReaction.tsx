"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useSauvegardes } from "@/components/shell/SauvegardesProvider";
import { DECOMPTE_VALIDATION_S } from "@/lib/ui/combatJoueur";
import type { FenetreReaction } from "@/lib/ui/reactions";
import { agirSurFenetre, type IssueReprise } from "@/lib/ui/reactionsApi";

/**
 * V3.1-161 (ADR 0075) — le bandeau de réaction : un jet vient d'être lancé et
 * quelqu'un peut intervenir (Esquive instinctive, Chance…). Il montre le jet,
 * son total et son issue, puis pour chacune de mes lignes la règle, le
 * personnage et, si le serveur le sait, « changerait l'issue ». Deux boutons au
 * pouce : « Utiliser » / « Passer ». Le MJ a en plus « Continuer » (les
 * réponses manquantes valent « Passer »).
 *
 * L'auteur du jet reprend la fenêtre une seule fois quand elle se ferme sans
 * lui, et lit ici ce que la reprise a appliqué (le serveur a tranché, règle 8).
 * Les fenêtres arrivent avec la page puis par le canal unique de
 * `SauvegardesProvider` : aucune lecture ici (docs/CABLAGE.md).
 * Même cadre que `BandeauSauvegarde` : feuille du bas au téléphone, au-dessus
 * de la barre flottante, sans voile.
 */
export default function BandeauReaction({ campaignId, userId, isMj }: { campaignId: string | null; userId: string | null; isMj: boolean }) {
  const { fenetres, aReprendre } = useSauvegardes();
  const [issue, setIssue] = useState<{ label: string; reprise: IssueReprise } | null>(null);
  const [erreurReprise, setErreurReprise] = useState<string | null>(null);
  // Une fenêtre se reprend UNE fois (la base le refuse de toute façon) : on retient celles déjà lancées.
  const reprisesLancees = useRef(new Set<string>());
  const t = useTranslations("reactions");

  useEffect(() => {
    if (!campaignId) return;
    for (const f of aReprendre) {
      if (reprisesLancees.current.has(f.id)) continue;
      reprisesLancees.current.add(f.id);
      void agirSurFenetre(campaignId, f.id, { action: "resume" }, t("erreurReprise")).then((res) => {
        if (!res.ok) setErreurReprise(res.erreur);
        else if (res.reponse.reprise) setIssue({ label: f.label, reprise: res.reponse.reprise });
      });
    }
  }, [campaignId, aReprendre, t]);

  if (!campaignId || !userId) return null;
  const courante = fenetres[0];
  if (courante) {
    return (
      <Fenetre
        key={courante.id}
        campaignId={campaignId}
        fenetre={courante}
        userId={userId}
        isMj={isMj}
        onReprise={(reprise) => {
          reprisesLancees.current.add(courante.id);
          setIssue({ label: courante.label, reprise });
        }}
      />
    );
  }
  if (issue) return <CadreIssue label={issue.label} reprise={issue.reprise} onFini={() => setIssue(null)} />;
  if (erreurReprise) {
    return (
      <Cadre labelledBy="reaction-erreur">
        <p id="reaction-erreur" role="alert" className="text-sm text-danger">
          {erreurReprise}
        </p>
        <button type="button" onClick={() => setErreurReprise(null)} className="rounded-lg border border-edge px-3 py-3 text-sm text-ink transition-colors hover:bg-panel-raised">
          {t("fermer")}
        </button>
      </Cadre>
    );
  }
  return null;
}

function Cadre({ children, labelledBy }: { children: React.ReactNode; labelledBy: string }) {
  return (
    <div
      role="region"
      aria-labelledby={labelledBy}
      className="@container fixed inset-x-3 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[98] flex max-h-[70dvh] flex-col gap-3 overflow-y-auto rounded-[18px] border border-accent bg-panel p-4 shadow-2xl backdrop-blur-[var(--blur)] md:inset-x-auto md:bottom-4 md:left-1/2 md:w-[26rem] md:-translate-x-1/2 print:hidden"
    >
      {children}
    </div>
  );
}

function Fenetre({
  campaignId,
  fenetre,
  userId,
  isMj,
  onReprise,
}: {
  campaignId: string;
  fenetre: FenetreReaction;
  userId: string;
  isMj: boolean;
  onReprise: (reprise: IssueReprise) => void;
}) {
  const t = useTranslations("reactions");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // La réponse que je viens d'envoyer : la ligne disparaît tout de suite, sans attendre le signal.
  const [envoyees, setEnvoyees] = useState<ReadonlySet<number>>(new Set());
  const idTitre = `reaction-${fenetre.id}`;

  const miennes = fenetre.choices
    .map((choix, index) => ({ choix, index }))
    .filter(({ choix, index }) => (choix.user_id === userId || (choix.user_id === null && isMj)) && fenetre.answers[String(index)] === undefined && !envoyees.has(index));

  async function agir(action: Parameters<typeof agirSurFenetre>[2], index?: number) {
    if (occupe) return;
    setErreur(null);
    setOccupe(true);
    const res = await agirSurFenetre(campaignId, fenetre.id, action, t("erreurEnvoi"));
    setOccupe(false);
    if (!res.ok) {
      setErreur(res.erreur);
      return;
    }
    if (index !== undefined) setEnvoyees((s) => new Set(s).add(index));
    if (res.reponse.reprise) onReprise(res.reponse.reprise);
  }

  const { total, outcome } = fenetre.view;
  return (
    <Cadre labelledBy={idTitre}>
      <div>
        <p className="text-xs uppercase tracking-wider text-ink-muted">{t("titreBandeau")}</p>
        <h2 id={idTitre} className="font-chrome text-base font-semibold text-ink">
          {fenetre.label}
        </h2>
        <p className="font-mech text-sm text-ink-soft">{outcome ? t("jetAvecIssue", { total, issue: outcome }) : t("jetSansIssue", { total })}</p>
      </div>

      {miennes.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("enAttenteDesAutres")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {miennes.map(({ choix, index }) => (
            <li key={index} className="flex flex-col gap-2 rounded-lg border border-edge bg-panel-sunken p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{choix.label}</p>
                <p className="text-xs text-ink-soft">{choix.actor_label}</p>
                {choix.changes_outcome === true && <p className="mt-1 text-xs font-semibold text-accent">{t("changeraitLIssue")}</p>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={occupe}
                  onClick={() => void agir({ action: "answer", index, use: true }, index)}
                  className="min-h-11 rounded-lg border border-accent bg-accent px-3 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-60"
                >
                  {t("utiliser")}
                </button>
                <button
                  type="button"
                  disabled={occupe}
                  onClick={() => void agir({ action: "answer", index, use: false }, index)}
                  className="min-h-11 rounded-lg border border-edge px-3 py-2 text-sm text-ink transition-colors hover:bg-panel-raised disabled:opacity-60"
                >
                  {t("passer")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {isMj && (
        <button
          type="button"
          disabled={occupe}
          onClick={() => void agir({ action: "continue" })}
          className="min-h-11 w-full rounded-lg border border-edge px-3 py-2 text-sm text-ink transition-colors hover:bg-panel-raised disabled:opacity-60"
        >
          {t("continuer")}
        </button>
      )}

      {erreur && (
        <p role="alert" className="text-xs text-danger">
          {erreur}
        </p>
      )}
    </Cadre>
  );
}

/** Ce que la reprise a appliqué, quelques secondes, puis le bandeau se referme. */
function CadreIssue({ label, reprise, onFini }: { label: string; reprise: IssueReprise; onFini: () => void }) {
  const t = useTranslations("reactions");
  const [reste, setReste] = useState(DECOMPTE_VALIDATION_S);
  useEffect(() => {
    const minuteur = setInterval(() => setReste((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(minuteur);
  }, []);
  useEffect(() => {
    if (reste === 0) onFini();
  }, [reste, onFini]);

  const test = reprise.test;
  const verdictTest = test ? (test.verdict === "success" ? t("jetTestReussi", { what: test.what, total: test.total }) : test.verdict === "fail" ? t("jetTestRate", { what: test.what, total: test.total }) : t("jetTestSansVerdict", { what: test.what, total: test.total })) : null;
  const lignes = verdictTest ? [verdictTest, ...reprise.phrases] : reprise.phrases;
  return (
    <Cadre labelledBy="reaction-issue">
      <div role="status">
        <h2 id="reaction-issue" className="font-chrome text-base font-semibold text-ink">
          {t("issueTitre")}
        </h2>
        <p className="text-xs text-ink-muted">{label}</p>
        {lignes.length > 0 && (
          <ul className="mt-1 text-sm text-ink-soft">
            {lignes.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-center text-xs text-ink-soft">{t("seReferme", { secondes: reste })}</p>
    </Cadre>
  );
}

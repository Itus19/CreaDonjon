"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ZoneResultatDuJet } from "@/components/shell/OutilDes";
import { useMatchMedia } from "@/components/shell/useMatchMedia";
import type { JetAffiche } from "@/lib/ui/outilDes";
import {
  DECOMPTE_VALIDATION_S,
  envoyerMonInitiative,
  naturelDepuisSaisie,
  saisieValide,
  type EnvoiInitiative,
} from "@/lib/ui/combatJoueur";

const REDUIT_QUERY = "(prefers-reduced-motion: reduce)";
const BALAYAGE_MS = 380;

/** Le jet affiché : la valeur vient du SERVEUR ; le dé n'est montré que si la joueuse l'a lu elle-même sur un vrai d20. */
function jetDepuisInitiative(total: number, natural: number | null, libelle: string): JetAffiche {
  return {
    id: crypto.randomUUID(),
    who: "",
    what: libelle,
    chips: [],
    total,
    dc: null,
    dcPrivate: false,
    verdict: null,
    naturalD20: natural,
    secret: false,
    groups: natural === null ? [] : [{ faces: 20, rolls: [natural] }],
    pair: null,
    createdAt: new Date().toISOString(),
  };
}

/** Le bouton est remplacé par la zone de résultat, par un balayage de gauche à droite. */
function Balayage({ children }: { children: React.ReactNode }) {
  const reduit = useMatchMedia(REDUIT_QUERY);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || reduit) return;
    const animation = element.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], {
      duration: BALAYAGE_MS,
      easing: "ease-out",
      fill: "forwards",
    });
    return () => animation.cancel();
  }, [reduit]);
  return (
    <div ref={ref} style={reduit ? undefined : { clipPath: "inset(0 100% 0 0)" }}>
      {children}
    </div>
  );
}

function Interrupteur({ actif, onChange, libelle }: { actif: boolean; onChange: (valeur: boolean) => void; libelle: string }) {
  return (
    <button type="button" role="switch" aria-checked={actif} onClick={() => onChange(!actif)} className="flex shrink-0 items-center gap-1.5">
      <span className={`relative h-4 w-7 rounded-full border transition-colors ${actif ? "border-accent bg-accent" : "border-edge-strong bg-edge"}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-panel transition-all motion-reduce:transition-none ${actif ? "left-[13px]" : "left-0.5"}`} />
      </span>
      <span className={`text-xs ${actif ? "font-semibold text-accent" : "text-ink-muted"}`}>{libelle}</span>
    </button>
  );
}

type Phase = "attente" | "envoi" | "resultat";

/**
 * V3.1-38 — « Vous entrez en combat » : l'invitation au premier plan.
 * Le toucher lance l'initiative de la fiche (le SERVEUR tire le d20, règle 8)
 * ou envoie un vrai dé. Le résultat s'affiche dans la zone de résultat de
 * l'outil de dés, puis la fenêtre se ferme après un décompte de 4 s.
 *
 * `onValidation(true)` dit au parent de garder la fenêtre ouverte même quand
 * le signal temps réel vide l'invitation (l'initiative est écrite dès la
 * réponse du serveur) ; `onTermine` la referme.
 */
export default function InvitationInitiative({
  campaignId,
  combatId,
  onValidation,
  onTermine,
  onEnvoyee,
}: {
  campaignId: string;
  combatId: string;
  onValidation: () => void;
  onTermine: () => void;
  /** L'initiative est écrite : le parent relit la vue sans attendre le signal. */
  onEnvoyee: () => void;
}) {
  const t = useTranslations("combatJoueur");
  const idTitre = useId();
  const [phase, setPhase] = useState<Phase>("attente");
  const [jet, setJet] = useState<JetAffiche | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [saisie, setSaisie] = useState("");
  const [inclus, setInclus] = useState(false);
  const [decompte, setDecompte] = useState(DECOMPTE_VALIDATION_S);

  const natural = naturelDepuisSaisie(saisie);
  const saisieOk = saisieValide(natural, inclus);

  async function envoyer(envoi: EnvoiInitiative) {
    if (phase !== "attente") return;
    setErreur(null);
    setPhase("envoi");
    try {
      const ecrite = await envoyerMonInitiative(campaignId, combatId, envoi);
      setJet(jetDepuisInitiative(ecrite.initiative, ecrite.natural, t("titreJet")));
      setPhase("resultat");
      onValidation();
      onEnvoyee();
    } catch (e) {
      console.error("Initiative non envoyée", e);
      setErreur(t("erreurEnvoi"));
      setPhase("attente");
    }
  }

  // Le décompte « validé dans 4 s… » ; à zéro, la fenêtre se ferme.
  useEffect(() => {
    if (phase !== "resultat") return;
    const minuteur = setInterval(() => setDecompte((d) => Math.max(0, d - 1)), 1000);
    return () => clearInterval(minuteur);
  }, [phase]);
  useEffect(() => {
    if (phase === "resultat" && decompte === 0) onTermine();
  }, [phase, decompte, onTermine]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 print:hidden">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
        className="@container flex w-full max-w-sm flex-col gap-3 rounded-[18px] border border-edge bg-panel p-4 backdrop-blur-[var(--blur)]"
      >
        <div>
          <h2 id={idTitre} className="font-chrome text-base font-semibold text-ink">
            {t("invitationTitre")}
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">{t("invitationAide")}</p>
        </div>

        {phase === "attente" ? (
          <>
            <button
              type="button"
              onClick={() => void envoyer({ mode: "roll" })}
              className="w-full rounded-lg border border-accent bg-accent py-3 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
            >
              {t("lancer")}
            </button>

            <div className="flex items-center gap-2 text-xs text-ink-muted" aria-hidden="true">
              <span className="h-px flex-1 bg-edge" />
              {t("ou")}
              <span className="h-px flex-1 bg-edge" />
            </div>

            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (natural !== null && saisieOk) void envoyer({ mode: "die", natural, modifierIncluded: inclus });
              }}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={saisie}
                  onChange={(e) => setSaisie(e.target.value)}
                  placeholder={inclus ? "—" : "1–20"}
                  aria-label={t("valeurDe")}
                  className="h-9 w-20 rounded-full border border-edge bg-panel-sunken px-2 text-center font-mech text-sm text-ink outline-none placeholder:text-ink-muted focus:border-accent"
                />
                <Interrupteur actif={inclus} onChange={setInclus} libelle={t("modificateurInclus")} />
                <button
                  type="submit"
                  disabled={!saisieOk}
                  className="ml-auto rounded-lg border border-accent px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-ink disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-accent"
                >
                  {t("valider")}
                </button>
              </div>
              <p className="text-xs text-ink-muted">{inclus ? t("saisieAideTotal") : t("saisieAideNu")}</p>
            </form>
          </>
        ) : (
          <Balayage>
            <ZoneResultatDuJet jet={jet} enCours={phase === "envoi"} />
          </Balayage>
        )}

        {erreur && (
          <p role="alert" className="text-xs text-danger">
            {erreur}
          </p>
        )}
        {phase === "resultat" && (
          <p className="text-center text-xs text-ink-soft" role="status">
            {t("valideDans", { secondes: decompte })}
          </p>
        )}
      </div>
    </div>
  );
}

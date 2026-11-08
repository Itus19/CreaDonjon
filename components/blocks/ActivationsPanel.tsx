"use client";

import { regagnerRessource } from "@/lib/ui/regainApi";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Checkbox from "@/components/shared/Checkbox";
import { useTextesJetCible } from "@/components/shell/useTextesJetCible";
import type { ActiveDurableEffect } from "@/src/core/rules/durableEffects";
import { localized } from "@/src/core/rules/durableEffects";
import type { BonusActionOption, ResolvedFeature, SheetResource } from "@/src/core/rules/sheet";
import type { Activation, ActivationBlockData } from "@/src/core/schemas/rule-blocks/playable";
import {
  activationsVisibles,
  basculerCible,
  ciblesActivationJoueur,
  ciblesActivationMj,
  ligneResultat,
  resumeActivation,
  ressourceManquante,
  ressourceRestante,
  tempsRestant,
} from "@/lib/ui/activationFiche";
import { activerRegle, type ReponseActivation } from "@/lib/ui/activationApi";
import { emplacementsOfferts, optionsDeLancement, type SortJouable } from "@/lib/ui/lancerSort";
import { lireCombatEnCours, lireCombatEnCoursJoueur } from "@/lib/ui/ficheDesApi";
import { SEUIL_COMPTEUR } from "@/lib/ui/egaliseur";
import { ErreurLancer, type CibleDeJet } from "@/lib/ui/outilDes";
import { ABILITY_LABELS } from "./sheetLabels";
import type { Ability } from "@/src/core/rules/abilities";

/**
 * V3.1-131 — l'onglet Actions montre ce que les règles rendent jouable (planche
 * « En jeu — onglet Actions ») : les ressources calculées, une carte par
 * capacité avec son bouton « Utiliser », et les effets que le personnage porte.
 *
 * Aucun chargement ici (docs/CABLAGE.md) : les ressources, les capacités et les
 * effets viennent de la fiche calculée déjà chargée. Le combat se lit AU
 * TOUCHER de « Utiliser », jamais au montage. Le serveur lance les dés et
 * applique (règle 8) ; ce composant montre ce qu'il rend. Une joueuse ne voit
 * que le verdict de chaque cible, le MJ voit aussi le jet.
 */

const ETIQUETTE = "text-xs font-bold uppercase tracking-widest text-ink-muted";
const CARTE = "flex flex-col gap-2 rounded-md border border-edge/60 bg-panel-raised px-2.5 py-2.5";
const BOUTON_PRINCIPAL =
  "min-h-11 shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50";
const BOUTON_SECONDAIRE = "min-h-11 rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50";

export interface ActivationsPanelProps {
  entityId: string;
  campaignId: string | null;
  /** MJ du monde : il voit les chiffres du jet de chaque cible. */
  estMj: boolean;
  ressources: readonly SheetResource[];
  features: readonly ResolvedFeature[];
  /** `runtimeState.resources` : les usages consommés. */
  utilises: Readonly<Record<string, number>>;
  /** Les nombres que lisent les formules (`nombresDeLaFiche`). */
  nombres: Readonly<Record<string, number>>;
  effets: readonly ActiveDurableEffect[];
  /** V3.1-166 : les sorts connus qui portent une activation (une carte chacun, avec le choix de l'emplacement). */
  sorts?: readonly SortJouable[];
  /** V3.1-166 : les emplacements que la fiche affiche déjà (totaux, dépensés, réserve de pacte). */
  emplacements?: {
    totaux: Readonly<Record<number, number>>;
    depenses: Readonly<Record<string, number>>;
    pacte: { count: number; slotLevel: number } | null;
    pacteDepense: number;
  };
  /** V3.1-166 : les actions permises en action bonus (`bonusActionOptions` de la fiche). */
  actionsBonus?: readonly BonusActionOption[];
  /** Après une activation réussie : la fiche se relit (même mécanisme que les autres actions). */
  apresActivation: () => void;
  busy: boolean;
}

export default function ActivationsPanel(props: ActivationsPanelProps) {
  const { ressources, features, effets } = props;
  const t = useTranslations("fiche.activation");

  const capacites = features.flatMap((f) =>
    f.activation ? activationsVisibles(f.activation, effets, f.key).map((activation) => ({ feature: f, bloc: f.activation as ActivationBlockData, activation })) : []
  );

  const sorts = (props.sorts ?? []).flatMap((s) =>
    activationsVisibles(s.bloc, effets, s.cle).map((activation) => ({ sort: s, activation }))
  );
  const actionsBonus = props.actionsBonus ?? [];

  if (ressources.length === 0 && capacites.length === 0 && effets.length === 0 && sorts.length === 0 && actionsBonus.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {ressources.length > 0 && (
        <section className="flex flex-col gap-1.5" aria-label={t("ressources")}>
          <span className={ETIQUETTE}>{t("ressources")}</span>
          {ressources.map((r) => (
            <LigneRessource key={r.key} ressource={r} {...props} />
          ))}
        </section>
      )}

      {actionsBonus.length > 0 && (
        <p className="text-xs text-ink-muted" data-testid="actions-bonus">
          {t("enActionBonus", { actions: actionsBonus.map((a) => t(`actionBonus.${a}`)).join(", ") })}
        </p>
      )}

      {capacites.length > 0 && (
        <section className="flex flex-col gap-1.5" aria-label={t("capacites")}>
          <span className={ETIQUETTE}>{t("capacites")}</span>
          {capacites.map(({ feature, bloc, activation }) => (
            <CarteCapacite key={`${feature.key}:${activation.id}`} {...props} ruleKey={feature.key} nomRegle={feature.label} bloc={bloc} activation={activation} />
          ))}
        </section>
      )}

      {sorts.length > 0 && (
        <section className="flex flex-col gap-1.5" aria-label={t("sorts")}>
          <span className={ETIQUETTE}>{t("sorts")}</span>
          {sorts.map(({ sort, activation }) => (
            <CarteCapacite key={`${sort.cle}:${activation.id}`} {...props} ruleKey={sort.cle} nomRegle={sort.nom} bloc={sort.bloc} activation={activation} sort />
          ))}
        </section>
      )}

      {effets.length > 0 && (
        <section className="flex flex-col gap-1.5" aria-label={t("surLaScene")}>
          <span className={ETIQUETTE}>{t("surLaScene")}</span>
          <div className={`${CARTE} flex-row flex-wrap gap-1.5`}>
            {effets.map((e) => (
              <PastilleEffet key={e.instanceId} effet={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// --- ressources -------------------------------------------------------------

function LigneRessource({ ressource, ...p }: ActivationsPanelProps & { ressource: SheetResource }) {
  const t = useTranslations("fiche.activation");
  const locale = useLocale();
  const { restants, max } = ressourceRestante(ressource, p.utilises);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // ADR 0078 (V3.1-183) : une ressource entamée qui se regagne contre autre chose montre son geste, et ce qu'il coûte.
  const regain = ressource.regain;
  const cout = regain
    ? regain.kind === "resource"
      ? (() => {
          const autre = p.ressources.find((r) => r.key === regain.key);
          return { libelle: t("regainRessource", { n: regain.amount, nom: autre ? localized(autre.label, locale) : regain.key }), payable: autre ? ressourceRestante(autre, p.utilises).restants >= regain.amount : false };
        })()
      : { libelle: t("regainEmplacement", { niveau: regain.min_level }), payable: true }
    : null;

  async function regagner() {
    setEnCours(true);
    setErreur(null);
    const message = await regagnerRessource(p.entityId, { campaignId: p.campaignId, resourceKey: ressource.key });
    setEnCours(false);
    if (message) setErreur(message);
    else p.apresActivation();
  }

  return (
    <div className={`${CARTE} flex-row flex-wrap items-center gap-x-3`}>
      <span className="min-w-0 flex-1 text-sm text-ink">{localized(ressource.label, locale)}</span>
      {max <= SEUIL_COMPTEUR && (
        <span className="flex gap-1" role="img" aria-label={t("pastilles", { restants, max })}>
          {Array.from({ length: max }, (_, i) => (
            <span key={i} className={`block h-3 w-3 rounded-full border-[1.5px] ${i < restants ? "border-accent bg-accent" : "border-accent/60 bg-transparent"}`} />
          ))}
        </span>
      )}
      <span className="mech text-xs text-ink-muted">{t("restantes", { restants, max, recharge: t(`recharge.${ressource.recharge}`) })}</span>
      {cout && restants < max && (
        <button
          type="button"
          disabled={p.busy || enCours || !cout.payable}
          onClick={() => void regagner()}
          className="rounded-full border border-accent px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
        >
          {t("regagner", { cout: cout.libelle })}
        </button>
      )}
      {erreur && <p className="basis-full text-xs text-danger">{erreur}</p>}
    </div>
  );
}

// --- une capacité -----------------------------------------------------------

function CarteCapacite(
  p: ActivationsPanelProps & { ruleKey: string; nomRegle: string; bloc: ActivationBlockData; activation: Activation; sort?: boolean }
) {
  const { activation, bloc, campaignId, estMj, nombres, ressources, utilises } = p;
  const t = useTranslations("fiche.activation");
  const locale = useLocale();
  const textes = useTextesJetCible();

  const variantes = activation.variants ?? [];
  const [varianteId, setVarianteId] = useState<string | null>(variantes[0]?.id ?? null);
  const [cibles, setCibles] = useState<CibleDeJet[] | "aucunCombat" | "lecture" | null>(null);
  const [choisies, setChoisies] = useState<string[]>([]);
  const [resultat, setResultat] = useState<ReponseActivation | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  // V3.1-166 : un sort se lance avec un emplacement (niveau de base ou plus) et, au choix, une option de lancement d'une aptitude.
  const niveauDeBase = activation.cost.slot?.level ?? 0;
  const offerts = p.sort && p.emplacements ? emplacementsOfferts({ base: niveauDeBase, ...p.emplacements }) : [];
  const options = p.sort ? optionsDeLancement(p.features) : [];
  const [niveauChoisi, setNiveauChoisi] = useState<number | null>(null);
  const [optionChoisie, setOptionChoisie] = useState<string | null>(null);
  const niveauEffectif = offerts.some((o) => o.niveau === niveauChoisi) ? niveauChoisi : (offerts[0]?.niveau ?? null);
  const optionLancement = options.find((o) => `${o.ruleKey}:${o.optionId}` === optionChoisie);
  const sansEmplacement = p.sort === true && niveauDeBase > 0 && niveauEffectif === null;

  const resume = resumeActivation(bloc, activation, nombres, varianteId);
  const manquante = ressourceManquante(resume.couts, ressources, utilises);
  const nomRessource = (cle: string) => {
    const r = ressources.find((x) => x.key === cle);
    return r ? localized(r.label, locale) : cle;
  };

  const morceaux: string[] = [t(`action.${resume.action}`)];
  if (p.sort) morceaux.push(niveauDeBase > 0 ? t("emplacementDeNiveau", { niveau: niveauDeBase }) : t("sortMineur"));
  for (const c of resume.couts) morceaux.push(`${c.montant} ${nomRessource(c.cle)}`);
  if (resume.cibles && resume.cibles.max !== null) morceaux.push(t("cibles", { n: resume.cibles.max }));
  const libelleSauvegarde = resume.sauvegarde ? (ABILITY_LABELS[resume.sauvegarde.caracteristique as Ability] ?? resume.sauvegarde.caracteristique.toUpperCase()) : "";
  if (resume.sauvegarde) {
    morceaux.push(
      resume.sauvegarde.dd !== null
        ? t("sauvegarde", { caracteristique: libelleSauvegarde, dd: resume.sauvegarde.dd })
        : t("sauvegardeSansDd", { caracteristique: libelleSauvegarde })
    );
  }
  if (resume.duree) {
    const d = resume.duree;
    if (d.unit === "until_turn_end") morceaux.push(t("duree.finDeTour"));
    else if (d.unit === "until_rest") morceaux.push(t("duree.repos"));
    else if (d.unit === "permanent") morceaux.push(t("duree.permanent"));
    else morceaux.push(t(`duree.${d.unit}`, { n: d.amount }));
  }

  // V3.1-161 (ADR 0075) : une activation à déclencheur ne se joue pas au clic ; elle se propose pendant le jet (bandeau de réaction).
  const reaction = activation.trigger?.on === "roll";
  if (activation.limit) morceaux.push(t(activation.limit.per === "turn" ? "limiteTour" : "limiteRound"));

  const nomCapacite = localized(activation.label, locale);
  const visePersonne = activation.targets.kind !== "self";
  const max = resume.cibles?.max ?? null;

  async function jouer(ciblesVisees: string[]) {
    if (campaignId === null) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const reponse = await activerRegle(
        p.entityId,
        { campaignId, ruleKey: p.ruleKey, activationId: activation.id,
          variantId: varianteId,
          targetParticipantIds: ciblesVisees,
          ...(p.sort
            ? {
                spell: {
                  slotLevel: niveauDeBase > 0 ? (niveauEffectif ?? niveauDeBase) : 0,
                  ...(optionLancement ? { castOption: { ruleKey: optionLancement.ruleKey, optionId: optionLancement.optionId } } : {}),
                },
              }
            : {}),
        },
        t("erreur")
      );
      setResultat(reponse);
      setCibles(null);
      setChoisies([]);
      p.apresActivation();
    } catch (e) {
      if (e instanceof ErreurLancer) setErreur(e.message);
      else {
        console.error("Activation non jouée", e);
        setErreur(t("erreur"));
      }
    } finally {
      setEnvoi(false);
    }
  }

  /** Le combat se lit ici, au toucher : jamais au montage de la fiche. */
  async function ouvrirChoix() {
    if (campaignId === null) return;
    setResultat(null);
    setErreur(null);
    setCibles("lecture");
    const genre = activation.targets.kind;
    const liste = estMj
      ? await lireCombatEnCours(campaignId, t("erreur")).then((c) => (c ? ciblesActivationMj(genre, c.participants, textes) : null))
      : await lireCombatEnCoursJoueur(campaignId).then((c) => (c ? ciblesActivationJoueur(genre, c.participants, textes) : null));
    setCibles(liste ?? "aucunCombat");
  }

  const ouvert = cibles !== null;
  const occupe = p.busy || envoi || cibles === "lecture";
  const bloque = campaignId === null || manquante !== null || sansEmplacement;

  return (
    <div className={CARTE}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="break-words text-sm font-semibold text-ink">{nomCapacite}</span>
          <span className="break-words text-xs text-ink-muted">{morceaux.join(" · ")}</span>
        </div>
        {!ouvert && !reaction && (
          <button
            type="button"
            className={BOUTON_PRINCIPAL}
            disabled={occupe || bloque}
            onClick={() => (visePersonne ? void ouvrirChoix() : void jouer([]))}
          >
            {t("utiliser")}
          </button>
        )}
      </div>

      {reaction && <p className="text-xs text-accent">{t("reaction")}</p>}

      {variantes.length > 1 && (
        <div className="flex flex-wrap gap-1" role="group" aria-label={t("variante", { nom: nomCapacite })}>
          {variantes.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={varianteId === v.id}
              onClick={() => setVarianteId(v.id)}
              className={`rounded-full border px-2.5 py-1 text-xs ${varianteId === v.id ? "border-accent text-accent" : "border-edge text-ink-muted"}`}
            >
              {localized(v.label, locale)}
            </button>
          ))}
        </div>
      )}

      {p.sort && !reaction && offerts.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className={ETIQUETTE}>{t("emplacement")}</span>
          <div className="flex flex-wrap gap-1" role="group" aria-label={t("choixEmplacement", { nom: nomCapacite })}>
            {offerts.map((o) => (
              <button
                key={o.niveau}
                type="button"
                aria-pressed={niveauEffectif === o.niveau}
                onClick={() => setNiveauChoisi(o.niveau)}
                className={`min-h-11 rounded-full border px-3 py-1 text-xs ${niveauEffectif === o.niveau ? "border-accent text-accent" : "border-edge text-ink-muted"}`}
              >
                {t("niveauRestants", { niveau: o.niveau, restants: o.restants })}
              </button>
            ))}
          </div>
        </div>
      )}
      {sansEmplacement && !reaction && <p className="text-xs text-ink-muted">{t("aucunEmplacement")}</p>}

      {p.sort && !reaction && options.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className={ETIQUETTE}>{t("optionsLancement")}</span>
          <div className="flex flex-wrap gap-1" role="group" aria-label={t("choixOption", { nom: nomCapacite })}>
            <button
              type="button"
              aria-pressed={optionChoisie === null}
              onClick={() => setOptionChoisie(null)}
              className={`min-h-11 rounded-full border px-3 py-1 text-xs ${optionChoisie === null ? "border-accent text-accent" : "border-edge text-ink-muted"}`}
            >
              {t("sansOption")}
            </button>
            {options.map((o) => {
              const id = `${o.ruleKey}:${o.optionId}`;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={optionChoisie === id}
                  onClick={() => setOptionChoisie(id)}
                  className={`min-h-11 rounded-full border px-3 py-1 text-xs ${optionChoisie === id ? "border-accent text-accent" : "border-edge text-ink-muted"}`}
                >
                  {localized(o.label, locale)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {campaignId === null && <p className="text-xs text-ink-muted">{t("sansCampagne")}</p>}
      {manquante !== null && <p className="text-xs text-ink-muted">{t("ressourceInsuffisante", { ressource: nomRessource(manquante) })}</p>}

      {ouvert && (
        <div className="flex flex-col gap-2 rounded-md bg-panel p-2.5">
          {cibles === "lecture" && <p className="text-xs text-ink-muted">{t("lectureCombat")}</p>}
          {cibles === "aucunCombat" && <p className="text-xs text-ink-muted">{t("aucunCombat")}</p>}
          {Array.isArray(cibles) && (
            <>
              <span className={ETIQUETTE}>
                {max !== null ? t("choisirCibles", { choisies: choisies.length, max }) : t("choisirCiblesSansMax", { choisies: choisies.length })}
              </span>
              {cibles.length === 0 && <p className="text-xs text-ink-muted">{t("aucuneCible")}</p>}
              {cibles.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-x-2 text-sm">
                  <Checkbox
                    checked={choisies.includes(c.id)}
                    onChange={() => setChoisies((l) => basculerCible(l, c.id, max))}
                    aria-label={t("cocherCible", { nom: c.label })}
                    disabled={envoi}
                  />
                  <span className="min-w-0 flex-1 break-words text-ink">{c.label}</span>
                  {c.info && <span className="text-xs text-ink-muted">{c.info}</span>}
                </div>
              ))}
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={BOUTON_PRINCIPAL}
              disabled={envoi || !Array.isArray(cibles) || choisies.length === 0}
              onClick={() => void jouer(choisies)}
            >
              {t("confirmer")}
            </button>
            <button
              type="button"
              className={BOUTON_SECONDAIRE}
              disabled={envoi}
              onClick={() => {
                setCibles(null);
                setChoisies([]);
              }}
            >
              {t("annuler")}
            </button>
          </div>
        </div>
      )}

      {erreur !== null && (
        <p role="alert" className="text-xs text-danger">
          {erreur}
        </p>
      )}

      {resultat !== null && <ResultatActivation reponse={resultat} estMj={estMj} nom={nomCapacite} caracteristique={libelleSauvegarde} onFermer={() => setResultat(null)} />}
    </div>
  );
}

// --- résultat ---------------------------------------------------------------

function ResultatActivation({
  reponse,
  estMj,
  nom,
  caracteristique,
  onFermer,
}: {
  reponse: ReponseActivation;
  estMj: boolean;
  nom: string;
  /** L'abréviation de la sauvegarde (« SAG »), pour « SAG 6 contre DD 15 » côté MJ. */
  caracteristique: string;
  onFermer: () => void;
}) {
  const t = useTranslations("fiche.activation");
  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-panel p-2.5" aria-live="polite">
      {reponse.overBudget && (
        <p role="status" className="text-xs text-accent">
          {t("depasseBudget")}
        </p>
      )}
      <div className="flex items-center gap-2">
        <span className={`${ETIQUETTE} min-w-0 flex-1`}>{t("resultat", { nom })}</span>
        <button type="button" onClick={onFermer} className="rounded-full px-2 py-0.5 text-xs text-ink-muted hover:text-ink" aria-label={t("fermerResultat")}>
          ×
        </button>
      </div>
      {/* V3.1-133 : une capacité sur soi (Second souffle, Fougue) dit ce qu'elle a changé ; sans cible, ces phrases ne parlent que du personnage. */}
      {reponse.targets.length === 0 &&
        reponse.changes.map((c, i) => (
          <p key={`c${i}`} className="text-sm text-ink">
            {c}
          </p>
        ))}
      {reponse.targets.length === 0 &&
        reponse.applied.map((a, i) => (
          <p key={i} className="text-sm text-ink">
            {t("effetPose", { effet: a.label })}
          </p>
        ))}
      {reponse.targets.map((cible) => {
        const ligne = ligneResultat(cible, estMj);
        return (
          <div key={cible.participantId} className="flex flex-wrap items-baseline gap-x-3 text-sm">
            <span className="min-w-0 flex-1 break-words text-ink">{ligne.nom}</span>
            {ligne.jet && (
              <span className="mech text-xs text-ink-muted">{t("jet", { caracteristique, total: ligne.jet.total, dd: ligne.jet.dc })}</span>
            )}
            {ligne.verdict === "reussite" && <span className="text-success">{t("reussite")}</span>}
            {ligne.verdict === "echec" && (
              <span className="text-danger">{ligne.appliques.length > 0 ? t("echecEffets", { effets: ligne.appliques.join(", ") }) : t("echec")}</span>
            )}
            {ligne.verdict === null && ligne.appliques.length > 0 && <span className="text-ink">{ligne.appliques.join(", ")}</span>}
          </div>
        );
      })}
    </div>
  );
}

// --- sur la scène -----------------------------------------------------------

function PastilleEffet({ effet }: { effet: ActiveDurableEffect }) {
  const t = useTranslations("fiche.activation.scene");
  const temps = tempsRestant(effet);
  const parties = [effet.label];
  if (temps.genre === "rounds") parties.push(t("rounds", { n: temps.rounds }));
  if (temps.genre === "minutes") parties.push(t("minutesRestantes", { n: temps.minutes }));
  if (temps.genre === "heures") parties.push(t("heuresRestantes", { n: temps.heures }));
  else if (temps.genre === "finDeTour") parties.push(t("finDeTour"));
  else if (temps.genre === "repos") parties.push(t("repos"));
  if (effet.concentration) parties.push(t("concentration"));
  if (effet.tokenGrants && effet.tokenUsesLeft > 0) parties.push(t("jeton", { n: effet.tokenUsesLeft }));
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs ${effet.conditions.length > 0 ? "border-danger text-danger" : "border-accent text-accent"}`}>
      {parties.join(" · ")}
    </span>
  );
}

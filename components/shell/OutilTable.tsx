"use client";

import { lbToKg } from "@/src/core/rules/encumbrance";
import { useState } from "react";
import { useTranslations } from "next-intl";
import RangeeChiffree from "@/components/blocks/RangeeChiffree";
import { XP_LEVEL_THRESHOLDS } from "@/src/core/rules/experience";
import { applyCurrencyDelta, CURRENCY_ORDER, type CoinType } from "@/src/core/rules/currency";
import { pvSousUnTiers } from "@/lib/ui/commandeE";
import { etatMourant as lireEtatMourant } from "@/lib/ui/etatMourant";
import {
  changeFait,
  desDeVie,
  fusionnerEtat,
  groupesDeCompteurs,
  ligneRepliee,
  progressionXp,
  type DeltaPieces,
} from "@/lib/ui/outilTable";
import { lireBourse, posterGeste, relirePj, type Resultat } from "@/lib/ui/tableApi";
import type { TablePc } from "@/src/server/services/tableParty";
import ListeSauvegardesMj from "./sauvegarde/ListeSauvegardesMj";
import { useSauvegardes } from "./SauvegardesProvider";
import type { DemandeSauvegarde } from "@/lib/ui/sauvegardes";
import FeuilleToutelaTable, { type ModeToutelaTable } from "./FeuilleToutelaTable";
import { useMatchMedia, WINDOWS_MOBILE_QUERY } from "./useMatchMedia";
import { conditionLabel } from "@/src/core/rules/weaponMastery";

const PILULE = "rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel disabled:opacity-50";
const PETIT_BOUTON =
  "flex h-6 w-6 items-center justify-center rounded border border-edge text-xs text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-30 disabled:hover:border-edge disabled:hover:text-ink-muted";

/** Trois ronds par jet contre la mort : ● obtenu, ○ à venir (même dessin que `BlocMourant`). */
function Ronds({ compte }: { compte: number }) {
  return <span aria-hidden="true">{[0, 1, 2].map((i) => (i < compte ? "●" : "○")).join("")}</span>;
}

type GestePj = (pc: TablePc, action: string, corps: object, delta?: DeltaPieces) => Promise<Resultat<unknown>>;

/**
 * L'outil Table du MJ (V3.1-34) : tous les PJ de la campagne, avec la même
 * commande que leur fiche. Ordinateur et tablette : une carte par PJ, dont le
 * haut EST le haut de la fiche (`RangeeChiffree`, en mode MJ). Téléphone : une
 * ligne repliée par PJ, qui se déplie sur le même contenu.
 *
 * Chaque geste passe par la route de la fiche (même service, même journal), puis
 * le seul PJ touché est relu (`/sheet`) : jamais toute la table. Les valeurs
 * dérivées (CA, vitesse, Perception passive) n'ont aucune commande (règle 16).
 */
export default function OutilTable({
  worldSlug,
  campaignId,
  party,
  conditions,
}: {
  worldSlug: string;
  campaignId: string | null;
  party: TablePc[];
  conditions: string[];
}) {
  const t = useTranslations("table");
  const { enAttente: sauvegardes } = useSauvegardes();
  const estTelephone = useMatchMedia(WINDOWS_MOBILE_QUERY);
  const [pcs, setPcs] = useState<TablePc[]>(party);
  const [occupes, setOccupes] = useState<Record<string, boolean>>({});
  const [erreurs, setErreurs] = useState<Record<string, string | null>>({});
  const [avis, setAvis] = useState<Record<string, string | null>>({});
  const [d20, setD20] = useState<Record<string, number | null>>({});
  const [deplie, setDeplie] = useState<string | null>(null);
  const [feuille, setFeuille] = useState<ModeToutelaTable | null>(null);

  function marquer(entityId: string, occupe: boolean) {
    setOccupes((prev) => ({ ...prev, [entityId]: occupe }));
  }

  /**
   * Un geste sur un PJ : la route de la fiche, puis la relecture de CE PJ. Le
   * résultat est rendu à l'appelant (la feuille « Toute la table » le montre par PJ) ;
   * l'erreur est aussi dite sur la carte, jamais avalée.
   */
  const geste: GestePj = async (pc, action, corps, delta) => {
    const id = pc.entityId;
    marquer(id, true);
    setErreurs((prev) => ({ ...prev, [id]: null }));
    setAvis((prev) => ({ ...prev, [id]: null }));
    const fait = await posterGeste(id, action, { campaignId, ...corps });
    if (!fait.ok) {
      setErreurs((prev) => ({ ...prev, [id]: fait.erreur ?? t("erreurGeste") }));
      marquer(id, false);
      return fait;
    }
    const bourse = action === "currency" ? lireBourse(fait.donnees) : null;
    const etat = await relirePj(id, campaignId);
    if (etat.ok) {
      setPcs((prev) => prev.map((p) => (p.entityId === id ? fusionnerEtat(p, etat.donnees, bourse ?? undefined) : p)));
    } else {
      setErreurs((prev) => ({ ...prev, [id]: etat.erreur ?? t("erreurRelecture") }));
      if (bourse) setPcs((prev) => prev.map((p) => (p.entityId === id ? { ...p, currency: bourse } : p)));
    }
    if (bourse && delta && changeFait(pc.currency, delta, bourse)) {
      setAvis((prev) => ({ ...prev, [id]: t("changeFait") }));
    }
    marquer(id, false);
    return fait;
  };

  async function jetDeMort(pc: TablePc) {
    const resultat = await geste(pc, "death-save", { natural: null });
    if (!resultat.ok) return;
    const corps = resultat.donnees;
    const natural = corps && typeof corps === "object" ? (corps as { natural?: unknown }).natural : null;
    setD20((prev) => ({ ...prev, [pc.entityId]: typeof natural === "number" ? natural : null }));
  }

  /** Une sauvegarde répondue a pu changer les PV ou les états de sa cible : on relit ce seul PJ. */
  async function relireCible(demande: DemandeSauvegarde) {
    const id = demande.target_entity_id;
    if (!id) return;
    const etat = await relirePj(id, campaignId);
    if (etat.ok) {
      setPcs((prev) => prev.map((p) => (p.entityId === id ? fusionnerEtat(p, etat.donnees) : p)));
    } else {
      setErreurs((prev) => ({ ...prev, [id]: etat.erreur ?? t("erreurRelecture") }));
    }
  }

  if (!campaignId) {
    return <p className="text-sm italic text-ink-muted">{t("aucuneCampagne")}</p>;
  }

  const cartes = pcs.map((pc) => (
    <ContenuPj
      key={pc.entityId}
      worldSlug={worldSlug}
      pc={pc}
      occupe={occupes[pc.entityId] ?? false}
      erreur={erreurs[pc.entityId] ?? null}
      avis={avis[pc.entityId] ?? null}
      dernierD20={d20[pc.entityId] ?? null}
      conditions={conditions}
      geste={geste}
      onJetDeMort={() => jetDeMort(pc)}
    />
  ));

  return (
    <div className="@container flex flex-col gap-4">
      <div>
        <h1 className="block-title text-base">{t("titre")}</h1>
        <p className="text-xs text-ink-muted">{t("description")}</p>
      </div>

      {/* V3.1-112 : toutes les sauvegardes en attente (hors combat ; celles d'un combat ouvert y figurent aussi). */}
      <ListeSauvegardesMj
        campaignId={campaignId}
        demandes={sauvegardes}
        nomDeLaCible={(d) => {
          const pc = pcs.find((p) => p.entityId === d.target_entity_id);
          return pc ? (pc.playerName ?? pc.name) : null;
        }}
        onRepondue={(d) => void relireCible(d)}
      />

      {pcs.length === 0 ? (
        <p className="text-sm italic text-ink-muted">{t("aucunPj")}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("toutelaTable")}>
            <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("toutelaTable")}</span>
            <button type="button" onClick={() => setFeuille("xp")} className={PILULE}>
              {t("ajouterXp")}
            </button>
            <button type="button" onClick={() => setFeuille("pieces")} className={PILULE}>
              {t("pieces")}
            </button>
            <button type="button" onClick={() => setFeuille("reposCourt")} className={PILULE}>
              {t("reposCourt")}
            </button>
            <button type="button" onClick={() => setFeuille("reposLong")} className={PILULE}>
              {t("reposLong")}
            </button>
          </div>

          {estTelephone ? (
            <ul className="no-scrollbar flex flex-col gap-2">
              {pcs.map((pc, index) => (
                <LigneTelephone
                  key={pc.entityId}
                  pc={pc}
                  deplie={deplie === pc.entityId}
                  occupe={occupes[pc.entityId] ?? false}
                  onBasculer={() => setDeplie((courant) => (courant === pc.entityId ? null : pc.entityId))}
                  onSoigner={() => geste(pc, "hp", { delta: 1 })}
                >
                  {cartes[index]}
                </LigneTelephone>
              ))}
            </ul>
          ) : (
            <div className="grid grid-cols-1 items-start gap-3 @min-[56rem]:grid-cols-2">
              {pcs.map((pc, index) => (
                <section key={pc.entityId} className="@container flex flex-col gap-3 rounded-md border border-edge/60 bg-panel-raised p-3">
                  <EnTetePj pc={pc} />
                  {cartes[index]}
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {feuille && <FeuilleToutelaTable mode={feuille} pcs={pcs} geste={geste} onFermer={() => setFeuille(null)} />}
    </div>
  );
}

/** Nom, niveau et joueur à gauche ; classe et sous-classe à droite. */
function EnTetePj({ pc }: { pc: TablePc }) {
  const t = useTranslations("table");
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold text-ink">
          {pc.name} <span className="font-normal text-ink-muted">{t("niveau", { niveau: pc.level })}</span>
        </h2>
        {pc.playerName && <p className="truncate text-xs text-ink-muted">{pc.playerName}</p>}
      </div>
      {pc.classesLabel && <p className="text-right text-xs text-ink-soft">{pc.classesLabel}</p>}
    </header>
  );
}

/**
 * Une ligne repliée du téléphone : nom + niveau ; dessous « joueur · CA · PV »
 * puis les états ; à droite classe et sous-classe. Toucher déplie. À 0 PV, la
 * ligne devient rouge : « Contre la mort », les jets et « Soigner +1 PV ».
 */
function LigneTelephone({
  pc,
  deplie,
  occupe,
  onBasculer,
  onSoigner,
  children,
}: {
  pc: TablePc;
  deplie: boolean;
  occupe: boolean;
  onBasculer: () => void;
  onSoigner: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("table");
  const ligne = ligneRepliee(pc);
  const aZeroPv = ligne.etat !== "vivant";
  const { success, fail } = pc.runtimeState.state.death_saves;
  const sousLigne = [ligne.joueur, `${t("ca")} ${ligne.ca}`, `${t("pv")} ${ligne.pv}`].filter(Boolean).join(" · ");

  return (
    <li className={`rounded-md border ${aZeroPv ? "border-danger bg-danger/10" : "border-edge/60 bg-panel-raised"}`}>
      <button
        type="button"
        onClick={onBasculer}
        aria-expanded={deplie}
        aria-label={t(deplie ? "replier" : "deplier", { nom: ligne.nom })}
        className="flex min-h-11 w-full items-start gap-2 px-3 py-2 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">
            {ligne.nom} <span className="font-normal text-ink-muted">{t("niveau", { niveau: ligne.niveau })}</span>
          </span>
          {aZeroPv ? (
            <span className="block text-xs font-bold uppercase tracking-wide text-danger">
              {ligne.etat === "mort" ? t("mort") : ligne.etat === "stabilisé" ? t("stabilise") : t("contreLaMort")}
            </span>
          ) : (
            <span className="block truncate text-xs text-ink-muted">{sousLigne}</span>
          )}
          {ligne.etats.length > 0 && (
            <span className="mt-1 flex flex-wrap gap-1">
              {ligne.etats.map((etat) => (
                <span key={etat} className="rounded-full border border-danger px-2 py-0.5 text-xs text-danger">
                  {conditionLabel(etat)}
                </span>
              ))}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-start gap-1">
          {ligne.classes && <span className="max-w-[9rem] text-right text-xs text-ink-soft">{ligne.classes}</span>}
          <span aria-hidden="true" className="text-xs text-ink-muted">
            {deplie ? "▴" : "▾"}
          </span>
        </span>
      </button>

      {aZeroPv && ligne.etat === "mourant" && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 pb-2 text-xs text-ink">
          <span>
            {t("reussites")} <Ronds compte={success} /> <span className="sr-only">{success} / 3</span>
          </span>
          <span className="text-danger">
            {t("echecs")} <Ronds compte={fail} /> <span className="sr-only">{fail} / 3</span>
          </span>
        </div>
      )}
      {aZeroPv && ligne.etat !== "mort" && (
        <div className="px-3 pb-2">
          <button type="button" disabled={occupe} onClick={onSoigner} className={`min-h-9 ${PILULE} border-danger/60`}>
            {t("soignerUnPv")}
          </button>
        </div>
      )}

      {deplie && <div className="@container flex flex-col gap-3 border-t border-edge/60 px-3 py-3">{children}</div>}
    </li>
  );
}

/**
 * Le contenu d'un PJ, identique sur la carte de l'ordinateur et dans la ligne
 * dépliée du téléphone : le haut de fiche, « Ce qui se dépense », la charge, les
 * pièces, les repos du PJ.
 */
function ContenuPj({
  worldSlug,
  pc,
  occupe,
  erreur,
  avis,
  dernierD20,
  conditions,
  geste,
  onJetDeMort,
}: {
  worldSlug: string;
  pc: TablePc;
  occupe: boolean;
  erreur: string | null;
  avis: string | null;
  dernierD20: number | null;
  conditions: string[];
  geste: GestePj;
  onJetDeMort: () => void;
}) {
  const t = useTranslations("table");
  const etat = pc.runtimeState.state;
  const hpMax = pc.runtimeState.hpMax;
  const { xpCeiling, xpPct } = progressionXp(pc.level, etat.xp);
  const groupes = groupesDeCompteurs(pc.resources);
  const encombrement = pc.sheet.encumbrance;
  const nomGroupe = { reposCourt: t("groupeReposCourt"), reposLong: t("groupeReposLong"), autres: t("groupeAutres") } as const;

  return (
    <>
      <RangeeChiffree
        worldSlug={worldSlug}
        sheet={pc.sheet}
        pret
        busy={occupe}
        exhaustion={etat.exhaustion}
        onChangeExhaustion={(delta) => geste(pc, "exhaustion", { delta })}
        inspiration={etat.inspiration}
        onChangeInspiration={(delta) => geste(pc, "inspiration", { delta })}
        conditions={etat.conditions}
        hpCurrent={etat.hp.current}
        hpTemp={etat.hp.temp}
        hpMax={hpMax}
        hpLow={pvSousUnTiers(etat.hp.current, hpMax)}
        onChangeHp={(delta) => geste(pc, "hp", { delta })}
        xpCurrent={etat.xp}
        xpCeiling={xpCeiling}
        xpPct={xpPct}
        totalLevel={pc.level}
        xpLevelThresholdsLength={XP_LEVEL_THRESHOLDS.length}
        onChangeXp={(delta) => geste(pc, "xp", { delta })}
        etatMourant={lireEtatMourant({ current: etat.hp.current }, etat.death_saves)}
        deathSaves={etat.death_saves}
        dernierD20={dernierD20}
        onJetDeMort={onJetDeMort}
        concentration={etat.concentration}
        desDeVie={desDeVie(pc)}
        onChangeHitDice={(die, delta) => geste(pc, "hit-dice", { die, delta })}
        onRetirerEtat={(nom) => geste(pc, "conditions", { remove: nom })}
        onAjouterEtat={(nom) => geste(pc, "conditions", { add: nom })}
        etatsDisponibles={conditions}
        onRompreConcentration={() => geste(pc, "concentration", {})}
      />

      {groupes.length > 0 && (
        <section className="flex flex-col gap-2" aria-label={t("ceQuiSeDepense")}>
          <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("ceQuiSeDepense")}</h3>
          {groupes.map((groupe) => (
            <div key={groupe.cle} className="flex flex-col gap-1">
              <span className="text-xs text-ink-muted">{nomGroupe[groupe.cle]}</span>
              <ul className="grid grid-cols-1 gap-1 @min-[28rem]:grid-cols-2">
                {groupe.compteurs.map((compteur) => (
                  <li key={compteur.id} className="flex items-center justify-between gap-2 rounded-md border border-edge/60 px-2 py-1">
                    <span className="min-w-0 truncate text-sm text-ink">{compteur.label}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        disabled={occupe || compteur.used <= 0}
                        onClick={() => geste(pc, "resource", { trackerId: compteur.id, delta: -1 })}
                        title={t("rendre", { nom: compteur.label })}
                        aria-label={t("rendre", { nom: compteur.label })}
                        className={PETIT_BOUTON}
                      >
                        ▼
                      </button>
                      <span className="min-w-[2.5rem] text-center text-sm font-semibold text-ink">
                        {compteur.used}/{compteur.max}
                      </span>
                      <button
                        type="button"
                        disabled={occupe || compteur.used >= compteur.max}
                        onClick={() => geste(pc, "resource", { trackerId: compteur.id, delta: 1 })}
                        title={t("depenser", { nom: compteur.label })}
                        aria-label={t("depenser", { nom: compteur.label })}
                        className={PETIT_BOUTON}
                      >
                        ▲
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2" aria-label={t("bourse")}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("charge")}</span>
          <span className={encombrement.tier !== "none" ? "text-danger" : "text-ink"}>
            {/* Le moteur compte en livres (SRD) ; l'écran affiche des kg. */}
            {t("chargeValeur", { carried: lbToKg(encombrement.carried), capacity: lbToKg(encombrement.capacity) })}
            {encombrement.tier !== "none" ? ` · ${t("encombre")}` : ""}
          </span>
        </div>
        <ul className="flex flex-wrap gap-2">
          {CURRENCY_ORDER.map((piece) => (
            <PieceLigne key={piece} pc={pc} piece={piece} occupe={occupe} geste={geste} />
          ))}
        </ul>
        {avis && (
          <p role="status" className="text-xs text-ink-muted">
            {avis}
          </p>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={occupe} onClick={() => geste(pc, "short-rest", { hitDiceSpent: {} })} className={PILULE}>
          {t("reposCourt")}
        </button>
        <button type="button" disabled={occupe} onClick={() => geste(pc, "long-rest", {})} className={PILULE}>
          {t("reposLong")}
        </button>
      </div>

      {erreur && (
        <p role="alert" className="text-xs text-danger">
          {erreur}
        </p>
      )}
    </>
  );
}

/** Une pièce de la bourse : son compte et ▲▼ d'une pièce (le serveur fait le change et refuse un fonds insuffisant). */
function PieceLigne({ pc, piece, occupe, geste }: { pc: TablePc; piece: CoinType; occupe: boolean; geste: GestePj }) {
  const t = useTranslations("table");
  const nom = t(`piece.${piece}`);
  const retirable = applyCurrencyDelta(pc.currency, { [piece]: -1 }) !== null;
  return (
    <li className="flex items-center gap-1.5 rounded-md border border-edge/60 px-2 py-1">
      <button
        type="button"
        disabled={occupe || !retirable}
        onClick={() => geste(pc, "currency", { delta: { [piece]: -1 } }, { [piece]: -1 })}
        title={t("retirerPiece", { piece: nom })}
        aria-label={t("retirerPiece", { piece: nom })}
        className={PETIT_BOUTON}
      >
        ▼
      </button>
      <span className="min-w-[3rem] text-center text-sm text-ink">
        <span className="font-semibold">{pc.currency[piece]}</span> <span className="text-ink-muted">{nom}</span>
      </span>
      <button
        type="button"
        disabled={occupe}
        onClick={() => geste(pc, "currency", { delta: { [piece]: 1 } }, { [piece]: 1 })}
        title={t("ajouterPiece", { piece: nom })}
        aria-label={t("ajouterPiece", { piece: nom })}
        className={PETIT_BOUTON}
      >
        ▲
      </button>
    </li>
  );
}

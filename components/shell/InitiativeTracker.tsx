"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import type { CombatRow, CombatParticipantRow } from "@/src/server/repos/combats";
import type { CombatDetail } from "@/src/server/services/combats";
import type { EncounterMonsterSummary } from "@/src/server/services/encounters";
import {
  adversairesSansInitiative,
  estUnPj,
  joueusesEnAttente,
  menaceRestante,
  nomOrigine,
  ordonner,
  peutCommencerRound,
  phaseDe,
  tousAdversairesVaincus,
} from "@/lib/ui/initiative";
import * as api from "@/lib/ui/initiativeApi";
import BandeauCombat from "./initiative/BandeauCombat";
import FormulaireAjout from "./initiative/FormulaireAjout";
import ListeCombats from "./initiative/ListeCombats";
import ListeSauvegardesMj from "./sauvegarde/ListeSauvegardesMj";
import { useSauvegardes } from "./SauvegardesProvider";
import { demandesDuCombat } from "@/lib/ui/sauvegardes";
import LigneParticipant from "./initiative/LigneParticipant";
import { detailsDepuisCaracteristiques, type DetailsParticipant } from "./initiative/ActionsParticipant";
import { useCombatTempsReel } from "./initiative/useCombatTempsReel";

/**
 * L'outil Initiative du MJ (V3.1-38, specs/outils-mj.md §5) : une ligne par
 * participant dans l'ordre du tour, le déroulé d'un combat (jets, Round 1,
 * suspension, fin confirmée) et toutes les actions de chacun, en deux boutons
 * qui ouvrent l'outil de dés. Un participant `entity` (PJ) écrit AUSSI la fiche
 * jouable (déjà garanti côté serveur par `patchCombatParticipant`) ; le temps
 * réel rapporte à l'inverse les changements de la joueuse sur sa fiche.
 *
 * Tous les appels réseau vivent dans `lib/ui/initiativeApi.ts` : ce composant
 * ne charge rien après l'affichage (docs/CABLAGE.md, C1).
 */
export default function InitiativeTracker({
  worldSlug,
  campaignId,
  initialCombat,
  savedCombats,
  pcOptions,
  monsters,
  conditions,
}: {
  worldSlug: string;
  campaignId: string;
  initialCombat: CombatDetail | null;
  savedCombats: CombatRow[];
  pcOptions: { id: string; name: string }[];
  monsters: EncounterMonsterSummary[];
  conditions: string[];
}) {
  const t = useTranslations("initiative");
  const { enAttente: enAttenteSauvegardes } = useSauvegardes();
  const [combat, setCombat] = useState<CombatRow | null>(initialCombat?.combat ?? null);
  const [participants, setParticipants] = useState<CombatParticipantRow[]>(initialCombat?.participants ?? []);
  const [combatsList, setCombatsList] = useState<CombatRow[]>(savedCombats);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const [terminaisonDemandee, setTerminaisonDemandee] = useState(false);
  const [quitterDemande, setQuitterDemande] = useState(false);
  /** « Continuer » après la fin proposée : la question ne revient que si un adversaire se relève puis retombe. */
  const [finRefusee, setFinRefusee] = useState(false);
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<Record<string, DetailsParticipant | "chargement" | "erreur">>({});

  const phase = combat ? phaseDe(combat.status) : "draft";
  const enCours = phase === "running";
  const xpParCle = useMemo(() => Object.fromEntries(monsters.map((m) => [m.key, m.xp])), [monsters]);
  const nomsParCle = useMemo(() => Object.fromEntries(monsters.map((m) => [m.key, m.name])), [monsters]);
  const menace = useMemo(() => menaceRestante(participants, xpParCle), [participants, xpParCle]);
  const joueusesQuiManquent = joueusesEnAttente(participants);
  const actif = enCours && combat ? (participants[combat.turn_index] ?? null) : null;
  const finProposee = enCours && tousAdversairesVaincus(participants) && !finRefusee;

  // ---- état local ----

  function poserParticipants(suite: CombatParticipantRow[]) {
    const ordre = ordonner(suite);
    setParticipants(ordre);
    if (!tousAdversairesVaincus(ordre)) setFinRefusee(false);
  }

  function poserCombat(ligne: CombatRow) {
    setCombat(ligne);
    setCombatsList((prev) => (prev.some((c) => c.id === ligne.id) ? prev.map((c) => (c.id === ligne.id ? ligne : c)) : [ligne, ...prev]));
  }

  /** Relit le combat ouvert et ses participants ; une erreur se voit. */
  async function relire(combatId: string) {
    const detail = await api.lireCombat(campaignId, combatId, t("erreurLecture"));
    poserCombat(detail.combat);
    poserParticipants(detail.participants);
  }

  /** Un geste du MJ : l'écran se met en attente, une erreur s'affiche, rien n'est avalé. */
  async function executer(geste: () => Promise<void>) {
    setOccupe(true);
    setErreur(null);
    try {
      await geste();
    } catch (e) {
      console.error("Geste d'initiative en échec", e);
      setErreur(e instanceof Error ? e.message : t("erreurGeste"));
    } finally {
      setOccupe(false);
    }
  }

  // ---- temps réel (un seul canal, refermé au démontage) ----

  useCombatTempsReel({
    campaignId,
    combatId: combat?.id ?? null,
    surLigne: (ligne) => {
      setCombatsList((prev) => (prev.some((c) => c.id === ligne.id) ? prev.map((c) => (c.id === ligne.id ? ligne : c)) : [ligne, ...prev]));
      setCombat((courant) => (courant && courant.id === ligne.id ? ligne : courant));
    },
    surChangement: () => {
      if (!combat) return;
      relire(combat.id).catch((e: unknown) => {
        console.error("Relecture du combat en échec", e);
        setErreur(e instanceof Error ? e.message : t("erreurLecture"));
      });
    },
  });

  // ---- dérouler les participants ----

  async function chargerDetails(p: CombatParticipantRow, combatId: string) {
    setDetails((prev) => ({ ...prev, [p.id]: "chargement" }));
    try {
      let lu: DetailsParticipant;
      if (p.source_kind === "entity" && p.entity_id) {
        lu = { kind: "personnage", blocs: await api.lireBlocsEntite(p.entity_id, t("erreurActions")) };
      } else if (p.source_kind === "statblock") {
        lu = detailsDepuisCaracteristiques(await api.lireCaracteristiques(campaignId, combatId, p.id, t("erreurActions")));
      } else {
        lu = { kind: "aucun" };
      }
      setDetails((prev) => ({ ...prev, [p.id]: lu }));
    } catch (e) {
      console.error("Actions du participant non lues", e);
      setDetails((prev) => ({ ...prev, [p.id]: "erreur" }));
    }
  }

  function ouvrir(p: CombatParticipantRow | null | undefined, combatId: string) {
    if (!p) return;
    setOuverts((prev) => (prev.has(p.id) ? prev : new Set(prev).add(p.id)));
    if (!details[p.id]) void chargerDetails(p, combatId);
  }

  function basculer(p: CombatParticipantRow) {
    if (!combat) return;
    if (ouverts.has(p.id)) {
      setOuverts((prev) => {
        const suite = new Set(prev);
        suite.delete(p.id);
        return suite;
      });
      return;
    }
    ouvrir(p, combat.id);
  }

  // ---- les combats ----

  async function choisirCombat(id: string) {
    await executer(async () => {
      const detail = await api.lireCombat(campaignId, id, t("erreurLecture"));
      setCombat(detail.combat);
      poserParticipants(detail.participants);
      setOuverts(new Set());
      setDetails({});
      setQuitterDemande(false);
      setFinRefusee(false);
    });
  }

  async function nouveauCombat() {
    await executer(async () => {
      const cree = await api.creerCombat(campaignId, t("erreurCreation"));
      poserCombat(cree);
      setParticipants([]);
      setOuverts(new Set());
      setDetails({});
    });
  }

  async function supprimerConfirme() {
    const id = aSupprimer;
    setASupprimer(null);
    if (!id) return;
    await executer(async () => {
      await api.supprimerCombat(campaignId, id, t("erreurGeste"));
      setCombatsList((prev) => prev.filter((c) => c.id !== id));
      if (combat?.id === id) {
        setCombat(null);
        setParticipants([]);
      }
    });
  }

  // ---- le déroulé ----

  async function commencer() {
    if (!combat) return;
    await executer(async () => {
      poserCombat(await api.changerStatut(campaignId, combat.id, "rolling", t("erreurGeste")));
      await api.lancerInitiatives(campaignId, combat.id, adversairesSansInitiative(participants).map((p) => p.id), t("erreurGeste"));
      await relire(combat.id);
    });
  }

  async function round1() {
    if (!combat) return;
    await executer(async () => {
      poserCombat(await api.commencerRound(campaignId, combat.id, t("erreurGeste")));
      ouvrir(participants[0], combat.id);
    });
  }

  async function terminer() {
    if (!combat) return;
    setTerminaisonDemandee(false);
    await executer(async () => {
      poserCombat(await api.terminerCombat(campaignId, combat.id, t("erreurGeste")));
    });
  }

  async function quitter() {
    if (!combat) return;
    setQuitterDemande(false);
    await executer(async () => {
      poserCombat(await api.suspendreCombat(campaignId, combat.id, t("erreurGeste")));
    });
  }

  async function reprendre() {
    if (!combat) return;
    await executer(async () => {
      poserCombat(await api.reprendreCombat(campaignId, combat.id, t("erreurGeste")));
    });
  }

  async function recommencer() {
    if (!combat) return;
    await executer(async () => {
      poserCombat(await api.recommencerCombat(campaignId, combat.id, t("erreurGeste")));
      await api.lancerInitiatives(campaignId, combat.id, participants.filter((p) => !estUnPj(p)).map((p) => p.id), t("erreurGeste"));
      await relire(combat.id);
    });
  }

  async function rouvrir() {
    if (!combat) return;
    await executer(async () => {
      poserCombat(await api.changerStatut(campaignId, combat.id, "draft", t("erreurGeste")));
    });
  }

  async function changerTour(sens: "next" | "previous") {
    if (!combat) return;
    await executer(async () => {
      const ligne = await api.changerTour(campaignId, combat.id, sens, t("erreurGeste"));
      poserCombat(ligne);
      ouvrir(participants[ligne.turn_index], combat.id);
    });
  }

  async function annuler() {
    if (!combat) return;
    await executer(async () => {
      await api.annulerDerniereAction(campaignId, combat.id, t("rienAAnnuler"));
      await relire(combat.id);
    });
  }

  // ---- les participants ----

  async function modifier(p: CombatParticipantRow, correctif: api.CorrectifParticipant, note: string) {
    if (!combat) return;
    await executer(async () => {
      const mis = await api.modifierParticipant(campaignId, combat.id, p.id, correctif, note, t("erreurGeste"));
      poserParticipants(participants.map((x) => (x.id === p.id ? mis : x)));
    });
  }

  async function ajouter(ajout: api.AjoutParticipant): Promise<boolean> {
    if (!combat) return false;
    let reussi = false;
    await executer(async () => {
      const ajoute = await api.ajouterParticipant(campaignId, combat.id, ajout, t("erreurAjout"));
      poserParticipants([...participants, ajoute]);
      if (ajout.sourceKind === "custom" && ajout.hpMax !== null && ajoute.hp_max === null) setErreur(t("erreurPvNonEnregistres"));
      setAjoutOuvert(false);
      reussi = true;
    });
    return reussi;
  }

  async function retirer(p: CombatParticipantRow) {
    if (!combat) return;
    await executer(async () => {
      await api.retirerParticipant(campaignId, combat.id, p.id, t("erreurGeste"));
      poserParticipants(participants.filter((x) => x.id !== p.id));
    });
  }

  async function relancer(p: CombatParticipantRow) {
    if (!combat) return;
    await executer(async () => {
      await api.lancerInitiatives(campaignId, combat.id, [p.id], t("erreurGeste"));
      await relire(combat.id);
    });
  }

  const dialogues = (
    <>
      <ConfirmDialog
        open={aSupprimer !== null}
        title={t("supprimerTitre")}
        message={t("supprimerMessage")}
        confirmLabel={t("supprimer")}
        danger
        onConfirm={supprimerConfirme}
        onCancel={() => setASupprimer(null)}
      />
      <ConfirmDialog
        open={terminaisonDemandee}
        title={t("terminerTitre")}
        message={t("terminerMessage")}
        confirmLabel={t("terminer")}
        danger
        onConfirm={terminer}
        onCancel={() => setTerminaisonDemandee(false)}
      />
    </>
  );

  if (!combat) {
    return (
      <div className="@container flex flex-col gap-3">
        {erreur && <p role="alert" className="text-xs text-danger">{erreur}</p>}
        <button
          type="button"
          onClick={nouveauCombat}
          disabled={occupe}
          className="self-start rounded-full border border-accent px-4 py-1.5 text-sm text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
        >
          {t("nouveauCombat")}
        </button>
        <p className="text-xs italic text-ink-muted">{t("ouRencontres")}</p>
        <ListeCombats combats={combatsList} actifId={null} onChoisir={choisirCombat} onSupprimer={setASupprimer} />
        {dialogues}
      </div>
    );
  }

  return (
    <div className="@container flex flex-col gap-3">
      <BandeauCombat
        combat={combat}
        phase={phase}
        menace={menace}
        tourDe={actif?.label ?? null}
        occupe={occupe}
        aDesParticipants={participants.length > 0}
        enAttente={joueusesQuiManquent.map((p) => p.label)}
        peutRound={peutCommencerRound(participants)}
        finProposee={finProposee}
        quitterDemande={quitterDemande}
        actions={{
          onNom: (nom) => {
            void executer(async () => {
              poserCombat(await api.renommerCombat(campaignId, combat.id, nom, t("erreurGeste")));
            });
          },
          onAjouter: () => setAjoutOuvert((v) => !v),
          onAnnuler: () => void annuler(),
          onCommencer: () => void commencer(),
          onRound: () => void round1(),
          onTerminer: () => setTerminaisonDemandee(true),
          onQuitter: () => setQuitterDemande(true),
          onQuitterOui: () => void quitter(),
          onQuitterNon: () => setQuitterDemande(false),
          onReprendre: () => void reprendre(),
          onRecommencer: () => void recommencer(),
          onRouvrir: () => void rouvrir(),
          onTour: (sens) => void changerTour(sens),
          onFinContinuer: () => setFinRefusee(true),
          onFinTerminer: () => void terminer(),
        }}
      />

      {/* V3.1-112 : les sauvegardes demandées dans ce combat (rien tant qu'il n'y en a pas). */}
      <ListeSauvegardesMj
        campaignId={campaignId}
        demandes={demandesDuCombat(enAttenteSauvegardes, combat.id)}
        nomDeLaCible={(d) => participants.find((x) => x.id === d.target_id)?.label ?? null}
        onRepondue={() => {
          relire(combat.id).catch((e: unknown) => {
            console.error("Relecture après une sauvegarde en échec", e);
            setErreur(e instanceof Error ? e.message : t("erreurLecture"));
          });
        }}
      />

      {erreur && (
        <p role="alert" className="text-xs text-danger">
          {erreur}
        </p>
      )}

      {ajoutOuvert && <FormulaireAjout pcOptions={pcOptions} monsters={monsters} occupe={occupe} onAjouter={ajouter} />}

      <section className="rounded-[18px] border border-edge bg-panel p-2 backdrop-blur-[var(--blur)]">
        {participants.length === 0 ? (
          <p className="px-2 py-3 text-xs italic text-ink-muted">{t("aucunParticipant")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {participants.map((p) => (
              <LigneParticipant
                key={p.id}
                participant={p}
                worldSlug={worldSlug}
                campaignId={campaignId}
                combatId={combat.id}
                participants={participants}
                actif={actif?.id === p.id}
                ouvert={ouverts.has(p.id)}
                enCours={enCours}
                occupe={occupe}
                nomOrigine={nomOrigine(p, nomsParCle)}
                etatsDisponibles={conditions}
                details={details[p.id]}
                onBasculer={() => basculer(p)}
                onModifier={(correctif, note) => modifier(p, correctif, note)}
                onRetirer={() => void retirer(p)}
                onRelancer={() => void relancer(p)}
                apresJet={() => {
                  relire(combat.id).catch((e: unknown) => {
                    console.error("Relecture après un jet en échec", e);
                    setErreur(e instanceof Error ? e.message : t("erreurLecture"));
                  });
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <ListeCombats combats={combatsList} actifId={combat.id} onChoisir={choisirCombat} onSupprimer={setASupprimer} />
      {dialogues}
    </div>
  );
}

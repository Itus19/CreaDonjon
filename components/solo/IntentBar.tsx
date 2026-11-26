"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import BulleFlottante from "@/components/shared/BulleFlottante";
import Dropdown from "@/components/shared/Dropdown";
import { interpretIntent, looksLikeQuestion, type IntentAction, type MechanicalIntentKind } from "@/src/core/rules/intent";
import { z } from "zod";
import { GM_QUESTION_MARKERS_FR, TRADE_LODGING_TERMS_FR, formatCpFr } from "@/src/i18n/fr";
import { interpretTrade, tradeOffersFromPriceList, type TradeDirection, type TradeOfferEntry, type TradeReading } from "@/src/core/rules/tradeIntent";
import { zPriceListBlockData } from "@/src/core/schemas/blocks/priceList";
import type { AdvantageState } from "@/src/core/rules/action";
import type { EncashedTurnResponse, IntentBarData, PendingRequest, PendingTurnResponse, RaisonSansNarration, SceneView, TurnOutcome } from "@/lib/solo/types";
import DieIcon from "@/components/shared/DieIcon";
import { useDiceRoll } from "@/components/shell/DiceRollPanel";
import { ErreurLancer, type SortieJet } from "@/lib/ui/outilDes";
import { preReglageDepuisDemande, sortieAttenteReactions, sortieJetDepuisTour } from "@/lib/ui/solo";
import { encaisserDepuisFiche, raconterTour } from "@/lib/ui/soloApi";
import { useSoloContexte } from "@/components/solo/SoloContexte";

/**
 * **La bulle à hauteur fixe** (esquisse validée par l'auteur le 25 novembre).
 * Trois rangées, quel que soit l'état : l'en-tête, où le moteur dit ce qu'il a
 * compris (type, arme, cible, en pastilles cliquables) ; le champ, avec Jouer
 * et MJ collés à sa droite ; la ligne d'état de l'IA, que l'erreur et l'attente
 * remplacent au lieu de s'y ajouter, avec le choix du modèle au bout. Ce qui
 * était une rangée de plus (correction, détail du fournisseur) s'ouvre en bulle
 * flottante par-dessus le récit. Avant, le cadre passait de 175 à plus de
 * 380 px selon l'état et faisait sauter le fil à chaque frappe. Seul un texte
 * long le fait encore grandir, jusqu'à trois lignes, vers le haut.
 *
 * V3.2-2 : le bloc d'interprétation est séparé par un FILET, jamais par un
 * troisième cadre — le panneau en porte un, le champ aussi, et trois
 * bordures emboîtées se lisaient comme un défaut de dessin.
 *
 * V3-B1 — La barre d'intention.
 *
 * Le joueur ecrit librement ; **rien ne part avant que la mecanique soit
 * resolue**, et la proposition du moteur est affichee AVANT d'etre
 * executee. C'est la reponse d'ADR 0009 au defaut de S1 : une case a cocher
 * facultative ne suffit pas, il faut que la mecanique soit le chemin.
 *
 * La lecture de la phrase se fait ICI, dans le navigateur, parce que
 * `interpretIntent` est un module pur du noyau : la proposition s'affiche
 * en frappant, sans aller-retour. Elle n'engage rien — le serveur ne
 * recoit jamais la phrase a interpreter, seulement le CHOIX retenu.
 *
 * **V3-D4 Phase 2 — un seul champ.** L'ancien panneau « Jet demandé »
 * séparé (avec son propre champ « Dé annoncé ») a disparu : ce MÊME champ
 * change de rôle quand une demande est posée — bordure à l'accent, texte
 * temporaire qui devient la demande, et ce que le joueur y tape devient le
 * naturel annoncé plutôt qu'une phrase à interpréter. `pending` est
 * possédé par `SoloScreen.tsx` (sondé au même rythme que le fil) : une
 * demande honorée depuis la fiche (colonne voisine, V3-B5 Phase 2) se
 * répercute donc ici sans qu'IntentBar l'ait lui-même demandée.
 *
 * **Ce que ce ticket NE change PAS, et pourquoi.** Un jet fait depuis la
 * fiche ou le volet de dés continue de résoudre DIRECTEMENT (V3-B5 Phase
 * 2, déjà vérifié en direct) plutôt que de s'inscrire en texte ici pour
 * exiger un second clic — les deux colonnes sont des arbres React
 * distincts, et faire remonter un texte de l'une vers l'autre aurait exigé
 * un canal de plus pour un gain douteux (un pas de plus là où B5 en
 * demande déjà un de moins). Le champ unique porte donc le chemin « annoncé
 * à la main », le seul qui n'avait pas déjà de résolution directe.
 *
 * **V3-D4, bouton `MJ`.** Deux boutons côte à côte : `Jouer` résout le
 * tour et fait avancer l'horloge (chemin déjà existant) ; `MJ` pose la
 * même phrase comme une question hors du temps de jeu (`askSoloGm`,
 * `src/server/ai/soloGmQuestion.ts`) — la scène ne bouge pas, aucun jet
 * n'est lancé. `looksLikeQuestion` (noyau pur, lexique fermé de
 * `src/i18n/fr.ts`) devine laquelle des deux l'utilisateur vise et fait
 * PASSER DEVANT le bouton correspondant (style primaire) — jamais un
 * reroutage silencieux : les deux boutons restent cliquables quoi que la
 * détection réponde. `lastAttempt` retient lequel des deux a été tenté en
 * dernier, pour que « Réessayer » rejoue le bon chemin après un échec.
 */

const KIND_LABELS: Record<MechanicalIntentKind, string> = {
  weapon_attack: "Attaque",
  skill_check: "Test",
  ability_check: "Test",
  saving_throw: "Sauvegarde",
};

/** Les familles du menu « Arme ou action ». */
const KIND_GROUPS: Record<MechanicalIntentKind, string> = {
  weapon_attack: "Attaques",
  skill_check: "Tests de compétence",
  ability_check: "Tests de caractéristique",
  saving_throw: "Sauvegardes",
};

const ADVANTAGE_LABELS: Record<AdvantageState, string> = {
  disadvantage: "désavantage",
  normal: "normal",
  advantage: "avantage",
};

/**
 * Jouer et MJ, collés au champ : même hauteur que lui sur une ligne (36 px),
 * d'où `py-2 text-sm` pour les deux, le principal comme le secondaire (charte §3,
 * versions confortables).
 */
const BTN_PRIMARY =
  "shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50";
const BTN_SECONDARY =
  "shrink-0 rounded-full border border-edge px-4 py-2 text-sm text-ink transition-colors hover:bg-panel-raised disabled:opacity-50";
/** Le bouton du dé, à côté d'« Annoncer » : même hauteur, icône seule. */
const BTN_ICONE =
  "shrink-0 rounded-full border border-edge px-3 py-2 text-ink transition-colors hover:bg-panel-raised disabled:opacity-50";
/** Le petit bouton de la ligne d'état (« Réessayer ») et des bulles. */
const BTN_PETIT =
  "rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50";
/**
 * Une pastille de l'en-tête (charte §3, « Puce » en version dense) : 20 px de haut
 * pour tenir dans la rangée, zone cliquable étendue à 28 px par le pseudo-élément
 * (charte §4). Même dessin que `Dropdown forme="pastille"`.
 */
const PASTILLE =
  "relative inline-flex max-w-[11rem] shrink-0 items-center gap-1 rounded-full border px-2 text-xs leading-[18px] transition-colors hover:bg-panel-raised before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']";

/** V3.2-10 : la famille d'un échange, et le verbe de son bouton. V3.2-11 : régler l'ardoise. */
const TRADE_LABELS: Record<TradeDirection, { chip: string; verb: string; button: string }> = {
  buy: { chip: "Achat", verb: "Acheter", button: "Payer" },
  sell: { chip: "Vente", verb: "Vendre", button: "Vendre" },
  give: { chip: "Don", verb: "Donner", button: "Donner" },
  settle: { chip: "Ardoise", verb: "Régler", button: "Payer" },
};

/** « « Une nuit à l'auberge », à Mabelle — 5 pa », ce que le moteur a compris de l'échange. */
function tradeSentence(trade: TradeReading): string {
  const what = trade.direction === "buy" ? `« ${trade.label} »` : trade.direction === "settle" ? trade.label.toLowerCase() : trade.label;
  const to = trade.target ? `, à ${trade.target.label}` : "";
  const price = trade.direction === "give" ? "" : trade.priceCp === null ? " — prix inconnu" : ` — ${trade.priceCp === 0 ? "gratuit" : formatCpFr(trade.priceCp)}`;
  return `${what}${to}${price}`;
}

/** 1 à 3 lignes — mesuré sur `text-sm` (20px de ligne) plus le padding vertical du champ (2 × 8px). */
const LINE_HEIGHT_PX = 20;
const FIELD_PADDING_PX = 16;
const MAX_LINES = 3;

export default function IntentBar({
  worldSlug,
  campaignId,
  entityId,
  data,
  pending,
  onPendingChange,
  onActed,
  onSceneMoved,
  onEnCours,
  onNarration,
  etatIa,
  choixModele,
  montrerIssue,
  suivreEnvoi,
}: {
  worldSlug: string;
  campaignId: string | null;
  entityId: string;
  data: IntentBarData;
  /** V3-D4 — possédée par `SoloScreen.tsx`, pas par cette barre (voir le commentaire d'en-tête). */
  pending: PendingRequest | null;
  onPendingChange: (next: PendingRequest | null) => void;
  /** Appelé après toute action confirmée par le serveur (pose ou encaissement) — `SoloScreen.tsx` en profite pour rafraîchir le fil tout de suite, sans attendre son sondage. */
  onActed?: () => void;
  /** V3.2-19 — la narration a déplacé la scène : la nouvelle, telle que le moteur l'a posée. */
  onSceneMoved?: (scene: SceneView) => void;
  /** V3.2-3 : un tour est en route — l'écran montre que quelque chose se passe pendant les 10 à 20 s du modèle local. */
  onEnCours?: (enCours: boolean) => void;
  /** V3.2-3 : le modèle a répondu (`null`), ou pourquoi il est resté muet (V3.1-223). Lu du DERNIER tour, jamais d'un sondage (docs/QUOTAS.md). */
  onNarration?: (sansNarration: RaisonSansNarration | null, detail?: string) => void;
  /** Le voyant et le message court de l'état du fournisseur d'IA (`SoloScreen.tsx`), à gauche de la dernière rangée. Une erreur ou l'attente le remplacent. */
  etatIa?: ReactNode;
  /** Le choix du modèle (`SoloScreen.tsx`), au bout de la dernière rangée. */
  choixModele?: ReactNode;
  /**
   * Appelé au moment d'envoyer ; rend de quoi vérifier, après un échec, si le
   * tour ou la question est QUAND MÊME arrivé au fil. Le serveur enregistre le
   * récit avant de répondre : une réponse perdue (délai, réseau) laissait
   * l'erreur affichée et la phrase dans le champ alors que l'IA avait raconté.
   */
  suivreEnvoi?: (texte: string, genre: "tour" | "mj") => () => Promise<boolean>;
  /** V3.2-20 : réglage de partie — coupé, l'en-tête de la demande tait le DD (et la CA). */
  montrerIssue: boolean;
}) {
  const [text, setText] = useState("");
  // V3.2-18 : l'heure rendue par chaque tour, pour le bandeau (rendu une fois par la page serveur).
  const { definirHeure } = useSoloContexte();
  const [overrideActionId, setOverrideActionId] = useState<string | null>(null);
  const [overrideTargetId, setOverrideTargetId] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const fermerCorrection = useCallback(() => setCorrecting(false), []);
  /** V3.2-10 : « ce n'est pas ça » sur un échange — la phrase repart dans la lecture ordinaire (jet ou action libre). */
  const [tradeDismissed, setTradeDismissed] = useState(false);
  const [drawingCarte, setDrawingCarte] = useState(false);
  /** V3.2-10 : la carte tout juste tirée, lue sur place plutôt que par un rafraîchissement complet de la page (docs/CABLAGE.md). */
  const [carteTiree, setCarteTiree] = useState<TradeOfferEntry[] | null>(null);
  const tradeCatalog = useMemo(() => (carteTiree ? { ...data.trade, offers: carteTiree, hasPriceList: true } : data.trade), [carteTiree, data.trade]);
  const [advantage, setAdvantage] = useState<AdvantageState>("normal");
  const [dc, setDc] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** V3-D4 — quel bouton retenter avec « Réessayer » : `submit` (Jouer/Annoncer, selon `pending`) ou `mj`. */
  const [lastAttempt, setLastAttempt] = useState<"submit" | "mj">("submit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { openDiceTool } = useDiceRoll();

  const proposal = useMemo(() => interpretIntent(text, data.catalog), [text, data.catalog]);
  // V3.2-10 : un échange (verbe ET offre de la carte ou objet du sac) passe
  // avant les jets — sinon « je vends ma dague » proposerait une attaque à la dague.
  const tradeReading = useMemo(() => interpretTrade(text, tradeCatalog, data.catalog.targets), [text, tradeCatalog, data.catalog.targets]);
  const trade = !tradeDismissed && tradeReading?.kind === "trade" ? tradeReading : null;
  const tradeShortCp =
    (trade?.direction === "buy" || trade?.direction === "settle") && trade.priceCp !== null && trade.priceCp > tradeCatalog.purseCp ? trade.priceCp - tradeCatalog.purseCp : 0;
  const tradeBlocked = trade?.direction === "sell" && trade.priceCp === null;
  // V3.2-11 : ce qui se consomme sur place (une offre sans fiche de règle) peut aller sur l'ardoise, en campagne seulement.
  const canPutOnTab =
    campaignId !== null && trade?.direction === "buy" && tradeCatalog.offers.some((o) => o.id === trade.entryId && o.ruleKey === null);

  /**
   * Une correction porte sur LA phrase corrigee. Reecrire la phrase repart
   * de la lecture du moteur, sinon un choix fait pour « je frappe » se
   * collerait silencieusement au tour suivant.
   *
   * Remis a zero dans le gestionnaire de saisie, jamais dans un effet : un
   * effet qui appelle `setState` declenche un second rendu pour rien, et
   * ici l'evenement qui invalide la correction est connu — c'est la frappe.
   */
  function changeText(next: string) {
    setText(next);
    setOverrideActionId(null);
    setOverrideTargetId(null);
    setCorrecting(false);
    setTradeDismissed(false);
  }

  // Le champ change de role des qu'une demande apparait ou disparait —
  // qu'elle vienne de CETTE barre ou de la fiche (`pending` est un prop,
  // sondé par le parent). Vider le texte a ce moment-la evite qu'un
  // brouillon d'action a moitie tape se retrouve interprete comme un
  // naturel, ou l'inverse. Ajuste PENDANT le rendu (pas dans un effet) —
  // le motif React recommande pour « reinitialiser un etat quand une prop
  // change », qui evite une passe de rendu supplementaire.
  const pendingKey = pending ? `${pending.kind}:${pending.action_id}` : null;
  const [lastPendingKey, setLastPendingKey] = useState(pendingKey);
  if (pendingKey !== lastPendingKey) {
    setLastPendingKey(pendingKey);
    setText("");
    // V3.2-20 : la demande est honorée, d'où qu'elle soit lancée (pastille, outil, fiche) : le DD saisi ne vaut plus.
    if (pendingKey === null) setDc("");
  }

  // Grandit avec son CONTENU (1 a 8 lignes) — colle a `scrollHeight`,
  // que le texte vienne de la frappe ou d'une valeur posee par du code.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = LINE_HEIGHT_PX * MAX_LINES + FIELD_PADDING_PX;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [text]);

  // `actions` melange plusieurs familles sous le meme identifiant (« dex »
  // est a la fois un test et une sauvegarde) : la cle d'option porte donc
  // la famille, jamais l'identifiant seul.
  const optionKey = (action: IntentAction) => `${action.kind}:${action.id}`;
  const chosenAction: IntentAction | null =
    (overrideActionId ? (data.catalog.actions.find((a) => optionKey(a) === overrideActionId) ?? null) : null) ??
    (proposal.kind === "mechanical" ? proposal.action : null);

  const proposedTargetId = proposal.kind === "mechanical" ? (proposal.target?.id ?? null) : null;
  const chosenTargetId = overrideTargetId === null ? proposedTargetId : overrideTargetId === "" ? null : overrideTargetId;
  const chosenTarget = data.targetDetails.find((t) => t.id === chosenTargetId) ?? null;
  const corrected = overrideActionId !== null || overrideTargetId !== null;
  const needsDc = chosenAction !== null && chosenAction.kind !== "weapon_attack";

  /**
   * V3.1-36 — le bouton dé de la barre ouvre l'outil de dés (ADR 0035) sur la
   * demande posée. « Lancer » y fait le même encaissement que les boutons de la
   * fiche : le serveur tire le dé et encaisse. V3.2-20 : l'outil ne s'ouvre plus
   * tout seul (ni à la pose, ni pour des dégâts chaînés) — la pastille du fil
   * (`PastilleJet`) est le chemin ordinaire, l'outil un recours.
   */
  function ouvrirOutil(demande: PendingRequest) {
    openDiceTool(preReglageDepuisDemande(demande, () => lancerDansOutil(demande)));
  }

  /** V3.2-20 : le récit d'un jet lancé depuis l'outil, demandé après coup ; l'attente se voit dans le fil. */
  async function raconterApres(idCampagne: string, eventId: string) {
    onEnCours?.(true);
    const recit = await raconterTour(eventId, { entityId, campaignId: idCampagne, worldSlug });
    onEnCours?.(false);
    onNarration?.(recit.narration !== null ? null : (recit.sansNarration ?? "echec"), recit.narration !== null ? undefined : recit.sansNarrationDetail);
    if (recit.time) definirHeure(recit.time);
    if (recit.scene) onSceneMoved?.(recit.scene);
    onActed?.();
  }

  async function lancerDansOutil(demande: PendingRequest): Promise<SortieJet | null> {
    if (campaignId === null) throw new ErreurLancer("Sans campagne, il n'y a pas de tour à jouer.");
    // V3.2-20 : le dé d'abord, le récit ensuite (`raconterApres`), pour que l'outil n'attende pas le modèle.
    const outcome = await encaisserDepuisFiche({ entityId, campaignId, worldSlug, narrer: false });
    // V3.1-216 : une réaction peut intervenir — le tour n'est pas joué, la
    // demande reste posée, et le bandeau de réaction prend la main. L'outil
    // n'affiche ni total ni verdict jusqu'à la reprise.
    if ("fenetre" in outcome) return sortieAttenteReactions(demande, outcome.fenetre);
    if (outcome.time) definirHeure(outcome.time);
    if (outcome.scene) onSceneMoved?.(outcome.scene);
    onPendingChange(outcome.chained);
    if (outcome.chained === null) setDc("");
    onActed?.();
    if (outcome.record.eventId) void raconterApres(campaignId, outcome.record.eventId);
    return sortieJetDepuisTour(demande, outcome);
  }

  /**
   * Après un échec qui n'est pas un refus (5xx, délai, réseau) : le tour est
   * peut-être arrivé quand même. S'il est au fil, la phrase a fait son office —
   * le champ se vide et aucune erreur ne s'affiche (rend `true`). Sinon, l'appelant
   * montre l'erreur d'origine.
   * Un refus (4xx) ne passe pas par ici : le serveur n'a rien enregistré.
   */
  async function arriveQuandMeme(verifier: (() => Promise<boolean>) | undefined): Promise<boolean> {
    if (!verifier) return false;
    const arrive = await verifier().catch((erreur: unknown) => {
      // La vérification elle-même a échoué : on ne sait rien de plus, l'appelant montre l'erreur d'origine.
      console.error("Vérification de l'arrivée du tour impossible", erreur);
      return false;
    });
    if (arrive) {
      changeText("");
      onActed?.();
    }
    return arrive;
  }

  async function play(onTab = false) {
    if (text.trim().length === 0) return;
    setLastAttempt("submit");
    setBusy(true);
    setError(null);
    const verifier = suivreEnvoi?.(text.trim(), "tour");
    try {
      const choice = trade
        ? { kind: "trade" as const, direction: trade.direction, entryId: trade.entryId, targetId: trade.target?.id ?? null, ...(onTab ? { onTab: true } : {}) }
        : chosenAction
        ? chosenAction.kind === "weapon_attack"
          ? { kind: "weapon_attack" as const, actionId: chosenAction.id, targetId: chosenTargetId, advantage }
          : {
              kind: chosenAction.kind,
              actionId: chosenAction.id,
              targetId: chosenTargetId,
              advantage,
              dc: dc.trim() === "" ? null : Number(dc),
            }
        : { kind: "free" as const };

      const res = await fetch("/api/solo/tour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, campaignId, worldSlug, text: text.trim(), corrected, choice }),
      });
      // Un `fetch` dont on ne teste pas `res.ok` est un bug
      // (docs/CHARTE-UI.md §5) : un echec silencieux laisserait l'ecran en
      // attente d'un tour qui n'arrivera jamais.
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        const message = payload?.error ?? "Le tour n'a pas pu être joué.";
        if (res.status < 500 || !(await arriveQuandMeme(verifier))) setError(message);
        return;
      }
      // V3.2-4 : le serveur a accepté — la phrase a fait son office, la zone repart
      // vide, comme le fait déjà la question au MJ (un refus, lui, sort plus haut et
      // rend sa phrase au joueur). `changeText` remet aussi la correction à zéro.
      changeText("");
      const body = (await res.json()) as TurnOutcome | PendingTurnResponse;
      // V3-B5 — un choix mecanique en campagne ne rend plus un tour joue :
      // il rend la demande posee, en attente du de annonce (`encash`).
      // L'action libre, elle, garde son aller simple d'avant ce ticket.
      // V3.2-20 : la demande s'affiche en pastille dans le fil, l'outil de dés ne s'ouvre plus par-dessus.
      if ("pending" in body) {
        onPendingChange(body.pending);
      } else {
        // V3.2-3 : un tour joué sans narration dit pourquoi (V3.1-223) ; sans raison
        // donnée par le serveur, c'est un échec générique.
        onNarration?.(body.narration !== null ? null : (body.sansNarration ?? "echec"), body.narration !== null ? undefined : body.sansNarrationDetail);
        if (body.time) definirHeure(body.time);
        if (body.scene) onSceneMoved?.(body.scene);
        onPendingChange(null);
        setDc("");
      }
      onActed?.();
    } catch {
      if (!(await arriveQuandMeme(verifier))) setError("Le serveur n'a pas répondu.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Encaisse la demande posee : un nombre NU, jamais un total — c'est le
   * serveur qui y ajoute le modificateur fige a la pose
   * (`resolveIntentRequest`, turnIntent.ts). Une attaque qui touche CHAINE
   * une demande de degats (`outcome.chained`) : le champ repart alors
   * directement en attente d'un second nombre, meme tour, meme geste.
   */
  async function encash() {
    if (pending === null) return;
    const value = Number(text);
    if (!Number.isInteger(value) || value < 1 || value > pending.die_max) {
      setError(`Un dé annoncé se lit entre 1 et ${pending.die_max}.`);
      return;
    }
    setLastAttempt("submit");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/solo/tour/encaisser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, campaignId, worldSlug, natural: value, origin: "a_la_main" }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Le jet n'a pas pu être encaissé.");
        return;
      }
      // V3.2-4 : le dé annoncé est encaissé, le champ se libère pour la suite.
      changeText("");
      const outcome = (await res.json()) as EncashedTurnResponse;
      // V3.1-216 : même attente que ci-dessus, pour le dé annoncé à la main.
      if ("fenetre" in outcome) return;
      if (outcome.time) definirHeure(outcome.time);
      if (outcome.scene) onSceneMoved?.(outcome.scene);
      onPendingChange(outcome.chained);
      if (outcome.chained === null) setDc("");
      onActed?.();
    } catch {
      setError("Le serveur n'a pas répondu.");
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    if (pending) void encash();
    else void play();
  }

  /**
   * V3-D4 — Le bouton « MJ » : pose une question HORS du temps de jeu.
   * N'appelle ni `play()` ni `encash()` — aucun tour, aucun jet, `pending`
   * ne change pas. `app/api/solo/mj/route.ts` ne touche à aucune fonction
   * de la boucle de tour, verrouillé par `turnIntent.noAi.test.ts`.
   */
  async function askMj() {
    if (text.trim().length === 0 || campaignId === null) return;
    setLastAttempt("mj");
    setBusy(true);
    setError(null);
    const verifier = suivreEnvoi?.(text.trim(), "mj");
    try {
      const res = await fetch("/api/solo/mj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, campaignId, worldSlug, question: text.trim() }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        const message = payload?.error ?? "La question n'a pas abouti.";
        if (res.status < 500 || !(await arriveQuandMeme(verifier))) setError(message);
        return;
      }
      changeText("");
      onActed?.();
    } catch {
      if (!(await arriveQuandMeme(verifier))) setError("Le serveur n'a pas répondu.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * V3.2-10 — un achat dans un lieu sans carte : la tirer et l'écrire sur sa
   * page (`POST /api/solo/scene/carte`), qui la rend : la même phrase se lit
   * aussitôt comme un achat, sans relire la page. Une fois par lieu.
   */
  async function tirerCarte() {
    if (campaignId === null) return;
    setDrawingCarte(true);
    setError(null);
    try {
      const res = await fetch("/api/solo/scene/carte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "La carte du lieu n'a pas pu être tirée.");
        return;
      }
      const parsed = z.object({ data: z.object({ priceList: zPriceListBlockData }) }).safeParse(await res.json().catch(() => null));
      if (!parsed.success) {
        setError("La carte du lieu est arrivée illisible.");
        return;
      }
      setCarteTiree(tradeOffersFromPriceList(parsed.data.data.priceList.offers, TRADE_LODGING_TERMS_FR));
    } catch {
      setError("Le serveur n'a pas répondu.");
    } finally {
      setDrawingCarte(false);
    }
  }

  // V3.2-3 : un seul endroit porte « ça travaille », pour les trois chemins.
  useEffect(() => {
    onEnCours?.(busy);
  }, [busy, onEnCours]);

  function retry() {
    if (lastAttempt === "mj") void askMj();
    else submit();
  }

  function handleChange(value: string) {
    // En attente d'une demande, le champ n'accepte que le naturel annonce
    // — jamais une phrase a interpreter tant que le tour n'est pas honore.
    if (pending) setText(value.replace(/[^0-9]/g, ""));
    else changeText(value);
  }

  // V3-D4 — « le moteur devine une question, et le montre » : purement
  // indicatif, les deux boutons restent cliquables quoi qu'il en soit.
  const isQuestion = !pending && looksLikeQuestion(text, GM_QUESTION_MARKERS_FR);
  const canAskMj = campaignId !== null;

  const label = pending ? "Jet demandé" : "Que fais-tu ?";
  // Le texte temporaire du jet tient sur une ligne, même sur téléphone : lancer
  // depuis la fiche ou avec le dé voisin se voit déjà, il ne reste qu'à dire quoi écrire.
  const placeholder = pending ? `Résultat du dé (1-${pending.die_max})` : "je frappe le gobelin avec mon épée";
  const vide = text.trim().length === 0;

  // L'en-tête : ce que le moteur a compris, en pastilles. Le type ouvre la
  // correction complète ; l'arme et la cible sont des raccourcis vers les deux
  // listes les plus utiles en attaque.
  const libelleType = isQuestion ? "Question au MJ" : chosenAction ? KIND_LABELS[chosenAction.kind] : "Action libre";
  const aucuneActionSurLaFiche = proposal.kind === "free" && proposal.reason === "aucune_action_disponible";
  const detailType = isQuestion ? "le temps ne bouge pas" : chosenAction ? null : aucuneActionSurLaFiche ? "rien sur ta fiche pour le faire" : "sans jet";
  const explicationType = isQuestion
    ? "Ça ressemble à une question : MJ ne fait pas avancer le temps. Clique pour corriger l'action."
    : chosenAction
      ? "Ce n'est pas ça ? Clique pour corriger l'action, la cible, l'avantage ou le DD."
      : aucuneActionSurLaFiche
        ? "Le verbe est compris, mais cette fiche n'a rien pour le faire : aucun jet ne sera lancé. Clique pour corriger."
        : "Aucune mécanique reconnue : ce tour partira sans jet. Clique pour corriger.";
  const montrerCible = chosenAction !== null && (chosenAction.kind === "weapon_attack" || chosenTarget !== null) && data.targetDetails.length > 0;
  const cibleAChoisir = chosenAction?.kind === "weapon_attack" && chosenTarget === null;
  // Triées par famille : `Dropdown` pose un titre à chaque changement de `groupe`.
  const ordreFamilles = Object.keys(KIND_GROUPS);
  const optionsAction = [...data.catalog.actions]
    .sort((a, b) => ordreFamilles.indexOf(a.kind) - ordreFamilles.indexOf(b.kind))
    .map((a) => ({ value: optionKey(a), label: a.label, groupe: KIND_GROUPS[a.kind] }));
  const optionsCible = [
    { value: "", label: "Aucune cible", labelCourt: cibleAChoisir ? "cible à choisir" : "aucune cible" },
    ...data.targetDetails.map((t) => ({
      value: t.id,
      label: t.ac === null ? t.label : `${t.label} — CA ${t.ac}`,
      labelCourt: t.ac === null ? t.label : `${t.label} · CA ${t.ac}`,
    })),
  ];

  const enTete = pending ? (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className={`${PASTILLE} border-accent text-accent hover:bg-transparent`}>
        <span className="truncate">{pending.what}</span>
      </span>
      <span className="min-w-0 truncate text-xs text-ink-soft">
        {pending.target_label ? `sur ${pending.target_label} · ` : ""}mod. {pending.modifier >= 0 ? "+" : "−"}
        {Math.abs(pending.modifier)}
        {montrerIssue && pending.dc !== null && ` · ${pending.kind === "weapon_attack" ? "CA" : "DD"} ${pending.dc}`}
        {pending.advantage !== "normal" && ` · ${ADVANTAGE_LABELS[pending.advantage]}`}
      </span>
    </span>
  ) : vide ? (
    <span className="min-w-0 truncate text-xs text-ink-muted">Le moteur dit ce qu&apos;il a compris avant de jouer</span>
  ) : trade ? (
    // V3.2-10 : l'échange compris. La pastille rend la phrase à la lecture
    // ordinaire (« ce n'est pas ça ») ; un manque se lit à côté, sans bloquer.
    <span className="flex min-w-0 items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={() => setTradeDismissed(true)}
        title="Ce n'est pas un échange ? Clique pour revenir à la lecture ordinaire (jet ou action libre)."
        className={`${PASTILLE} border-edge-strong text-ink`}
      >
        <span className="truncate">{TRADE_LABELS[trade.direction].chip}</span>
        <span aria-hidden="true" className="text-ink-muted">
          ×
        </span>
      </button>
      <span className="min-w-0 truncate text-xs text-ink" title={tradeSentence(trade)}>
        {tradeSentence(trade)}
      </span>
      {tradeShortCp > 0 && (
        <span
          className="shrink-0 text-xs text-danger"
          title={`Le tour part quand même : rien ne sera payé, et ${trade.target ? trade.target.label : "la personne en face"} verra qu'il manque ${formatCpFr(tradeShortCp)}.`}
        >
          {tradeCatalog.purseCp === 0 ? "bourse vide" : `tu as ${formatCpFr(tradeCatalog.purseCp)}`}
        </span>
      )}
      {tradeBlocked && (
        <span className="shrink-0 text-xs text-ink-soft" title="Cet objet n'a pas de prix connu : il ne se vend pas au prix de la table. Tu peux le donner, ou jouer la vente en action libre.">
          sans prix
        </span>
      )}
    </span>
  ) : (
    <span className="flex min-w-0 items-center justify-end gap-1.5">
      <span className="relative flex shrink-0">
        <button
          type="button"
          onClick={() => setCorrecting((v) => !v)}
          aria-expanded={correcting}
          aria-haspopup="dialog"
          title={explicationType}
          className={`${PASTILLE} ${correcting ? "border-accent bg-accent/10" : isQuestion ? "border-gm text-gm" : "border-edge-strong text-ink"}`}
        >
          <span className="truncate">{libelleType}</span>
          <span aria-hidden="true" className="text-ink-muted">
            ▾
          </span>
        </button>
        <BulleFlottante ouverte={correcting} onFermer={fermerCorrection} alignement="fin" aria-label="Correction de l'action">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Dropdown
                aria-label="Action à résoudre"
                size="md"
                className="w-64"
                value={chosenAction ? optionKey(chosenAction) : ""}
                options={[{ value: "", label: "Action libre — aucun jet" }, ...optionsAction.map(({ value, label, groupe }) => ({ value, label, groupe }))]}
                onChange={(v) => setOverrideActionId(v)}
              />
              <Dropdown
                aria-label="Cible de l'action"
                size="md"
                className="w-56"
                value={chosenTargetId ?? ""}
                options={optionsCible.map(({ value, label }) => ({ value, label }))}
                onChange={(v) => setOverrideTargetId(v)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-ink-muted">Jet :</span>
              {(["disadvantage", "normal", "advantage"] as AdvantageState[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAdvantage(a)}
                  className={`rounded-full border px-3 py-1 transition-colors ${
                    advantage === a ? "border-accent text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
                  }`}
                >
                  {ADVANTAGE_LABELS[a]}
                </button>
              ))}
              {needsDc && (
                <label className="flex items-center gap-1">
                  <span className="text-ink-muted">DD</span>
                  <input
                    value={dc}
                    onChange={(e) => setDc(e.target.value.replace(/[^0-9]/g, ""))}
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="—"
                    className="w-12 rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none"
                  />
                </label>
              )}
            </div>
          </div>
        </BulleFlottante>
      </span>
      {chosenAction ? (
        <Dropdown
          aria-label="Arme ou action"
          forme="pastille"
          className="min-w-0 max-w-[11rem]"
          value={optionKey(chosenAction)}
          options={optionsAction}
          onChange={(v) => setOverrideActionId(v)}
        />
      ) : (
        detailType && <span className="min-w-0 truncate text-xs text-ink-soft max-md:hidden">{detailType}</span>
      )}
      {montrerCible && (
        <Dropdown
          aria-label="Cible de l'action"
          forme={cibleAChoisir ? "pastille-accent" : "pastille"}
          className="min-w-0 max-w-[11rem]"
          value={chosenTargetId ?? ""}
          options={optionsCible}
          onChange={(v) => setOverrideTargetId(v)}
        />
      )}
      {corrected && <span className="shrink-0 text-xs text-ink-muted max-md:hidden">corrigé</span>}
      {tradeReading?.kind === "no_price_list" && campaignId !== null && (
        <button
          type="button"
          className={`${BTN_PETIT} shrink-0`}
          onClick={() => void tirerCarte()}
          disabled={busy || drawingCarte}
          title="Ce lieu n'a pas encore de carte : rien à acheter au prix de la table. La tirer l'écrit sur sa page."
        >
          {drawingCarte ? "…" : "Tirer la carte du lieu"}
        </button>
      )}
    </span>
  );

  // La dernière rangée : l'erreur, puis l'attente, remplacent l'état de l'IA
  // au lieu de s'y ajouter. Le modèle reste au bout dans les trois cas.
  const etat =
    error !== null ? (
      <span className="flex min-w-0 items-center gap-2 text-danger">
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-danger" />
        <span className="min-w-0 truncate" title={error}>
          {error}
        </span>
        <button type="button" className={`${BTN_PETIT} shrink-0`} onClick={() => retry()} disabled={busy}>
          Réessayer
        </button>
      </span>
    ) : busy ? (
      <span className="flex min-w-0 items-center gap-1.5 text-ink-muted">
        <span aria-hidden="true" className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-ink-soft" />
        <span className="min-w-0 truncate">Le récit s&apos;écrit…</span>
      </span>
    ) : (
      etatIa
    );

  return (
    // `px-4 py-3` et non le `p-6` des panneaux (charte §3) : cette barre reste
    // ancrée sous le fil, chaque pixel qu'elle prend lui est retiré.
    <section className="flex flex-col gap-2 rounded-lg border border-edge bg-panel px-4 py-3">
      <div className="flex h-6 min-w-0 items-center justify-between gap-3">
        {/* Sur téléphone, dès qu'on écrit, le titre laisse sa place aux pastilles :
            le champ porte le même nom pour un lecteur d'écran (`aria-label`). */}
        <span
          className={`shrink-0 text-xs font-semibold uppercase tracking-wide ${pending ? "text-accent" : "text-ink-muted"} ${!pending && !vide ? "max-md:hidden" : ""}`}
        >
          {label}
        </span>
        {enTete}
      </div>

      <div className="flex min-w-0 items-end gap-1.5">
        <textarea
          ref={textareaRef}
          aria-label={label}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !busy) {
              e.preventDefault();
              submit();
            }
            // Tab, champ vide : la proposition grisée devient le texte, comme une
            // complétion. Champ rempli, ou jet demandé (son indication n'est pas une
            // action à jouer) : Tab garde son rôle, passer au contrôle suivant.
            if (e.key === "Tab" && !e.shiftKey && !pending && text === "") {
              e.preventDefault();
              handleChange(placeholder);
            }
          }}
          placeholder={placeholder}
          maxLength={pending ? (pending.die_max >= 100 ? 3 : 2) : 500}
          rows={1}
          className={`min-w-0 flex-1 resize-none overflow-y-auto rounded-md border bg-transparent px-3 py-2 text-sm text-ink outline-none ${
            pending ? "border-accent" : "border-edge"
          }`}
        />
        {pending ? (
          <>
            <button type="button" className={BTN_ICONE} onClick={() => ouvrirOutil(pending)} disabled={busy} aria-label="Ouvrir l'outil de dés" title="Ouvrir l'outil de dés">
              <DieIcon sides={20} className="h-5 w-5" />
            </button>
            <button type="button" className={BTN_PRIMARY} onClick={() => void encash()} disabled={busy || text.trim() === ""}>
              {busy ? "…" : "Annoncer"}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={isQuestion ? BTN_PRIMARY : BTN_SECONDARY}
              onClick={() => void askMj()}
              disabled={busy || vide || !canAskMj}
              title={canAskMj ? "Poser la phrase au MJ, hors du temps de jeu" : "Sans campagne, il n'y a pas de MJ à qui demander."}
            >
              {busy && lastAttempt === "mj" ? "…" : "MJ"}
            </button>
            {canPutOnTab && (
              <button type="button" className={BTN_SECONDARY} onClick={() => void play(true)} disabled={busy} title="Consommer sur place, et le devoir : rien n'est payé">
                Ardoise
              </button>
            )}
            <button type="button" className={isQuestion ? BTN_SECONDARY : BTN_PRIMARY} onClick={() => void play()} disabled={busy || vide || tradeBlocked}>
              {busy && lastAttempt === "submit" ? "…" : trade ? TRADE_LABELS[trade.direction].button : "Jouer"}
            </button>
          </>
        )}
      </div>

      <div className="flex h-6 min-w-0 items-center justify-between gap-3 text-xs">
        {etat}
        {choixModele}
      </div>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import FeuilleDuBas from "@/components/shared/FeuilleDuBas";
import BandeFiche from "@/components/solo/BandeFiche";
import { useSoloContexte } from "@/components/solo/SoloContexte";
import ScenePanel from "@/components/solo/ScenePanel";
import IntentBar from "@/components/solo/IntentBar";
import Fil from "@/components/solo/Fil";
import PastilleJet from "@/components/solo/PastilleJet";
import { raconterTour } from "@/lib/ui/soloApi";
import OngletChangements from "@/components/solo/OngletChangements";
import type { EncashedTurnOutcome, FilItem, IntentBarData, PendingTurnResponse, RaisonSansNarration, SceneView, TurnOutcome } from "@/lib/solo/types";
import BulleFlottante from "@/components/shared/BulleFlottante";
import Dropdown from "@/components/shared/Dropdown";
import { choixDepuisValeur, optionsChoix, valeurChoix, type FournisseursIaReponse } from "@/lib/ia/fournisseurs";

/**
 * V3-B2 — Les deux moitiés de l'écran solo : la scène, puis le tour.
 *
 * **V3-D1** : la scène défile, la saisie reste ancrée en bas. Sous 768 px
 * c'est la seule façon de garder le champ atteignable quand le clavier
 * virtuel monte ; au-dessus, ça évite d'aller rechercher la barre en bas
 * d'un fil qui s'allonge à chaque tour.
 *
 * **V3-D4** : le fil (`Fil.tsx`) rejoint `ScenePanel` dans la MÊME zone
 * défilante — c'est ce composant-ci qui possède le défilement automatique
 * et l'annonce `aria-live`, puisqu'il possède déjà le conteneur.
 *
 * **V3-D4 Phase 2 — `pending` n'est pas possédé par `IntentBar`.** Une
 * demande peut être honorée depuis la fiche (colonne voisine, V3-B5 Phase 2)
 * sans que `IntentBar` en soit jamais informé autrement. Elle vit dans
 * `SoloContexte` : la fiche, qui sonde déjà `/sheet`, la publie ; ce
 * composant ne sonde plus que le fil et les conséquences. Il sondait aussi
 * `/sheet` pour la seule demande, soit deux fois la même route toutes les
 * 4 s (docs/QUOTAS.md).
 */
const POLL_MS = 4000;

/** V3.1-223 — le libellé de l'état du fournisseur d'IA, sous la barre d'intention. */
const LIBELLE_ETAT_IA = {
  inconnu: "iaInconnue",
  repond: "iaRepond",
  aucun_fournisseur: "iaAucunFournisseur",
  quota: "iaQuota",
  limite: "iaLimite",
  limite_app: "iaLimiteApp",
  cle_refusee: "iaCleRefusee",
  delai: "iaDelai",
  refusee: "iaRefusee",
  inutilisable: "iaInutilisable",
  echec: "iaMuette",
} as const satisfies Record<"inconnu" | "repond" | RaisonSansNarration, string>;

/**
 * La couleur du voyant : vert, tout est branché ; orange (l'or de l'accent, pas de
 * jeton « avertissement » dans la charte), plus de tokens ou trop d'appels ; rouge,
 * un souci de branchement ; gris, rien n'est encore su.
 */
const COULEUR_ETAT_IA = {
  inconnu: "bg-ink-muted",
  repond: "bg-success",
  quota: "bg-accent",
  limite: "bg-accent",
  limite_app: "bg-accent",
  aucun_fournisseur: "bg-danger",
  cle_refusee: "bg-danger",
  delai: "bg-danger",
  refusee: "bg-danger",
  inutilisable: "bg-danger",
  echec: "bg-danger",
} as const satisfies Record<"inconnu" | "repond" | RaisonSansNarration, string>;

function summarizeForAnnounce(item: FilItem): string {
  switch (item.kind) {
    case "narration":
      return item.text;
    case "player_action":
      return item.text;
    case "roll":
      return item.facts.join(" ");
    case "rule_application":
      return item.changes[0] ?? item.hints[0] ?? "";
    case "world_update":
      return item.note;
    case "note":
      return item.answer;
    case "turn_summary":
    case "other":
      return "";
  }
}

export default function SoloScreen({
  worldSlug,
  campaignId,
  entityId,
  data,
  scene,
  locations,
  candidates,
  montrerIssue: montrerIssueInitial,
}: {
  worldSlug: string;
  campaignId: string;
  entityId: string;
  data: IntentBarData;
  scene: SceneView | null;
  locations: { id: string; name: string }[];
  candidates: { id: string; name: string }[];
  /** V3.2-20 : réglage de partie `solo_show_outcome`, lu avec la page. */
  montrerIssue: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("solo");
  const { jauges, demande: pending, definirDemande: setPending, rechargerFiche, definirInterlocuteur, definirHeure, deplierMonde } = useSoloContexte();
  // V3.2-20 : DD et issue des jets, visibles ou non. Changé ici, écrit dans les réglages de la partie.
  const [montrerIssue, setMontrerIssue] = useState(montrerIssueInitial);
  const [reglageErreur, setReglageErreur] = useState<string | null>(null);
  const [feuilleConsequences, setFeuilleConsequences] = useState(false);
  const [sceneView, setSceneView] = useState(scene);
  const [filItems, setFilItems] = useState<FilItem[] | null>(null);
  // V3.2-14 : le PNJ qui a parlé au dernier tour (sa réplique la plus récente), pour le halo de la bande du Monde.
  const interlocuteur = useMemo(() => {
    for (let i = (filItems?.length ?? 0) - 1; i >= 0; i--) {
      const item = filItems?.[i];
      if (item?.kind === "narration") return item.npcReaction?.npcName ?? null;
    }
    return null;
  }, [filItems]);
  useEffect(() => definirInterlocuteur(interlocuteur), [interlocuteur, definirInterlocuteur]);
  const [announce, setAnnounce] = useState("");
  // V3.2-3 : l'attente et l'état du fournisseur, lus des tours eux-mêmes — aucun sondage.
  const [tourEnCours, setTourEnCours] = useState(false);
  const [narrationEtat, setNarrationEtat] = useState<"inconnu" | "repond" | RaisonSansNarration>("inconnu");
  /** La phrase du fournisseur quand il a refusé le dernier tour : de quoi corriger sans ouvrir les journaux du serveur. */
  const [narrationDetail, setNarrationDetail] = useState<string | undefined>(undefined);
  // ADR 0108 : les modèles déclarés au compte, pour en changer à côté du voyant. Lus une fois.
  const [fournisseursIa, setFournisseursIa] = useState<FournisseursIaReponse | null>(null);
  /** La bulle « i » de l'état du fournisseur : la phrase complète et la réponse brute. */
  const [detailIaOuvert, setDetailIaOuvert] = useState(false);
  const fermerDetailIa = useCallback(() => setDetailIaOuvert(false), []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const lastSeqRef = useRef<number | null>(null);

  /**
   * Rafraîchit le fil, qui change aussi sans passer par cette colonne (un
   * jet résolu depuis la fiche). V3.2-27 : les conséquences ne sont plus
   * sondées ici ; l'onglet « Changements » les lit lui-même, seulement
   * quand il est ouvert (docs/QUOTAS.md).
   */
  async function reloadCenter() {
    const filRes = await fetch(`/api/campaigns/${campaignId}/fil`);
    if (!filRes.ok) return;
    const body = (await filRes.json()) as { items: FilItem[] };
    // La ligne du tour (V3.2-27) n'est pas annoncée : le récit qu'elle suit l'est.
    const newest = body.items.findLast((i) => i.kind !== "turn_summary");
    if (newest && newest.seq !== lastSeqRef.current) {
      lastSeqRef.current = newest.seq;
      setAnnounce(summarizeForAnnounce(newest));
    }
    setFilItems(body.items);
  }

  /** V3.2-27 : l'onglet « Changements » — dans la colonne Monde sur ordinateur, en feuille du bas sur téléphone. */
  function voirChangements() {
    if (window.matchMedia("(min-width: 768px)").matches) deplierMonde("changements");
    else setFeuilleConsequences(true);
  }

  /**
   * Appelé par la barre au moment d'envoyer. Rend une vérification pour le cas où
   * la réponse se perd (délai, réseau) alors que le serveur a enregistré le tour :
   * une seule lecture du fil, et seulement après un échec (docs/QUOTAS.md), qui
   * cherche, APRÈS le dernier élément connu à l'envoi, l'action ou la question
   * de ce texte exact. Un tour mécanique n'en a pas besoin : sa demande de jet,
   * publiée par la fiche, vide déjà le champ en changeant son rôle.
   */
  function suivreEnvoi(texte: string, genre: "tour" | "mj") {
    const avant = lastSeqRef.current ?? -1;
    return async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/fil`);
      if (!res.ok) return false;
      const body = (await res.json()) as { items: FilItem[] };
      setFilItems(body.items);
      return body.items.some(
        (i) =>
          i.seq > avant &&
          (genre === "tour" ? i.kind === "player_action" && i.text.trim() === texte : i.kind === "note" && i.question.trim() === texte)
      );
    };
  }

  /** V3-F2 : un tour de la joueuse figure au fil (le serveur retrouve lui-même lequel annuler). */
  const annulable = campaignId && (filItems ?? []).some((i) => i.kind === "player_action" || i.kind === "roll") ? { campaignId } : null;

  /**
   * La scène a changé de lieu ou de présents : depuis le panneau de scène, ou
   * (V3.2-19) parce que la narration a emmené le personnage ailleurs. Tout
   * l'écran en dépend (bandeau, Monde, présents) : `router.refresh()` est
   * justifié (docs/CABLAGE.md C5), un seul pour les deux chemins.
   */
  function apresChangementDeScene(next: SceneView) {
    setSceneView(next);
    router.refresh();
  }

  /** V3.2-20 : le jet lancé depuis la pastille est joué — la suite du tour, puis son récit, demandé à part. */
  async function apresJet(tour: EncashedTurnOutcome) {
    if (tour.time) definirHeure(tour.time);
    if (tour.scene) apresChangementDeScene(tour.scene);
    setPending(tour.chained);
    void apresGeste();
    // V3.2-20 : le dé est déjà à l'écran ; le récit arrive ensuite, avec l'attente visible du fil.
    if (!tour.record.eventId) return;
    setTourEnCours(true);
    const recit = await raconterTour(tour.record.eventId, { entityId, campaignId, worldSlug });
    setTourEnCours(false);
    setNarrationEtat(recit.narration !== null ? "repond" : (recit.sansNarration ?? "echec"));
    setNarrationDetail(recit.narration !== null ? undefined : recit.sansNarrationDetail);
    if (recit.time) definirHeure(recit.time);
    if (recit.scene) apresChangementDeScene(recit.scene);
    await apresGeste();
  }

  /** V3.2-24 : « Changer » a posé une autre demande, ou « Sans jet » a joué le tour (récit compris). */
  async function apresRejeu(reponse: TurnOutcome | PendingTurnResponse) {
    if ("pending" in reponse) {
      setPending(reponse.pending);
      await apresGeste();
      return;
    }
    setPending(null);
    setNarrationEtat(reponse.narration !== null ? "repond" : (reponse.sansNarration ?? "echec"));
    setNarrationDetail(reponse.narration !== null ? undefined : reponse.sansNarrationDetail);
    if (reponse.time) definirHeure(reponse.time);
    if (reponse.scene) apresChangementDeScene(reponse.scene);
    await apresGeste();
  }

  /**
   * V3.2-20 : bascule le réglage « DD et réussites ». L'écran change tout de
   * suite ; un refus du serveur le remet comme avant et le dit. Une écriture
   * par clic, aucune lecture de plus (docs/QUOTAS.md).
   */
  async function basculerIssue() {
    const suivant = !montrerIssue;
    setMontrerIssue(suivant);
    setReglageErreur(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/table-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solo_show_outcome: suivant }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch (erreur) {
      console.error("Réglage « DD et réussites » non enregistré", erreur);
      setMontrerIssue(!suivant);
      setReglageErreur(t("jet.reglageEchec"));
    }
  }

  // À terre ou non, relu de la fiche qui sonde déjà l'état de jeu : la barre suit sans recharger la page.
  const aTerre = jauges ? jauges.aTerre : data.aTerre;
  const donneesBarre = useMemo(() => (aTerre === data.aTerre ? data : { ...data, aTerre }), [data, aTerre]);

  /** Après un geste de cette colonne : le fil, les conséquences, ET la fiche (PV, demande) sans attendre son prochain tick. */
  function apresGeste() {
    rechargerFiche();
    return reloadCenter();
  }

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      if (!cancelled) await reloadCenter();
    }
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, entityId]);

  /**
   * ADR 0108 — les fournisseurs du compte, lus UNE fois à l'ouverture de
   * l'écran (docs/QUOTAS.md : une requête par chargement, aucun sondage).
   */
  useEffect(() => {
    let vivant = true;
    fetch("/api/compte/ia")
      .then(async (res) => {
        if (res.ok && vivant) setFournisseursIa((await res.json()) as FournisseursIaReponse);
      })
      .catch(() => {
        // catch-attendu : erreur reseau ; sans la liste, le menu ne s'affiche pas et le voyant reste seul.
      });
    return () => {
      vivant = false;
    };
  }, []);

  /** Change le modèle qui sert. Le voyant repart à « inconnu » : son état valait pour l'ancien modèle. */
  async function choisirModele(valeur: string) {
    const choix = choixDepuisValeur(valeur);
    if (!choix) return;
    const res = await fetch("/api/compte/ia/choix", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(choix) });
    if (!res.ok) {
      setAnnounce(t("iaChoixEchec"));
      return;
    }
    setFournisseursIa((f) => (f ? { ...f, actif: choix } : f));
    setNarrationEtat("inconnu");
    setNarrationDetail(undefined);
  }

  const optionsModeles = fournisseursIa ? optionsChoix(fournisseursIa.fournisseurs) : [];

  // Défile jusqu'en bas à chaque nouveau contenu, SAUF si le joueur a
  // remonté lire quelque chose plus haut — cas classique et
  // systématiquement raté (critère explicite du ticket).
  useEffect(() => {
    if (autoScrollRef.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [filItems, sceneView]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Téléphone (V3.1-36) : la bande de jauges en ligne, et ✦ qui ouvre l'onglet « Changements » en feuille du bas (V3.2-27 : « Annuler ce tour » vit désormais au bout du dernier tour, dans le fil). */}
      <div className="flex shrink-0 items-stretch gap-2 md:hidden">
        <BandeFiche jauges={jauges} variante="ligne" />
        <button
          type="button"
          onClick={() => setFeuilleConsequences(true)}
          aria-haspopup="dialog"
          aria-label={t("consequencesOuvrir")}
          className="flex shrink-0 flex-col items-center justify-center rounded-lg border border-edge bg-panel px-3 text-accent transition-colors hover:bg-panel-raised"
        >
          <span aria-hidden="true">✦</span>
        </button>
      </div>
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        <ScenePanel
          campaignId={campaignId}
          scene={sceneView}
          locations={locations}
          candidates={candidates}
          onChanged={apresChangementDeScene}
        />
        <div className="mt-4">
          <Fil items={filItems} montrerIssue={montrerIssue} annulation={annulable} onAnnule={() => void apresGeste()} onVoirChangements={voirChangements} />
          {/* V3.2-20 (option C) : le jet demandé se lance d'ici, sous la phrase du joueur.
              La clé remet la pastille à zéro quand une demande en remplace une autre (dégâts après une attaque). */}
          {pending && (
            <div className="mt-2 flex flex-col items-stretch gap-2">
              {pending.player_action_text && <p className="max-w-[85%] self-end rounded-lg rounded-br-sm border border-players bg-panel-raised px-3 py-1 text-sm text-ink">{pending.player_action_text}</p>}
              <PastilleJet
                key={`${pending.kind}:${pending.action_id}:${pending.player_action_text}`}
                demande={pending}
                montrerIssue={montrerIssue}
                entityId={entityId}
                campaignId={campaignId}
                worldSlug={worldSlug}
                actions={data.catalog.actions}
                onEncaisse={(tour) => void apresJet(tour)}
                onRejoue={(reponse) => void apresRejeu(reponse)}
              />
            </div>
          )}
          {/* V3.2-3 : pendant que le modèle écrit (10 à 20 s en local), le fil montre qu'il
              se passe quelque chose, au lieu de rester figé. `prefers-reduced-motion` est
              déjà traité dans tokens.css : rien à réimplémenter ici (docs/CHARTE-UI.md §4). */}
          {tourEnCours && (
            <p className="mt-2 flex max-w-[85%] items-center gap-1 self-start rounded-lg rounded-bl-sm border border-edge bg-panel-raised px-3 py-2" aria-label={t("enCours")}>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-muted" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-muted [animation-delay:200ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-muted [animation-delay:400ms]" />
            </p>
          )}
        </div>
      </div>
      {/* Region discrete : annonce chaque nouveau tour sans deplacer le
          focus — seul ecran du produit ou du contenu arrive sans action de
          l'utilisateur (critere F-08 de l'audit). */}
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>
      {/* Le fil défile dans son propre conteneur au-dessus : la barre ne le
          recouvre jamais, elle n'a donc pas besoin d'un fond (il dessinait une
          bande sombre au-dessus du cadre de saisie). */}
      <div className="sticky bottom-0 shrink-0 pb-1 pt-1">
        <IntentBar
          worldSlug={worldSlug}
          campaignId={campaignId}
          entityId={entityId}
          data={donneesBarre}
          pending={pending}
          onPendingChange={setPending}
          onActed={apresGeste}
          onSceneMoved={apresChangementDeScene}
          onEnCours={setTourEnCours}
          onNarration={(raison, detail) => {
            setNarrationEtat(raison ?? "repond");
            setNarrationDetail(detail);
          }}
          suivreEnvoi={suivreEnvoi}
          montrerIssue={montrerIssue}
          etatIa={
            /* V3.2-3 : l'état du fournisseur, lu du dernier tour joué, avec sa raison (V3.1-223) :
               vert s'il a raconté, orange si le quota ou la limite est atteint, rouge pour un
               souci de branchement, gris tant qu'aucun tour n'a été joué. Aucun appel n'est
               fait pour l'allumer : un sondage coûterait une requête par tic (QUOTAS).
               Forme courte sur la ligne (elle tient sans retour à la ligne, même sur
               téléphone) ; la phrase complète et la réponse du fournisseur derrière « i ». */
            <span className="relative flex min-w-0 items-center gap-1.5 text-ink-muted">
              <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${COULEUR_ETAT_IA[narrationEtat]}`} />
              <span className="min-w-0 truncate">{t(`iaCourt.${narrationEtat}`)}</span>
              {narrationEtat !== "inconnu" && narrationEtat !== "repond" && (
                <>
                  <button
                    type="button"
                    onClick={() => setDetailIaOuvert((v) => !v)}
                    aria-expanded={detailIaOuvert}
                    aria-haspopup="dialog"
                    aria-label={t("iaDetailOuvrir")}
                    className="relative grid h-4 w-4 shrink-0 place-items-center rounded-full border border-edge-strong font-mono text-xs leading-none text-ink-soft transition-colors hover:bg-panel-raised before:absolute before:-inset-1 before:content-['']"
                  >
                    i
                  </button>
                  <BulleFlottante ouverte={detailIaOuvert} onFermer={fermerDetailIa} alignement="debut" aria-label={t("iaDetailOuvrir")}>
                    <p className="text-ink-soft">{t(LIBELLE_ETAT_IA[narrationEtat])}</p>
                    {narrationDetail && <p className="mt-2 break-words font-mono text-xs text-ink-muted">{t("iaDetailFournisseur", { detail: narrationDetail })}</p>}
                  </BulleFlottante>
                </>
              )}
            </span>
          }
          choixModele={
            <span className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void basculerIssue()}
                aria-pressed={montrerIssue}
                title={reglageErreur ?? t("jet.reglageTitre")}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-panel-raised ${reglageErreur ? "border-danger text-danger" : montrerIssue ? "border-accent text-accent" : "border-edge text-ink-muted"}`}
              >
                {t("jet.reglage")} : {t(montrerIssue ? "jet.reglageAffiches" : "jet.reglageMasques")}
              </button>
            {optionsModeles.length > 0 && (
              <Dropdown
                size="sm"
                className="max-w-[10rem] shrink-0"
                aria-label={t("iaChoixModele")}
                value={fournisseursIa?.actif ? valeurChoix(fournisseursIa.actif) : ""}
                options={optionsModeles}
                onChange={(v) => void choisirModele(v)}
              />
            )}
            </span>
          }
        />
      </div>
      {feuilleConsequences && (
        <FeuilleDuBas titre={t("consequencesTitre")} titreVisible onFermer={() => setFeuilleConsequences(false)}>
          <div className="pb-2">
            <OngletChangements campaignId={campaignId} />
          </div>
        </FeuilleDuBas>
      )}
    </div>
  );
}

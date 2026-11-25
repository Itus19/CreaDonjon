"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import FeuilleDuBas from "@/components/shared/FeuilleDuBas";
import BandeFiche from "@/components/solo/BandeFiche";
import { useSoloContexte } from "@/components/solo/SoloContexte";
import ScenePanel from "@/components/solo/ScenePanel";
import IntentBar from "@/components/solo/IntentBar";
import Fil from "@/components/solo/Fil";
import ConsequencesDrawer, { type ConsequencesDrawerData } from "@/components/solo/ConsequencesDrawer";
import type { FilItem, IntentBarData, RaisonSansNarration, SceneView } from "@/lib/solo/types";
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
}: {
  worldSlug: string;
  campaignId: string;
  entityId: string;
  data: IntentBarData;
  scene: SceneView | null;
  locations: { id: string; name: string }[];
  candidates: { id: string; name: string }[];
}) {
  const router = useRouter();
  const t = useTranslations("solo");
  const { jauges, demande: pending, definirDemande: setPending, rechargerFiche } = useSoloContexte();
  const [feuilleConsequences, setFeuilleConsequences] = useState(false);
  const [sceneView, setSceneView] = useState(scene);
  const [filItems, setFilItems] = useState<FilItem[] | null>(null);
  const [consequences, setConsequences] = useState<ConsequencesDrawerData | null>(null);
  const [announce, setAnnounce] = useState("");
  // V3.2-3 : l'attente et l'état du fournisseur, lus des tours eux-mêmes — aucun sondage.
  const [tourEnCours, setTourEnCours] = useState(false);
  const [narrationEtat, setNarrationEtat] = useState<"inconnu" | "repond" | RaisonSansNarration>("inconnu");
  // ADR 0108 : les modèles déclarés au compte, pour en changer à côté du voyant. Lus une fois.
  const [fournisseursIa, setFournisseursIa] = useState<FournisseursIaReponse | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const lastSeqRef = useRef<number | null>(null);

  /**
   * Rafraîchit le fil et le tiroir de conséquences, chacun dès que SA
   * réponse arrive : attendre les deux ensemble retardait le fil sur la plus
   * lente. Tous deux changent sans passer par cette colonne (un jet résolu
   * depuis la fiche, une proposition acceptée depuis le tiroir lui-même).
   */
  async function reloadCenter() {
    await Promise.all([
      fetch(`/api/campaigns/${campaignId}/fil`).then(async (filRes) => {
        if (!filRes.ok) return;
        const body = (await filRes.json()) as { items: FilItem[] };
        const newest = body.items[body.items.length - 1];
        if (newest && newest.seq !== lastSeqRef.current) {
          lastSeqRef.current = newest.seq;
          setAnnounce(summarizeForAnnounce(newest));
        }
        setFilItems(body.items);
      }),
      fetch(`/api/campaigns/${campaignId}/consequences`).then(async (consequencesRes) => {
        if (consequencesRes.ok) setConsequences((await consequencesRes.json()) as ConsequencesDrawerData);
      }),
    ]);
  }

  /** V3-F2 : un tour de la joueuse figure au fil (le serveur retrouve lui-même lequel annuler). */
  const annulable = campaignId && (filItems ?? []).some((i) => i.kind === "player_action" || i.kind === "roll") ? { campaignId } : null;

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

  const nombreConsequences = consequences ? consequences.pending.length + consequences.applied.length : 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Téléphone (V3.1-36) : la bande de jauges en ligne, et ✦ qui ouvre les conséquences en feuille du bas. */}
      <div className="flex shrink-0 items-stretch gap-2 md:hidden">
        <BandeFiche jauges={jauges} variante="ligne" />
        {/* V3-F2 : ✦ aussi quand un tour peut être annulé, même si le monde n'a rien écrit (le geste vit dans la feuille). */}
        {(nombreConsequences > 0 || annulable) && (
          <button
            type="button"
            onClick={() => setFeuilleConsequences(true)}
            aria-haspopup="dialog"
            aria-label={t("consequencesOuvrir", { nombre: nombreConsequences })}
            className="flex shrink-0 flex-col items-center justify-center rounded-lg border border-edge bg-panel px-3 text-accent transition-colors hover:bg-panel-raised"
          >
            <span aria-hidden="true">✦</span>
            {nombreConsequences > 0 && <span className="text-xs tabular-nums text-ink-soft">{nombreConsequences}</span>}
          </button>
        )}
      </div>
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        <ScenePanel
          campaignId={campaignId}
          scene={sceneView}
          locations={locations}
          candidates={candidates}
          onChanged={(next) => {
            setSceneView(next);
            router.refresh();
          }}
        />
        <div className="mt-4">
          <Fil items={filItems} />
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
        <div className="mt-2 max-md:hidden">
          <ConsequencesDrawer data={consequences} onChanged={apresGeste} annulation={annulable} />
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
          data={data}
          pending={pending}
          onPendingChange={setPending}
          onActed={apresGeste}
          onEnCours={setTourEnCours}
          onNarration={(raison) => setNarrationEtat(raison ?? "repond")}
          pied={
            /* V3.2-3 : l'état du fournisseur, lu du dernier tour joué, avec sa raison (V3.1-223) :
               vert s'il a raconté, orange si le quota ou la limite est atteint, rouge pour un
               souci de branchement, gris tant qu'aucun tour n'a été joué. Aucun appel n'est
               fait pour l'allumer : un sondage coûterait une requête par tic (QUOTAS). */
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className="flex min-w-0 items-center gap-1.5 text-xs text-ink-muted">
                <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${COULEUR_ETAT_IA[narrationEtat]}`} />
                {t(LIBELLE_ETAT_IA[narrationEtat])}
              </p>
              {optionsModeles.length > 0 && (
                <Dropdown
                  size="sm"
                  className="max-w-[16rem] shrink-0"
                  aria-label={t("iaChoixModele")}
                  value={fournisseursIa?.actif ? valeurChoix(fournisseursIa.actif) : ""}
                  options={optionsModeles}
                  onChange={(v) => void choisirModele(v)}
                />
              )}
            </div>
          }
        />
      </div>
      {feuilleConsequences && (
        <FeuilleDuBas titre={t("consequencesTitre")} titreVisible onFermer={() => setFeuilleConsequences(false)}>
          <div className="pb-2">
            <ConsequencesDrawer data={consequences} onChanged={apresGeste} ouvertParDefaut annulation={annulable} />
          </div>
        </FeuilleDuBas>
      )}
    </div>
  );
}

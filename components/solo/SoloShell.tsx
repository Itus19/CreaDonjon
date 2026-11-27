"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Tabs from "@/components/shared/Tabs";
import { SoloContexteProvider, type OngletMonde } from "@/components/solo/SoloContexte";
import RailJeu, { useEmplacementRailJeu } from "@/components/solo/RailJeu";
import VoletLecture from "@/components/solo/VoletLecture";
import { cibleDepuisAdresse, type CibleLecture } from "@/lib/ui/railJeu";
import type { SceneView } from "@/lib/solo/types";
import type { GameTime } from "@/src/core/rules/scene";
import { useMatchMedia } from "@/components/shell/useMatchMedia";
import type { PendingRequest } from "@/lib/solo/types";
import { jaugesEgales, memeDemande, vueDepuisAdresse, type JaugesBande } from "@/lib/ui/solo";

/**
 * V3-D1 — La coquille a trois colonnes de l'ecran solo.
 *
 * Elle ne sait rien de ce qu'elle porte : trois emplacements, un bandeau,
 * et la mecanique de repli. Le monde connu (V3-D3), le fil et la saisie
 * (V3-D4) et la fiche jouable (V3-D5) s'y posent sans que ce fichier
 * change.
 *
 * **V3.1-36 — Trois largeurs, trois dispositions.**
 * - A partir de 1024 px : trois colonnes. **V3.2-12** : le repli se commande
 *   par deux ONGLETS accroches en haut du bord interieur de chaque volet,
 *   dans un couloir de 20 px (meme recette que l'onglet du menu, `Rail.tsx`).
 *   Replie, chaque volet devient une bande de 64 px (V3.2-25 : meme largeur
 *   des deux cotes, la jauge de 48 px de la Fiche et ses marges) : icones et
 *   presents pour le Monde, jauges pour la Fiche ; l'onglet garde sa hauteur et suit le
 *   bord. Les anciennes poignees, a mi-hauteur dans 12 px, touchaient la barre
 *   de defilement du fil et les bulles des PNJ.
 * - De 768 a 1024 px : les trois colonnes deviennent trois onglets.
 * - Sous 768 px : une vue a la fois (`?vue=jeu|monde|fiche|quetes`), choisie
 *   par la barre flottante de `PlayerShell` — lue ici dans l'adresse, ecrite
 *   la-bas par `history.replaceState` (aucun aller-retour serveur).
 *
 * **ADR 0120 — L'écran de jeu (V3.2-55, 56).** Quand la page passe `railJeu`
 * et que `PlayerShell` a laissé un emplacement dans son rail, le rail devient
 * le rail de jeu (rempli ici par un portail, `RailJeu`) et la colonne gauche
 * devient le **volet de consultation** : 380 px ouvert, 0 fermé, en 320 ms.
 * Fermé, le fil prend toute la largeur ; plus de bande du Monde replié (les
 * présents sont dans le rail). Sans emplacement (le MJ à distance, sous sa
 * propre coquille), rien ne change.
 */

type Colonne = "monde" | "jeu" | "fiche";

/**
 * Le pli d'une colonne, memorise dans `localStorage` — meme precedent que
 * `useCollapsedGroups` et `RadioWidget` : un confort de navigateur, jamais
 * synchronise entre appareils. La cle porte le monde, parce qu'on ne joue
 * pas deux mondes avec la meme disposition.
 *
 * La valeur se lit APRES le montage : la lire pendant le rendu donnerait
 * un HTML serveur different du premier rendu client.
 */
function usePliMemorise(cle: string): [boolean, () => void] {
  const [replie, setReplie] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture de localStorage, disponible seulement cote client, au premier montage
      setReplie(window.localStorage.getItem(cle) === "1");
    } catch (erreur) {
      // Stockage indisponible (navigation privee stricte) : la colonne reste depliee.
      console.error("Lecture du pli de la colonne solo impossible", erreur);
    }
  }, [cle]);

  function basculer() {
    setReplie((v) => {
      const suivant = !v;
      try {
        window.localStorage.setItem(cle, suivant ? "1" : "0");
      } catch (erreur) {
        // Rien a faire : le pli tient pour cette session.
        console.error("Enregistrement du pli de la colonne solo impossible", erreur);
      }
      return suivant;
    });
  }

  return [replie, basculer];
}

/**
 * V3.2-12 — L'onglet d'un volet. Il sort du bord interieur du volet, en haut,
 * dans le couloir de 20 px : il appartient visiblement au volet, et le haut
 * du couloir est loin des bulles et de la barre de defilement du fil. Meme
 * recette que l'onglet du menu (`Rail.tsx`) : bordure ouverte du cote du
 * volet, coins arrondis du cote du fil.
 *
 * Le chevron pointe vers **ce qui va se passer**, pas vers l'etat present :
 * deplie, la fleche va vers l'exterieur (le volet part se ranger) ; replie,
 * elle revient vers l'interieur.
 */
function OngletVolet({
  cote,
  repliee,
  libelle,
  onBasculer,
}: {
  cote: "gauche" | "droite";
  repliee: boolean;
  libelle: string;
  onBasculer: () => void;
}) {
  const versExterieur = cote === "gauche" ? "‹" : "›";
  const versInterieur = cote === "gauche" ? "›" : "‹";

  return (
    <button
      type="button"
      onClick={onBasculer}
      aria-expanded={!repliee}
      aria-label={libelle}
      title={libelle}
      // `-left-5` / `-right-5` = la largeur du couloir (`lg:gap-5`) : l'onglet touche le bord du volet, pas celui du fil.
      className={`absolute top-3 z-10 hidden h-11 w-4 items-center justify-center border border-edge-strong bg-panel-raised text-sm leading-none text-ink-soft shadow-lg transition-colors hover:bg-panel hover:text-ink motion-reduce:transition-none lg:flex ${
        cote === "gauche" ? "-left-5 rounded-r-xl border-l-0" : "-right-5 rounded-l-xl border-r-0"
      }`}
    >
      <span aria-hidden="true">{repliee ? versInterieur : versExterieur}</span>
    </button>
  );
}

export default function SoloShell({
  worldSlug,
  entete,
  monde,
  mondeTelephone,
  quetes,
  jeu,
  fiche,
  bandeMonde,
  railJeu,
}: {
  worldSlug: string;
  /** Le contenu du bandeau (V3-D2). */
  entete: ReactNode;
  /** Le monde connu des colonnes d'ordinateur et de tablette (V3-D3). */
  monde: ReactNode;
  /** V3.1-36 : le Monde du telephone (presents, wiki, recents), sans Quetes ni Regles. */
  mondeTelephone: ReactNode;
  /** V3.1-36 : la vue Quetes du telephone. */
  quetes: ReactNode;
  jeu: ReactNode;
  /** La fiche lit son pli dans le contexte (`useSoloContexte`) : replie, elle se rend en bande. */
  fiche: ReactNode;
  /** V3.2-12 : le contenu de la bande du Monde replié (ordinateur). Absent : la bande ne porte que son nom. */
  bandeMonde?: ReactNode;
  /** ADR 0120 : les présents du rail de jeu. Absent : la coquille garde ses deux volets d'avant (MJ, jeu à distance). */
  railJeu?: { present: SceneView["present"]; sketches: SceneView["sketches"] };
}) {
  const t = useTranslations("solo");
  const [gaucheRepliee, basculerGauche] = usePliMemorise(`creadonjon:solo:${worldSlug}:gauche`);
  const [droiteRepliee, basculerDroite] = usePliMemorise(`creadonjon:solo:${worldSlug}:droite`);
  const [colonne, setColonne] = useState<Colonne>("jeu");
  const vue = vueDepuisAdresse(useSearchParams().get("vue"));
  const ordinateur = useMatchMedia("(min-width: 1024px)");
  const [jauges, setJauges] = useState<JaugesBande | null>(null);
  const publier = useCallback((suivantes: JaugesBande | null) => setJauges((precedentes) => (jaugesEgales(precedentes, suivantes) ? precedentes : suivantes)), []);

  // Le pli de la Fiche (bande de 64 px) n'existe que sur ordinateur : un pli memorise sur grand ecran ne doit pas reduire la fiche d'un telephone.
  const ficheRepliee = droiteRepliee && ordinateur;
  // Meme chose pour la bande du Monde : sur tablette, le Monde reste entier dans son onglet.
  const mondeReplie = gaucheRepliee && ordinateur;
  const [ongletMonde, choisirOngletMonde] = useState<OngletMonde>("wiki");
  const emplacementRail = useEmplacementRailJeu();
  const voletDeJeu = railJeu !== undefined && emplacementRail !== null;
  // V3.2-57 : la fiche ou la règle lue en entier dans le volet ; `null` : le volet montre l'entrée du rail.
  const [lecture, setLecture] = useState<CibleLecture | null>(null);
  const [interlocuteur, definirInterlocuteur] = useState<string | null>(null);
  const deplierMonde = useCallback(
    (onglet: OngletMonde) => {
      choisirOngletMonde(onglet);
      if (gaucheRepliee) basculerGauche();
      // Sur tablette, le volet est l'onglet « Monde » : le rail de jeu y mène.
      if (!ordinateur) setColonne("monde");
    },
    [gaucheRepliee, basculerGauche, ordinateur]
  );
  /** Rail de jeu : l'entrée déjà ouverte referme le volet ; une autre l'ouvre sur elle. */
  const basculerVolet = useCallback(
    (onglet: OngletMonde) => {
      // Une lecture ouverte : l'entrée ramène d'abord à sa liste, sans fermer le volet.
      if (ordinateur && !gaucheRepliee && ongletMonde === onglet && lecture === null) basculerGauche();
      else deplierMonde(onglet);
      setLecture(null);
    },
    [ordinateur, gaucheRepliee, ongletMonde, lecture, basculerGauche, deplierMonde]
  );

  /**
   * V3.2-57 — Un lien vers une fiche du wiki ou une règle de ce monde, cliqué
   * n'importe où dans l'écran de jeu (récit, bandeau, volet, fiche lue), s'ouvre
   * dans le volet au lieu de faire quitter la partie. Capturé ici une fois pour
   * toutes, plutôt que dans chaque composant qui pose un lien. Un clic avec
   * Ctrl, Maj ou la molette garde son sens (nouvel onglet).
   */
  function intercepterLien(e: React.MouseEvent) {
    if (!voletDeJeu || !ordinateur || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const lien = (e.target as HTMLElement).closest("a");
    const href = lien?.getAttribute("href");
    if (!lien || !href || lien.target === "_blank") return;
    const cible = cibleDepuisAdresse(href, worldSlug);
    if (!cible) return;
    e.preventDefault();
    setLecture(cible);
    if (gaucheRepliee) basculerGauche();
  }
  // La demande en cours : une seule source, la fiche (son sondage) et la barre d'intention (sa réponse), jamais un second sondage.
  const [demande, setDemande] = useState<PendingRequest | null>(null);
  const definirDemande = useCallback((suivante: PendingRequest | null) => setDemande((precedente) => (memeDemande(precedente, suivante) ? precedente : suivante)), []);
  const rechargeRef = useRef<(() => void) | null>(null);
  const inscrireRecharge = useCallback((recharger: (() => void) | null) => {
    rechargeRef.current = recharger;
  }, []);
  const rechargerFiche = useCallback(() => rechargeRef.current?.(), []);
  // V3.2-18 : l'heure rendue par le dernier tour, pour le bandeau (rendu une fois par la page serveur).
  const [heure, definirHeure] = useState<GameTime | null>(null);
  const contexte = useMemo(
    () => ({ replie: ficheRepliee, jauges, publier, demande, definirDemande, rechargerFiche, inscrireRecharge, ongletMonde, choisirOngletMonde, deplierMonde, interlocuteur, definirInterlocuteur, heure, definirHeure, voletDeJeu }),
    [ficheRepliee, jauges, publier, demande, definirDemande, rechargerFiche, inscrireRecharge, ongletMonde, deplierMonde, interlocuteur, heure, voletDeJeu]
  );

  /**
   * **Piege verifie le 22 septembre en dessinant l'ecran :**
   * `grid-template-columns` n'interpole pas entre `minmax(200px,1fr)` et un
   * `0px` nu — le navigateur reste bloque sur l'ancienne valeur et la
   * colonne ne se replie jamais. Les deux bornes doivent etre des
   * `minmax()` de meme forme. Meme raison pour les bandes de 64 px.
   */
  // ADR 0120 : le volet de consultation a une largeur fixe (380 px) ; fermé, 0 px — même forme `minmax()` aux deux bornes.
  const colGauche = voletDeJeu
    ? gaucheRepliee
      ? "minmax(0px,0px)"
      : "minmax(380px,380px)"
    : gaucheRepliee
      ? "minmax(64px,0fr)"
      : "minmax(200px,1fr)";
  const colDroite = droiteRepliee ? "minmax(64px,0fr)" : "minmax(280px,1.2fr)";

  // Visibilite par largeur : `max-md:` = telephone (la vue de l'adresse), `md:max-lg:` = tablette (l'onglet), `lg:` = tout est la.
  const cachee = (telephone: boolean, tablette: boolean) =>
    `${telephone ? "" : "max-md:hidden"} ${tablette ? "" : "md:max-lg:hidden"}`;

  return (
    <SoloContexteProvider value={contexte}>
      {voletDeJeu && emplacementRail && railJeu && (
        <RailJeu
          emplacement={emplacementRail}
          worldSlug={worldSlug}
          present={railJeu.present}
          sketches={railJeu.sketches}
          voletOuvert={!gaucheRepliee}
          basculerVolet={basculerVolet}
        />
      )}
      {/* V3.2-57 : capture les clics sur les liens qu'il contient ; Entrée sur un lien déclenche aussi un `click`. */}
      <div className="flex h-full min-h-0 flex-col gap-3" onClickCapture={intercepterLien}>
        {/* Sous 768 px, le bandeau lieu / heure est celui de la vue Jeu seulement. */}
        <header
          className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-edge bg-panel px-3 py-2 ${vue === "jeu" ? "" : "max-md:hidden"}`}
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">{entete}</div>
        </header>

        {/* De 768 a 1024 px, les trois colonnes deviennent trois onglets, et
            « Jeu » s'ouvre par defaut : c'est la que se joue le tour. */}
        <div className="hidden md:block lg:hidden">
          <Tabs
            aria-label={t("colonneAffichee")}
            value={colonne}
            onChange={setColonne}
            items={[
              { value: "monde", label: t("onglets.monde") },
              { value: "jeu", label: t("onglets.jeu") },
              { value: "fiche", label: t("onglets.fiche") },
            ]}
          />
        </div>

        <div
          className={`grid min-h-0 flex-1 grid-cols-1 gap-3 lg:gap-5 transition-[grid-template-columns] ${voletDeJeu ? "duration-[320ms] ease-[cubic-bezier(.4,0,.2,1)]" : "duration-200"} motion-reduce:transition-none lg:grid-cols-[var(--col-gauche)_minmax(0,2fr)_var(--col-droite)]`}
          style={{ "--col-gauche": colGauche, "--col-droite": colDroite } as React.CSSProperties}
        >
          <section aria-label={voletDeJeu ? t("railJeu.voletAria") : t("aria.monde")} className={`min-h-0 ${voletDeJeu ? "lg:overflow-hidden" : ""} ${cachee(false, colonne === "monde")} lg:block`}>
            {voletDeJeu ? (
              // Largeur fixe à l'intérieur : le contenu ne se recompose pas pendant que la colonne s'ouvre ou se ferme.
              <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-edge bg-panel lg:w-[380px]" inert={ordinateur && gaucheRepliee ? true : undefined}>
                <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-edge pl-4 pr-2">
                  {lecture ? (
                    <button type="button" onClick={() => setLecture(null)} className="min-w-0 truncate py-1 text-xs text-ink-muted hover:text-ink">
                      ← {t(`bandeMonde.${ongletMonde}`)}
                    </button>
                  ) : (
                    <span className="min-w-0 truncate font-chrome text-sm font-medium text-ink">{t(`bandeMonde.${ongletMonde}`)}</span>
                  )}
                  <button
                    type="button"
                    onClick={basculerGauche}
                    aria-label={t("railJeu.fermerVolet")}
                    title={t("railJeu.fermerVolet")}
                    className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-full border border-edge text-sm text-ink-soft transition-colors hover:text-ink motion-reduce:transition-none lg:flex"
                  >
                    ×
                  </button>
                </div>
                {lecture && (
                  <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    <VoletLecture worldSlug={worldSlug} cible={lecture} />
                  </div>
                )}
                {/* La liste reste montée sous la lecture : sa recherche et son défilement survivent au retour. */}
                <div className={`flex min-h-0 flex-1 flex-col ${lecture ? "hidden" : ""}`}>{monde}</div>
              </div>
            ) : (
              <>
                {/* Replie, le Monde reste MONTE (cache) : sa recherche et son defilement survivent au pli. */}
            {mondeReplie && (
              <div className="flex h-full min-h-0 flex-col items-center gap-3 overflow-hidden rounded-lg border border-edge bg-panel py-3">
                {bandeMonde}
                <span aria-hidden="true" className="mt-auto rotate-180 text-xs uppercase tracking-wider text-ink-muted [writing-mode:vertical-rl]">
                  {t("onglets.monde")}
                </span>
              </div>
            )}
            <div className={`h-full min-h-0 ${mondeReplie ? "hidden" : ""}`}>{monde}</div>
              </>
            )}
          </section>

          <section aria-label={t("aria.monde")} className={`min-h-0 overflow-y-auto md:hidden ${vue === "monde" ? "" : "max-md:hidden"}`}>
            {mondeTelephone}
          </section>

          <section aria-label={t("aria.quetes")} className={`min-h-0 overflow-y-auto md:hidden ${vue === "quetes" ? "" : "max-md:hidden"}`}>
            {quetes}
          </section>

          <section aria-label={t("aria.fil")} className={`relative min-h-0 ${cachee(vue === "jeu", colonne === "jeu")} lg:block`}>
            {!voletDeJeu && (
            <OngletVolet
              cote="gauche"
              repliee={gaucheRepliee}
              libelle={gaucheRepliee ? t("deplierMonde") : t("replierMonde")}
              onBasculer={basculerGauche}
            />
            )}
            <OngletVolet
              cote="droite"
              repliee={droiteRepliee}
              libelle={droiteRepliee ? t("deplierFiche") : t("replierFiche")}
              onBasculer={basculerDroite}
            />
            {/* V3.2-12 : plus de plafond a 80 caracteres, le fil s'etale (le plafond vit sur le paragraphe de narration, `Fil.tsx`). `lg:pr-1` rentre la barre de defilement d'un cran. */}
            <div className="flex h-full min-h-0 flex-col lg:pr-1">{jeu}</div>
          </section>

          <section
            aria-label={t("aria.fiche")}
            className={`min-h-0 overflow-hidden ${cachee(vue === "fiche", colonne === "fiche")} lg:block`}
          >
            {fiche}
          </section>
        </div>
      </div>
    </SoloContexteProvider>
  );
}

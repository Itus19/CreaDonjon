"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Tabs from "@/components/shared/Tabs";
import { SoloContexteProvider } from "@/components/solo/SoloContexte";
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
 * - A partir de 1024 px : trois colonnes. Le repli se commande par deux
 *   POIGNEES verticales posees sur les bords du Jeu (gauche : le Monde, qui
 *   disparait replie ; droite : la Fiche, qui devient une bande de 96 px de
 *   jauges). Qu'on replie ou qu'on deplie, la poignee ne bouge pas : elle est
 *   au bord du Jeu, qui ne change pas de place.
 * - De 768 a 1024 px : les trois colonnes deviennent trois onglets.
 * - Sous 768 px : une vue a la fois (`?vue=jeu|monde|fiche|quetes`), choisie
 *   par la barre flottante de `PlayerShell` — lue ici dans l'adresse, ecrite
 *   la-bas par `history.replaceState` (aucun aller-retour serveur).
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
 * Le chevron pointe vers **ce qui va se passer**, pas vers l'etat present :
 * depliee, la fleche va vers l'exterieur (la colonne part se ranger) ;
 * repliee, elle revient vers l'interieur.
 */
function PoigneeRepli({
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
      // Posee dans la gouttiere de 12 px entre le Jeu et la colonne voisine : `after:` agrandit la cible sans empieter sur le texte.
      // Une languette fermée et neutre : ouverte d'un côté ou cerclée d'accent, elle encadrait la ligne du fil voisine comme une sélection.
      className={`absolute top-1/2 z-10 hidden h-16 w-3 -translate-y-1/2 items-center justify-center rounded-full border border-edge bg-panel text-xs leading-none text-ink-muted transition-colors after:absolute after:-inset-x-1.5 after:inset-y-0 after:content-[''] hover:border-accent hover:text-accent motion-reduce:transition-none lg:flex ${
        cote === "gauche" ? "-left-3" : "-right-3"
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
}) {
  const t = useTranslations("solo");
  const [gaucheRepliee, basculerGauche] = usePliMemorise(`creadonjon:solo:${worldSlug}:gauche`);
  const [droiteRepliee, basculerDroite] = usePliMemorise(`creadonjon:solo:${worldSlug}:droite`);
  const [colonne, setColonne] = useState<Colonne>("jeu");
  const vue = vueDepuisAdresse(useSearchParams().get("vue"));
  const ordinateur = useMatchMedia("(min-width: 1024px)");
  const [jauges, setJauges] = useState<JaugesBande | null>(null);
  const publier = useCallback((suivantes: JaugesBande | null) => setJauges((precedentes) => (jaugesEgales(precedentes, suivantes) ? precedentes : suivantes)), []);

  // Le pli de la Fiche (bande de 96 px) n'existe que sur ordinateur : un pli memorise sur grand ecran ne doit pas reduire la fiche d'un telephone.
  const ficheRepliee = droiteRepliee && ordinateur;
  // La demande en cours : une seule source, la fiche (son sondage) et la barre d'intention (sa réponse), jamais un second sondage.
  const [demande, setDemande] = useState<PendingRequest | null>(null);
  const definirDemande = useCallback((suivante: PendingRequest | null) => setDemande((precedente) => (memeDemande(precedente, suivante) ? precedente : suivante)), []);
  const rechargeRef = useRef<(() => void) | null>(null);
  const inscrireRecharge = useCallback((recharger: (() => void) | null) => {
    rechargeRef.current = recharger;
  }, []);
  const rechargerFiche = useCallback(() => rechargeRef.current?.(), []);
  const contexte = useMemo(
    () => ({ replie: ficheRepliee, jauges, publier, demande, definirDemande, rechargerFiche, inscrireRecharge }),
    [ficheRepliee, jauges, publier, demande, definirDemande, rechargerFiche, inscrireRecharge]
  );

  /**
   * **Piege verifie le 22 septembre en dessinant l'ecran :**
   * `grid-template-columns` n'interpole pas entre `minmax(200px,1fr)` et un
   * `0px` nu — le navigateur reste bloque sur l'ancienne valeur et la
   * colonne ne se replie jamais. Les deux bornes doivent etre des
   * `minmax()` de meme forme. Meme raison pour la bande de 96 px.
   */
  const colGauche = gaucheRepliee ? "minmax(0px,0fr)" : "minmax(200px,1fr)";
  const colDroite = droiteRepliee ? "minmax(96px,0fr)" : "minmax(280px,1.2fr)";

  /**
   * La meme disparition que le volet de des (`DiceRollPanel`) : 200 ms,
   * echelle et opacite, origine du cote de la colonne. Seul le Monde
   * disparait ; la Fiche, elle, reste en bande.
   *
   * Tout est prefixe `lg:` — une colonne repliee sur grand ecran ne doit
   * pas revenir invisible dans son onglet de tablette, ou le pli n'existe
   * pas.
   */
  const volee = (repliee: boolean) =>
    // Les classes sont ecrites ENTIERES : Tailwind lit les sources au mot,
    // une classe composee n'existerait dans aucun CSS.
    `min-h-0 overflow-hidden transition-all duration-200 motion-reduce:transition-none origin-left ${
      repliee ? "lg:pointer-events-none lg:scale-95 lg:opacity-0" : "lg:scale-100 lg:opacity-100"
    }`;

  /**
   * Les deux colonnes repliees, **le fil ne s'etale pas** : replier sert a
   * enlever le bruit autour du texte, pas a elargir le texte. Une ligne de
   * 200 caracteres se lit moins bien qu'une ligne de 80, et l'oeil perd
   * son retour a la ligne.
   */
  const centreSeul = gaucheRepliee && droiteRepliee;

  // Visibilite par largeur : `max-md:` = telephone (la vue de l'adresse), `md:max-lg:` = tablette (l'onglet), `lg:` = tout est la.
  const cachee = (telephone: boolean, tablette: boolean) =>
    `${telephone ? "" : "max-md:hidden"} ${tablette ? "" : "md:max-lg:hidden"}`;

  return (
    <SoloContexteProvider value={contexte}>
      <div className="flex h-full min-h-0 flex-col gap-3">
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
          className="grid min-h-0 flex-1 grid-cols-1 gap-3 transition-[grid-template-columns] duration-200 motion-reduce:transition-none lg:grid-cols-[var(--col-gauche)_minmax(0,2fr)_var(--col-droite)]"
          style={{ "--col-gauche": colGauche, "--col-droite": colDroite } as React.CSSProperties}
        >
          <section aria-label={t("aria.monde")} className={`${cachee(false, colonne === "monde")} lg:block ${volee(gaucheRepliee)}`}>
            {monde}
          </section>

          <section aria-label={t("aria.monde")} className={`min-h-0 overflow-y-auto md:hidden ${vue === "monde" ? "" : "max-md:hidden"}`}>
            {mondeTelephone}
          </section>

          <section aria-label={t("aria.quetes")} className={`min-h-0 overflow-y-auto md:hidden ${vue === "quetes" ? "" : "max-md:hidden"}`}>
            {quetes}
          </section>

          <section aria-label={t("aria.fil")} className={`relative min-h-0 ${cachee(vue === "jeu", colonne === "jeu")} lg:block`}>
            <PoigneeRepli
              cote="gauche"
              repliee={gaucheRepliee}
              libelle={gaucheRepliee ? t("deplierMonde") : t("replierMonde")}
              onBasculer={basculerGauche}
            />
            <PoigneeRepli
              cote="droite"
              repliee={droiteRepliee}
              libelle={droiteRepliee ? t("deplierFiche") : t("replierFiche")}
              onBasculer={basculerDroite}
            />
            <div className={`flex h-full min-h-0 flex-col ${centreSeul ? "mx-auto w-full max-w-[80ch]" : ""}`}>{jeu}</div>
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

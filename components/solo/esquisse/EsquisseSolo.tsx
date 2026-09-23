"use client";

import { useEffect, useRef, useState } from "react";
import BinderTabs from "@/components/shared/BinderTabs";
import Checkbox from "@/components/shared/Checkbox";
import Dropdown from "@/components/shared/Dropdown";
import DieIcon from "@/components/shared/DieIcon";
import { dieSidesFromFormula } from "@/src/core/dice/dieSides";
// `withModifier` vient de la vraie fiche : c'est elle qui sait écrire
// « 1d20+5 » à partir d'un modificateur, et deux façons de le faire
// finiraient par diverger d'un signe.
import { withModifier } from "@/components/blocks/InventoryPanel";
import { MAGIC_SCHOOL_COLOR_VAR } from "@/src/i18n/fr";
import {
  DES_FACTICES,
  DISCOVERY_MARK,
  EMPLACEMENTS,
  ENTETE,
  FEED,
  FICHE,
  INVENTAIRE,
  APTITUDES,
  BOURSE,
  CHARGE,
  COMPTEURS,
  ETATS,
  MAITRISES,
  ORIGINE_LABEL,
  PROGRESSION,
  PRESENTS,
  QUETES,
  SORTS,
  SOURCE_MARK,
  WIKI,
  type FeedItem,
  type Sort,
  type WikiEntry,
} from "./fixtures";

/**
 * V3-D — **Esquisse**, pas l'écran. Jetable.
 *
 * Sixième passe. Ce qu'elle acte :
 *
 * - **Un seul champ pour tout ce que le joueur envoie.** Ce qu'il écrit
 *   ET ce qu'il lance : un jet fait depuis la fiche ou depuis l'outil de
 *   dés vient s'y inscrire en texte. Plus de volet séparé à valider — le
 *   résultat se voit là où part tout le reste, et `Jouer` l'engage.
 * - **Le champ grandit avec son contenu**, les boutons sont dessous.
 * - **Le moteur devine une question**, et le montre plutôt que de
 *   corriger en douce : `MJ` passe devant, `Jouer` recule.
 * - **Les colonnes latérales n'ont pas de fond** : elles se posent sur le
 *   fond de page, et de fins encadrés découpent leur contenu.
 * - **Les colonnes se replient depuis le bandeau**, par deux boutons
 *   posés à ses extrémités et toujours visibles. Elles s'effacent avec
 *   la meme animation que le volet de des (200 ms, echelle + opacite).
 *
 * Les dés sortent d'une liste fixe (`DES_FACTICES`) : dans ce projet le
 * client ne lance pas les dés.
 */

const CHIP = "rounded-full border border-edge px-3 py-1 text-xs text-ink";
const CHIP_MUTED = "rounded-full border border-edge px-3 py-1 text-xs text-ink-muted";
const BTN_ACCENT =
  "rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover";
const BTN_GHOST =
  "rounded-full border border-accent px-4 py-2 text-sm text-accent transition-colors hover:bg-accent/10";
const BTN_RETRAIT =
  "rounded-full border border-edge px-4 py-2 text-sm text-ink-muted transition-colors hover:bg-panel-raised";
/**
 * Le panneau d'un classeur. **Sans fond**, comme le haut de la fiche :
 * les deux colonnes latérales se posent sur le fond de page, et seuls de
 * fins encadrés découpent ce qu'elles contiennent. C'est ce que l'auteur
 * a retenu du premier jet — le bloc des caractéristiques, qui ne pèse
 * rien parce qu'il ne pose aucune surface.
 *
 * Bord fin (`border`, pas `border-2`), de la couleur de la ligne des
 * onglets pour que la jointure reste franche.
 */
const CLASSEUR = "rounded-b-lg border border-t-0 border-edge-strong p-3";
const LIGNE_CLIQUABLE =
  "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-panel-sunken";

type Colonne = "monde" | "jeu" | "fiche";

interface Demande {
  label: string;
  detail: string;
  modificateur: number;
  dc: number | null;
}

/** Un résultat tombé dans le volet, pas encore engagé dans la partie. */
interface JetEnAttente {
  label: string;
  de: number;
  modificateur: number;
  total: number;
  dc: number | null;
  /**
   * D'où vient le dé. `fiche` : le modificateur était connu au moment du
   * clic, il s'est ajouté tout seul. `outil` : le dé est arrivé nu, et
   * c'est le volet qui l'a rattaché à la demande en cours.
   */
  origine: "fiche" | "outil";
}

const PREMIERE_DEMANDE: Demande = {
  label: "Sauvegarde de Dextérité",
  detail: "le gobelin te pousse contre la rampe",
  modificateur: 3,
  dc: 13,
};

/**
 * « Est-ce que c'est une question ? », sans modèle.
 *
 * Un point d'interrogation, ou une tournure interrogative en tête de
 * phrase. Liste FERMÉE, comme le lexique de verbes de V3-B1 : ce qu'elle
 * rate tombe simplement du bon côté par défaut (une action), ce qui est
 * l'erreur la moins coûteuse — on ne fait jamais avancer l'horloge par
 * surprise, on la laisse seulement avancer quand l'humain l'a voulu.
 */
const TOURNURES = ["est-ce", "comment", "combien", "pourquoi", "quand", "quel", "quelle", "qui", "puis-je", "peut-on", "où"];

export function ressembleAUneQuestion(texte: string): boolean {
  const t = texte.trim().toLowerCase();
  if (t.length === 0) return false;
  if (t.endsWith("?")) return true;
  return TOURNURES.some((mot) => t.startsWith(mot));
}

function Marqueur({ mark, title }: { mark: string; title: string }) {
  return (
    <span className="cursor-help text-xs text-ink-muted" title={title}>
      {mark}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Colonne gauche — le monde connu
// ---------------------------------------------------------------------------

function FicheWiki({ entry, onRetour }: { entry: WikiEntry; onRetour: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={onRetour} className="self-start py-1 text-xs text-ink-muted hover:text-ink">
        ← {entry.group}
      </button>
      <div className="flex items-center gap-2">
        <span className="font-chrome text-base font-medium text-ink">{entry.name}</span>
        <Marqueur {...DISCOVERY_MARK[entry.discovery]} />
      </div>
      {(entry.body ?? ["Rien d'écrit pour l'instant."]).map((p) => (
        <p key={p} className="text-sm leading-snug text-ink-soft">
          {p}
        </p>
      ))}
      <a href="#" className="mt-1 text-xs text-link-entity hover:underline">
        ouvrir la fiche entière
      </a>
    </div>
  );
}

function ColonneMonde() {
  const [onglet, setOnglet] = useState<"wiki" | "quetes" | "presents" | "regles">("wiki");
  const [ouverte, setOuverte] = useState<string | null>(null);
  const groupes = [...new Set(WIKI.map((e) => e.group))];
  const entry = WIKI.find((e) => e.id === ouverte) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <BinderTabs
        aria-label="Colonne du monde"
        value={onglet}
        onChange={(v) => {
          setOnglet(v);
          setOuverte(null);
        }}
        items={[
          { value: "wiki", label: "Wiki" },
          { value: "quetes", label: "Quêtes" },
          { value: "presents", label: "Présents" },
          { value: "regles", label: "Règles" },
        ]}
      />

      <div className={`${CLASSEUR} min-h-0 flex-1 overflow-y-auto`}>
        {onglet === "wiki" &&
          (entry ? (
            <FicheWiki entry={entry} onRetour={() => setOuverte(null)} />
          ) : (
            <div className="flex flex-col gap-3">
              {groupes.map((groupe) => (
                <div key={groupe} className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{groupe}</span>
                  {WIKI.filter((e) => e.group === groupe).map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setOuverte(e.id)}
                      disabled={e.discovery === "mentionne"}
                      className={`${LIGNE_CLIQUABLE} disabled:opacity-50 disabled:hover:bg-transparent`}
                    >
                      <span className="truncate text-sm text-ink">{e.name}</span>
                      <Marqueur {...DISCOVERY_MARK[e.discovery]} />
                    </button>
                  ))}
                </div>
              ))}
              <p className="text-xs text-ink-muted">◆ connu · ○ esquisse · ◇ mentionné</p>
            </div>
          ))}

        {onglet === "quetes" && (
          <div className="flex flex-col gap-3">
            {QUETES.map((q) => {
              const faits = q.objectifs.filter((o) => o.done).length;
              return (
                <div key={q.id} className="flex flex-col gap-1 rounded-md border border-edge p-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-ink">{q.titre}</span>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {faits}/{q.objectifs.length}
                    </span>
                  </div>
                  <span className="text-xs text-ink-muted">donnée par {q.donneur}</span>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {q.objectifs.map((o) => (
                      <li key={o.id} className={`text-sm ${o.done ? "text-ink-muted line-through" : "text-ink-soft"}`}>
                        {o.done ? "✓" : "○"} {o.text}
                      </li>
                    ))}
                  </ul>
                  {q.recompense && <span className="mt-1 text-xs text-ink-muted">Récompense : {q.recompense}</span>}
                </div>
              );
            })}
          </div>
        )}

        {onglet === "presents" && (
          <div className="flex flex-col gap-2">
            {PRESENTS.map((p) => (
              <div key={p.id} className="flex flex-col gap-0.5 rounded-md border border-edge p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-ink">{p.name}</span>
                  <Marqueur {...DISCOVERY_MARK[p.discovery]} />
                </div>
                <span className="text-xs text-ink-muted">
                  {p.attitude} · {p.zone === "engaged" ? "au contact" : p.zone === "near" ? "à portée" : "au loin"}
                </span>
                {p.discovery === "esquisse" && (
                  <button type="button" className={`${CHIP} mt-1 self-start`}>
                    garder cette fiche
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {onglet === "regles" && (
          <div className="flex flex-col gap-2">
            <input
              placeholder="chercher une règle"
              aria-label="Chercher une règle"
              className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
            />
            <p className="text-sm text-ink-muted">L&apos;écran de règles existant, en version étroite.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Colonne centrale — le fil, le volet de dés, la saisie
// ---------------------------------------------------------------------------

function Jet({ item }: { item: Extract<FeedItem, { kind: "roll" }> }) {
  return (
    <details className="rounded-md border border-edge bg-panel-sunken px-3 py-1.5">
      <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-xs uppercase tracking-wide text-ink-muted">{item.label}</span>
        <span className="text-sm font-medium text-ink">{item.total}</span>
        {item.dc !== null && (
          <span className={`text-xs ${item.verdict === "success" ? "text-success" : "text-danger"}`}>
            contre DD {item.dc} — {item.verdict === "success" ? "réussite" : "échec"}
          </span>
        )}
        <span className="text-xs text-ink-muted">· {ORIGINE_LABEL[item.origine]}</span>
      </summary>
      <p className="mt-1 text-xs text-ink-muted">
        {item.expression} · {item.trace.join(", ")}
      </p>
    </details>
  );
}

function Fil({ items }: { items: FeedItem[] }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        switch (item.kind) {
          case "narration":
            return (
              <p key={item.id} className="text-sm leading-snug text-ink">
                {item.text} <Marqueur {...SOURCE_MARK[item.source]} />
              </p>
            );
          case "player":
            return (
              <p key={item.id} className="self-end rounded-md bg-panel-sunken px-3 py-1 text-sm text-ink-soft">
                {item.text}
              </p>
            );
          case "mj":
            return (
              <div key={item.id} className="rounded-md border-l-2 border-accent bg-panel-sunken px-3 py-1.5">
                <span className="text-xs uppercase tracking-wide text-ink-muted">MJ · hors du temps de jeu</span>
                <p className="text-sm leading-snug text-ink-soft">{item.text}</p>
              </div>
            );
          case "demande":
            return (
              <div key={item.id} className="flex flex-wrap items-baseline gap-x-2 text-xs text-ink-muted">
                <span className="uppercase tracking-wide">Jet demandé</span>
                <span className="text-ink-soft">
                  {item.label} — {item.detail}
                </span>
              </div>
            );
          case "roll":
            return <Jet key={item.id} item={item} />;
          case "rule":
            return (
              <details key={item.id} className="rounded-md border border-edge px-3 py-1.5">
                <summary className="cursor-pointer text-xs text-ink-muted">{item.label}</summary>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {item.lines.map((line) => (
                    <li key={line} className="text-sm text-ink-soft">
                      {line}
                    </li>
                  ))}
                </ul>
              </details>
            );
          case "world":
            return (
              <p key={item.id} className="text-xs text-ink-muted">
                {item.text} <Marqueur {...SOURCE_MARK[item.source]} />
              </p>
            );
        }
      })}
    </div>
  );
}

/**
 * La saisie — **un seul champ pour tout ce que le joueur envoie.**
 *
 * Ce qu'il écrit, et ce qu'il lance : un jet fait depuis la fiche ou
 * depuis l'outil de dés vient s'y inscrire en texte, à côté de ce qu'il
 * était en train de taper. Il n'y a donc plus de volet séparé à valider —
 * le résultat se voit là où part tout le reste, et `Jouer` l'engage.
 *
 * Le champ GRANDIT avec ce qu'on écrit : une ligne au départ, jusqu'à
 * huit. Les boutons passent dessous, sinon ils descendraient avec lui.
 *
 * Quand la phrase ressemble à une question, `MJ` passe devant et `Jouer`
 * recule — le moteur devine, il ne corrige pas en douce.
 */
function Saisie({
  demande,
  texte,
  onTexte,
  onJouer,
  onLancerDansOutil,
}: {
  demande: Demande | null;
  texte: string;
  onTexte: (v: string) => void;
  onJouer: () => void;
  onLancerDansOutil: () => void;
}) {
  const question = ressembleAUneQuestion(texte);
  const champRef = useRef<HTMLTextAreaElement>(null);

  const invite = demande
    ? `${demande.label}${demande.dc !== null ? ` DD ${demande.dc}` : ""} — lance depuis ta fiche, ou écris ton résultat`
    : "Que fais-tu ?";

  /**
   * Le champ suit son contenu : remis à plat, puis à la hauteur du texte.
   *
   * Dans un effet, et pas dans le gestionnaire de frappe : le texte
   * n'arrive pas toujours du clavier — un jet lancé depuis la fiche s'y
   * inscrit aussi, et le champ doit grandir pour lui de la même façon.
   * Vérifié le 22 septembre : sur la frappe seule, un jet inséré restait
   * coincé sur une ligne.
   */
  useEffect(() => {
    const champ = champRef.current;
    if (!champ) return;
    champ.style.height = "auto";
    champ.style.height = `${champ.scrollHeight}px`;
  }, [texte]);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-edge bg-panel p-3">
      <textarea
        ref={champRef}
        rows={1}
        value={texte}
        onChange={(e) => onTexte(e.target.value)}
        placeholder={invite}
        aria-label={demande ? `Jet attendu : ${demande.label}` : "Que fais-tu ?"}
        className={`max-h-48 w-full resize-none overflow-y-auto rounded-md border bg-transparent px-2 py-2 text-sm leading-snug text-ink outline-none transition-colors ${
          demande ? "border-accent placeholder:text-accent" : "border-edge"
        }`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={question ? BTN_RETRAIT : BTN_ACCENT} onClick={onJouer} title="Joue ce tour — l'horloge avance">
          Jouer
        </button>
        <button
          type="button"
          className={question ? BTN_ACCENT : BTN_GHOST}
          title="Une question sur la scène ou sur une règle — le temps de jeu ne bouge pas"
        >
          MJ
        </button>

        {question && (
          <span className="text-xs text-ink-muted">
            On dirait une question — elle part au MJ, et l&apos;horloge ne bouge pas.
          </span>
        )}

        {/* Commande d'ESQUISSE : elle tient lieu du vrai outil de dés,
            qu'on ne peut pas piloter d'ici. En vrai, le d20 lancé dans
            l'outil vient s'inscrire ici tout seul. */}
        <button
          type="button"
          onClick={onLancerDansOutil}
          className="ml-auto rounded-full border border-dashed border-edge px-3 py-1 text-xs text-ink-muted transition-colors hover:bg-panel-raised"
        >
          simuler un d20 lancé dans l&apos;outil
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Colonne droite — la fiche jouable
// ---------------------------------------------------------------------------


/**
 * La colonne de droite EST la fiche jouable, au format étroit.
 *
 * Les six onglets reprennent ceux de `PlayableCharacterSheet` — Actions,
 * Sac, Magie, Traits, Maîtrises — et leur contenu est celui de leurs
 * vrais onglets : « Aptitudes accordées » pour Traits, maîtrises /
 * maîtrise d'armes / langues pour Maîtrises, la bourse et la charge en
 * tête du Sac. Rien n'est inventé ici ; seul le format change.
 *
 * Les compétences ont leur propre onglet, que la vraie fiche n'a pas :
 * elles y vivent dans le bandeau, qui ne tient pas dans 300 px.
 */
type OngletFiche = "actions" | "inventaire" | "magie" | "traits" | "maitrises";

function SectionTitre({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{children}</span>;
}

/**
 * Une jauge circulaire — PV, XP, épuisement (auteur, 23 septembre).
 *
 * Pourquoi l'anneau plutôt que la barre : dans une colonne de 300 px, une
 * barre horizontale coûte sa hauteur PLUS la ligne de légende qui la
 * traduit, et c'est la légende qu'on lit. L'anneau porte son chiffre au
 * centre, et les trois tiennent sur une rangée.
 *
 * Le clic bascule le chiffre en pourcentage, et **chaque anneau garde le
 * sien** : « il me reste combien de PV » et « où j'en suis du niveau » ne
 * se lisent pas de la même façon, l'une en valeur, l'autre en proportion.
 *
 * `pathLength={100}` : le navigateur renormalise la circonférence, donc le
 * tiret se donne directement en pourcents — rien à recalculer si le
 * diamètre change.
 */
function Jauge({
  libelle,
  valeur,
  pct,
  ton = "accent",
  titre,
  petite = false,
}: {
  /** Absent quand la valeur se suffit — la charge porte sa fraction dans l'anneau. */
  libelle?: string;
  /** Une chaîne, ou deux lignes empilées quand la valeur porte son total. */
  valeur: React.ReactNode;
  pct: number;
  ton?: "accent" | "danger";
  titre: string;
  /**
   * 44 px au lieu de 48 — la charge du Sac, qui n'est pas un compteur de
   * combat. Pas 40 : une fraction de deux lignes de 12 px mesure 25 px de
   * haut, et dans un anneau de 40 px la corde disponible à cette hauteur
   * tombe à 12,6 px. Le texte déborderait, ce qu'il faisait.
   */
  petite?: boolean;
}) {
  const [enPourcent, setEnPourcent] = useState(false);
  const borne = Math.max(0, Math.min(100, pct));

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`relative ${petite ? "h-11 w-11" : "h-12 w-12"}`}>
        <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="20" cy="20" r="16" fill="none" strokeWidth="4" className="stroke-panel-sunken" />
          {/* `strokeLinecap` : un cap arrondi sur une valeur nulle dessine
              quand même un point, et un point d'épuisement à zéro est un
              mensonge — à zéro, la jauge doit être VIDE. */}
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            strokeWidth="4"
            strokeLinecap={borne === 0 ? "butt" : "round"}
            pathLength={100}
            strokeDasharray={`${borne} ${100 - borne}`}
            className={ton === "danger" ? "stroke-danger" : "stroke-accent"}
          />
        </svg>
        {/* Le bouton EST le centre de l'anneau : 40 px de cible dans 48
            de jauge, 32 dans 40 pour la petite (V2.1-27 : jamais sous 24).
            Pas de fond au survol — il mordrait sur le trait — mais la
            couleur d'accent. */}
        <button
          type="button"
          onClick={() => setEnPourcent((v) => !v)}
          title={titre}
          aria-label={`${titre} — ${enPourcent ? "afficher la valeur" : "afficher le pourcentage"}`}
          className="absolute inset-1 flex items-center justify-center rounded-full text-xs font-medium text-ink transition-colors hover:text-accent"
        >
          {enPourcent ? `${borne} %` : valeur}
        </button>
      </div>
      {libelle !== undefined && <span className="text-xs text-ink-muted">{libelle}</span>}
    </div>
  );
}

/**
 * Le bouton de jet, au format de la colonne solo.
 *
 * `ActionButton` (la vraie fiche) met sur UNE ligne son dé, son libellé, sa
 * formule détaillée et sa formule résolue : il lui faut 15 rem, et sa
 * grille le sait — en dessous, elle repasse les boutons l'un sous l'autre.
 * Or l'auteur les veut côte à côte, et deux boutons côte à côte dans 280 px
 * tombent à 113 px : le libellé s'y réduisait à « A… » (vu le 23 septembre).
 *
 * Même dessin — pastille, bord, teinte d'accent pour l'action principale,
 * le vrai dé de `DieIcon` — mais le libellé passe AU-DESSUS de la formule,
 * et la formule détaillée s'en va dans l'infobulle. Ce qui tombe est ce
 * qu'on lit le moins, et rien ne se lit plus en « A… ».
 *
 * `.mech` (globals.css) impose son propre `font-size` hors de tout
 * `@layer`, donc il bat n'importe quelle classe Tailwind posée à côté :
 * seule une taille en ligne tient face à lui. C'est le même contournement,
 * commenté, que dans `ActionButton`.
 */
function BoutonJet({
  label,
  formule,
  detail,
  primaire = false,
  inactif = false,
  onClick,
}: {
  label: string;
  formule: string;
  detail: string;
  primaire?: boolean;
  inactif?: boolean;
  onClick: () => void;
}) {
  const faces = dieSidesFromFormula(formule);
  return (
    <button
      type="button"
      disabled={inactif}
      onClick={onClick}
      title={detail}
      className={`flex min-h-11 w-full items-center gap-1.5 rounded-full border px-2 py-1 text-left transition-colors disabled:opacity-50 ${
        primaire ? "border-accent bg-accent/10 hover:bg-accent/20" : "border-edge hover:bg-panel"
      }`}
    >
      {faces !== null && (
        <DieIcon sides={faces} className={`h-5 w-5 shrink-0 ${primaire ? "text-accent" : "text-ink-muted"}`} />
      )}
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-xs font-semibold text-ink">{label}</span>
        <span className="mech truncate text-ink-muted" style={{ fontSize: "0.75rem" }}>
          {formule}
        </span>
      </span>
    </button>
  );
}

/**
 * Les caractéristiques en grille, retenue le 23 septembre parmi trois
 * refontes comparées dans l'esquisse (réglette, barrette, grille).
 *
 * Le pavé d'origine — six cartes bordées de trois lignes — mesurait 144 px
 * pour six nombres. Celui-ci en fait deux rangées : le nom et le score sur
 * la première ligne de la tuile, le modificateur et la sauvegarde sur la
 * seconde, où ils sont les deux boutons — 24 px de haut chacun, le minimum
 * de V2.1-27.
 *
 * L'encadré est celui des Compétences (`rounded-md border border-edge`),
 * jamais un trait plus épais : six cadres côte à côte pèsent déjà six fois
 * ce que pèse un cadre seul.
 *
 * `tabular-nums` : sans lui un `1` étroit décale sa colonne, et six
 * colonnes qui ne s'alignent pas se lisent mal.
 */
function Caracteristiques({ onLancer }: { onLancer: (label: string, modificateur: number) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {FICHE.abilities.map((a) => (
        <div key={a.key} className="flex flex-col items-center rounded-md border border-edge px-1 py-0.5">
          <div className="flex items-baseline gap-1">
            <span className="text-xs text-ink-muted">{a.key}</span>
            <span className="text-xs tabular-nums text-ink-soft" title={`Score de ${a.key}`}>
              {a.score}
            </span>
          </div>
          <div className="flex w-full items-center gap-0.5">
            <button
              type="button"
              onClick={() => onLancer(`Test de ${a.key}`, Number(a.mod))}
              className="flex h-6 flex-1 items-center justify-center rounded text-sm font-medium tabular-nums text-ink transition-colors hover:bg-panel-sunken"
              title={`Lancer un test de ${a.key}`}
            >
              {a.mod}
            </button>
            <button
              type="button"
              onClick={() => onLancer(`Sauvegarde de ${a.key}`, Number(a.save))}
              className="flex h-6 flex-1 items-center justify-center rounded text-xs tabular-nums text-ink-muted transition-colors hover:bg-panel-sunken"
              title={`Lancer une sauvegarde de ${a.key}`}
            >
              js{a.save}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Les emplacements de sorts, tous niveaux — pastilles pleines = disponible,
 * creuses = dépensé. Même langage visuel que `SpellSlotsTracker`
 * (`ActionsTab.tsx`), à une différence près : la vraie fiche écrit ses
 * libellés en `text-[10px]`, exemptée nommément dans la règle ESLint de
 * V2.1-27. Un fichier neuf n'a pas cette dispense, donc `text-xs`.
 *
 * Un niveau sans aucun emplacement n'apparaît pas : jamais une ligne à 0/0.
 */
function EmplacementsSorts({ utilises }: { utilises: Record<number, number> }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-md border border-edge bg-panel-sunken px-2 py-1.5">
      {EMPLACEMENTS.filter((e) => e.total > 0).map((e) => {
        const restants = Math.max(0, e.total - (utilises[e.niveau] ?? 0));
        return (
          <div key={e.niveau} className="flex items-center gap-1">
            <span className="text-xs text-ink-muted">Niv. {e.niveau}</span>
            <div className="flex gap-0.5">
              {Array.from({ length: e.total }, (_, i) => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-full ${i < restants ? "bg-accent" : "border border-edge bg-transparent"}`}
                />
              ))}
            </div>
            <span className="text-xs tabular-nums text-ink-muted">
              {restants}/{e.total}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Un sort préparé, dans l'onglet ACTIONS — même squelette que
 * `PreparedSpellCard` (`ActionsTab.tsx`) : le nom et ses pastilles
 * au-dessus, les boutons de jet dessous, le sélecteur d'emplacement
 * au-dessus du bouton de lancement.
 *
 * Un sort préparé arrive ici exactement comme une arme équipée arrive
 * depuis le Sac : l'onglet Actions ne tient aucune liste à lui, il dérive
 * ce qu'il montre de ce qui est préparé et de ce qui est équipé.
 *
 * Le sélecteur ne propose que des niveaux **au moins égaux** à celui du
 * sort : on surclasse vers le haut, jamais vers le bas. C'est le filtre de
 * la vraie fiche, recopié plutôt que réinventé.
 *
 * Dépenser un emplacement est ici un état local : l'esquisse montre le
 * geste, le vrai décompte appartient au serveur — un client ne décide
 * d'aucun résultat (règle absolue 8).
 */
function CarteSortAction({
  sort,
  utilises,
  onDepenser,
  onLancer,
}: {
  sort: Sort;
  utilises: Record<number, number>;
  onDepenser: (niveau: number) => void;
  onLancer: (label: string, modificateur: number) => void;
}) {
  const mineur = sort.niveau === 0;
  const niveauxValides = EMPLACEMENTS.filter((e) => e.total > 0 && e.niveau >= sort.niveau).map((e) => e.niveau);
  const [niveau, setNiveau] = useState(mineur ? 0 : (niveauxValides[0] ?? sort.niveau));
  const emplacement = EMPLACEMENTS.find((e) => e.niveau === niveau);
  const restants = emplacement ? Math.max(0, emplacement.total - (utilises[niveau] ?? 0)) : 0;
  const epuise = !mineur && restants === 0;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-edge bg-panel-raised px-2 py-2">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-sm font-semibold text-ink">{sort.nom}</span>
        <div className="flex flex-wrap gap-1">
          <span className="rounded-full border border-edge px-1.5 text-xs text-ink-muted">
            {mineur ? "Sort mineur" : `Niv. ${sort.niveau}`}
          </span>
          {sort.sauvegarde && (
            <span className="rounded-full border border-edge px-1.5 text-xs text-ink-muted">
              DD {FICHE.sort.dd} ({sort.sauvegarde})
            </span>
          )}
        </div>
      </div>
      {/* Les boutons sur une seule ligne, comme pour une arme équipée. */}
      <div className="grid grid-cols-2 gap-1">
        {sort.attaque && (
          <BoutonJet
            label="Attaquer"
            formule={withModifier("1d20", Number(FICHE.sort.attaque))}
            detail={`1d20 + ${FICHE.sort.carac} + maîtrise`}
            primaire
            onClick={() => onLancer(`Attaque de sort — ${sort.nom}`, Number(FICHE.sort.attaque))}
          />
        )}
        <div className="flex flex-col gap-1">
          {!mineur && niveauxValides.length > 0 && (
            <Dropdown
              value={String(niveau)}
              options={niveauxValides.map((n) => ({ value: String(n), label: `Niv. ${n}` }))}
              onChange={(v) => setNiveau(Number(v))}
              aria-label={`Emplacement pour ${sort.nom}`}
              triggerClassName="w-fit rounded-md border border-edge px-2 py-0.5 text-xs text-ink outline-none transition-colors hover:bg-panel"
            />
          )}
          <BoutonJet
            label={sort.degats ? "Dégâts" : "Lancer"}
            formule={sort.degats ?? (mineur ? "—" : `${restants}/${emplacement?.total ?? 0}`)}
            detail={mineur ? "sort mineur, sans emplacement" : `emplacements restants au niveau choisi`}
            inactif={epuise}
            onClick={() => {
              if (!mineur) onDepenser(niveau);
              if (sort.degats) onLancer(`Dégâts — ${sort.nom}`, 0);
            }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * La CA en bouclier, à gauche des jauges (auteur, 23 septembre).
 *
 * Le `clipPath` est celui de `CharacterSheetHeader` au caractère près, et
 * c'est le but : la fiche et l'écran solo montrent la même chose, donc ils
 * la dessinent pareil. Seule la taille change — la colonne fait 280 px.
 *
 * Pas d'anneau pour la CA : un anneau dit une proportion, et une classe
 * d'armure n'a pas de maximum. Le bouclier dit « défense » sans rien
 * promettre de tel.
 */
function Bouclier({ valeur }: { valeur: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className="flex h-12 w-9 items-center justify-center border-2 border-accent bg-panel-raised"
        style={{ clipPath: "polygon(50% 0%, 100% 20%, 100% 55%, 50% 100%, 0% 55%, 0% 20%)" }}
        title="Classe d'armure — calculée, jamais saisie"
      >
        <span className="text-sm font-bold text-ink">{valeur}</span>
      </div>
      <span className="text-xs text-ink-muted">CA</span>
    </div>
  );
}

/**
 * Les trois faits qui restent une fois la CA, les PV, le niveau et
 * l'épuisement passés en jauges : vitesse, bonus de maîtrise, inspiration.
 *
 * Ils tiennent sur la même rangée, en colonne de trois lignes à sa droite.
 * Pourquoi pas trois jauges de plus : ce sont des CONSTANTES de la fiche,
 * pas des compteurs qui bougent en jouant — un anneau leur promettrait un
 * mouvement qu'ils n'ont pas, et la rangée deviendrait illisible à force
 * d'être régulière.
 *
 * L'étiquette est abrégée en toutes lettres plutôt qu'en pictogramme : un
 * pictogramme de vitesse ou de maîtrise ne se devine pas.
 */
function TroisFaits({
  vitesse,
  maitrise,
  inspiration,
}: {
  vitesse: string;
  maitrise: string;
  inspiration: number;
}) {
  return (
    <div className="grid grid-cols-[auto_auto] items-center gap-x-1.5 pt-0.5 text-xs">
      <span className="text-ink-muted">VIT</span>
      <span className="text-ink">{vitesse}</span>
      <span className="text-ink-muted">MAÎT</span>
      <span className="text-ink">{maitrise}</span>
      <span className="text-ink-muted">INSP</span>
      <span className={inspiration > 0 ? "text-accent" : "text-ink-muted"}>
        {inspiration > 0 ? "✦".repeat(inspiration) : "—"}
      </span>
    </div>
  );
}

function ColonneFiche({ onLancer }: { onLancer: (label: string, modificateur: number) => void }) {
  const [onglet, setOnglet] = useState<OngletFiche>("actions");
  const [equipes, setEquipes] = useState(INVENTAIRE.filter((o) => o.equipe).map((o) => o.id));
  const [prepares, setPrepares] = useState(SORTS.filter((s) => s.prepare).map((s) => s.id));
  const [deplies, setDeplies] = useState<string[]>([]);
  /**
   * Les emplacements dépensés, par niveau. État LOCAL : l'esquisse montre
   * le geste, le vrai décompte appartient au serveur — un client ne décide
   * d'aucun résultat de règle (règle absolue 8).
   */
  const [utilises, setUtilises] = useState<Record<number, number>>(
    Object.fromEntries(EMPLACEMENTS.map((e) => [e.niveau, e.utilises]))
  );

  function depenserEmplacement(niveau: number) {
    const total = EMPLACEMENTS.find((e) => e.niveau === niveau)?.total ?? 0;
    setUtilises((u) => ({ ...u, [niveau]: Math.min(total, (u[niveau] ?? 0) + 1) }));
  }
  const pctPv = Math.round((FICHE.hp.current / FICHE.hp.max) * 100);
  const pctXp = Math.round((PROGRESSION.xp / PROGRESSION.seuilNiveauSuivant) * 100);
  const pctCharge = Math.round((CHARGE.porte / CHARGE.capacite) * 100);
  // 6, et non un maximum inventé : `zRuntimeState` borne `exhaustion` à
  // `.min(0).max(6)`, parce que le niveau 6 est la mort (MdJ 2024).
  const pctEpuisement = Math.round((COMPTEURS.epuisement / 6) * 100);

  function bascule(liste: string[], set: (v: string[]) => void, id: string) {
    set(liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-chrome text-base font-medium text-ink">{FICHE.name}</span>
          {/* Les états en cours, à côté du nom : ils viennent de
              `entity_runtime_state.conditions`, qui existe depuis la V1 et
              que la fiche n'affiche nulle part. */}
          {ETATS.map((etat) => (
            <span key={etat} className="rounded-full border border-danger px-2 py-0.5 text-xs text-danger">
              {etat}
            </span>
          ))}
        </div>
        <span className="text-xs text-ink-muted">{FICHE.ligne}</span>
      </div>

      <div className="flex flex-col gap-1">
        {/* Tout l'état chiffré du personnage sur UNE rangée : le bouclier
            de CA, trois jauges, et les trois faits qui ne bougent pas. La
            ligne de légende qui suivait les deux barres a disparu — c'est
            là qu'est la place gagnée, plus que dans la forme des jauges.

            Le seuil du niveau suivant a quitté l'écran pour l'infobulle de
            sa jauge : c'est une valeur qu'on consulte, pas qu'on surveille.

            L'inspiration manquait à la vraie fiche quand cette esquisse a
            été dessinée ; V2.1-26 l'a ajoutée depuis, au bandeau comme dans
            `RuntimeState`. */}
        <div className="flex items-start justify-between gap-1">
          <Bouclier valeur={FICHE.ac} />
          <Jauge
            libelle="PV"
            valeur={`${FICHE.hp.current}/${FICHE.hp.max}`}
            pct={pctPv}
            titre={`${FICHE.hp.current} points de vie sur ${FICHE.hp.max}`}
          />
          {/* Sous la jauge, le niveau ATTEINT ; dedans, la marche vers le
              suivant. Les deux ensemble disent où l'on en est, et la ligne
              « niveau 5 à 6 500 XP » n'a plus lieu d'être. */}
          <Jauge
            libelle={`Niv. ${PROGRESSION.niveau}`}
            valeur={PROGRESSION.xp.toLocaleString("fr-FR")}
            pct={pctXp}
            titre={`${PROGRESSION.xp.toLocaleString("fr-FR")} XP — niveau ${PROGRESSION.niveau + 1} à ${PROGRESSION.seuilNiveauSuivant.toLocaleString("fr-FR")}`}
          />
          {/* L'épuisement monte quand ça va mal : son anneau se remplit à
              l'envers des deux autres, d'où le ton d'alerte. */}
          <Jauge
            libelle="Épuis."
            valeur={`${COMPTEURS.epuisement}/6`}
            pct={pctEpuisement}
            ton="danger"
            titre={`Épuisement ${COMPTEURS.epuisement} sur 6`}
          />
          <TroisFaits vitesse={FICHE.vitesse} maitrise={FICHE.maitrise} inspiration={COMPTEURS.inspiration} />
        </div>
      </div>

      <Caracteristiques onLancer={onLancer} />

      {/* Les compétences suivent les caractéristiques, comme dans la vraie
          fiche — elles n'y sont pas un onglet. Repliées par défaut : six
          onglets ne tiennent pas dans 300 px (le dernier se coupait), et
          la liste complète mangerait la colonne. Chaque ligne lance son
          jet, comme les caractéristiques au-dessus. */}
      <details className="rounded-md border border-edge px-2 py-1.5">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Compétences
        </summary>
        <div className="mt-1 flex flex-col gap-0.5">
          {FICHE.competences.map((c) => (
            <button
              key={c.nom}
              type="button"
              onClick={() => onLancer(c.nom, Number(c.mod))}
              className={LIGNE_CLIQUABLE}
              title={`Lancer ${c.nom}`}
            >
              <span className="text-sm text-ink">{c.nom}</span>
              <span className="text-sm text-ink-muted">{c.mod}</span>
            </button>
          ))}
        </div>
      </details>

      <div className="flex min-h-0 flex-1 flex-col">
        <BinderTabs
          aria-label="Sections de la fiche"
          value={onglet}
          onChange={setOnglet}
          items={[
            { value: "actions", label: "Actions" },
            { value: "inventaire", label: "Sac" },
            { value: "magie", label: "Magie" },
            { value: "traits", label: "Traits" },
            { value: "maitrises", label: "Maîtrises" },
          ]}
        />
        <div className={`${CLASSEUR} min-h-0 flex-1 overflow-y-auto`}>
          {/* ACTIONS — la présentation de `ActionsTab` : les emplacements en
              tête, puis une carte par chose qu'on peut faire. L'onglet ne
              tient AUCUNE liste à lui : il dérive ce qu'il montre de ce qui
              est équipé dans le Sac et de ce qui est préparé dans Magie.
              C'est le mécanisme de la vraie fiche, et c'est ce que l'auteur
              a demandé pour les sorts. */}
          {onglet === "actions" && (
            <div className="flex flex-col gap-2">
              <EmplacementsSorts utilises={utilises} />

              {INVENTAIRE.filter((o) => equipes.includes(o.id) && o.arme).map((o) => (
                <div key={o.id} className="flex flex-col gap-1.5 rounded-md border border-edge bg-panel-raised px-2 py-2">
                  <span className="truncate text-sm font-semibold text-ink">{o.nom}</span>
                  {/* Les deux boutons sur la même ligne (auteur, 23 septembre),
                      et ce sont les boutons de la vraie fiche : `ActionButton`
                      importé, avec son dé, sa formule résolue à droite et son
                      détail en dessous. */}
                  <div className="grid grid-cols-2 gap-1">
                    <BoutonJet
                      label="Attaquer"
                      formule={withModifier("1d20", Number(o.arme!.attaque))}
                      detail="1d20 + Dex + maîtrise"
                      primaire
                      onClick={() => onLancer(`Attaque — ${o.nom}`, Number(o.arme!.attaque))}
                    />
                    <BoutonJet
                      label="Dégâts"
                      formule={o.arme!.degats}
                      detail={o.detail.split(" · ")[0]}
                      onClick={() => onLancer(`Dégâts — ${o.nom}`, 3)}
                    />
                  </div>
                </div>
              ))}

              {/* Un sort mineur est toujours là ; les autres n'arrivent ici
                  que préparés. Exactement comme l'épée n'y arrive qu'équipée. */}
              {SORTS.filter((s) => s.niveau === 0 || prepares.includes(s.id)).map((s) => (
                <CarteSortAction
                  key={s.id}
                  sort={s}
                  utilises={utilises}
                  onDepenser={depenserEmplacement}
                  onLancer={onLancer}
                />
              ))}
            </div>
          )}

          {onglet === "inventaire" && (
            <div className="flex flex-col gap-2">
              {/* La bourse et la charge ouvrent le sac, comme dans
                  `InventoryPanel` : ce sont les deux choses qu'on vient y
                  vérifier en jouant.

                  Sur UNE ligne (auteur, 23 septembre) : la charge quitte la
                  barre pleine largeur pour la jauge des PV et du niveau,
                  et les pièces occupent la place qu'elle libère. Une seule
                  forme pour « une part d'un tout » dans toute la colonne —
                  deux dessins pour la même idée, c'est deux fois à
                  apprendre.

                  Le chiffre au centre est le poids porté, jamais
                  `23,5/75` : sept caractères ne tiennent pas dans 40 px.
                  La capacité vit sous la jauge, et le clic donne le
                  pourcentage comme ailleurs. */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {BOURSE.map((piece) => (
                    <span
                      key={piece.code}
                      className={`rounded-full border border-edge px-2 py-0.5 text-xs ${
                        piece.valeur > 0 ? "text-ink" : "text-ink-muted"
                      }`}
                    >
                      {piece.valeur} {piece.code}
                    </span>
                  ))}
                </div>

                {/* La charge en FRACTION, tout dans l'anneau et plus rien
                    dessous (auteur, 23 septembre).

                    La police ne descend pas : `text-xs` est le plancher de
                    la charte, et une règle ESLint l'impose depuis V2.1-27.
                    Ce qui rentre dans un anneau se règle donc par la
                    géométrie, pas par le corps du texte — et la géométrie
                    est têtue : deux lignes de 12 px font 25 px de haut, et
                    à cette hauteur un anneau de 40 px n'offre plus que
                    12,6 px de large. D'où 44 px, et des nombres COURTS.

                    Le poids est donc arrondi au kilo pour l'affichage —
                    `23,5` mesure 25 px, `24` en mesure 14 — et la valeur
                    exacte reste dans l'infobulle. Un demi-kilo ne change
                    aucune décision ; un texte qui déborde de son anneau,
                    si. */}
                <Jauge
                  petite
                  valeur={
                    <span className="flex flex-col items-center leading-none">
                      <span>{Math.round(CHARGE.porte)}</span>
                      <span className="w-3.5 border-t border-ink-muted" />
                      <span className="text-ink-muted">{CHARGE.capacite}</span>
                    </span>
                  }
                  pct={pctCharge}
                  ton={CHARGE.palier === "none" ? "accent" : "danger"}
                  titre={`Charge : ${CHARGE.porte.toLocaleString("fr-FR")} / ${CHARGE.capacite} kg${CHARGE.palier !== "none" ? " — encombré" : ""}`}
                />
              </div>

              {INVENTAIRE.map((o) => (
                <div key={o.id} className="flex items-start justify-between gap-2 rounded-md border border-edge p-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm text-ink">{o.nom}</span>
                    <span className="text-xs text-ink-muted">{o.detail}</span>
                  </div>
                  <Checkbox
                    aria-label={`Équiper ${o.nom}`}
                    checked={equipes.includes(o.id)}
                    onChange={() => bascule(equipes, setEquipes, o.id)}
                  />
                </div>
              ))}
              <p className="text-xs text-ink-muted">La case équipe l&apos;objet — une arme équipée entre dans Actions.</p>
            </div>
          )}

          {/* MAGIE — la présentation de `MagicTab` : une carte par sort
              connu, avec le bandeau vertical « Préparé / Préparer » à
              gauche, l'école en pastille à sa couleur, le niveau à droite,
              les propriétés d'incantation en pastilles, et la description
              sous un bandeau de pliage.

              Les couleurs d'école viennent de `MAGIC_SCHOOL_COLOR_VAR`
              (`src/i18n/fr.ts`), jamais réécrites ici — la table accepte
              les graphies françaises. */}
          {onglet === "magie" && (
            <div className="flex flex-col gap-2">
              <EmplacementsSorts utilises={utilises} />

              {SORTS.map((s) => {
                const prepare = s.niveau === 0 || prepares.includes(s.id);
                const couleur = MAGIC_SCHOOL_COLOR_VAR[s.ecole] ?? "--link-rule";
                const deplie = deplies.includes(s.id);
                const proprietes = [
                  s.incantation,
                  s.portee,
                  s.concentration ? `${s.duree} (concentration)` : s.duree,
                  s.composantes,
                  ...(s.rituel ? ["Rituel"] : []),
                ];
                return (
                  <div key={s.id} className="flex flex-col overflow-hidden rounded-md border border-edge bg-panel-raised">
                    <button
                      type="button"
                      onClick={() => bascule(deplies, setDeplies, s.id)}
                      title={deplie ? "Replier" : "Déplier"}
                      aria-label={deplie ? "Replier" : "Déplier"}
                      className="flex w-full items-center justify-center border-b border-edge bg-panel py-px text-xs leading-none text-ink-muted transition-colors hover:bg-panel-raised hover:text-accent"
                    >
                      {deplie ? "▴" : "▾"}
                    </button>
                    <div className="flex">
                      {/* Un sort mineur n'a rien à préparer : le bandeau le
                          dit au lieu d'offrir une case qui ne ferait rien. */}
                      <button
                        type="button"
                        disabled={s.niveau === 0}
                        onClick={() => bascule(prepares, setPrepares, s.id)}
                        title={s.niveau === 0 ? "Toujours prêt" : prepare ? "Ne plus préparer" : "Préparer"}
                        className={`w-7 shrink-0 border-r text-xs font-semibold uppercase tracking-wide transition-colors ${
                          prepare ? "border-accent bg-accent/20 text-accent" : "border-edge bg-panel text-ink-muted hover:bg-panel-raised"
                        }`}
                        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                      >
                        {s.niveau === 0 ? "Mineur" : prepare ? "Préparé" : "Préparer"}
                      </button>
                      <div className="flex min-w-0 flex-1 flex-col gap-1 px-2 pb-2 pt-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: "var(--link-rule)" }}>
                            {s.nom}
                          </span>
                          <span
                            className="shrink-0 rounded-full border px-1.5 text-xs"
                            style={{ borderColor: `var(${couleur})`, color: `var(${couleur})` }}
                          >
                            {s.ecole}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <span className="rounded-full border border-edge px-1.5 text-xs text-ink-muted">
                            {s.niveau === 0 ? "Sort mineur" : `Niv. ${s.niveau}`}
                          </span>
                          {proprietes.map((prop) => (
                            <span key={prop} className="rounded-full border border-edge px-1.5 text-xs text-ink-muted">
                              {prop}
                            </span>
                          ))}
                        </div>
                        {deplie && <p className="text-xs leading-snug text-ink-muted">{s.description}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Traits = « Aptitudes accordées », la seule section de l'onglet
              Traits de la vraie fiche : nom, source, résumé. */}
          {onglet === "traits" && (
            <div className="flex flex-col gap-2">
              <SectionTitre>Aptitudes accordées</SectionTitre>
              {APTITUDES.map((a) => (
                <div key={a.nom} className="flex flex-col gap-0.5 rounded-md border border-edge p-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-link-rule">{a.nom}</span>
                    <span className="shrink-0 text-xs uppercase tracking-wide text-ink-muted">{a.source}</span>
                  </div>
                  <p className="text-xs leading-snug text-ink-muted">{a.resume}</p>
                </div>
              ))}
            </div>
          )}

          {/* Maîtrises = les trois sections de `MasteriesTab` : maîtrises,
              maîtrise d'armes, langues. */}
          {onglet === "maitrises" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <SectionTitre>Maîtrises</SectionTitre>
                <div className="flex flex-wrap gap-1">
                  {MAITRISES.general.map((m) => (
                    <span key={m.nom} className={CHIP} title={`Source : ${m.source}`}>
                      {m.nom}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <SectionTitre>Maîtrise d&apos;armes</SectionTitre>
                {MAITRISES.armes.map((m) => (
                  <div key={m.nom} className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-ink">{m.nom}</span>
                    <span className="text-xs text-ink-muted">{m.botte}</span>
                  </div>
                ))}
                <span className="text-xs text-ink-muted">Remis à zéro à chaque repos long.</span>
              </div>

              <div className="flex flex-col gap-1">
                <SectionTitre>Langues</SectionTitre>
                <div className="flex flex-wrap gap-1">
                  {MAITRISES.langues.map((l) => (
                    <span key={l.nom} className={CHIP_MUTED} title={`Source : ${l.source}`}>
                      {l.nom}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Le repli des colonnes
// ---------------------------------------------------------------------------

/**
 * Le bouton de repli, aux deux extrémités du bandeau et **toujours
 * visible** — qu'on replie ou qu'on déplie, la commande ne bouge jamais
 * de place. C'est ce qui manquait aux trois propositions précédentes :
 * les poignées apparaissaient et disparaissaient, le bandeau n'affichait
 * le bouton qu'une fois la colonne fermée.
 *
 * Le chevron pointe vers ce qui va se passer : vers l'extérieur quand la
 * colonne va se replier, vers l'intérieur quand elle va s'ouvrir.
 */
function BoutonRepli({
  cote,
  label,
  repliee,
  onBasculer,
}: {
  cote: "gauche" | "droite";
  label: string;
  repliee: boolean;
  onBasculer: () => void;
}) {
  const versExterieur = cote === "gauche" ? "‹" : "›";
  const versInterieur = cote === "gauche" ? "›" : "‹";
  return (
    <button
      type="button"
      onClick={onBasculer}
      aria-expanded={!repliee}
      title={`${repliee ? "Déplier" : "Replier"} ${label}`}
      className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-colors ${
        repliee ? "border-edge text-ink-muted hover:bg-panel-raised" : "border-accent text-accent"
      }`}
    >
      {cote === "gauche" ? (
        <>
          {repliee ? versInterieur : versExterieur} {label}
        </>
      ) : (
        <>
          {label} {repliee ? versInterieur : versExterieur}
        </>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// L'écran
// ---------------------------------------------------------------------------

export default function EsquisseSolo() {
  const [colonne, setColonne] = useState<Colonne>("jeu");
  const [demande, setDemande] = useState<Demande | null>(PREMIERE_DEMANDE);
  const [fil, setFil] = useState<FeedItem[]>(FEED);
  const [tirage, setTirage] = useState(0);
  /**
   * Les jets attachés à ce qu'on est en train d'écrire — au pluriel, parce
   * qu'un tour en porte souvent deux : l'attaque, puis les dégâts. Ils
   * partent ensemble au `Jouer`.
   */
  const [jetsAttaches, setJetsAttaches] = useState<JetEnAttente[]>([]);
  const [texte, setTexte] = useState("");

  const [gaucheRepliee, setGaucheRepliee] = useState(false);
  const [droiteRepliee, setDroiteRepliee] = useState(false);

  /**
   * Un jet s'écrit DANS LE CHAMP DE SAISIE, à la suite de ce que le
   * joueur était en train de taper. Il n'y a plus de volet à valider : le
   * résultat se voit là où part tout le reste, et `Jouer` l'engage.
   */
  function inscrire(jet: JetEnAttente) {
    const detail = `dé${jet.origine === "outil" ? " de l'outil" : ""} ${jet.de} ${
      jet.modificateur >= 0 ? "+" : "−"
    } ${Math.abs(jet.modificateur)}`;
    const ligne = `${jet.label} : ${jet.total} (${detail})`;
    setJetsAttaches((precedents) => [...precedents, jet]);
    setTexte((precedent) => (precedent.trim() === "" ? ligne : `${precedent.trim()}\n${ligne}`));
  }

  /** Depuis la fiche : le modificateur est connu au clic, il s'ajoute tout de suite. */
  function lancer(label: string, modificateur: number) {
    const de = DES_FACTICES[tirage % DES_FACTICES.length];
    setTirage((t) => t + 1);
    // Un jet de dégâts n'a pas de seuil : lui coller le DD de la demande
    // en cours le ferait annoncer « réussite », ce qui ne veut rien dire.
    const degats = label.startsWith("Dégâts");
    inscrire({
      label,
      de,
      modificateur,
      total: de + modificateur,
      dc: degats ? null : (demande?.dc ?? null),
      origine: "fiche",
    });
  }

  /**
   * Depuis l'outil de dés : le dé arrive NU. On le rattache à ce qui était
   * attendu et le modificateur s'applique **après coup** — c'est le même
   * chemin qu'un dé physique annoncé à la main.
   *
   * Sans demande en cours, le dé reste nu : rien à quoi le rattacher, et
   * on n'invente pas un modificateur.
   */
  function lancerDansOutil() {
    const de = DES_FACTICES[tirage % DES_FACTICES.length];
    setTirage((t) => t + 1);
    const modificateur = demande?.modificateur ?? 0;
    inscrire({
      label: demande?.label ?? "Jet libre",
      de,
      modificateur,
      total: de + modificateur,
      dc: demande?.dc ?? null,
      origine: "outil",
    });
  }

  /** « Jouer » : ce qui est dans le champ part — le texte, et les jets qui y sont attachés. */
  function jouer() {
    const dit = texte.trim();
    if (dit === "" && jetsAttaches.length === 0) return;

    setFil((precedent) => {
      const suite: FeedItem[] = [...precedent];
      if (dit !== "") suite.push({ id: `dit-${precedent.length}`, kind: "player", text: dit });
      jetsAttaches.forEach(({ label, de, modificateur, total, dc, origine }, index) => {
        suite.push({
          id: `jet-${precedent.length}-${index}`,
          kind: "roll",
          label,
          expression: `1d20 ${modificateur >= 0 ? "+" : "−"} ${Math.abs(modificateur)}`,
          total,
          dc,
          verdict: dc === null ? null : total >= dc ? "success" : "fail",
          trace: [
            `dé${origine === "outil" ? " (outil)" : ""} : ${de}`,
            `modificateur ${modificateur >= 0 ? "+" : "−"}${Math.abs(modificateur)}`,
          ],
          origine: origine === "outil" ? "volet" : "fiche",
        });
      });
      return suite;
    });

    setTexte("");
    setJetsAttaches([]);
    setDemande(null);
  }


  // Le gabarit des colonnes. La transition sur `grid-template-columns`
  // fait glisser la largeur ; les colonnes, elles, s'effacent comme le
  // volet de dés (`transition-all duration-200`, échelle + opacité).
  //
  // Les deux bornes sont des `minmax()` de MÊME forme, y compris repliées.
  // Vérifié en direct le 22 septembre : avec un `0px` nu en face d'un
  // `minmax(200px,1fr)`, le navigateur n'interpole pas — il reste bloqué
  // sur l'ancienne valeur, et la colonne ne se replie jamais. Deux
  // `minmax()` s'interpolent composante par composante.
  const colGauche = gaucheRepliee ? "minmax(0px,0fr)" : "minmax(200px,1fr)";
  const colDroite = droiteRepliee ? "minmax(0px,0fr)" : "minmax(280px,1.2fr)";
  // Variantes préfixées `lg:` : sous 1024 px les colonnes sont des
  // ONGLETS, et une colonne repliée sur grand écran ne doit pas revenir
  // invisible dans son onglet de téléphone.
  const voleeGauche = `origin-left transition-all duration-200 ${
    gaucheRepliee ? "lg:pointer-events-none lg:scale-95 lg:opacity-0" : "lg:scale-100 lg:opacity-100"
  }`;
  const voleeDroite = `origin-right transition-all duration-200 ${
    droiteRepliee ? "lg:pointer-events-none lg:scale-95 lg:opacity-0" : "lg:scale-100 lg:opacity-100"
  }`;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <p className="rounded-lg border border-dashed border-edge px-4 py-1 text-xs text-ink-muted">
        Esquisse — données factices, à jeter quand V3-D1 arrive.
      </p>

      {/* V3-D2 — l'en-tête d'état. Les deux boutons de repli sont à ses
          extrémités et TOUJOURS visibles : la commande ne se déplace
          jamais, qu'on replie ou qu'on déplie. */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-edge bg-panel px-3 py-2">
        <div className="hidden lg:block">
          <BoutonRepli
            cote="gauche"
            label="Monde"
            repliee={gaucheRepliee}
            onBasculer={() => setGaucheRepliee((v) => !v)}
          />
        </div>

        <nav className="flex flex-wrap items-baseline gap-x-2" aria-label="Où se passe la scène">
          <a href="#" className="text-sm font-medium text-link-entity hover:underline">
            {ENTETE.ville.nom}
          </a>
          <span className="text-ink-muted">·</span>
          <a href="#" className="text-sm font-medium text-link-entity hover:underline">
            {ENTETE.lieu.nom}
          </a>
          <span className="text-ink-muted">·</span>
          <span className="text-sm text-ink-soft">{ENTETE.piece}</span>
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm text-ink-soft">{ENTETE.date}</span>
          <span className="text-sm text-ink">{ENTETE.heure}</span>
          <span className="text-sm text-ink-soft">
            {ENTETE.meteo} · {ENTETE.temperature}
          </span>
        </div>

        <div className="hidden lg:block">
          <BoutonRepli
            cote="droite"
            label="Fiche"
            repliee={droiteRepliee}
            onBasculer={() => setDroiteRepliee((v) => !v)}
          />
        </div>
      </header>

      <div className="lg:hidden">
        <BinderTabs
          aria-label="Colonne affichée"
          value={colonne}
          onChange={setColonne}
          items={[
            { value: "monde", label: "Monde" },
            { value: "jeu", label: "Jeu" },
            { value: "fiche", label: "Fiche" },
          ]}
        />
      </div>

      <div
        className="grid min-h-0 flex-1 grid-cols-1 gap-3 transition-[grid-template-columns] duration-200 lg:grid-cols-[var(--col-gauche)_minmax(0,2fr)_var(--col-droite)]"
        style={{ "--col-gauche": colGauche, "--col-droite": colDroite } as React.CSSProperties}
      >
        <section className={`min-h-0 overflow-hidden ${colonne === "monde" ? "" : "hidden"} lg:block ${voleeGauche}`}>
          <ColonneMonde />
        </section>

        <section className={`flex min-h-0 flex-col gap-3 ${colonne === "jeu" ? "" : "hidden"} lg:flex`}>
          {/* Les deux colonnes repliées, le fil ne s'étale pas : une
              colonne de prose de 1 200 px ne se lit plus. */}
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-edge bg-panel p-4">
            <div className={gaucheRepliee && droiteRepliee ? "mx-auto max-w-[80ch]" : ""}>
              <Fil items={fil} />
            </div>
          </div>
          <Saisie
            demande={demande}
            texte={texte}
            onTexte={setTexte}
            onJouer={jouer}
            onLancerDansOutil={lancerDansOutil}
          />
        </section>

        <section className={`min-h-0 overflow-hidden ${colonne === "fiche" ? "" : "hidden"} lg:block ${voleeDroite}`}>
          <ColonneFiche onLancer={lancer} />
        </section>
      </div>
    </div>
  );
}

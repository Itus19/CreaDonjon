"use client";

import { useEffect, useRef, useState } from "react";
import BinderTabs from "@/components/shared/BinderTabs";
import Checkbox from "@/components/shared/Checkbox";
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
}: {
  libelle: string;
  valeur: string;
  pct: number;
  ton?: "accent" | "danger";
  titre: string;
}) {
  const [enPourcent, setEnPourcent] = useState(false);
  const borne = Math.max(0, Math.min(100, pct));

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative h-12 w-12">
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
        {/* Le bouton EST le centre de l'anneau : 40 px de cible dans 48 px
            de jauge (V2.1-27 : jamais sous 24). Pas de fond au survol — il
            mordrait sur le trait — mais la couleur d'accent. */}
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
      <span className="text-xs text-ink-muted">{libelle}</span>
    </div>
  );
}

/**
 * Les trois refontes des caractéristiques, demandées le 23 septembre —
 * « moins de place, esthétique et lisible ». L'interrupteur qui les
 * compare est un OUTIL D'ESQUISSE : il part avec le reste du dossier
 * quand V3-D1 arrive, seule la variante retenue survit.
 *
 * Le pavé d'origine — six cartes bordées de trois lignes chacune — coûtait
 * deux rangées de 60 px. Les trois propositions attaquent le problème par
 * trois bouts différents, et aucune n'est une simple réduction de police :
 * on ne gagne pas de la place en rendant illisible ce qu'on garde.
 */
type VarianteCaracs = "reglette" | "barrette" | "grille";

const VARIANTES: { cle: VarianteCaracs; nom: string; note: string }[] = [
  { cle: "reglette", nom: "Réglette", note: "deux colonnes de trois lignes — tout est visible, rien n'est caché" },
  { cle: "barrette", nom: "Barrette", note: "retenue : une seule rangée, quatre étages — nom, score, test, sauvegarde" },
  { cle: "grille", nom: "Grille", note: "la forme actuelle, mais chaque tuile tient sur une ligne" },
];

function Caracteristiques({ onLancer }: { onLancer: (label: string, modificateur: number) => void }) {
  const [variante, setVariante] = useState<VarianteCaracs>("barrette");

  return (
    <div className="flex flex-col gap-1">
      {/* Outil d'esquisse, pas un élément de l'écran. */}
      <div className="flex items-center gap-1">
        {VARIANTES.map((v) => (
          <button
            key={v.cle}
            type="button"
            onClick={() => setVariante(v.cle)}
            title={v.note}
            className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
              variante === v.cle ? "border-accent text-accent" : "border-edge text-ink-muted hover:text-ink"
            }`}
          >
            {v.nom}
          </button>
        ))}
      </div>

      {/* A — LA RÉGLETTE. Une caractéristique par ligne, deux colonnes.
          Le test et la sauvegarde restent côte à côte et toujours lus :
          c'est la plus lisible des trois, et elle économise déjà la
          moitié de la hauteur en supprimant les bordures. */}
      {variante === "reglette" && (
        <div className="grid grid-cols-2 gap-x-3">
          {FICHE.abilities.map((a) => (
            <div key={a.key} className="flex items-baseline justify-between border-b border-edge py-0.5">
              <span className="text-xs text-ink-muted">{a.key}</span>
              <button
                type="button"
                onClick={() => onLancer(`Test de ${a.key}`, Number(a.mod))}
                className="px-1 text-sm font-medium text-ink transition-colors hover:text-accent"
                title={`Lancer un test de ${a.key}`}
              >
                {a.mod}
              </button>
              <button
                type="button"
                onClick={() => onLancer(`Sauvegarde de ${a.key}`, Number(a.save))}
                className="text-xs text-ink-muted transition-colors hover:text-accent"
                title={`Lancer une sauvegarde de ${a.key}`}
              >
                js {a.save}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* B — LA BARRETTE, retenue par l'auteur le 23 septembre, et
          complétée : la sauvegarde sous chaque caractéristique, le score
          au-dessus du modificateur. L'interrupteur « tests / sauvegardes »
          disparaît du même coup — il n'existait que pour cacher la moitié
          qu'on affiche maintenant.

          Quatre étages, du plus durable au plus lancé : le nom, le score
          (qui ne bouge qu'à la montée de niveau), le modificateur, la
          sauvegarde. Les deux du bas sont les deux boutons, et chacun fait
          24 px de haut sur toute la largeur de la colonne (V2.1-27).

          `tabular-nums` : sans lui, un `1` étroit décale la colonne
          entière, et six colonnes qui ne s'alignent pas se lisent mal.

          L'encadré est celui des Compétences juste en dessous —
          `rounded-md border border-edge`, un seul pixel — et pas un trait
          plus épais : six cadres côte à côte pèsent six fois ce que pèse
          un cadre seul, et la colonne n'a pas de fond pour les porter. */}
      {variante === "barrette" && (
        <div className="flex justify-between">
          {FICHE.abilities.map((a) => (
            <div key={a.key} className="flex w-10 flex-col items-center rounded-md border border-edge py-0.5">
              <span className="text-xs text-ink-muted">{a.key}</span>
              <span className="text-xs tabular-nums text-ink-soft" title={`Score de ${a.key}`}>
                {a.score}
              </span>
              <button
                type="button"
                onClick={() => onLancer(`Test de ${a.key}`, Number(a.mod))}
                className="flex h-6 w-full items-center justify-center rounded-md text-sm font-medium tabular-nums text-ink transition-colors hover:bg-panel-sunken"
                title={`Lancer un test de ${a.key}`}
              >
                {a.mod}
              </button>
              <button
                type="button"
                onClick={() => onLancer(`Sauvegarde de ${a.key}`, Number(a.save))}
                className="flex h-6 w-full items-center justify-center rounded-md text-xs tabular-nums text-ink-muted transition-colors hover:bg-panel-sunken"
                title={`Lancer une sauvegarde de ${a.key}`}
              >
                js {a.save}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* C — LA GRILLE. La disposition d'aujourd'hui, mais chaque tuile
          tient sur UNE ligne au lieu de trois : deux rangées au lieu de
          deux pavés. Le compromis — on garde l'encadré qui rythme la
          colonne, on perd la hauteur qui ne servait à rien. */}
      {variante === "grille" && (
        <div className="grid grid-cols-3 gap-1">
          {FICHE.abilities.map((a) => (
            <div key={a.key} className="flex items-baseline justify-center gap-1 rounded-md border border-edge px-1 py-0.5">
              <span className="text-xs text-ink-muted">{a.key}</span>
              <button
                type="button"
                onClick={() => onLancer(`Test de ${a.key}`, Number(a.mod))}
                className="text-sm font-medium text-ink transition-colors hover:text-accent"
                title={`Lancer un test de ${a.key}`}
              >
                {a.mod}
              </button>
              <button
                type="button"
                onClick={() => onLancer(`Sauvegarde de ${a.key}`, Number(a.save))}
                className="text-xs text-ink-muted transition-colors hover:text-accent"
                title={`Lancer une sauvegarde de ${a.key}`}
              >
                js{a.save}
              </button>
            </div>
          ))}
        </div>
      )}
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
 * Pas d'anneau pour la CA : un anneau dit une proportion, et une CA n'a pas
 * de maximum. Le bouclier dit « défense » sans rien promettre de tel.
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
          {onglet === "actions" && (
            <div className="flex flex-col gap-1">
              {FICHE.actions.map((a) => (
                <div key={a.nom} className="flex flex-col gap-1 rounded-md border border-edge p-2">
                  <span className="text-sm text-ink">{a.nom}</span>
                  <span className="text-xs text-ink-muted">
                    {a.attaque} · {a.degats}
                  </span>
                  <div className="flex gap-1">
                    <button type="button" className={CHIP} onClick={() => onLancer(`Attaque — ${a.nom}`, Number(a.attaque))}>
                      attaquer
                    </button>
                    <button type="button" className={CHIP_MUTED} onClick={() => onLancer(`Dégâts — ${a.nom}`, 3)}>
                      dégâts
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {onglet === "inventaire" && (
            <div className="flex flex-col gap-2">
              {/* La bourse et la charge ouvrent le sac, comme dans
                  `InventoryPanel` : ce sont les deux choses qu'on vient y
                  vérifier en jouant. */}
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

              <div className="flex flex-col gap-0.5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-sunken">
                  <div
                    className={`h-full rounded-full ${CHARGE.palier === "none" ? "bg-accent" : "bg-danger"}`}
                    style={{ width: `${pctCharge}%` }}
                  />
                </div>
                <span className="text-xs text-ink-muted">
                  Charge : {CHARGE.porte} / {CHARGE.capacite} kg{CHARGE.palier !== "none" ? " — encombré" : ""}
                </span>
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

          {onglet === "magie" && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {EMPLACEMENTS.map((e) => (
                  <span key={e.niveau} className={CHIP_MUTED}>
                    Niv. {e.niveau} : {e.total - e.utilises}/{e.total}
                  </span>
                ))}
              </div>
              {SORTS.map((s) => (
                <div key={s.id} className="flex items-start justify-between gap-2 rounded-md border border-edge p-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm text-ink">{s.nom}</span>
                    <span className="text-xs text-ink-muted">
                      {s.niveau === 0 ? "Sort mineur" : `Niveau ${s.niveau}`} · {s.ecole}
                    </span>
                  </div>
                  {s.niveau === 0 ? (
                    <span className="shrink-0 text-xs text-ink-muted">toujours prêt</span>
                  ) : (
                    <Checkbox
                      aria-label={`Préparer ${s.nom}`}
                      checked={prepares.includes(s.id)}
                      onChange={() => bascule(prepares, setPrepares, s.id)}
                    />
                  )}
                </div>
              ))}
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

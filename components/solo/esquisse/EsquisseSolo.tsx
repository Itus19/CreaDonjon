"use client";

import { useState } from "react";
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
  ORIGINE_LABEL,
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
 * Quatrième passe. Ce qu'elle ajoute :
 *
 * - **Le moteur devine une question**, et le montre plutôt que de
 *   corriger en douce : quand la phrase ressemble à une question, `MJ`
 *   passe devant et `Jouer` recule. Même règle que la barre d'intention —
 *   on affiche ce qu'on a compris, le joueur garde la main.
 * - **Tout jet atterrit d'abord dans le volet de dés**, y compris lancé
 *   depuis une caractéristique ou une compétence. Il n'entre dans la
 *   partie qu'au bouton **Utiliser**. Un résultat vu avant d'être engagé,
 *   c'est la même idée que la proposition mécanique de V3-B1.
 * - **Trois façons de replier les colonnes**, à essayer en haut de
 *   l'écran : poignées, bandeau, superposition.
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
const CLASSEUR = "rounded-b-lg border-2 border-t-0 border-edge-strong bg-panel-raised p-3";
const LIGNE_CLIQUABLE =
  "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-panel-sunken";

type Colonne = "monde" | "jeu" | "fiche";
type ModeRepli = "poignees" | "bandeau" | "superposition";

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
 * Le volet de dés — **le seul endroit où un résultat tombe**, qu'il vienne
 * d'un bouton de la fiche, d'une compétence ou du volet lui-même.
 *
 * Le résultat s'y voit AVANT d'entrer dans la partie ; `Utiliser`
 * l'engage. C'est la même idée que la proposition mécanique de V3-B1 :
 * rien ne part sans avoir été montré. Et c'est ce qui rend « relancer »
 * inoffensif — tant qu'on n'a pas utilisé, rien n'a eu lieu.
 */
function VoletDes({
  jet,
  demande,
  onUtiliser,
  onRelancer,
}: {
  jet: JetEnAttente | null;
  demande: Demande | null;
  onUtiliser: () => void;
  onRelancer: () => void;
}) {
  const verdict = jet && jet.dc !== null ? (jet.total >= jet.dc ? "réussite" : "échec") : null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-edge bg-panel px-3 py-2">
      <span className="text-xs uppercase tracking-wide text-ink-muted">Volet de dés</span>
      {jet === null ? (
        <span className="text-sm text-ink-muted">
          {demande ? `en attente — ${demande.label}` : "aucun jet en attente"}
        </span>
      ) : (
        <>
          <span className="text-sm text-ink">{jet.label}</span>
          <span className="text-base font-medium text-ink">{jet.total}</span>
          <span className="text-xs text-ink-muted">
            dé {jet.de} {jet.modificateur >= 0 ? "+" : "−"} {Math.abs(jet.modificateur)}
          </span>
          {verdict && (
            <span className={`text-xs ${verdict === "réussite" ? "text-success" : "text-danger"}`}>
              contre DD {jet.dc} — {verdict}
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" className={CHIP_MUTED} onClick={onRelancer}>
              relancer
            </button>
            <button type="button" className={BTN_ACCENT} onClick={onUtiliser}>
              Utiliser
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * La saisie. `Jouer` fait avancer l'horloge, `MJ` ne la touche pas.
 *
 * Quand la phrase ressemble à une question, **`MJ` passe devant** et
 * `Jouer` recule : le moteur devine, il ne corrige pas en douce. Le mauvais
 * clic devient difficile à faire, et reste possible — c'est le joueur qui
 * décide, comme partout ailleurs dans cet écran.
 */
function Saisie({ demande }: { demande: Demande | null }) {
  const [texte, setTexte] = useState("");
  const question = ressembleAUneQuestion(texte);

  const invite = demande
    ? `${demande.label}${demande.dc !== null ? ` DD ${demande.dc}` : ""} — lance depuis ta fiche, ou écris ton résultat`
    : "Que fais-tu ?";

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-edge bg-panel p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder={invite}
          aria-label={demande ? `Jet attendu : ${demande.label}` : "Que fais-tu ?"}
          className={`min-w-0 flex-1 rounded-md border bg-transparent px-2 py-2 text-sm text-ink outline-none transition-colors ${
            demande ? "border-accent placeholder:text-accent" : "border-edge"
          }`}
        />
        <button type="button" className={question ? BTN_RETRAIT : BTN_ACCENT} title="Joue ce tour — l'horloge avance">
          Jouer
        </button>
        <button
          type="button"
          className={question ? BTN_ACCENT : BTN_GHOST}
          title="Une question sur la scène ou sur une règle — le temps de jeu ne bouge pas"
        >
          MJ
        </button>
      </div>
      {question && (
        <span className="text-xs text-ink-muted">
          On dirait une question — elle part au MJ, et l&apos;horloge ne bouge pas.
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Colonne droite — la fiche jouable
// ---------------------------------------------------------------------------

type OngletFiche = "actions" | "inventaire" | "magie" | "competences" | "traits";

function ColonneFiche({ onLancer }: { onLancer: (label: string, modificateur: number) => void }) {
  const [onglet, setOnglet] = useState<OngletFiche>("actions");
  const [equipes, setEquipes] = useState(INVENTAIRE.filter((o) => o.equipe).map((o) => o.id));
  const [prepares, setPrepares] = useState(SORTS.filter((s) => s.prepare).map((s) => s.id));
  const pct = Math.round((FICHE.hp.current / FICHE.hp.max) * 100);

  function bascule(liste: string[], set: (v: string[]) => void, id: string) {
    set(liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="font-chrome text-base font-medium text-ink">{FICHE.name}</span>
        <span className="text-xs text-ink-muted">{FICHE.ligne}</span>
      </div>

      <div className="flex flex-col gap-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-panel-sunken">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex flex-wrap gap-x-3 text-xs text-ink-muted">
          <span>
            {FICHE.hp.current}/{FICHE.hp.max} PV
          </span>
          <span>CA {FICHE.ac}</span>
          <span>{FICHE.vitesse}</span>
          <span>Maîtrise {FICHE.maitrise}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1">
        {FICHE.abilities.map((a) => (
          <div key={a.key} className="flex flex-col items-center rounded-md border border-edge py-1">
            <span className="text-xs text-ink-muted">{a.key}</span>
            <button
              type="button"
              onClick={() => onLancer(`Test de ${a.key}`, Number(a.mod))}
              className="rounded-md px-2 py-0.5 text-sm font-medium text-ink transition-colors hover:bg-panel-sunken"
              title={`Lancer un test de ${a.key}`}
            >
              {a.mod}
            </button>
            <button
              type="button"
              onClick={() => onLancer(`Sauvegarde de ${a.key}`, Number(a.save))}
              className="rounded-md px-2 py-0.5 text-xs text-ink-muted transition-colors hover:bg-panel-sunken"
              title={`Lancer une sauvegarde de ${a.key}`}
            >
              JS {a.save}
            </button>
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <BinderTabs
          aria-label="Sections de la fiche"
          value={onglet}
          onChange={setOnglet}
          items={[
            { value: "actions", label: "Actions" },
            { value: "inventaire", label: "Sac" },
            { value: "magie", label: "Magie" },
            { value: "competences", label: "Comp." },
            { value: "traits", label: "Traits" },
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
            <div className="flex flex-col gap-1">
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
              <p className="mt-1 text-xs text-ink-muted">La case équipe l&apos;objet — une arme équipée entre dans Actions.</p>
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

          {onglet === "competences" && (
            <div className="flex flex-col gap-0.5">
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
          )}

          {onglet === "traits" && (
            <div className="flex flex-col gap-1">
              {FICHE.ressources.map((r) => (
                <div key={r.nom} className="flex items-center justify-between">
                  <span className="text-sm text-ink">{r.nom}</span>
                  <span className="text-sm text-ink-muted">{r.valeur}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Le repli des colonnes — trois propositions
// ---------------------------------------------------------------------------

/** La poignée qui reste quand une colonne est repliée, mode « poignées ». */
function Poignee({ cote, label, onOuvrir }: { cote: "gauche" | "droite"; label: string; onOuvrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onOuvrir}
      title={`Déplier ${label}`}
      className="flex h-full w-8 flex-col items-center justify-center gap-2 rounded-lg border border-edge bg-panel text-xs text-ink-muted transition-colors hover:bg-panel-raised"
    >
      <span aria-hidden>{cote === "gauche" ? "›" : "‹"}</span>
      <span className="[writing-mode:vertical-rl]">{label}</span>
    </button>
  );
}

/** Le bouton de repli posé dans l'angle d'une colonne ouverte. */
function BoutonReplier({ cote, onReplier }: { cote: "gauche" | "droite"; onReplier: () => void }) {
  return (
    <button
      type="button"
      onClick={onReplier}
      title="Replier cette colonne"
      className="absolute right-1 top-1 z-10 rounded-md px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-panel-raised"
    >
      {cote === "gauche" ? "‹" : "›"}
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
  const [jetEnAttente, setJetEnAttente] = useState<JetEnAttente | null>(null);

  const [mode, setMode] = useState<ModeRepli>("poignees");
  const [gaucheRepliee, setGaucheRepliee] = useState(false);
  const [droiteRepliee, setDroiteRepliee] = useState(false);

  /** Un jet tombe TOUJOURS dans le volet d'abord — il n'entre dans la partie qu'au bouton « Utiliser ». */
  function lancer(label: string, modificateur: number) {
    const de = DES_FACTICES[tirage % DES_FACTICES.length];
    setTirage((t) => t + 1);
    setJetEnAttente({ label, de, modificateur, total: de + modificateur, dc: demande?.dc ?? null });
  }

  function relancer() {
    if (!jetEnAttente) return;
    lancer(jetEnAttente.label, jetEnAttente.modificateur);
  }

  /** « Utiliser » : c'est ici, et seulement ici, que le résultat entre dans la partie. */
  function utiliser() {
    if (!jetEnAttente) return;
    const { label, de, modificateur, total, dc } = jetEnAttente;
    setFil((precedent) => [
      ...precedent,
      {
        id: `jet-${precedent.length}`,
        kind: "roll",
        label,
        expression: `1d20 ${modificateur >= 0 ? "+" : "−"} ${Math.abs(modificateur)}`,
        total,
        dc,
        verdict: dc === null ? null : total >= dc ? "success" : "fail",
        trace: [`dé : ${de}`, `modificateur ${modificateur >= 0 ? "+" : "−"}${Math.abs(modificateur)}`],
        origine: "volet",
      },
    ]);
    setJetEnAttente(null);
    setDemande(null);
  }

  // Le gabarit des colonnes suit le mode et ce qui est replié. En
  // superposition, les colonnes flottent AU-DESSUS : le centre garde sa
  // largeur, donc la lecture ne bouge jamais.
  const superposition = mode === "superposition";
  const colGauche = superposition || gaucheRepliee ? (mode === "poignees" ? "2rem" : "0") : "minmax(200px,1fr)";
  const colDroite = superposition || droiteRepliee ? (mode === "poignees" ? "2rem" : "0") : "minmax(280px,1.2fr)";
  const gaucheVisible = superposition ? !gaucheRepliee : !gaucheRepliee;
  const droiteVisible = superposition ? !droiteRepliee : !droiteRepliee;

  const panneauFlottant =
    "absolute inset-y-0 z-20 w-[min(22rem,80vw)] rounded-lg border border-edge-strong bg-panel-raised p-3 shadow-2xl";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Les commandes de l'ESQUISSE, jamais de l'écran. */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-edge px-4 py-2">
        <span className="text-xs uppercase tracking-wide text-ink-muted">Replier les colonnes</span>
        <div role="group" aria-label="Façon de replier les colonnes" className="flex gap-1">
          {(
            [
              { value: "poignees", label: "poignées" },
              { value: "bandeau", label: "bandeau" },
              { value: "superposition", label: "superposition" },
            ] as { value: ModeRepli; label: string }[]
          ).map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={mode === o.value}
              onClick={() => {
                setMode(o.value);
                // La superposition part colonnes fermées : c'est son idée.
                setGaucheRepliee(o.value === "superposition");
                setDroiteRepliee(o.value === "superposition");
              }}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                mode === o.value ? "border-accent text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-edge bg-panel px-4 py-2">
        <nav className="flex flex-wrap items-baseline gap-x-2" aria-label="Où se passe la scène">
          {/* Mode « bandeau » : la colonne repliée revient ici, sous forme
              de bouton. Le contrôle quitte la colonne pour l'en-tête. */}
          {mode !== "poignees" && gaucheRepliee && (
            <button type="button" className={`${CHIP_MUTED} mr-2`} onClick={() => setGaucheRepliee(false)}>
              ▸ Monde
            </button>
          )}
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

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm text-ink-soft">{ENTETE.date}</span>
          <span className="text-sm text-ink">{ENTETE.heure}</span>
          <span className="text-sm text-ink-soft">
            {ENTETE.meteo} · {ENTETE.temperature}
          </span>
          <button type="button" className={CHIP_MUTED} title="Radio d'ambiance">
            ♪ radio
          </button>
          {mode !== "poignees" && droiteRepliee && (
            <button type="button" className={CHIP_MUTED} onClick={() => setDroiteRepliee(false)}>
              Fiche ◂
            </button>
          )}
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
        className="relative grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[var(--col-gauche)_minmax(0,2fr)_var(--col-droite)]"
        style={{ "--col-gauche": colGauche, "--col-droite": colDroite } as React.CSSProperties}
      >
        {/* Colonne gauche — repliée, superposée, ou en place. */}
        {!superposition && (
          <section className={`relative min-h-0 ${colonne === "monde" ? "" : "hidden"} lg:block`}>
            {gaucheRepliee ? (
              mode === "poignees" ? (
                <Poignee cote="gauche" label="Monde" onOuvrir={() => setGaucheRepliee(false)} />
              ) : null
            ) : (
              <>
                <div className="hidden lg:block">
                  <BoutonReplier cote="gauche" onReplier={() => setGaucheRepliee(true)} />
                </div>
                <ColonneMonde />
              </>
            )}
          </section>
        )}

        <section className={`flex min-h-0 flex-col gap-3 ${colonne === "jeu" ? "" : "hidden"} lg:flex`}>
          {/* Quand les deux colonnes sont repliées, le fil ne s'étale pas :
              une colonne de prose de 1 100 px ne se lit plus. */}
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-edge bg-panel p-4">
            <div className={gaucheRepliee && droiteRepliee ? "mx-auto max-w-[80ch]" : ""}>
              <Fil items={fil} />
            </div>
          </div>
          <VoletDes jet={jetEnAttente} demande={demande} onUtiliser={utiliser} onRelancer={relancer} />
          <Saisie demande={demande} />
        </section>

        {!superposition && (
          <section className={`relative min-h-0 ${colonne === "fiche" ? "" : "hidden"} lg:block`}>
            {droiteRepliee ? (
              mode === "poignees" ? (
                <Poignee cote="droite" label="Fiche" onOuvrir={() => setDroiteRepliee(false)} />
              ) : null
            ) : (
              <>
                <div className="hidden lg:block">
                  <BoutonReplier cote="droite" onReplier={() => setDroiteRepliee(true)} />
                </div>
                <ColonneFiche onLancer={lancer} />
              </>
            )}
          </section>
        )}

        {/* Mode superposition : les colonnes flottent au-dessus du centre,
            qui ne bouge jamais. On les ouvre depuis l'en-tête. */}
        {superposition && gaucheVisible && (
          <div className={`${panneauFlottant} left-0 hidden lg:block`}>
            <button
              type="button"
              onClick={() => setGaucheRepliee(true)}
              className="absolute right-1 top-1 rounded-md px-2 py-1 text-xs text-ink-muted hover:bg-panel-sunken"
            >
              ‹
            </button>
            <ColonneMonde />
          </div>
        )}
        {superposition && droiteVisible && (
          <div className={`${panneauFlottant} right-0 hidden lg:block`}>
            <button
              type="button"
              onClick={() => setDroiteRepliee(true)}
              className="absolute left-1 top-1 rounded-md px-2 py-1 text-xs text-ink-muted hover:bg-panel-sunken"
            >
              ›
            </button>
            <ColonneFiche onLancer={lancer} />
          </div>
        )}
      </div>
    </div>
  );
}

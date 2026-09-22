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
 * Troisième passe. Ce que le dernier retour acte :
 *
 * - **Un onglet Quêtes** dans la colonne de gauche, à la forme du bloc
 *   `quest` (des objectifs cochés ou non, rien de plus).
 * - **La colonne de droite est la fiche jouable**, inventaire et magie
 *   compris, avec l'équipement et la préparation des sorts. **Tout ce qui
 *   se lance se clique** — caractéristique, sauvegarde, compétence,
 *   attaque — et le résultat répond à la demande en cours.
 * - **La barre latérale joueur est là** : cet écran est une destination de
 *   `PlayerShell` comme les autres, et non une coquille à part.
 * - **La demande de jet s'écrit DANS le champ de saisie**, en texte
 *   temporaire, au lieu d'occuper un panneau sous lui. Le champ dit
 *   lui-même ce qu'il attend.
 *
 * Les dés sont tirés d'une liste fixe (`DES_FACTICES`) : dans ce projet le
 * client ne lance pas les dés, et une esquisse qui prendrait l'habitude de
 * `Math.random()` la donnerait au vrai écran.
 */

const CHIP = "rounded-full border border-edge px-3 py-1 text-xs text-ink";
const CHIP_MUTED = "rounded-full border border-edge px-3 py-1 text-xs text-ink-muted";
const BTN_ACCENT =
  "rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover";
const BTN_GHOST =
  "rounded-full border border-accent px-4 py-2 text-sm text-accent transition-colors hover:bg-accent/10";
/** Le panneau d'un classeur : c'est l'appelant qui le porte (BinderTabs ne rend que la rangée). */
const CLASSEUR = "rounded-b-lg border-2 border-t-0 border-edge-strong bg-panel-raised p-3";
const LIGNE_CLIQUABLE =
  "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-panel-sunken";

type Colonne = "monde" | "jeu" | "fiche";

/** Ce que le moteur attend. `null` quand il n'attend rien : le champ redevient « Que fais-tu ? ». */
interface Demande {
  label: string;
  detail: string;
  modificateur: number;
  dc: number | null;
}

const PREMIERE_DEMANDE: Demande = {
  label: "Sauvegarde de Dextérité",
  detail: "le gobelin te pousse contre la rampe",
  modificateur: 3,
  dc: 13,
};

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
// Colonne centrale — le fil, puis la saisie
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
 * La saisie. Trois choses sur une seule ligne — dire, **Jouer**, **MJ**.
 *
 * Quand un jet est attendu, **c'est le champ qui le dit** : son texte
 * temporaire devient la demande, et sa bordure passe à l'accent. Rien ne
 * s'ajoute sous lui. Le joueur répond en lançant depuis sa fiche, depuis
 * le volet de dés, ou en écrivant son résultat ici même.
 */
function Saisie({ demande }: { demande: Demande | null }) {
  const invite = demande
    ? `${demande.label}${demande.dc !== null ? ` DD ${demande.dc}` : ""} — lance depuis ta fiche, ou écris ton résultat`
    : "Que fais-tu ?";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-edge bg-panel p-3">
      <input
        placeholder={invite}
        aria-label={demande ? `Jet attendu : ${demande.label}` : "Que fais-tu ?"}
        className={`min-w-0 flex-1 rounded-md border bg-transparent px-2 py-2 text-sm text-ink outline-none transition-colors ${
          demande ? "border-accent placeholder:text-accent" : "border-edge"
        }`}
      />
      <button type="button" className={BTN_ACCENT}>
        Jouer
      </button>
      <button type="button" className={BTN_GHOST} title="Une question sur la scène ou sur une règle — le temps de jeu ne bouge pas">
        MJ
      </button>
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

      {/* Caractéristiques : le modificateur lance un TEST, la ligne du bas
          une SAUVEGARDE. Deux jets distincts, deux cibles de clic. */}
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
// L'écran
// ---------------------------------------------------------------------------

export default function EsquisseSolo() {
  const [colonne, setColonne] = useState<Colonne>("jeu");
  const [demande, setDemande] = useState<Demande | null>(PREMIERE_DEMANDE);
  const [fil, setFil] = useState<FeedItem[]>(FEED);
  const [tirage, setTirage] = useState(0);

  /**
   * Un jet lancé depuis la fiche. Il RÉPOND à la demande en cours quand il
   * y en a une — c'est tout l'intérêt de cliquer là plutôt qu'ailleurs :
   * un seul chemin vers la résolution, jamais deux.
   */
  function lancer(label: string, modificateur: number) {
    const de = DES_FACTICES[tirage % DES_FACTICES.length];
    setTirage((t) => t + 1);
    const total = de + modificateur;
    const dc = demande?.dc ?? null;

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
        origine: "fiche",
      },
    ]);
    setDemande(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <p className="rounded-lg border border-dashed border-edge px-4 py-1 text-xs text-ink-muted">
        Esquisse — données factices, à jeter quand V3-D1 arrive. Clique un modificateur, une compétence ou une attaque :
        le jet répond à la demande en cours.
      </p>

      {/* V3-D2 — l'en-tête d'état. Ville · lieu · pièce à gauche ; date,
          heure, météo et radio à droite. */}
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-edge bg-panel px-4 py-2">
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

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm text-ink-soft">{ENTETE.date}</span>
          <span className="text-sm text-ink">{ENTETE.heure}</span>
          <span className="text-sm text-ink-soft">
            {ENTETE.meteo} · {ENTETE.temperature}
          </span>
          <button type="button" className={CHIP_MUTED} title="Radio d'ambiance">
            ♪ radio
          </button>
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

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(200px,1fr)_minmax(0,2fr)_minmax(280px,1.2fr)]">
        <section className={`min-h-0 ${colonne === "monde" ? "" : "hidden"} lg:block`}>
          <ColonneMonde />
        </section>

        <section className={`flex min-h-0 flex-col gap-3 ${colonne === "jeu" ? "" : "hidden"} lg:flex`}>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-edge bg-panel p-4">
            <Fil items={fil} />
          </div>
          <Saisie demande={demande} />
        </section>

        <section className={`min-h-0 ${colonne === "fiche" ? "" : "hidden"} lg:block`}>
          <ColonneFiche onLancer={lancer} />
        </section>
      </div>
    </div>
  );
}

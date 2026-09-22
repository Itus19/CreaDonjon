"use client";

import { useState } from "react";
import BinderTabs from "@/components/shared/BinderTabs";
import {
  DEMANDE_EN_COURS,
  DISCOVERY_MARK,
  ENTETE,
  FEED,
  FICHE,
  ORIGINE_LABEL,
  PRESENTS,
  SOURCE_MARK,
  WIKI,
  type FeedItem,
  type WikiEntry,
} from "./fixtures";

/**
 * V3-D — **Esquisse**, pas l'écran. Jetable.
 *
 * Deuxième version, après retour de l'auteur sur la première. Ce qu'elle
 * acte :
 *
 * - **Le fil est compact** ; sa trace se déplie au clic plutôt que de
 *   s'étaler (D4 demande « l'encart compact AVEC sa trace » — les deux
 *   tiennent, l'un caché dans l'autre).
 * - **Les marqueurs de source restent** (D6) : ils informent sans peser.
 * - **La colonne gauche se navigue** : on ouvre une fiche connue DANS la
 *   colonne, avec le chemin pour revenir.
 * - **Onglets en intercalaire de classeur**, ceux de la fiche jouable
 *   (`BinderTabs`, ADR 0026) — pas une seconde présentation.
 * - **Le moteur DEMANDE un jet, il ne le lance pas.** Le joueur répond
 *   avec ses outils (fiche, volet de dés) ou annonce son dé physique.
 *   C'est le vrai déroulé d'une table, et c'est un changement de V3-B1.
 * - **Ville · lieu · pièce** à gauche de l'en-tête, date/heure/météo et la
 *   radio à droite. Le bloc « Le monde » quitte la colonne de droite.
 *
 * Tout vient de `fixtures.ts` : aucune requête, aucun compte, aucune
 * donnée réelle. Les jetons, eux, sont les vrais.
 */

const CHIP = "rounded-full border border-edge px-3 py-1 text-xs text-ink";
const CHIP_MUTED = "rounded-full border border-edge px-3 py-1 text-xs text-ink-muted";
const BTN_ACCENT =
  "rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover";
const BTN_GHOST =
  "rounded-full border border-accent px-4 py-2 text-sm text-accent transition-colors hover:bg-accent/10";
/** Le panneau d'un classeur : c'est l'appelant qui le porte (BinderTabs ne rend que la rangée). */
const CLASSEUR = "rounded-b-lg border-2 border-t-0 border-edge-strong bg-panel-raised p-3";

type Colonne = "monde" | "jeu" | "fiche";

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
      {/* Le chemin de retour, toujours au même endroit : c'est lui qui rend
          la navigation lisible dans une colonne étroite. */}
      <button type="button" onClick={onRetour} className="self-start text-xs text-ink-muted hover:text-ink">
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
  const [onglet, setOnglet] = useState<"wiki" | "presents" | "regles">("wiki");
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
                      className="flex items-center justify-between gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-panel-sunken disabled:opacity-50 disabled:hover:bg-transparent"
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

function Fil() {
  return (
    <div className="flex flex-col gap-2">
      {FEED.map((item) => {
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
            // La réponse du MJ : elle éclaire, elle n'avance pas la partie.
            // Le dire en toutes lettres évite de la confondre avec un fait.
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
 * La zone de saisie. Trois choses sur une seule ligne — dire, **Jouer**,
 * **MJ** — puis, dessous, la demande en cours quand il y en a une.
 *
 * `Jouer` fait avancer le tour. `MJ` pose une question sur la scène ou sur
 * une règle et **n'avance pas le temps de jeu** : c'est la différence qui
 * justifie deux boutons plutôt qu'un.
 */
function Saisie() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-edge bg-panel p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          placeholder="Que fais-tu ?"
          aria-label="Que fais-tu ?"
          className="min-w-0 flex-1 rounded-md border border-edge bg-transparent px-2 py-2 text-sm text-ink outline-none"
        />
        <button type="button" className={BTN_ACCENT}>
          Jouer
        </button>
        <button type="button" className={BTN_GHOST} title="Une question sur la scène ou sur une règle — le temps de jeu ne bouge pas">
          MJ
        </button>
      </div>

      {/* La demande en cours. Le moteur dit CE QU'IL ATTEND ; il ne lance
          rien lui-même. Trois façons d'y répondre, et la troisième est
          celle des dés physiques. */}
      <div className="flex flex-col gap-2 rounded-md border border-accent/40 bg-panel-sunken p-3">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className={CHIP}>Jet demandé</span>
          <span className="text-sm font-medium text-ink">{DEMANDE_EN_COURS.label}</span>
          <span className="text-sm text-ink-muted">{DEMANDE_EN_COURS.detail}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={CHIP}>
            lancer depuis la fiche ({DEMANDE_EN_COURS.modificateur})
          </button>
          <button type="button" className={CHIP}>
            volet de dés
          </button>
          <span className="text-xs text-ink-muted">ou écris « j&apos;ai fait 12 » si tu lances tes propres dés</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Colonne droite — la fiche complète
// ---------------------------------------------------------------------------

function ColonneFiche() {
  const [onglet, setOnglet] = useState<"actions" | "competences" | "traits">("actions");
  const pct = Math.round((FICHE.hp.current / FICHE.hp.max) * 100);

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
          <span>Init {FICHE.initiative}</span>
          <span>{FICHE.vitesse}</span>
          <span>Maîtrise {FICHE.maitrise}</span>
        </div>
      </div>

      {/* Les six caractéristiques : chacune son score, son modificateur et
          sa sauvegarde — cliquables, parce que c'est ici qu'on répond à un
          jet demandé. */}
      <div className="grid grid-cols-3 gap-1">
        {FICHE.abilities.map((a) => (
          <button
            key={a.key}
            type="button"
            className="flex flex-col items-center rounded-md border border-edge py-1 transition-colors hover:bg-panel-raised"
          >
            <span className="text-xs text-ink-muted">{a.key}</span>
            <span className="text-sm font-medium text-ink">{a.mod}</span>
            <span className="text-xs text-ink-muted">
              {a.score} · JS {a.save}
            </span>
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <BinderTabs
          aria-label="Sections de la fiche"
          value={onglet}
          onChange={setOnglet}
          items={[
            { value: "actions", label: "Actions" },
            { value: "competences", label: "Compétences" },
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
                    <button type="button" className={CHIP}>
                      attaquer
                    </button>
                    <button type="button" className={CHIP_MUTED}>
                      dégâts
                    </button>
                  </div>
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
                  className="flex items-center justify-between rounded-md px-1 py-1 transition-colors hover:bg-panel-sunken"
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <p className="rounded-lg border border-dashed border-edge px-4 py-1 text-xs text-ink-muted">
        Esquisse — données factices, à jeter quand V3-D1 arrive.
      </p>

      {/* V3-D2 — l'en-tête d'état. Ville · lieu · pièce à gauche, tous
          tenus par le moteur ; date, heure, météo et la radio à droite. */}
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
          {/* La pièce n'est pas un lien : anecdotique le plus souvent, et
              quand elle ne l'est pas (salle secrète), elle vit dans un bloc
              de la fiche du lieu. */}
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

      {/* Sous 1024 px : trois onglets. Au-dessus : trois colonnes. Une
          seule implémentation, deux mises en page. */}
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

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(210px,1fr)_minmax(0,2.2fr)_minmax(260px,1.1fr)]">
        <section className={`min-h-0 ${colonne === "monde" ? "" : "hidden"} lg:block`}>
          <ColonneMonde />
        </section>

        <section className={`flex min-h-0 flex-col gap-3 ${colonne === "jeu" ? "" : "hidden"} lg:flex`}>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-edge bg-panel p-4">
            <Fil />
          </div>
          <Saisie />
        </section>

        <section className={`min-h-0 ${colonne === "fiche" ? "" : "hidden"} lg:block`}>
          <ColonneFiche />
        </section>
      </div>
    </div>
  );
}

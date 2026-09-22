"use client";

import { useState } from "react";
import {
  DISCOVERY_MARK,
  ENTETE,
  FEED,
  FICHE,
  MONDE,
  PRESENTS,
  SOURCE_MARK,
  WIKI,
  type FeedItem,
} from "./fixtures";

/**
 * V3-D — **Esquisse**, pas l'écran. Jetable.
 *
 * Elle existe pour trancher trois choses qu'aucun croquis ne dit :
 *
 * 1. **La densité du fil.** Deux tours complets — jet, application de
 *    règle, prose — est-ce que ça sature ou ça respire ? Le commutateur
 *    « aéré / compact » met les deux côte à côte.
 * 2. **Les marqueurs de source** (V3-D6, une proposition à garder ou à
 *    écarter) : trois signes minuscules qui disent d'où vient chaque
 *    élément. On les allume, on les éteint, on regarde le bruit visuel.
 * 3. **Le téléphone.** Sous 1024 px les colonnes deviennent des onglets.
 *    Ça ne se juge pas sur un dessin, ça se juge à 375 px.
 *
 * Aucune donnée réelle, aucune requête : tout vient de `fixtures.ts`. Les
 * jetons, eux, sont les vrais (docs/CHARTE-UI.md) — une esquisse dans de
 * fausses couleurs ne dirait rien de l'écran final.
 */

const CHIP = "rounded-full border border-edge px-3 py-1 text-xs text-ink";
const CHIP_MUTED = "rounded-full border border-edge px-3 py-1 text-xs text-ink-muted";

type Colonne = "monde" | "jeu" | "fiche";
type Densite = "aere" | "compact";

function Marqueur({ mark, title }: { mark: string; title: string }) {
  return (
    <span className="cursor-help text-xs text-ink-muted" title={title}>
      {mark}
    </span>
  );
}

function Segmente<T extends string>({
  valeur,
  options,
  onChange,
  ariaLabel,
}: {
  valeur: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={valeur === o.value}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            valeur === o.value ? "border-accent text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Fil({ items, densite, sources }: { items: FeedItem[]; densite: Densite; sources: boolean }) {
  const gap = densite === "aere" ? "gap-5" : "gap-2";
  const proseSize = densite === "aere" ? "text-base leading-relaxed" : "text-sm leading-snug";

  return (
    <div className={`flex flex-col ${gap}`}>
      {items.map((item) => {
        switch (item.kind) {
          case "narration":
            return (
              <p key={item.id} className={`${proseSize} text-ink`}>
                {item.text}
                {sources && <> <Marqueur {...SOURCE_MARK[item.source]} /></>}
              </p>
            );

          case "player":
            // Aligné à droite et discret : c'est ce que le joueur a tapé,
            // pas ce que le monde répond.
            return (
              <p key={item.id} className="self-end rounded-md bg-panel-sunken px-3 py-1 text-sm text-ink-soft">
                {item.text}
              </p>
            );

          case "roll":
            return (
              <div
                key={item.id}
                className={`rounded-md border border-edge bg-panel-sunken ${densite === "aere" ? "p-3" : "px-3 py-1.5"}`}
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-xs uppercase tracking-wide text-ink-muted">{item.label}</span>
                  <span className="text-sm font-medium text-ink">{item.total}</span>
                  {item.dc !== null && (
                    <span className={`text-xs ${item.verdict === "success" ? "text-success" : "text-danger"}`}>
                      contre DD {item.dc} — {item.verdict === "success" ? "réussite" : "échec"}
                    </span>
                  )}
                </div>
                {densite === "aere" && (
                  <p className="mt-1 text-xs text-ink-muted">
                    {item.expression} · {item.trace.join(", ")}
                  </p>
                )}
              </div>
            );

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
                {item.text}
                {sources && <> <Marqueur {...SOURCE_MARK[item.source]} /></>}
              </p>
            );
        }
      })}
    </div>
  );
}

function ColonneMonde({ sources }: { sources: boolean }) {
  const [onglet, setOnglet] = useState<"wiki" | "presents" | "regles">("wiki");
  const groupes = [...new Set(WIKI.map((e) => e.group))];

  return (
    <div className="flex h-full flex-col gap-3">
      <Segmente
        ariaLabel="Colonne du monde"
        valeur={onglet}
        onChange={setOnglet}
        options={[
          { value: "wiki", label: "Wiki" },
          { value: "presents", label: "Présents" },
          { value: "regles", label: "Règles" },
        ]}
      />

      {onglet === "wiki" && (
        <div className="flex flex-col gap-3">
          {groupes.map((groupe) => (
            <div key={groupe} className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{groupe}</span>
              {WIKI.filter((e) => e.group === groupe).map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2">
                  <span className={`truncate text-sm ${e.current ? "text-accent" : "text-ink"}`}>{e.name}</span>
                  <Marqueur {...DISCOVERY_MARK[e.discovery]} />
                </div>
              ))}
            </div>
          ))}
          <p className="mt-1 text-xs text-ink-muted">◆ connu · ○ esquisse · ◇ mentionné</p>
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
          {sources && <p className="text-xs text-ink-muted">▪ préparé · ⬦ tiré · ~ narré</p>}
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
  );
}

function ColonneFiche() {
  const pct = Math.round((FICHE.hp.current / FICHE.hp.max) * 100);
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="font-chrome text-base font-medium text-ink">{FICHE.name}</span>
        <div className="h-2 w-full overflow-hidden rounded-full bg-panel-sunken">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-ink-muted">
          {FICHE.hp.current}/{FICHE.hp.max} PV · CA {FICHE.ac} · Init {FICHE.initiative}
        </span>
        <div className="flex flex-wrap gap-2">
          <span className={CHIP_MUTED}>
            Emplacements {FICHE.slots.total - FICHE.slots.used}/{FICHE.slots.total}
          </span>
          {FICHE.inspiration && <span className={CHIP}>Inspiration ✦</span>}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {["Actions", "Sorts", "Sac"].map((section) => (
          <details key={section} className="rounded-md border border-edge px-3 py-1.5">
            <summary className="cursor-pointer text-sm text-ink">{section}</summary>
            <p className="mt-1 text-xs text-ink-muted">
              La fiche jouable existante, en version étroite — mêmes composants, aucun code dupliqué.
            </p>
          </details>
        ))}
      </div>

      <div className="flex flex-col gap-1 border-t border-edge pt-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Le monde</span>
        <span className="text-sm text-ink">{MONDE.date}</span>
        <span className="text-sm text-ink-soft">{MONDE.lune}</span>
        <span className="text-sm text-ink-soft">Bourse : {MONDE.bourse}</span>
        <span className="text-sm text-ink-soft">Quête : {MONDE.quete}</span>
      </div>
    </div>
  );
}

export default function EsquisseSolo() {
  const [densite, setDensite] = useState<Densite>("aere");
  const [sources, setSources] = useState(true);
  const [colonne, setColonne] = useState<Colonne>("jeu");

  const panneau = "rounded-lg border border-edge bg-panel p-4";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Les commandes de l'ESQUISSE, jamais de l'écran : elles disparaissent
          avec elle. Posées en haut pour qu'on puisse basculer sans perdre
          le fil des yeux. */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-edge px-4 py-2">
        <span className="text-xs uppercase tracking-wide text-ink-muted">Esquisse</span>
        <Segmente
          ariaLabel="Densité du fil"
          valeur={densite}
          onChange={setDensite}
          options={[
            { value: "aere", label: "fil aéré" },
            { value: "compact", label: "fil compact" },
          ]}
        />
        <button
          type="button"
          onClick={() => setSources((v) => !v)}
          aria-pressed={sources}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            sources ? "border-accent text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
          }`}
        >
          marqueurs de source
        </button>
      </div>

      {/* V3-D2 — l'en-tête d'état. Tout y est tenu par le moteur. */}
      <header className={`flex flex-wrap items-center justify-between gap-2 ${panneau} py-3`}>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium text-ink">{ENTETE.lieu}</span>
          <span className="text-sm text-ink-muted">· {ENTETE.quartier}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
          <span>{ENTETE.meteo}</span>
          <span>
            {ENTETE.moment} · {ENTETE.heure}
          </span>
          <button type="button" className={CHIP_MUTED}>
            pause
          </button>
        </div>
      </header>

      {/* Sous 1024 px : trois onglets, barre en haut de la zone de contenu.
          Au-dessus : trois colonnes. Une seule implémentation, deux mises
          en page — jamais deux composants. */}
      <div className="lg:hidden">
        <Segmente
          ariaLabel="Colonne affichée"
          valeur={colonne}
          onChange={setColonne}
          options={[
            { value: "monde", label: "Monde" },
            { value: "jeu", label: "Jeu" },
            { value: "fiche", label: "Fiche" },
          ]}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(200px,1fr)_minmax(0,2.2fr)_minmax(220px,1fr)]">
        <section className={`${panneau} overflow-y-auto ${colonne === "monde" ? "" : "hidden"} lg:block`}>
          <ColonneMonde sources={sources} />
        </section>

        <section className={`flex min-h-0 flex-col ${colonne === "jeu" ? "" : "hidden"} lg:flex`}>
          <div className={`${panneau} min-h-0 flex-1 overflow-y-auto`}>
            <Fil items={FEED} densite={densite} sources={sources} />
          </div>

          {/* La barre d'intention de V3-B1 — c'est ici qu'elle vit. Ancrée
              au bas de la colonne, au-dessus du clavier sur téléphone. */}
          <div className={`${panneau} mt-3 flex flex-col gap-2`}>
            <input
              placeholder="Que fais-tu ?"
              aria-label="Que fais-tu ?"
              className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className={CHIP}>Attaque</span>
              <span className="text-sm text-ink">épée longue</span>
              <span className="text-ink-muted">·</span>
              <span className="text-sm text-ink">cible : Gobelin 2 (CA 12)</span>
              <button
                type="button"
                className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
              >
                Lancer
              </button>
              <button type="button" className={CHIP_MUTED}>
                ce n&apos;est pas ça
              </button>
            </div>
          </div>
        </section>

        <section className={`${panneau} overflow-y-auto ${colonne === "fiche" ? "" : "hidden"} lg:block`}>
          <ColonneFiche />
        </section>
      </div>
    </div>
  );
}

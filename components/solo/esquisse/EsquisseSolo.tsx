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
          <button type="button" className={CHIP_MUTED} title="Radio d'ambiance">
            ♪ radio
          </button>
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ENTITY_KIND_LABELS } from "@/components/shared/entityKindLabels";
import type { EntityRefPreview, RuleRefPreview } from "@/src/server/services/refPreview";

/** Delai d'intention. Assez long pour qu'un curseur qui traverse un paragraphe n'ouvre rien, assez court pour qu'un survol volontaire ne se remarque pas. */
const INTENT_MS = 250;
/** Fermeture : laisse le temps de rejoindre la carte a la souris sans la voir disparaitre sous le curseur. */
const CLOSE_MS = 180;
const CARD_WIDTH = 300;
const GAP = 8;

interface Target {
  name: string;
  /** Libelle deja traduit — categorie de la fiche ou type d'entree de regle. */
  category: string;
  excerpt: string | null;
  /** Entite seulement : sert la vignette. Absent pour une regle, qui n'a jamais d'illustration. */
  entityId?: string;
  href?: string;
}

/**
 * Cartes d'apercu au survol d'un lien (V2.1-18 lot 3).
 *
 * UNE seule instance pour toute la page, jamais une par lien : le Prologue
 * porte plus de vingt mentions, et vingt composants avec chacun leur
 * minuteur et leurs ecouteurs seraient du gaspillage pur. D'ou la
 * delegation d'evenements sur le document et la table de refs passee en
 * props — les liens eux-memes ne portent qu'un `data-ref-id`/`data-ref-key`.
 *
 * Aucun acces reseau au survol : tout ce que la carte montre est deja
 * arrive avec le HTML de la page (`refPreview.ts`, lot 2). C'est ce qui
 * permet de la peindre en une image.
 *
 * PAS de `router.prefetch` sur le minuteur d'intention, et c'est une
 * decision mesuree, pas un oubli. L'idee etait seduisante — ces 250 ms sont
 * le meilleur signal disponible qu'un lecteur va cliquer — et elle ne paie
 * rien ici : `/partage/[token]/[entitySlug]` est une route entierement
 * dynamique, et le cache client de Next lui applique `staleTimes.dynamic`,
 * qui vaut 0 par defaut. Mesure en construction de production : le survol
 * declenchait bien deux requetes de prechargement, puis le clic en faisait
 * une TROISIEME — la charge prechargee n'etait jamais reutilisee. Navigation
 * chronometree a 448 ms a froid contre 428 ms apres un survol appuye, soit
 * l'ecart de mesure. Deux rendus serveur par lien survole, pour rien.
 * A rouvrir seulement si `staleTimes` change, ce qui est une decision de
 * portee applicative, pas de composant.
 */
export default function RefPreviewLayer({
  entityRefs,
  ruleRefs,
  hrefBase,
}: {
  entityRefs: Record<string, EntityRefPreview>;
  ruleRefs: Record<string, RuleRefPreview>;
  hrefBase: string;
}) {
  // Memes tables que partout ailleurs, jamais un libelle reecrit pour
  // l'occasion : `ENTITY_KIND_LABELS` pour les fiches, `regles.entryTypes`
  // pour les regles — la meme lecture que `RuleEntryView`.
  const t = useTranslations("regles");
  const ruleEntryTypeLabels = t.raw("entryTypes") as Record<string, string>;
  const [target, setTarget] = useState<Target | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  /**
   * V2.1-18 lot 4 — un pointeur grossier n'a PAS de survol : sans ceci, une
   * regle sur telephone n'ouvrirait jamais rien (elle n'est meme pas un
   * lien, cf. `PublicBlockView`). La carte y devient une feuille basse,
   * ouverte au tap. Lu dans un effet et non au rendu : `matchMedia`
   * n'existe pas au rendu serveur, et la valeur doit etre la meme des deux
   * cotes a l'hydratation.
   */
  const [coarse, setCoarse] = useState(false);
  const [portraitOk, setPortraitOk] = useState(true);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const close = useCallback(() => {
    clearTimers();
    closeTimer.current = setTimeout(() => setTarget(null), CLOSE_MS);
  }, [clearTimers]);

  const open = useCallback(
    (el: HTMLElement) => {
      const kind = el.dataset.refKind;
      let next: Target | null = null;

      if (kind === "entity" && el.dataset.refId) {
        const found = entityRefs[el.dataset.refId];
        if (found) {
          next = {
            name: found.name,
            category: ENTITY_KIND_LABELS[found.kind as keyof typeof ENTITY_KIND_LABELS] ?? found.kind,
            excerpt: found.excerpt,
            entityId: el.dataset.refId,
            href: `${hrefBase}/${found.slug}`,
          };
        }
      } else if (kind === "rule" && el.dataset.refKey) {
        const found = ruleRefs[el.dataset.refKey];
        if (found) {
          next = {
            name: found.name,
            category: ruleEntryTypeLabels[found.entryType] ?? found.entryType,
            excerpt: found.excerpt,
            // Une fiche de regle n'a jamais d'illustration, et sur `/partage`
            // elle n'a pas non plus de page : ni vignette, ni pied.
            href: (el as HTMLAnchorElement).href || undefined,
          };
        }
      }
      if (!next) return;

      // Mesure UNE fois, a l'ouverture. Les coordonnees sont celles du
      // document (defilement inclus) : la carte est posee en `absolute` dans
      // le flux, jamais en `fixed`, pour qu'elle suive son paragraphe si la
      // page defile sous elle.
      const rect = el.getBoundingClientRect();
      const x = Math.max(GAP, Math.min(rect.left + window.scrollX, document.documentElement.clientWidth - CARD_WIDTH - GAP));
      setPos({ x, y: rect.bottom + window.scrollY + GAP });
      setPortraitOk(true);
      setTarget(next);
    },
    [entityRefs, ruleRefs, hrefBase, ruleEntryTypeLabels]
  );

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const sync = () => setCoarse(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    function refFrom(e: Event): HTMLElement | null {
      const el = (e.target as HTMLElement | null)?.closest?.("[data-ref-kind]");
      return el instanceof HTMLElement ? el : null;
    }

    function onOver(e: MouseEvent) {
      if (coarse) return;
      const el = refFrom(e);
      if (!el) return;
      clearTimers();
      openTimer.current = setTimeout(() => open(el), INTENT_MS);
    }

    function onOut(e: MouseEvent) {
      if (coarse || !refFrom(e)) return;
      close();
    }

    /**
     * Tactile : le tap sur une REGLE ouvre la feuille (elle n'a pas d'autre
     * destination) ; le tap sur une ENTITE navigue comme aujourd'hui, sans
     * rien intercepter — un lecteur qui touche un nom de personnage veut sa
     * fiche, pas un resume.
     */
    function onClick(e: MouseEvent) {
      if (!coarse) return;
      const el = refFrom(e);
      if (!el || el.dataset.refKind !== "rule") return;
      e.preventDefault();
      open(el);
    }

    function onFocus(e: FocusEvent) {
      if (coarse) return;
      const el = refFrom(e);
      if (el) open(el);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        clearTimers();
        setTarget(null);
      }
    }

    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("click", onClick);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("click", onClick);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", close);
      document.removeEventListener("keydown", onKey);
      clearTimers();
    };
  }, [open, close, clearTimers, coarse]);

  if (!target) return null;
  if (!coarse && !pos) return null;

  return (
    <div
      role="tooltip"
      // Hors du flux du paragraphe : ouvrir une carte ne doit RIEN deplacer
      // dans le texte qu'on est en train de lire.
      className={
        coarse
          ? "fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t border-edge-strong bg-panel-raised p-4 shadow-2xl backdrop-blur-md"
          : "absolute z-40 rounded-xl border border-edge-strong bg-panel-raised p-3 shadow-2xl backdrop-blur-md"
      }
      style={
        coarse
          ? undefined
          : { left: 0, top: 0, width: CARD_WIDTH, transform: `translate3d(${pos!.x}px, ${pos!.y}px, 0)` }
      }
      onMouseEnter={coarse ? undefined : clearTimers}
      onMouseLeave={coarse ? undefined : close}
    >
      {coarse && (
        <button
          type="button"
          onClick={() => setTarget(null)}
          className="float-right -mt-1 px-2 py-1 text-xs text-ink-muted"
          aria-label="Fermer l'aperçu"
        >
          ✕
        </button>
      )}
      <div className="flex items-start gap-3">
        {/* Boite reservee en dur : `/api/entities/[id]/portrait` repond par
            une redirection vers une URL signee — deux allers-retours. Sans
            reservation, la carte grandirait sous le curseur a l'arrivee de
            l'image. Meme repli que `PublicPortrait` sur un 404. */}
        {target.entityId && portraitOk && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/entities/${target.entityId}/portrait`}
            alt=""
            onError={() => setPortraitOk(false)}
            className="aspect-[3/4] w-12 shrink-0 rounded-md border border-edge object-cover"
          />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{target.name}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-ink-muted">{target.category}</p>
        </div>
      </div>
      {target.excerpt && <p className="mt-2 text-xs leading-relaxed text-ink">{target.excerpt}</p>}
      {target.href && <span className="mt-2 block text-xs text-link-entity">Ouvrir la fiche →</span>}
    </div>
  );
}

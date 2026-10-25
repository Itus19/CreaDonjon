"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ImageBlockData } from "@/src/core/schemas/blocks/image";
import type { Segment } from "@/src/core/schemas/entities/segments";
import Dropdown from "@/components/shared/Dropdown";
import type { ImageBackgroundMode } from "@/src/core/images/backgroundMode";
import {
  CHOIX_FOND,
  appliquerControle,
  appliquerFond,
  estContourne,
  fondDe,
  reglagesFondVisibles,
  type ControleBarre,
} from "@/lib/ui/imageBloc";

/** Forme minimale d'un bloc frere pour cet editeur — `BlockItem` (EntityBlocks) la satisfait. */
export interface ImageAnchorSibling {
  id: string;
  blockType: string;
  display: { label: string };
  data: unknown;
}

/** Un cran du curseur de position : ce qu'il ecrit, et ce qu'il affiche. */
interface PositionStop {
  segmentId: string | null;
  position: "before" | "after";
  label: string;
}

/** Traducteur des libelles de cran (`fiche.image.cran.*`) — le calcul des crans reste pur. */
type TraduireCran = (cle: "enTete" | "avant" | "fin" | "trait" | "segmentVide", valeurs?: { texte: string }) => string;

const APERCU_LONGUEUR = 46;

/** Le texte d'un segment, mentions comprises (leur libelle). */
function texteDe(segment: Segment): string {
  return segment.content.map((node) => (node.t === "text" ? node.v : node.label)).join("").trim();
}

/**
 * Premiers mots d'un segment, pour nommer un cran du curseur. Deuxieme
 * occurrence de cet aplatissement dans le depot (la premiere est
 * `src/server/services/spikeSolo.ts`) — pas encore la troisieme, donc pas
 * encore une fonction partagee.
 */
function apercuSegment(segment: Segment, cran: TraduireCran): string {
  // Un `divider` (V2.1-14) n'a pas de contenu par construction : sans ce cas,
  // il apparaitrait ici comme « (segment vide) », ce qui designe normalement
  // une erreur de saisie.
  if (segment.blockType === "divider") return cran("trait");
  const texte = texteDe(segment);
  if (texte.length === 0) return cran("segmentVide");
  return texte.length > APERCU_LONGUEUR ? `${texte.slice(0, APERCU_LONGUEUR)}…` : texte;
}

function segmentsDe(block: ImageAnchorSibling | undefined): Segment[] {
  const segments = (block?.data as { segments?: unknown } | null)?.segments;
  return Array.isArray(segments) ? (segments as Segment[]) : [];
}

/**
 * N segments donnent N+1 crans : un avant chaque segment, plus « a la fin ».
 * Le premier cran ecrit `segmentId: null` plutot que l'id du premier segment
 * — meme position, mais elle survit a la suppression de ce segment.
 */
function cransDe(segments: Segment[], cran: TraduireCran): PositionStop[] {
  const stops: PositionStop[] = [{ segmentId: null, position: "before", label: cran("enTete") }];
  segments.forEach((segment, i) => {
    if (i > 0) {
      stops.push({ segmentId: segment.id, position: "before", label: cran("avant", { texte: apercuSegment(segment, cran) }) });
    }
  });
  const dernier = segments[segments.length - 1];
  if (dernier) stops.push({ segmentId: dernier.id, position: "after", label: cran("fin") });
  return stops;
}

function cranActuel(stops: PositionStop[], anchor: ImageBlockData["anchor"]): number {
  if (!anchor || anchor.segmentId === null) return 0;
  const exact = stops.findIndex((s) => s.segmentId === anchor.segmentId && s.position === anchor.position);
  if (exact !== -1) return exact;
  // Cote inattendu (ecrit par une version anterieure, ou segment devenu le
  // dernier) : on retombe sur le meme segment, du cote « avant ».
  const memeSegment = stops.findIndex((s) => s.segmentId === anchor.segmentId);
  return memeSegment === -1 ? 0 : memeSegment;
}

/** Largeur de reference a 100 % — la meme que `PublicImageBlock` (`PublicBlockView.tsx`), pour que l'apercu soit a l'echelle du wiki. */
const LARGEUR_IMAGE_BASE_PX = 480;

/** Pastille de choix, recette « puces » de la planche : actif = contour et texte accent. */
function Pastille({
  actif,
  onClick,
  disabled,
  title,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors disabled:opacity-50 ${
        actif ? "border-accent bg-accent/10 text-accent" : "border-edge text-ink-muted hover:bg-panel-raised hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/** Bouton de la barre flottante. */
function BoutonBarre({
  actif,
  onClick,
  disabled,
  title,
  label,
  children,
}: {
  actif?: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`whitespace-nowrap rounded-lg px-2 py-1 text-xs transition-colors disabled:opacity-50 ${
        actif ? "bg-accent/10 text-accent" : "text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Téléversement (V2-G12) : même patron que le portrait
 * (`components/entities/PortraitUpload.tsx`), mais par bloc — une fiche
 * peut avoir plusieurs blocs image, contrairement au portrait unique de
 * l'entité. Le collage d'une URL externe reste possible (`data.url` ne
 * distingue jamais externe/téléversé, même champ dans les deux cas).
 *
 * V2.1-11 : l'emplacement de l'image est **explicite** — le bloc de texte
 * hôte et un curseur à crans pour la position dans ce bloc. Règle de forme
 * retenue avec l'auteur : **choix discret = liste, valeur continue =
 * curseur.**
 *
 * V3.1-67 (B) : toucher l'image fait paraître une barre flottante (alignement,
 * taille, « le texte contourne ») ; l'aperçu montre l'image dans le texte de
 * son bloc hôte, légende éditable sur place ; le reste (emplacement,
 * parallaxe, fond) est dans un encart dessous. Rien n'est écrit à l'ouverture :
 * tout passe par un geste de l'auteur. `wrapMode` reste lu seulement.
 */
export default function ImageBlockEditor({
  blockId,
  data,
  onChange,
  siblings,
}: {
  blockId: string;
  data: ImageBlockData;
  onChange: (data: ImageBlockData) => void;
  /** V2.1-11 : tous les blocs de la fiche, pour proposer les hôtes possibles. */
  siblings: ImageAnchorSibling[];
}) {
  const t = useTranslations("fiche.image");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [barreOuverte, setBarreOuverte] = useState(false);
  const cacheBustRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLButtonElement>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    const res = await fetch(`/api/blocks/${blockId}/image`, { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? t("erreurInattendue"));
      return;
    }
    cacheBustRef.current += 1;
    // Cache-busting (retelenverser remplace l'image au meme id de bloc,
    // comme le portrait) : sans ce parametre, le navigateur pourrait
    // continuer d'afficher l'ancienne image en cache.
    onChange({ ...data, url: `/api/blocks/${blockId}/image?v=${cacheBustRef.current}` });
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) upload(file);
  }

  const cran: TraduireCran = (cle, valeurs) => t(`cran.${cle}`, valeurs);

  // Seul un bloc `text` peut heberger une image : c'est le seul type qui
  // porte des segments, et l'ancrage vise un segment.
  const hotes = siblings.filter((b) => b.blockType === "text" && b.id !== blockId);
  const ancre = data.placement === "anchored" ? data.anchor : null;
  const hote = ancre ? hotes.find((b) => b.id === ancre.blockId) : undefined;
  const ancree = Boolean(ancre && hote);
  const contourne = estContourne(data, ancree);
  const fond = fondDe(data);

  const hoteOptions = [
    ...hotes.map((b) => ({ value: b.id, label: t("blocOption", { bloc: b.display.label }) })),
    // Cible perdue : jamais retiree en silence de la liste. Le rendu, lui,
    // replie deja l'image dans le fil (`planImageAnchors`).
    ...(ancre && !hote ? [{ value: ancre.blockId, label: t("blocSupprime") }] : []),
  ];

  const stops = cransDe(segmentsDe(hote), cran);
  const cranCourant = cranActuel(stops, ancre);

  function choisirEmplacement(value: string) {
    if (value === "flow") {
      onChange({ ...data, placement: "flow", anchor: null });
      return;
    }
    onChange({
      ...data,
      placement: "anchored",
      anchor: { blockId: value, segmentId: null, position: "before" },
      // Une image qui contourne ne peut pas etre centree (un flottement
      // centre n'existe pas en CSS) : on retombe a gauche plutot que de
      // garder une valeur que le rendu ignorerait en silence.
      align: data.anchorFlow !== "break" && data.align === "center" ? "left" : data.align,
    });
  }

  function choisirCran(index: number) {
    if (!ancre) return;
    const stop = stops[index] ?? stops[0];
    onChange({ ...data, anchor: { ...ancre, segmentId: stop.segmentId, position: stop.position } });
  }

  function barre(action: ControleBarre) {
    onChange(appliquerControle(data, action, ancree));
  }

  function fermerSurEchap(e: React.KeyboardEvent) {
    if (e.key === "Escape" && barreOuverte) {
      e.stopPropagation();
      setBarreOuverte(false);
      imageRef.current?.focus();
    }
  }

  const FOND_LIBELLES: Record<ImageBackgroundMode, string> = {
    none: t("fondNone"),
    also: t("fondAlso"),
    only: t("fondOnly"),
  };

  const largeurPx = (LARGEUR_IMAGE_BASE_PX * data.sizePct) / 100;
  const disposition = contourne
    ? `mb-2 ${data.align === "right" ? "float-right ml-4" : "float-left mr-4"}`
    : data.align === "left"
      ? "my-2 items-start"
      : data.align === "right"
        ? "my-2 ml-auto items-end"
        : "my-2 mx-auto items-center";

  const figure = (
    <figure
      key="figure"
      className={`flex w-[var(--img-w)] max-w-full flex-col gap-1.5 ${disposition}`}
      style={{ "--img-w": `${largeurPx}px` } as React.CSSProperties & Record<`--${string}`, string>}
    >
      <button
        ref={imageRef}
        type="button"
        aria-expanded={barreOuverte}
        aria-label={t("regler")}
        onClick={() => setBarreOuverte((ouverte) => !ouverte)}
        className={`block w-full rounded-md ${barreOuverte ? "ring-2 ring-accent" : "hover:ring-1 hover:ring-edge-strong"}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.url} alt={data.caption} loading="lazy" decoding="async" className="block w-full rounded-md object-cover" />
      </button>
      <input
        value={data.caption}
        onChange={(e) => onChange({ ...data, caption: e.target.value })}
        placeholder={t("legendePlaceholder")}
        aria-label={t("legende")}
        className="w-full border-b border-transparent bg-transparent px-0.5 text-xs italic text-ink-muted outline-none transition-colors placeholder:not-italic hover:border-edge focus:border-accent"
      />
    </figure>
  );

  // L'image dans le texte de son bloc hote, a son cran ; seule sinon.
  const segments = segmentsDe(hote);
  const dansLeTexte = ancree && fond !== "only" && segments.length > 0;
  const contenu: React.ReactNode[] = [];
  if (dansLeTexte) {
    const stop = stops[cranCourant] ?? stops[0];
    if (stop.segmentId === null) contenu.push(figure);
    segments.forEach((segment) => {
      if (stop.segmentId === segment.id && stop.position === "before") contenu.push(figure);
      if (segment.blockType === "divider") {
        contenu.push(<hr key={segment.id} className="my-2 border-edge" />);
      } else {
        const titre = segment.blockType !== "paragraph";
        contenu.push(
          <p key={segment.id} className={`my-1 line-clamp-3 text-sm ${titre ? "font-semibold text-ink" : "text-ink-soft"}`}>
            {texteDe(segment)}
          </p>,
        );
      }
      if (stop.segmentId === segment.id && stop.position === "after") contenu.push(figure);
    });
  } else {
    contenu.push(figure);
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        value={data.url}
        onChange={(e) => onChange({ ...data, url: e.target.value })}
        placeholder={t("urlPlaceholder")}
        aria-label={t("url")}
        className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
        >
          {data.url ? t("remplacer") : t("televerser")}
        </button>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFileChange} />
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      {data.url && (
        <>
          <div className="flex flex-col gap-1.5 border-t border-edge/60 pt-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              {dansLeTexte && hote ? t("apercuDansBloc", { bloc: hote.display.label }) : t("apercuTitre")}
            </span>
            {/* La place de la barre est reservee en haut de l'apercu : elle
                paraît et disparaît sans faire sauter le texte. */}
            <div className="relative rounded-xl bg-panel-sunken p-3 pt-12" onKeyDown={fermerSurEchap}>
              {barreOuverte && (
                <div
                  role="toolbar"
                  aria-label={t("barre")}
                  className="absolute left-3 top-2 z-10 flex flex-wrap items-center gap-0.5 rounded-xl border border-edge-strong bg-panel-raised p-0.5 shadow-2xl"
                >
                  <BoutonBarre actif={data.align === "left"} onClick={() => barre({ controle: "align", valeur: "left" })}>
                    {t("gauche")}
                  </BoutonBarre>
                  <BoutonBarre actif={data.align === "center"} onClick={() => barre({ controle: "align", valeur: "center" })}>
                    {t("centre")}
                  </BoutonBarre>
                  <BoutonBarre actif={data.align === "right"} onClick={() => barre({ controle: "align", valeur: "right" })}>
                    {t("droite")}
                  </BoutonBarre>
                  <span aria-hidden="true" className="mx-1 h-4 w-px bg-edge" />
                  <BoutonBarre label={t("moins")} onClick={() => barre({ controle: "taille", sens: -1 })}>
                    −
                  </BoutonBarre>
                  <span className="px-1 text-xs text-ink-soft" aria-live="polite">
                    {t("taille", { pct: data.sizePct })}
                  </span>
                  <BoutonBarre label={t("plus")} onClick={() => barre({ controle: "taille", sens: 1 })}>
                    +
                  </BoutonBarre>
                  <span aria-hidden="true" className="mx-1 h-4 w-px bg-edge" />
                  <BoutonBarre
                    actif={contourne}
                    disabled={!ancree}
                    title={ancree ? undefined : t("contourneIndispo")}
                    onClick={() => barre({ controle: "contourne" })}
                  >
                    {t("contourne")}
                  </BoutonBarre>
                </div>
              )}
              <div className="flow-root">{contenu}</div>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-edge bg-panel-sunken p-3 text-xs">
            {fond !== "only" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("emplacement")}</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Pastille actif={!ancre} onClick={() => choisirEmplacement("flow")}>
                      {t("autonome")}
                    </Pastille>
                    <Pastille
                      actif={Boolean(ancre)}
                      disabled={hotes.length === 0}
                      title={hotes.length === 0 ? t("aucunBlocTexte") : undefined}
                      onClick={() => {
                        if (!ancre && hotes[0]) choisirEmplacement(hotes[0].id);
                      }}
                    >
                      {t("dansTexte")}
                    </Pastille>
                  </div>
                  {ancre && (
                    <Dropdown
                      value={ancre.blockId}
                      options={hoteOptions}
                      onChange={choisirEmplacement}
                      size="md"
                      className="w-full"
                      aria-label={t("bloc")}
                    />
                  )}
                </div>

                {ancree && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("position")}</span>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, stops.length - 1)}
                      step={1}
                      value={cranCourant}
                      onChange={(e) => choisirCran(Number(e.target.value))}
                      aria-label={t("positionLabel")}
                      className="w-full max-w-64"
                    />
                    {/* Le cran cite le texte reel du segment : personne n'a a
                        compter les paragraphes pour savoir ou l'image tombera. */}
                    <span className="italic text-ink-muted">{stops[cranCourant]?.label ?? t("cran.enTete")}</span>
                  </div>
                )}

                {/* Pas de case a cocher a cote : `0` eteint l'effet, donc le
                    curseur EST l'interrupteur. */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("parallaxe")}</span>
                  <label className="flex items-center gap-1.5">
                    <span className="w-9 shrink-0 text-ink-soft">{data.parallaxPct}%</span>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      step={5}
                      value={data.parallaxPct}
                      onChange={(e) => onChange({ ...data, parallaxPct: Number(e.target.value) })}
                      aria-label={t("parallaxeLabel")}
                      className="w-full max-w-64"
                    />
                  </label>
                  <span className="italic text-ink-muted">
                    {data.parallaxPct === 0 ? t("parallaxeZero") : t("parallaxeRogne")}
                  </span>
                </div>
              </>
            )}

            {/* Le fond de page : un seul bloc peut l'etre a la fois par
                fiche, applique cote serveur (src/server/services/blocks.ts) —
                choisir celui-ci retire silencieusement ce role a tout autre
                bloc image de la meme entite (reflete au prochain
                rechargement). */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("fond")}</span>
              <div role="group" aria-label={t("fondLabel")} className="flex flex-wrap items-center gap-1.5">
                {CHOIX_FOND.map((mode) => (
                  <Pastille key={mode} actif={fond === mode} onClick={() => onChange(appliquerFond(data, mode))}>
                    {FOND_LIBELLES[mode]}
                  </Pastille>
                ))}
              </div>
              {fond === "only" && <span className="italic text-ink-muted">{t("fondOnlyNote")}</span>}
            </div>

            {/* Flou et fondu n'existent que pour le fond lui-meme — ils ne
                touchent jamais l'exemplaire rendu dans le corps de la fiche. */}
            {reglagesFondVisibles(fond) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("flou")}</span>
                  <label className="flex items-center gap-1.5">
                    <span className="w-9 shrink-0 text-ink-soft">{data.backgroundBlurPx}px</span>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      step={1}
                      value={data.backgroundBlurPx}
                      onChange={(e) => onChange({ ...data, backgroundBlurPx: Number(e.target.value) })}
                      aria-label={t("flouLabel")}
                      className="w-full"
                    />
                  </label>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("fondu")}</span>
                  <label className="flex items-center gap-1.5">
                    <span className="w-12 shrink-0 text-ink-soft">{data.fadeMs}ms</span>
                    <input
                      type="range"
                      min={0}
                      max={3000}
                      step={100}
                      value={data.fadeMs}
                      onChange={(e) => onChange({ ...data, fadeMs: Number(e.target.value) })}
                      aria-label={t("fonduLabel")}
                      className="w-full"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

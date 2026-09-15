"use client";

import { useRef, useState } from "react";
import type { ImageBlockData } from "@/src/core/schemas/blocks/image";
import type { Segment } from "@/src/core/schemas/entities/segments";
import Dropdown from "@/components/shared/Dropdown";
import { backgroundModeOf, withBackgroundMode, type ImageBackgroundMode } from "@/src/core/images/backgroundMode";

const BACKGROUND_OPTIONS: { value: ImageBackgroundMode; label: string }[] = [
  { value: "none", label: "Pas de fond de page" },
  { value: "also", label: "En fond, en plus de la fiche" },
  { value: "only", label: "Seulement en fond — retirée du texte" },
];

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

const APERCU_LONGUEUR = 46;

/**
 * Premiers mots d'un segment, pour nommer un cran du curseur. Deuxieme
 * occurrence de cet aplatissement dans le depot (la premiere est
 * `src/server/services/spikeSolo.ts`) — pas encore la troisieme, donc pas
 * encore une fonction partagee.
 */
function apercuSegment(segment: Segment): string {
  const texte = segment.content.map((node) => (node.t === "text" ? node.v : node.label)).join("").trim();
  if (texte.length === 0) return "(segment vide)";
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
function cransDe(segments: Segment[]): PositionStop[] {
  const stops: PositionStop[] = [{ segmentId: null, position: "before", label: "en tête du bloc" }];
  segments.forEach((segment, i) => {
    if (i > 0) stops.push({ segmentId: segment.id, position: "before", label: `avant « ${apercuSegment(segment)} »` });
  });
  const dernier = segments[segments.length - 1];
  if (dernier) stops.push({ segmentId: dernier.id, position: "after", label: "à la fin du bloc" });
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

/**
 * Téléversement (V2-G12) : même patron que le portrait
 * (`components/entities/PortraitUpload.tsx`), mais par bloc — une fiche
 * peut avoir plusieurs blocs image, contrairement au portrait unique de
 * l'entité. Le collage d'une URL externe reste possible (`data.url` ne
 * distingue jamais externe/téléversé, même champ dans les deux cas).
 *
 * V2.1-10 : l'emplacement de l'image est désormais **explicite** — une liste
 * des blocs de la fiche, et un curseur à crans pour la position dans le bloc
 * choisi. Les pastilles `Intercaler`/`Retour à la ligne` disparaissent : elles
 * confondaient *où est l'image* et *comment le texte réagit*, ce qui faisait
 * qu'on choisissait un comportement de texte et qu'on obtenait un
 * déplacement. Règle de forme retenue avec l'auteur : **choix discret =
 * liste, valeur continue = curseur.**
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
  /** V2.1-10 : tous les blocs de la fiche, pour proposer les hôtes possibles. */
  siblings: ImageAnchorSibling[];
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheBustRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    const res = await fetch(`/api/blocks/${blockId}/image`, { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Erreur inattendue.");
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

  // Seul un bloc `text` peut heberger une image : c'est le seul type qui
  // porte des segments, et l'ancrage vise un segment.
  const hotes = siblings.filter((b) => b.blockType === "text" && b.id !== blockId);
  const ancre = data.placement === "anchored" ? data.anchor : null;
  const hote = ancre ? hotes.find((b) => b.id === ancre.blockId) : undefined;
  const ancree = Boolean(ancre && hote);
  const contourne = ancree && data.anchorFlow !== "break";
  const fond = backgroundModeOf(data);

  const emplacementOptions = [
    { value: "flow", label: "Bloc autonome — dans le fil de la fiche" },
    ...hotes.map((b) => ({ value: b.id, label: `Dans « ${b.display.label} »` })),
    // Cible perdue : jamais retiree en silence de la liste. Le rendu, lui,
    // replie deja l'image dans le fil (`planImageAnchors`).
    ...(ancre && !hote ? [{ value: ancre.blockId, label: "Bloc supprimé — l'image revient dans le fil" }] : []),
  ];

  const stops = cransDe(segmentsDe(hote));
  const cran = cranActuel(stops, ancre);

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

  function choisirComportement(value: string) {
    const flow = value === "break" ? "break" : "float";
    onChange({ ...data, anchorFlow: flow, align: flow === "float" && data.align === "center" ? "left" : data.align });
  }

  const alignOptions = contourne
    ? [
        { value: "left", label: "Gauche" },
        { value: "right", label: "Droite" },
      ]
    : [
        { value: "left", label: "Gauche" },
        { value: "center", label: "Centre" },
        { value: "right", label: "Droite" },
      ];

  return (
    <div className="flex flex-col gap-2">
      <input
        value={data.url}
        onChange={(e) => onChange({ ...data, url: e.target.value })}
        placeholder="https://…"
        className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel disabled:opacity-50"
        >
          {data.url ? "Remplacer par un fichier" : "+ Téléverser un fichier"}
        </button>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFileChange} />
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      {/* Apercu a gauche, reglages empiles a droite (retour utilisateur) —
          une ligne par type de parametre : le libelle, puis ses boutons
          juste en dessous. */}
      {data.url && (
        <div className="flex items-start gap-4 border-t border-edge/60 pt-2">
          {/* `self-start` (retour utilisateur, rognage) : sans lui, le
              conteneur parent (`flex`) etire ce flex-item en largeur
              (`align-items: stretch`, la valeur par defaut) malgre `w-auto` —
              une image plus large que haute se retrouvait alors dans une
              boite pleine largeur x 240px, rognee par `object-cover` pour la
              remplir. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.url}
            alt={data.caption}
            loading="lazy"
            decoding="async"
            className="max-h-32 w-auto shrink-0 self-start rounded-md object-cover"
          />
          <div className="flex flex-1 flex-col gap-3 text-xs">
            {/* Le fond de page vient EN PREMIER : c'est la seule question qui
                peut annuler toutes les autres. La poser en dernier ferait
                remplir six reglages avant d'apprendre qu'ils ne s'appliquent
                pas (decision d'interface V2.1-10, esquisse validee). */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Fond de page</span>
              <Dropdown
                value={fond}
                options={BACKGROUND_OPTIONS}
                onChange={(value) => onChange({ ...data, ...withBackgroundMode(value as ImageBackgroundMode) })}
                size="md"
                className="w-full"
                aria-label="Rôle de l'image comme fond de la page wiki"
              />
              {fond === "only" && (
                <span className="italic text-ink-muted">
                  L&apos;image ne paraît que derrière la page. Son emplacement dans la fiche est conservé, mais ne
                  s&apos;applique pas tant que ce mode est actif.
                </span>
              )}
            </div>

            {fond !== "only" && (
              <>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Emplacement</span>
              <Dropdown
                value={ancre ? ancre.blockId : "flow"}
                options={emplacementOptions}
                onChange={choisirEmplacement}
                size="md"
                className="w-full"
                aria-label="Emplacement de l'image dans la fiche"
              />
            </div>

            {ancree && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Position dans le bloc</span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, stops.length - 1)}
                  step={1}
                  value={cran}
                  onChange={(e) => choisirCran(Number(e.target.value))}
                  aria-label="Position de l'image dans le bloc"
                  className="w-full max-w-64"
                />
                {/* Le cran cite le texte reel du segment : personne n'a a
                    compter les paragraphes pour savoir ou l'image tombera. */}
                <span className="italic text-ink-muted">{stops[cran]?.label ?? "en tête du bloc"}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {ancree && (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Comportement du texte</span>
                  <Dropdown
                    value={data.anchorFlow === "break" ? "break" : "float"}
                    options={[
                      { value: "float", label: "Le texte contourne" },
                      { value: "break", label: "L'image coupe le texte" },
                    ]}
                    onChange={choisirComportement}
                    size="md"
                    className="w-full"
                    aria-label="Comportement du texte autour de l'image"
                  />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Alignement</span>
                <Dropdown
                  value={data.align}
                  options={alignOptions}
                  onChange={(value) => onChange({ ...data, align: value as ImageBlockData["align"] })}
                  size="md"
                  className="w-full"
                  aria-label="Alignement de l'image"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Taille</span>
                <label className="flex items-center gap-1.5">
                  <span className="w-9 shrink-0 text-ink-soft">{data.sizePct}%</span>
                  <input
                    type="range"
                    min={50}
                    max={200}
                    step={5}
                    value={data.sizePct}
                    onChange={(e) => onChange({ ...data, sizePct: Number(e.target.value) })}
                    aria-label="Taille de l'image dans le wiki"
                    className="w-full"
                  />
                </label>
              </div>
              {/* Pas de case a cocher a cote : `0` eteint l'effet, donc le
                  curseur EST l'interrupteur. Un controle au lieu de deux, et
                  l'etat se lit d'un coup d'oeil au lieu de se deduire. */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Parallaxe</span>
                <label className="flex items-center gap-1.5">
                  <span className="w-9 shrink-0 text-ink-soft">{data.parallaxPct}%</span>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    step={5}
                    value={data.parallaxPct}
                    onChange={(e) => onChange({ ...data, parallaxPct: Number(e.target.value) })}
                    aria-label="Intensité de la parallaxe au défilement"
                    className="w-full"
                  />
                </label>
              </div>
            </div>
            <span className="italic text-ink-muted">
              {data.parallaxPct === 0
                ? "Parallaxe à 0 % — aucun effet. Le curseur est l’interrupteur."
                : "L’image sera rognée dans un cadre de hauteur fixe, pour pouvoir y glisser au défilement."}
            </span>

            {ancree && hote && (
              <AnchorPreview
                segments={segmentsDe(hote)}
                label={hote.display.label}
                stop={stops[cran] ?? stops[0]}
                contourne={contourne}
                align={data.align}
                sizePct={data.sizePct}
              />
            )}
              </>
            )}

            {/* Flou et fondu n'existent que pour le fond lui-meme — ils ne
                touchent jamais l'exemplaire rendu dans le corps de la fiche.
                Un seul bloc peut etre fond a la fois par fiche, applique cote
                serveur (src/server/services/blocks.ts) : choisir celui-ci
                retire silencieusement ce role a tout autre bloc image de la
                meme entite (reflete au prochain rechargement). */}
            {fond !== "none" && (
              <>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Flou du fond</span>
                  <label className="flex items-center gap-1.5">
                    <span className="shrink-0 text-ink-soft">{data.backgroundBlurPx}px</span>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      step={1}
                      value={data.backgroundBlurPx}
                      onChange={(e) => onChange({ ...data, backgroundBlurPx: Number(e.target.value) })}
                      aria-label="Flou du fond du wiki"
                      className="w-full max-w-48"
                    />
                  </label>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Durée du fondu</span>
                  <label className="flex items-center gap-1.5">
                    <span className="shrink-0 text-ink-soft">{data.fadeMs}ms</span>
                    <input
                      type="range"
                      min={0}
                      max={3000}
                      step={100}
                      value={data.fadeMs}
                      onChange={(e) => onChange({ ...data, fadeMs: Number(e.target.value) })}
                      aria-label="Durée du fondu d'entrée et de sortie"
                      className="w-full max-w-48"
                    />
                  </label>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <input
        value={data.caption}
        onChange={(e) => onChange({ ...data, caption: e.target.value })}
        placeholder="Légende (optionnelle)"
        className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm italic placeholder:not-italic placeholder:text-ink-muted"
      />
    </div>
  );
}

/**
 * Mini-carte d'apercu (decision d'interface V2.1-10, « on le fait
 * maintenant ») : les segments du bloc hote en barres, l'image a son cran.
 * Elle supprime la seule incertitude qui restait — ou l'image tombe — sans
 * quitter l'editeur ni publier la fiche.
 *
 * Volontairement schematique : afficher le vrai texte en miniature le
 * rendrait illisible et ferait croire a un apercu fidele, qu'il n'est pas
 * (ni la police, ni la largeur de colonne, ni les marques ne sont celles du
 * wiki).
 */
function AnchorPreview({
  segments,
  label,
  stop,
  contourne,
  align,
  sizePct,
}: {
  segments: Segment[];
  label: string;
  stop: PositionStop;
  contourne: boolean;
  align: ImageBlockData["align"];
  sizePct: number;
}) {
  const largeur = `${Math.min(92, Math.round((38 * sizePct) / 100))}%`;
  const vignette = (
    <div
      key="vignette"
      className={`h-6 rounded-sm bg-accent ${
        contourne
          ? align === "left"
            ? "float-left mr-2 mb-1"
            : "float-right ml-2 mb-1"
          : align === "left"
            ? "my-1"
            : align === "right"
              ? "my-1 ml-auto"
              : "mx-auto my-1"
      }`}
      style={{ width: largeur }}
    />
  );

  const lignes: React.ReactNode[] = [];
  if (stop.segmentId === null) lignes.push(vignette);
  segments.forEach((segment, i) => {
    if (stop.segmentId === segment.id && stop.position === "before") lignes.push(vignette);
    lignes.push(
      <div key={segment.id} className="my-1 h-1.5 rounded-full bg-edge" style={{ width: `${[100, 94, 86, 72][i % 4]}%` }} />
    );
    if (stop.segmentId === segment.id && stop.position === "after") lignes.push(vignette);
  });

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Aperçu dans « {label} »</span>
      <div className="rounded-md bg-panel-sunken p-2">
        <div className="flow-root">{lignes}</div>
      </div>
    </div>
  );
}

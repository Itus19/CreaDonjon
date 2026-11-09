"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ImageBlockData } from "@/src/core/schemas/blocks/image";
import type { TextBlockData } from "@/src/core/schemas/blocks/text";
import Dropdown from "@/components/shared/Dropdown";
import type { ImageBackgroundMode } from "@/src/core/images/backgroundMode";
import { placeImageInText, textHostOf } from "@/src/core/images/inlineImagePlacement";
import { CHOIX_FOND, appliquerFond, fondDe, reglagesFondVisibles } from "@/lib/ui/imageBloc";

/** Forme minimale d'un bloc frere pour cet editeur — `BlockItem` (EntityBlocks) la satisfait. */
export interface ImageAnchorSibling {
  id: string;
  blockType: string;
  display: { label: string };
  data: unknown;
}

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

/**
 * Téléversement (V2-G12) : même patron que le portrait
 * (`components/entities/PortraitUpload.tsx`), mais par bloc — une fiche
 * peut avoir plusieurs blocs image, contrairement au portrait unique de
 * l'entité. Le collage d'une URL externe reste possible (`data.url` ne
 * distingue jamais externe/téléversé, même champ dans les deux cas).
 *
 * V3.1-189 (option B, ADR 0079) : la place de l'image se choisit DANS le
 * texte. Ce bloc ne dit plus que « seule, à sa place » ou « dans tel bloc
 * texte » : choisir un bloc y pose l'image en tête (`placeImageInText`), puis
 * l'auteur la fait glisser dans la phrase et règle habillage et taille dans
 * la bulle de l'éditeur de texte. Le curseur à crans, l'aperçu et la barre
 * d'alignement de V2.1-11 / V3.1-67 ont quitté ce bloc. Restent ici la
 * légende, la parallaxe et tout le fond de page.
 */
export default function ImageBlockEditor({
  blockId,
  data,
  onChange,
  siblings,
  onEditSibling,
  onOpenBlock,
}: {
  blockId: string;
  data: ImageBlockData;
  onChange: (data: ImageBlockData) => void;
  /** Tous les blocs de la fiche, pour proposer les blocs texte. */
  siblings: ImageAnchorSibling[];
  /** V3.1-189 : écrit le texte d'un autre bloc (poser ou retirer l'image). Absent : le choix du bloc texte est en lecture seule. */
  onEditSibling?: (blockId: string, data: unknown) => void;
  /** V3.1-189 : fait défiler jusqu'au bloc texte qui porte l'image. */
  onOpenBlock?: (blockId: string) => void;
}) {
  const t = useTranslations("fiche.image");
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

  const textes = siblings.filter((b): b is ImageAnchorSibling & { data: TextBlockData } => b.blockType === "text");
  // Le texte d'abord. A defaut, un placement a l'ANCIENNE, que le wiki rend
  // encore mais que l'editeur de texte ne dessine pas (retour de l'auteur, 9
  // novembre) : l'ancrage par paragraphe (V2.1-11), ou « le texte du bloc
  // suivant contourne » (`wrapMode: "wrap"`, avant V2.1-11). « Poser dans le
  // texte » l'ecrit au nouveau format, a la meme place. Rien a l'ouverture.
  const citeDans = textHostOf(textes, blockId);
  const suivant = siblings[siblings.findIndex((b) => b.id === blockId) + 1];
  const ancien =
    citeDans !== null
      ? null
      : data.placement === "anchored" && data.anchor && textes.some((b) => b.id === data.anchor?.blockId)
        ? { blockId: data.anchor.blockId, at: { segmentId: data.anchor.segmentId, position: data.anchor.position } }
        : data.wrapMode === "wrap" && suivant?.blockType === "text"
          ? { blockId: suivant.id, at: undefined }
          : null;
  const hoteId = citeDans ?? ancien?.blockId ?? null;
  const hote = textes.find((b) => b.id === hoteId);
  const fond = fondDe(data);

  /**
   * Pose l'image dans `cible` (en tete), ou la retire de tout texte (`null`).
   * L'ancien ancrage par paragraphe (V2.1-11) est efface au passage : le
   * texte est desormais la seule source de la position.
   */
  function choisirBlocTexte(cible: string | null) {
    if (!onEditSibling) return;
    // Vers le bloc de son ancien placement : a la meme place dans le texte.
    const at = ancien && cible === ancien.blockId ? ancien.at : undefined;
    for (const change of placeImageInText(textes, blockId, cible, crypto.randomUUID(), at)) onEditSibling(change.id, change.data);
    const habillage =
      cible !== null && data.anchorFlow !== "break" && data.align === "center"
        ? // Un flottement centre n'existe pas : l'image arrive a droite, texte a gauche.
          { align: "right" as const }
        : {};
    onChange({ ...data, placement: "flow", anchor: null, wrapMode: "intercalate", ...habillage });
  }

  const FOND_LIBELLES: Record<ImageBackgroundMode, string> = {
    none: t("fondNone"),
    also: t("fondAlso"),
    only: t("fondOnly"),
  };

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
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.url} alt={data.caption} loading="lazy" decoding="async" className="block w-36 shrink-0 rounded-md object-cover" />
            <input
              value={data.caption}
              onChange={(e) => onChange({ ...data, caption: e.target.value })}
              placeholder={t("legendePlaceholder")}
              aria-label={t("legende")}
              className="w-full border-b border-edge bg-transparent px-0.5 py-1 text-xs italic text-ink-muted outline-none transition-colors placeholder:not-italic focus:border-accent"
            />
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-edge bg-panel-sunken p-3 text-xs">
            {fond !== "only" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("emplacement")}</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Pastille actif={!hote} disabled={!onEditSibling} onClick={() => choisirBlocTexte(null)}>
                      {t("autonome")}
                    </Pastille>
                    <Pastille
                      actif={Boolean(hote)}
                      disabled={!onEditSibling || textes.length === 0}
                      title={textes.length === 0 ? t("aucunBlocTexte") : undefined}
                      onClick={() => {
                        if (!hote && textes[0]) choisirBlocTexte(textes[0].id);
                      }}
                    >
                      {t("dansTexte")}
                    </Pastille>
                  </div>
                  {hote && (
                    <>
                      <Dropdown
                        value={hote.id}
                        options={textes.map((b) => ({ value: b.id, label: t("blocOption", { bloc: b.display.label }) }))}
                        onChange={choisirBlocTexte}
                        size="md"
                        className="w-full"
                        aria-label={t("bloc")}
                      />
                      {ancien ? (
                        <span className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/50 bg-accent/10 px-2.5 py-2 text-ink">
                          {t("ancienPlacement")}
                          <button
                            type="button"
                            onClick={() => choisirBlocTexte(ancien.blockId)}
                            disabled={!onEditSibling}
                            className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
                          >
                            {t("poserDansTexte")}
                          </button>
                        </span>
                      ) : (
                        <span className="text-ink-muted">{t("glisserAide")}</span>
                      )}
                      {onOpenBlock && (
                        <button type="button" onClick={() => onOpenBlock(hote.id)} className="self-start text-accent hover:underline">
                          {t("allerAuBloc", { bloc: hote.display.label })}
                        </button>
                      )}
                    </>
                  )}
                </div>

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

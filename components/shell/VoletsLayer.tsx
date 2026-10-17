"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { PARTAGE_DEFAUT, PARTAGE_MAX, PARTAGE_MIN, voletDe } from "@/lib/ui/volets";
import { useDesktopWindowsState } from "./DesktopWindowsProvider";
import { refId, windowContentLabel, type WindowRef } from "./windowRefs";
import { useMatchMedia, WINDOWS_MOBILE_QUERY } from "./useMatchMedia";
import type { EntityWindowData } from "@/src/server/services/entityWindow";
import { isMjToolWindowData } from "./mjToolWindows";

/**
 * V3-R1 — les quatre contenus de fenetre sont charges a la demande, jamais
 * dans le paquet initial.
 *
 * Ce composant est monte sur CHAQUE page de monde (`app/m/[worldSlug]/
 * layout.tsx`), et il ne rend rien sous 768 px ni sans fiche. Importes
 * statiquement, ces quatre-la tiraient 332 fichiers / 55 498 lignes — Tiptap,
 * `@dnd-kit`, `d3-force`, les dix panneaux MJ, les quatre formulaires maison —
 * sur toutes les routes du monde, y compris celles qui n'ouvrent aucune fiche.
 *
 * `ssr: false` ne perd rien : `avecData` part vide dans
 * `DesktopWindowsProvider` et n'est remplie que par effet, donc AUCUN de ces
 * composants n'a jamais ete rendu cote serveur.
 */
const LOADING = () => <p className="text-sm text-ink-muted">Chargement...</p>;

const EditEntityForm = dynamic(() => import("@/app/m/[worldSlug]/(monde)/f/[entitySlug]/EditEntityForm"), {
  ssr: false,
  loading: LOADING,
});
const RuleEntryView = dynamic(() => import("@/components/rules/RuleEntryView"), { ssr: false, loading: LOADING });
const MjToolWindowContent = dynamic(() => import("./MjToolWindowContent"), { ssr: false, loading: LOADING });
const RuleToolWindowContent = dynamic(() => import("./RuleToolWindowContent"), { ssr: false, loading: LOADING });

function isEntityWindowData(data: unknown): data is EntityWindowData {
  return !!data && typeof data === "object" && "entity" in data;
}

interface Mesure {
  el: HTMLElement;
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Le rectangle de la zone de travail, suivi quand elle change de taille (le
 * rail se replie, la fenetre se redimensionne) : la couche est `fixed` et se
 * cale dessus plutot que sur une largeur codee en dur. `null` tant que la zone
 * n'est pas enregistree ni mesuree.
 */
function useRectZone(zone: HTMLElement | null): Mesure | null {
  const [mesure, setMesure] = useState<Mesure | null>(null);
  useEffect(() => {
    if (!zone) return;
    const mesurer = () => {
      const r = zone.getBoundingClientRect();
      setMesure((prev) =>
        prev && prev.el === zone && prev.left === r.left && prev.top === r.top && prev.width === r.width && prev.height === r.height
          ? prev
          : { el: zone, left: r.left, top: r.top, width: r.width, height: r.height }
      );
    };
    // `ResizeObserver` rappelle une premiere fois des l'observation : la
    // mesure initiale passe par la, jamais par un `setState` synchrone.
    const observer = new ResizeObserver(mesurer);
    observer.observe(zone);
    window.addEventListener("resize", mesurer);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", mesurer);
    };
  }, [zone]);
  return mesure && mesure.el === zone ? mesure : null;
}

/**
 * Ce que porte le glisser d'un onglet : l'identifiant de la fiche. La barre de
 * titre d'un volet fait `h-10` ; le corps (et les boites des fiches) commence
 * dessous (`top-10`).
 */
const MIME_ONGLET = "text/plain";
/** Ecart (px) entre les volets et le rail ou les bords de l'ecran. */
const MARGE = 8;

/**
 * Les fenetres du MJ en deux volets a onglets (V3.1-20, ADR 0066) — montee
 * UNE SEULE FOIS ici (`app/m/[worldSlug]/layout.tsx`), au-dessus des trois
 * sections : changer de section ne demonte donc rien.
 *
 * La couche est `fixed`, calee sur la zone de travail que `WindowsDesktop`
 * enregistre. Chaque fiche ouverte a une boite STABLE, gardee par son
 * identifiant et posee en absolu sur le corps de son volet : une fiche qui
 * change de volet change de style, jamais de parent React — son contenu n'est
 * pas remonte, un brouillon survit. La primaire, rendue par sa section, y
 * entre par un portail dans son emplacement (`enregistrerEmplacementPrimaire`).
 */
export default function VoletsLayer({ worldSlug }: { worldSlug: string }) {
  const state = useDesktopWindowsState();
  const isMobile = useMatchMedia(WINDOWS_MOBILE_QUERY);
  const zone = useRectZone(state?.zone ?? null);
  // Les volets se tiennent a 8 px du rail et des bords de l'ecran : le fond
  // du monde se voit autour, comme autour du rail.
  const rect = zone ? { left: zone.left + MARGE, top: zone.top + MARGE, width: zone.width - 2 * MARGE, height: zone.height - 2 * MARGE } : null;
  const [partageGlisse, setPartageGlisse] = useState<number | null>(null);
  const [glisse, setGlisse] = useState<string | null>(null);
  const [cible, setCible] = useState<number | null>(null);
  const t = useTranslations("shell");
  const tRegles = useTranslations("regles");
  const entityKindLabels = t.raw("kindLabelsSingular") as Record<string, string>;
  const entryTypeLabels = tRegles.raw("entryTypes") as Record<string, string>;
  function translateBadge(kind: WindowRef["kind"], raw: string | null): string | null {
    if (!raw) return raw;
    return (kind === "entity" ? entityKindLabels[raw] : entryTypeLabels[raw]) ?? raw;
  }

  if (!state || isMobile || !rect || state.disposition.volets.length === 0) return null;

  const d = state.disposition;
  const deux = d.volets.length === 2;
  const agrandi = deux ? state.voletAgrandi : null;
  const partage = partageGlisse ?? d.partage;

  // Les fiches ouvertes, dans un ordre stable (primaire d'abord) : l'ordre des
  // boites ne change jamais quand une fiche change de volet.
  const fiches: { id: string; ref: WindowRef; data: (typeof state.avecWindows)[number]["data"]; primaire: boolean }[] = [
    ...(state.primary ? [{ id: refId(state.primary.ref), ref: state.primary.ref, data: undefined, primaire: true }] : []),
    ...state.avecWindows.map((w) => ({ id: refId(w.ref), ref: w.ref, data: w.data, primaire: false })),
  ];

  function etiquette(fiche: (typeof fiches)[number]): { nom: string; type: string | null } {
    const { name, badge } = fiche.primaire
      ? { name: state!.primary!.name, badge: state!.primary!.badge }
      : windowContentLabel(fiche.ref, fiche.data);
    return { nom: name, type: translateBadge(fiche.ref.kind, badge) };
  }

  /** Emprise horizontale d'un volet, ou `null` s'il est masque par l'autre, agrandi. */
  function bornes(i: number): { left: string; width: string } | null {
    if (!deux || agrandi === i) return { left: "0%", width: "100%" };
    if (agrandi !== null) return null;
    return i === 0 ? { left: "0%", width: `${partage}%` } : { left: `${partage}%`, width: `${100 - partage}%` };
  }

  function finGlisse() {
    setGlisse(null);
    setCible(null);
  }

  function pourcentDepuis(clientX: number): number {
    const brut = ((clientX - rect!.left) / rect!.width) * 100;
    return Math.min(PARTAGE_MAX, Math.max(PARTAGE_MIN, Math.round(brut)));
  }

  const idSource = glisse !== null ? voletDe(d, glisse) : -1;
  // Un volet qui n'a qu'un onglet ne se coupe pas en deux : pas de zone de depot.
  const zoneSecondVolet = glisse !== null && d.volets.length === 1 && d.volets[0].onglets.length > 1;

  function surOverlay(i: number) {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setCible(i);
      },
      onDragLeave: () => setCible((prev) => (prev === i ? null : prev)),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const id = e.dataTransfer.getData(MIME_ONGLET);
        finGlisse();
        if (voletDe(d, id) >= 0 && (i === 0 || i === 1)) state!.deplacerOnglet(id, i);
      },
    };
  }

  const classeOverlay = (actif: boolean) =>
    `absolute z-10 flex items-center justify-center border-2 transition-colors motion-reduce:transition-none ${
      actif ? "border-accent bg-accent/10" : "border-transparent"
    }`;

  return (
    <div
      className={`volets-couche fixed z-40 overflow-hidden rounded-2xl border border-edge bg-panel shadow-2xl ${partageGlisse !== null ? "select-none" : ""}`}
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
    >
      {d.volets.map((v, i) => {
        const b = bornes(i);
        if (!b) return null;
        const voletEstActif = d.voletActif === i;
        return (
          <section
            key={i}
            className={`absolute inset-y-0 flex flex-col ${deux && agrandi === null && i === 1 ? "border-l border-edge" : ""}`}
            style={{ left: b.left, width: b.width }}
          >
            <div
              role="tablist"
              aria-label={t("volets.listeOnglets")}
              className={`volet-barre flex h-10 shrink-0 items-stretch border-b bg-panel-sunken ${
                deux && voletEstActif ? "border-accent/40" : "border-edge"
              }`}
              onPointerDownCapture={() => {
                if (!voletEstActif) state.activerOnglet(v.actif);
              }}
            >
              <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
                {v.onglets.map((id) => {
                  const fiche = fiches.find((f) => f.id === id);
                  if (!fiche) return null;
                  const { nom, type } = etiquette(fiche);
                  const selectionne = v.actif === id;
                  return (
                    <div
                      key={id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(MIME_ONGLET, id);
                        e.dataTransfer.effectAllowed = "move";
                        // Differe : changer le DOM pendant `dragstart` annule le glisser dans Chrome.
                        window.setTimeout(() => setGlisse(id), 0);
                      }}
                      onDragEnd={finGlisse}
                      className={`flex min-w-[5.5rem] shrink items-center border-b-2 border-r border-r-edge transition-colors motion-reduce:transition-none ${
                        selectionne ? "border-b-accent bg-panel text-ink" : "border-b-transparent text-ink-soft hover:bg-panel-raised hover:text-ink"
                      }`}
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={selectionne}
                        onClick={() => state.activerOnglet(id)}
                        className="flex min-w-0 max-w-[220px] flex-1 items-center gap-2 py-1 pl-3 pr-1 text-sm"
                      >
                        <span className="truncate font-chrome font-medium">{nom}</span>
                        {type && (
                          <span className="min-w-0 shrink truncate rounded-full border border-edge bg-panel-raised px-2 py-0.5 text-xs text-ink-muted">{type}</span>
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label={t("volets.fermerOnglet", { nom })}
                        onClick={() => state.closeWindow(fiche.ref)}
                        className="shrink-0 px-2 py-1 text-ink-muted transition-colors hover:text-ink motion-reduce:transition-none"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex shrink-0 items-center gap-1 px-2">
                {deux && (
                  <button
                    type="button"
                    aria-label={agrandi === i ? t("volets.retablirVolet") : t("volets.agrandirVolet")}
                    title={agrandi === i ? t("volets.retablirVolet") : t("volets.agrandirVolet")}
                    onClick={() => state.basculerAgrandi(i)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-edge text-sm text-ink-soft transition-colors hover:border-accent/40 hover:text-ink motion-reduce:transition-none"
                  >
                    {agrandi === i ? "−" : "+"}
                  </button>
                )}
                <button
                  type="button"
                  aria-label={t("volets.fermerFiche")}
                  title={t("volets.fermerFiche")}
                  onClick={() => {
                    const fiche = fiches.find((f) => f.id === v.actif);
                    if (fiche) state.closeWindow(fiche.ref);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-edge text-sm text-ink-soft transition-colors hover:border-danger/60 hover:text-ink motion-reduce:transition-none"
                >
                  ×
                </button>
              </div>
            </div>
          </section>
        );
      })}

      {/* Une boite par fiche ouverte, gardee par son identifiant : elle se
          repose sur le corps de son volet par son style, jamais en changeant
          de parent. Masquee (et non demontee) si ce n'est pas l'onglet
          affiche, ou si l'autre volet est agrandi. */}
      {fiches.map((fiche) => {
        const i = voletDe(d, fiche.id);
        const b = i >= 0 ? bornes(i) : null;
        const visible = b !== null && d.volets[i].actif === fiche.id;
        const { ref, data } = fiche;
        return (
          <div
            key={fiche.id}
            className={`volet-fiche absolute bottom-0 top-10 overflow-auto bg-panel p-6 ${visible ? "" : "hidden"}`}
            style={b ? { left: b.left, width: b.width } : undefined}
            onPointerDownCapture={() => {
              if (i >= 0 && d.voletActif !== i) state.activerOnglet(fiche.id);
            }}
          >
            {fiche.primaire ? (
              <div ref={state.enregistrerEmplacementPrimaire} />
            ) : ref.kind === "rule-tool" ? (
              <RuleToolWindowContent worldSlug={worldSlug} toolKey={ref.key} />
            ) : !data ? (
              <p className="text-sm text-ink-muted">Chargement...</p>
            ) : isEntityWindowData(data) ? (
              <EditEntityForm
                entity={data.entity}
                worldSlug={data.worldSlug}
                initialBlocks={data.blocks}
                initialRelations={data.relations}
                otherEntities={data.otherEntities}
                worldCustomKinds={data.worldCustomKinds}
                campaignId={data.campaignId}
                initialIsPc={data.isPc}
                campaignCharacterUserId={data.campaignCharacterUserId}
                initialPortraitLayout={data.portraitLayout}
              />
            ) : isMjToolWindowData(data) ? (
              <MjToolWindowContent worldSlug={worldSlug} data={data} />
            ) : (
              <RuleEntryView entry={data} worldSlug={worldSlug} />
            )}
          </div>
        );
      })}

      {/* Separateur : glisse pendant le geste (etat local), n'ecrit l'adresse qu'au relachement. */}
      {deux && agrandi === null && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("volets.separateur")}
          aria-valuenow={partage}
          aria-valuemin={PARTAGE_MIN}
          aria-valuemax={PARTAGE_MAX}
          className="volet-separateur absolute inset-y-0 z-10 w-2 -translate-x-1/2 cursor-col-resize touch-none transition-colors hover:bg-accent/30 motion-reduce:transition-none"
          style={{ left: `${partage}%` }}
          onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) setPartageGlisse(pourcentDepuis(e.clientX));
          }}
          onPointerUp={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
            // Un simple clic (aucun mouvement) n'ecrit rien.
            if (partageGlisse !== null) state.fixerPartage(pourcentDepuis(e.clientX));
            setPartageGlisse(null);
          }}
          onPointerCancel={() => setPartageGlisse(null)}
          onDoubleClick={() => state.fixerPartage(PARTAGE_DEFAUT)}
        />
      )}

      {/* Cibles de depot, seulement pendant qu'un onglet est glisse. */}
      {glisse !== null &&
        deux &&
        d.volets.map((_, i) => {
          const b = bornes(i);
          if (!b) return null;
          return (
            <div
              key={`depot-${i}`}
              className={`${classeOverlay(cible === i && i !== idSource)} inset-y-0`}
              style={{ left: b.left, width: b.width }}
              {...surOverlay(i)}
            />
          );
        })}
      {zoneSecondVolet && (
        <div
          className={`${classeOverlay(cible === 1)} bottom-0 top-10 right-0 w-1/2 ${cible === 1 ? "" : "border-dashed border-edge-strong"}`}
          {...surOverlay(1)}
        >
          <span className="pointer-events-none px-4 text-center text-sm text-ink-soft">{t("volets.deposerSecondVolet")}</span>
        </div>
      )}
    </div>
  );
}

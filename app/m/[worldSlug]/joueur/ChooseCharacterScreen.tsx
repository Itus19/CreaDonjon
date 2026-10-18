"use client";

import { useEffect, useRef, useState, useTransition, type KeyboardEvent, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { claimCharacterAction } from "./actions";
import type { ChooseStart } from "@/src/core/campaigns/claimable";
import type { CartePersonnage } from "@/src/server/services/choixPersonnage";
import {
  decalage,
  directionGlisse,
  indexDepart,
  indexPrecedent,
  indexSuivant,
  prenom,
  rolePosition,
} from "@/lib/ui/carrousel";

/**
 * Écran « Choisis ton personnage » (V3.1-82, C2) : un carrousel. Les cartes
 * et la carte de départ viennent du serveur (V3.1-100 : lien nominatif → ce
 * PJ seul) ; ce composant ne filtre rien. « Nouveau personnage » est la
 * dernière carte. Un seul bouton : jouer le PJ centré, ou créer le sien.
 */
export default function ChooseCharacterScreen({
  worldSlug,
  worldName,
  campaignName,
  cartes,
  startOn,
}: {
  worldSlug: string;
  worldName: string;
  campaignName: string;
  cartes: CartePersonnage[];
  startOn: ChooseStart;
}) {
  const t = useTranslations("choixPersonnage");
  const router = useRouter();
  const [index, setIndex] = useState(() =>
    indexDepart(
      startOn,
      cartes.map((c) => c.entityId)
    )
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const departX = useRef<number | null>(null);
  const aGlisse = useRef(false);

  // La carte « Nouveau » est la dernière : `total` = PJ + 1. La liste peut raccourcir après un rechargement.
  const total = cartes.length + 1;
  const courant = Math.min(index, total - 1);
  const surNouveau = courant === cartes.length;
  const carteCourante = surNouveau ? null : cartes[courant];
  const seule = cartes.length === 0;

  function aller(i: number) {
    setError(null);
    setIndex(i);
  }

  function jouerOuCreer() {
    if (pending) return;
    if (!carteCourante) {
      router.push(`/m/${worldSlug}/joueur/nouveau-personnage`);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await claimCharacterAction(worldSlug, carteCourante.entityId);
      if (result?.error) {
        setError(result.error);
        // Recharge la liste (le PJ pris n'y est plus) par une navigation vers la même page : `router.refresh()` ferait monter le cliquet du câblage (C5).
        router.replace(`/m/${worldSlug}/joueur`);
      }
    });
  }

  /** ← → font tourner, Entrée déclenche le bouton. Rend vrai si la touche a servi. */
  function toucheCarrousel(key: string): boolean {
    if (key === "ArrowLeft" && !seule) aller(indexPrecedent(courant, total));
    else if (key === "ArrowRight" && !seule) aller(indexSuivant(courant, total));
    else if (key === "Enter") jouerOuCreer();
    else return false;
    return true;
  }

  function surTouche(e: KeyboardEvent<HTMLDivElement>) {
    if (toucheCarrousel(e.key)) e.preventDefault();
  }

  // Le clavier fonctionne aussi sans avoir mis le carrousel au point : un
  // `autoFocus` lui dessinait son anneau dès le chargement, même pour qui
  // n'utilise que la souris. Une frappe dans un champ ou sur un bouton garde
  // son sens habituel ; le carrousel au point a sa propre écoute.
  const toucheRef = useRef(toucheCarrousel);
  useEffect(() => {
    toucheRef.current = toucheCarrousel;
  });
  useEffect(() => {
    function surToucheFenetre(e: globalThis.KeyboardEvent) {
      const cible = e.target instanceof HTMLElement ? e.target : null;
      if (cible?.closest("input, textarea, select, button, a, [contenteditable='true'], [aria-roledescription='carrousel']")) return;
      if (toucheRef.current(e.key)) e.preventDefault();
    }
    window.addEventListener("keydown", surToucheFenetre);
    return () => window.removeEventListener("keydown", surToucheFenetre);
  }, []);

  function surAppui(e: PointerEvent<HTMLDivElement>) {
    departX.current = e.clientX;
    aGlisse.current = false;
  }

  function surRelache(e: PointerEvent<HTMLDivElement>) {
    if (departX.current === null || seule) return;
    const direction = directionGlisse(e.clientX - departX.current);
    departX.current = null;
    if (direction === 0) return;
    aGlisse.current = true;
    aller(direction === 1 ? indexSuivant(courant, total) : indexPrecedent(courant, total));
  }

  const fleche =
    "absolute top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-edge bg-panel text-lg text-ink-soft backdrop-blur-[var(--blur)] transition-colors hover:bg-panel-raised motion-reduce:transition-none";
  // Phones et ordinateurs : flèches ; tablettes (md à lg) : on glisse.
  const flecheVisible = "flex md:hidden lg:flex";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="text-center">
        <h1 className="block-title text-base">{t("titre")}</h1>
        <p className="text-xs text-ink-muted">{t("intro", { monde: worldName, campagne: campaignName, n: cartes.length })}</p>
      </div>

      <div
        role="group"
        aria-roledescription="carrousel"
        aria-label={t("carrousel")}
        tabIndex={0}
        onKeyDown={surTouche}
        onPointerDown={surAppui}
        onPointerUp={surRelache}
        onPointerCancel={() => {
          departX.current = null;
        }}
        className="relative h-[470px] touch-pan-y select-none overflow-hidden rounded-lg [--w:250px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent md:h-[500px] md:[--w:280px] lg:h-[540px] lg:[--w:320px]"
      >
        {!seule && (
          <button
            type="button"
            aria-label={t("precedent")}
            onClick={() => aller(indexPrecedent(courant, total))}
            className={`${fleche} ${flecheVisible} left-2`}
          >
            ‹
          </button>
        )}

        {[...cartes.map((c) => ({ carte: c })), { carte: null }].map((item, i) => {
          const d = decalage(i, courant, total);
          const role = rolePosition(d);
          const centre = role === "centre";
          const nom = item.carte ? item.carte.entityName : t("nouveauNom");
          return (
            <div
              key={item.carte ? item.carte.entityId : "nouveau"}
              aria-hidden={role === "masquee" ? true : undefined}
              aria-current={centre ? "true" : undefined}
              aria-label={role === "voisine" ? t("aller", { nom }) : undefined}
              onClick={() => {
                if (aGlisse.current) {
                  aGlisse.current = false;
                  return;
                }
                if (role === "voisine") aller(i);
              }}
              style={{
                transform: `translate(calc(-50% + ${d} * (var(--w) + 24px)), -50%) scale(${centre ? 1 : 0.8})`,
                opacity: centre ? 1 : role === "voisine" ? 0.45 : 0,
                filter: centre ? "none" : "saturate(0.5)",
                zIndex: 10 - Math.min(Math.abs(d), 10),
              }}
              className={`absolute left-1/2 top-1/2 flex w-[var(--w)] flex-col overflow-hidden rounded-2xl border bg-panel backdrop-blur-[var(--blur)] transition-[transform,opacity,filter] duration-300 motion-reduce:transition-none ${
                item.carte ? "border-edge" : "border-dashed border-edge-strong"
              } ${centre ? "border-accent shadow-[0_0_32px_-6px_var(--accent)]" : ""} ${
                role === "voisine" ? "cursor-pointer" : ""
              } ${role === "masquee" ? "pointer-events-none" : ""}`}
            >
              <div className="relative flex h-[250px] items-center justify-center overflow-hidden bg-panel-sunken md:h-[280px] lg:h-[330px]">
                {item.carte?.portraitUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- portrait servi par /api/entities/[id]/portrait
                  <img src={item.carte.portraitUrl} alt="" draggable={false} className="h-full w-full object-cover" />
                ) : (
                  <span aria-hidden className={`font-display text-[96px] font-bold ${item.carte ? "text-ink-muted" : "text-accent"}`}>
                    {item.carte ? (nom.trim()[0] ?? "").toUpperCase() : "+"}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1 p-3">
                <span className="block-title text-base">{nom}</span>
                {item.carte?.identite && (
                  <span className="text-xs text-accent">
                    {item.carte.identite.speciesLabel} · {item.carte.identite.classesLabel} {item.carte.identite.level}
                  </span>
                )}
                {item.carte ? (
                  item.carte.phrase && <span className="text-xs leading-relaxed text-ink-soft">{item.carte.phrase}</span>
                ) : (
                  <span className="text-xs leading-relaxed text-ink-soft">{t("nouveauTexte")}</span>
                )}
              </div>
            </div>
          );
        })}

        {!seule && (
          <button
            type="button"
            aria-label={t("suivant")}
            onClick={() => aller(indexSuivant(courant, total))}
            className={`${fleche} ${flecheVisible} right-2`}
          >
            ›
          </button>
        )}
      </div>

      {!seule && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={t("aller", { nom: i === cartes.length ? t("nouveauNom") : cartes[i].entityName })}
              aria-current={i === courant ? "true" : undefined}
              onClick={() => aller(i)}
              className={`h-2 rounded-full transition-all motion-reduce:transition-none ${
                i === courant ? "w-6 bg-accent" : "w-2 bg-edge-strong hover:bg-ink-muted"
              }`}
            />
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="text-center text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={jouerOuCreer}
        disabled={pending}
        className="mx-auto mb-20 w-full rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50 md:mb-0 md:w-auto md:min-w-64"
      >
        {pending ? t("reclamationEnCours") : carteCourante ? t("jouer", { prenom: prenom(carteCourante.entityName) }) : t("creer")}
      </button>
    </div>
  );
}

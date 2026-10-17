"use client";

import { useState, type KeyboardEvent } from "react";
import { ecartCommandeE } from "@/lib/ui/commandeE";

/**
 * Jauge à commandes, « option E » (V3.1-26) : une jauge circulaire qui porte
 * ses commandes, trois pastilles accrochées à son bord droit. ▲ ajoute, ▼
 * retire, la pastille du milieu reçoit un écart.
 *
 * - champ vide : ▲ et ▼ envoient ±1 ;
 * - champ rempli (250 XP gagnés, 7 dégâts) : ±ce nombre, puis le champ se vide.
 *
 * Le composant ne transmet qu'un ÉCART à `onDelta`. Il ne calcule jamais la
 * nouvelle valeur pour l'envoyer : le serveur applique l'écart et le borne
 * (règle de sécurité : aucune valeur posée par le client). La valeur affichée
 * vient toujours de l'appelant.
 *
 * Accessibilité : la jauge est un `spinbutton` qui annonce sa valeur et son
 * maximum ; Entrée dans le champ = ▲, Maj + Entrée = ▼ ; flèches haut/bas sur
 * la jauge = ▲/▼ avec le champ. Les pastilles font 20 px, chacune a une zone
 * de clic invisible de 32 px pour le doigt, sans grossir le dessin.
 *
 * Dessin de l'anneau : celui de `JaugeCirculaire` (`components/solo/
 * FicheJouableEnTete.tsx`), `pathLength={100}` pour se donner en pourcents.
 */
export default function CommandeE({
  libelle,
  valeur,
  maximum,
  progression,
  danger = false,
  complement,
  desactive = false,
  onDelta,
}: {
  /** « Points de vie », « Niveau 2 », « Épuisement » : au-dessus de la jauge, et nom accessible du champ. */
  libelle: string;
  valeur: number;
  /** Absent pour l'XP, qui n'en a pas : l'anneau montre alors `progression`. */
  maximum?: number;
  /** Part de l'anneau remplie (0 à 100) quand il n'y a pas de maximum (XP : progression vers le niveau suivant). */
  progression?: number;
  /** Anneau et libellé en `--danger`. Décidé par l'appelant (PV sous un tiers, épuisement dès 1). */
  danger?: boolean;
  /** Ligne discrète sous la jauge (« +5 temp. » pour les PV temporaires), jamais une donnée sans rapport. */
  complement?: string;
  /** Pendant un envoi : la jauge ne reçoit plus de geste. */
  desactive?: boolean;
  /** L'écart à appliquer, jamais une valeur cible. */
  onDelta: (delta: number) => void;
}) {
  const [champ, setChamp] = useState("");

  const pct = maximum !== undefined ? (maximum > 0 ? (valeur / maximum) * 100 : 0) : (progression ?? 0);
  const borne = Math.max(0, Math.min(100, pct));
  const texte = maximum !== undefined ? `${valeur}/${maximum}` : String(valeur);

  /** Envoie l'écart du champ dans le sens demandé, puis vide le champ. Saisie invalide : rien ne part, le champ reste. */
  function appliquer(signe: 1 | -1) {
    if (desactive) return;
    const ecart = ecartCommandeE(champ, signe);
    if (ecart === null) return;
    onDelta(ecart);
    setChamp("");
  }

  function surToucheChamp(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    appliquer(e.shiftKey ? -1 : 1);
  }

  function surToucheJauge(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      appliquer(1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      appliquer(-1);
    }
  }

  const pastille =
    "relative flex h-5 w-5 items-center justify-center rounded-full border border-edge bg-panel-raised text-xs leading-none text-ink-muted transition-colors after:absolute after:-inset-1.5 after:content-[''] hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-ink-muted";

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <span className={`flex h-8 items-end justify-center text-center text-xs font-bold uppercase leading-tight tracking-wide ${danger ? "text-danger" : "text-ink-muted"}`}>{libelle}</span>
      <div className="relative h-14 w-[86px]">
        <div
          role="spinbutton"
          tabIndex={0}
          aria-label={libelle}
          aria-valuenow={valeur}
          aria-valuemin={0}
          aria-valuemax={maximum}
          aria-valuetext={maximum !== undefined ? `${valeur} sur ${maximum}` : String(valeur)}
          aria-disabled={desactive}
          onKeyDown={surToucheJauge}
          className="absolute left-0 top-0 flex h-14 w-14 items-center justify-center rounded-full"
        >
          <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="20" cy="20" r="16" fill="none" strokeWidth="4" className="stroke-panel-sunken" />
            {/* Un cap arrondi sur une valeur nulle dessine quand même un point : à zéro, l'anneau doit être VIDE. */}
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              strokeWidth="4"
              strokeLinecap={borne === 0 ? "butt" : "round"}
              pathLength={100}
              strokeDasharray={`${borne} ${100 - borne}`}
              className={danger ? "stroke-danger" : "stroke-accent"}
            />
          </svg>
          <span className="relative text-xs font-medium text-ink">{texte}</span>
        </div>
        <button
          type="button"
          disabled={desactive}
          onClick={() => appliquer(1)}
          title={`Ajouter : ${libelle}`}
          aria-label={`Ajouter : ${libelle}`}
          className={`${pastille} absolute left-[44px] top-0`}
        >
          ▲
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={champ}
          disabled={desactive}
          onChange={(e) => setChamp(e.target.value)}
          onKeyDown={surToucheChamp}
          placeholder="—"
          aria-label={`Écart : ${libelle}`}
          className="absolute left-[50px] top-1/2 h-5 w-9 -translate-y-1/2 rounded-full border border-edge bg-panel-sunken px-1 text-center text-xs text-ink outline-none placeholder:text-ink-muted focus:border-accent disabled:opacity-40"
        />
        <button
          type="button"
          disabled={desactive}
          onClick={() => appliquer(-1)}
          title={`Retirer : ${libelle}`}
          aria-label={`Retirer : ${libelle}`}
          className={`${pastille} absolute bottom-0 left-[44px]`}
        >
          ▼
        </button>
      </div>
      {complement && <span className="text-xs leading-tight text-ink-muted">{complement}</span>}
    </div>
  );
}

/**
 * Le même encombrement que `CommandeE`, sans aucun chiffre : l'état de
 * chargement de la fiche (anneau creux, pas de valeur). Même rendu côté
 * serveur et au premier rendu du navigateur.
 */
export function CommandeESquelette({ libelle }: { libelle: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1" aria-hidden="true">
      <span className="flex h-8 items-end justify-center text-center text-xs font-bold uppercase leading-tight tracking-wide text-ink-muted">{libelle}</span>
      <div className="relative h-14 w-[86px]">
        <svg viewBox="0 0 40 40" className="absolute left-0 top-0 h-14 w-14" aria-hidden="true">
          <circle cx="20" cy="20" r="16" fill="none" strokeWidth="4" className="animate-pulse stroke-panel-sunken" />
        </svg>
      </div>
    </div>
  );
}

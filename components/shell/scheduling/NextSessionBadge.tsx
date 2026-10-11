"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Ce que le badge affiche, lu par le layout joueur (V3.1-62, C1). */
export interface ProchaineSession {
  /** Date de la prochaine seance (`YYYY-MM-DD`), `null` si aucune n'est fixee. */
  date: string | null;
  /** Une ronde de demande de disponibilites est ouverte et la joueuse n'y a pas repondu. */
  demandeEnAttente: boolean;
}

function formatSessionDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function CalendarIcon() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 9h16M8 3v4M16 3v4" />
    </svg>
  );
}

/**
 * Lien "Prochaine session" (V2.1-4, recalibré V3.1-9, mène à une page depuis
 * V3.1-8 — jamais une fenêtre pop-up, retour utilisateur : "à l'image de ce
 * que le joueur peut voir pour les autres onglets"). Deux présentations du
 * même lien, pas deux composants : sur desktop, la bannière verticale
 * habituelle (retour utilisateur : "je voulais le garder vertical") ; sur
 * mobile, une icône + libellé court comme les autres destinations de la
 * barre du bas (retour utilisateur : "le bouton de prochaine session
 * disparaît" sur téléphone — il n'existait jusque-là que pour desktop,
 * `hidden md:block` côté `PlayerShell.tsx`).
 *
 * Pastille (V3.1-8) : dès qu'une ronde de demande est ouverte pour la
 * campagne et que la joueuse n'y a pas encore répondu.
 */
export default function NextSessionBadge({ worldSlug, prochaineSession }: { worldSlug: string; prochaineSession: ProchaineSession | null }) {
  const pathname = usePathname();
  const href = `/m/${worldSlug}/joueur/prochaine-session`;
  const active = pathname === href;

  if (!prochaineSession) return null;

  const showBadge = prochaineSession.demandeEnAttente;

  return (
    <>
      <Link
        href={href}
        className={`relative flex flex-col items-center gap-[clamp(0px,0.5vh,4px)] rounded-md px-2 py-2 text-[11px] transition-colors md:hidden ${
          active ? "text-accent" : "text-ink-muted hover:text-ink"
        }`}
      >
        <span className="relative block h-5 w-5 shrink-0">
          <CalendarIcon />
          {showBadge && <span aria-label="Une demande de disponibilités attend une réponse" className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-danger" />}
        </span>
        Session
      </Link>

      <Link
        href={href}
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        className={`relative hidden rounded-md border border-accent px-1.5 py-2 font-mono text-[clamp(8px,1.3vh,11px)] leading-tight text-accent transition-colors hover:bg-panel-raised md:block ${active ? "bg-accent/10" : ""}`}
      >
        {showBadge && (
          // `left`/`bottom`, pas `right`/`top` : le parent est tourne a
          // 180deg (`transform: rotate(180deg)`, pour lire le texte de bas
          // en haut), ce qui tourne AUSSI cette pastille positionnee en
          // absolu — verifie visuellement, "top-right" en CSS atterrissait
          // en bas-gauche a l'ecran avant ce correctif.
          <span
            aria-label="Une demande de disponibilités attend une réponse"
            className="absolute -bottom-1 -left-1 h-2.5 w-2.5 rounded-full bg-danger"
            style={{ writingMode: "horizontal-tb", transform: "none" }}
          />
        )}
        <span className="block">Prochaine session</span>
        <span className="block font-semibold">{prochaineSession.date ? formatSessionDate(prochaineSession.date) : "à définir"}</span>
      </Link>
    </>
  );
}

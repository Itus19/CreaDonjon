"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Destination {
  href: string;
  label: string;
  icon: string;
  match: (pathname: string) => boolean;
}

/**
 * Coquille joueur (V2-M7b, retour utilisateur avec maquette) — responsive,
 * un seul composant pour telephone/tablette/PC plutot que deux
 * implementations : barre d'onglets en bas sous 768px (zone du pouce,
 * inspiration DnD Beyond), rail lateral au-dessus. Jamais `MondeShell`
 * (fenetres flottantes, paradigme desktop) ni `MjSidebar` (outils MJ) —
 * quatre destinations fixes, Fiche/Notes/Wiki/Regles, jamais l'onglet MJ.
 */
export default function PlayerShell({ worldSlug, children }: { worldSlug: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const base = `/m/${worldSlug}/joueur`;

  const destinations: Destination[] = [
    { href: base, label: "Fiche", icon: "user", match: (p) => p === base },
    { href: `${base}/notes`, label: "Notes", icon: "notes", match: (p) => p.startsWith(`${base}/notes`) },
    { href: `${base}/wiki`, label: "Wiki", icon: "map", match: (p) => p.startsWith(`${base}/wiki`) },
    { href: `${base}/regles`, label: "Règles", icon: "books", match: (p) => p.startsWith(`${base}/regles`) },
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col-reverse md:flex-row">
      <nav className="flex shrink-0 justify-around border-t border-edge bg-panel md:w-20 md:flex-col md:justify-start md:gap-1 md:border-t-0 md:border-r md:p-2 print:hidden">
        {destinations.map((d) => {
          const active = d.match(pathname);
          return (
            <Link
              key={d.href}
              href={d.href}
              className={`flex flex-col items-center gap-1 rounded-md px-2 py-2 text-[11px] transition-colors md:py-3 ${
                active ? "text-accent" : "text-ink-muted hover:text-ink"
              }`}
            >
              <Icon name={d.icon} />
              {d.label}
            </Link>
          );
        })}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</div>
    </div>
  );
}

/** Icones minimales en SVG (pas de dependance a une police d'icones cote app) — quatre suffisent, jamais un jeu d'icones complet pour cette coquille. */
function Icon({ name }: { name: string }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8 } as const;
  switch (name) {
    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      );
    case "notes":
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      );
    case "map":
      return (
        <svg {...common}>
          <path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z" />
          <path d="M9 4v14M15 6v14" />
        </svg>
      );
    case "books":
      return (
        <svg {...common}>
          <path d="M5 4h4a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H5V4Z" />
          <path d="M13 4h4v16h-4a2 2 0 0 0-2 2V6a2 2 0 0 1 2-2Z" />
        </svg>
      );
    default:
      return null;
  }
}

/**
 * Icone "œil" minimaliste (SVG inline, pas de dependance) — bascule de
 * visibilite reutilisee a plusieurs endroits (bulles de relation, fiche
 * entiere...). `open` = visible, sinon barre (masque).
 */
export default function EyeIcon({ open, className }: { open: boolean; className?: string }) {
  if (open) {
    return (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden>
        <path d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="10" cy="10" r="2.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden>
      <path
        d="M2.5 2.5l15 15M8.3 8.4a2.5 2.5 0 0 0 3.4 3.4M6 5.1C3.2 6.4 1.5 10 1.5 10S4.5 16 10 16c1.5 0 2.8-.4 3.9-1M16.2 13.9c1.5-1.4 2.3-3.9 2.3-3.9S15.5 4 10 4c-.5 0-.9 0-1.4.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

import type { ReactNode } from "react";
import type { PlayerTitleTier } from "@/src/core/stats/titleTiers";

/**
 * Les douze icônes de titre, au trait (docs/CHARTE-UI.md §10 : jamais
 * d'émoji). Même gabarit que le reste : 24 × 24, trait de 1,75, couleur
 * héritée (`currentColor`) — la teinte vient de la pastille qui les porte.
 * Une clé inconnue retombe sur le d20 plutôt que sur un trou.
 */
const TRACES: Record<PlayerTitleTier["icon_key"], ReactNode> = {
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z" />,
  clover: (
    <>
      <circle cx="12" cy="7.5" r="3.2" />
      <circle cx="7.5" cy="12" r="3.2" />
      <circle cx="16.5" cy="12" r="3.2" />
      <circle cx="12" cy="16.5" r="3.2" />
      <path d="M12 16.5V21" />
    </>
  ),
  d20: (
    <>
      <path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z" />
      <path d="M12 8l3.6 6.4H8.4zM12 2.8V8M4 7.4L8.4 14.4M20 7.4l-4.4 7M8.4 14.4L4 16.6M15.6 14.4l4.4 2.2M8.4 14.4h7.2M12 21.2v-6.8" />
    </>
  ),
  shield: <path d="M12 3l7 2.6v5.6c0 4.4-3 8-7 9.8-4-1.8-7-5.4-7-9.8V5.6z" />,
  cat: (
    <>
      <path d="M5 4.5l3.6 3A8.4 8.4 0 0112 6.8c1.2 0 2.4.2 3.4.7l3.6-3v8.2c0 4-3 7.3-7 7.3s-7-3.300-7-7.300z" />
      <path d="M9.5 12v.8M14.500 12v.8M10.500 15.500c.9.700 2.100.700 3 0" />
    </>
  ),
  purse: (
    <>
      <path d="M9 3.5h6l-1.500 3h-3z" />
      <path d="M10.500 6.500C6.500 8.500 4.500 12 4.500 15.500 4.500 18.500 7 20.500 12 20.500s7.500-2 7.500-5c0-3.500-2-7-6-9" />
      <path d="M12 11v6M10.200 12.200c.5-.5 1.100-.7 1.800-.7 1 0 1.800.5 1.800 1.300S13 14 12 14.200 10.200 14.700 10.200 15.500s.8 1.300 1.800 1.300c.7 0 1.300-.2 1.800-.7" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="8.500" />
      <circle cx="12" cy="12" r="5.200" />
      <path d="M12 9.500v5" />
    </>
  ),
  dagger: <path d="M18.500 3.500l-9 9M14 4l6 6M9.500 12.500l-3 1.200-2.700 5.800 2.700-.1M9.500 12.500l-1.200 3M4.800 19.200l-1.300 1.300M12.200 11.500l1.800 1.800" />,
  sword: <path d="M20 4l-1 5-9.500 9.500M14.500 4H20v5.500M7 14l3 3M5 19l-2 2M8 16l-4 4" />,
  wand: (
    <>
      <path d="M4 20L15 9M14 6l4 4" />
      <path d="M18 3v3M16.500 4.500h3M20.500 11v2M19.500 12h2M9 3v2M8 4h2" />
    </>
  ),
  heart: <path d="M12 20s-7.500-4.600-7.500-10.200A4.300 4.300 0 0112 7.300a4.300 4.300 0 017.500 2.500C19.500 15.400 12 20 12 20z" />,
  scroll: (
    <>
      <path d="M7 4.500h10a2 2 0 012 2V17a2.500 2.500 0 01-2.500 2.500H8.500A2.500 2.500 0 016 17V6.500" />
      <path d="M6 6.500a2 2 0 01-2-2M9.500 9h6M9.500 12.500h6M9.500 16h4" />
    </>
  ),
};

export default function IconeTitre({ cle, className }: { cle: string; className?: string }) {
  const trace = (TRACES as Record<string, ReactNode>)[cle] ?? TRACES.d20;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {trace}
    </svg>
  );
}

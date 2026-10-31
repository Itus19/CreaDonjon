import type { Emplacement } from "@/lib/ui/equipement";

/**
 * V3.1-53 — Les symboles du type d'objet de l'Équipement, dessinés au trait
 * (SVG inline, `currentColor`, aucune bibliothèque, charte §10) : l'armure, la
 * petite épée (lame, garde, poignée, pommeau) et le bouclier.
 */
export default function IconeEquipement({ emplacement, className }: { emplacement: Emplacement; className?: string }) {
  const commun = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", className, "aria-hidden": true } as const;
  if (emplacement === "armor") {
    return (
      <svg {...commun}>
        <path d="M8.5 4 4 7v5l3.2 1.2V20h9.6v-6.8L20 12V7l-4.5-3c-.6 1.4-2 2.2-3.5 2.2S9.1 5.4 8.5 4Z" />
      </svg>
    );
  }
  if (emplacement === "main") {
    return (
      <svg {...commun}>
        {/* La lame, la garde, la poignée, le pommeau. */}
        <path d="M12 2.5 14 5.5V14h-4V5.5L12 2.5Z" />
        <path d="M7 14h10" />
        <path d="M12 14v5" />
        <circle cx="12" cy="20.6" r="1.2" />
      </svg>
    );
  }
  return (
    <svg {...commun}>
      <path d="M12 3 5 5.8V11c0 4.4 2.9 7.9 7 10 4.1-2.1 7-5.6 7-10V5.8L12 3Z" />
    </svg>
  );
}

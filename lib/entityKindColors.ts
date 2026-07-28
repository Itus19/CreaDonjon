export const ENTITY_KIND_COLORS: Record<string, string> = {
  personnage: "hsl(40, 90%, 60%)",
  lieu: "hsl(150, 60%, 45%)",
  faction: "hsl(200, 70%, 55%)",
  objet: "hsl(25, 80%, 55%)",
  evenement: "hsl(280, 60%, 60%)",
};

export function entityKindColor(kind: string | null | undefined): string {
  return (kind && ENTITY_KIND_COLORS[kind]) || "hsl(220, 15%, 55%)";
}

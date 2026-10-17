/**
 * Ou l'on est dans la coquille du MJ (V3.1-29), pour la barre flottante du
 * telephone : de quoi griser la bonne entree. Pure, donc testee sans routeur.
 */

export type SectionMj = "monde" | "regles" | "mj";

/** `fiche` : une page d'entite ou de regle ; `outil` : un outil MJ ou un formulaire de creation de regle. */
export type PageMj = "accueil" | "fiche" | "chat" | "outil" | "autre";

export interface EmplacementMj {
  section: SectionMj;
  page: PageMj;
}

/**
 * `null` hors de la coquille du MJ : la coquille joueur (`/joueur`), l'apercu
 * public (`/apercu`) et toute autre route n'ont pas cette barre.
 * `clesOutilsRegle` : les segments de `/regles/<segment>` qui sont des
 * formulaires de creation (`RULE_TOOL_KEYS`), pas des fiches de regle.
 */
export function classerPageMj(pathname: string, worldSlug: string, clesOutilsRegle: readonly string[]): EmplacementMj | null {
  const base = `/m/${worldSlug}`;
  if (pathname !== base && !pathname.startsWith(`${base}/`)) return null;
  const [premier, second] = pathname.slice(base.length).split("/").filter(Boolean);

  if (premier === undefined) return { section: "monde", page: "accueil" };
  if (premier === "joueur" || premier === "apercu") return null;
  if (premier === "f") return { section: "monde", page: "fiche" };
  if (premier === "regles") {
    if (second === undefined) return { section: "regles", page: "accueil" };
    return { section: "regles", page: clesOutilsRegle.includes(second) ? "outil" : "fiche" };
  }
  if (premier === "mj") {
    if (second === undefined) return { section: "mj", page: "accueil" };
    return { section: "mj", page: second === "chat" ? "chat" : "outil" };
  }
  return { section: "monde", page: "autre" };
}

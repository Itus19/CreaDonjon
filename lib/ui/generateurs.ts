/**
 * Logique pure de l'écran « Générateurs » (V3.1-45) : assemblage de l'aperçu
 * de la fiche, découpage du menu de taverne, texte à copier. Aucun tirage ici :
 * toutes les valeurs viennent des réponses de `/api/blocks/[id]/generate`.
 */

/** Un fragment de l'aperçu : du texte fixe, ou un morceau tiré (relançable par son emplacement). */
export type Morceau =
  | { type: "texte"; texte: string }
  | { type: "tirage"; cle: string; texte: string | null };

const EMPLACEMENT_RE = /\{([a-zA-Z0-9_-]+)\}/g;

/**
 * Découpe un gabarit de section (`{cle}`) en morceaux. Une clé d'emplacement
 * donne un morceau tiré (`texte` nul tant qu'il n'a pas été tiré), une valeur
 * fixe (libellé de variante) devient du texte simple, une clé inconnue reste
 * visible telle quelle — comme `renderGeneratorTemplate` côté serveur.
 */
export function assemblerApercu(
  gabarit: string,
  clesEmplacements: readonly string[],
  textes: Readonly<Record<string, string>>,
  fixes: Readonly<Record<string, string>> = {},
): Morceau[] {
  const morceaux: Morceau[] = [];
  const ajouterTexte = (texte: string) => {
    if (texte === "") return;
    const dernier = morceaux[morceaux.length - 1];
    if (dernier?.type === "texte") dernier.texte += texte;
    else morceaux.push({ type: "texte", texte });
  };

  let curseur = 0;
  for (const m of gabarit.matchAll(EMPLACEMENT_RE)) {
    const cle = m[1];
    ajouterTexte(gabarit.slice(curseur, m.index));
    curseur = m.index + m[0].length;
    if (clesEmplacements.includes(cle)) {
      morceaux.push({ type: "tirage", cle, texte: cle in textes ? textes[cle] : null });
    } else if (cle in fixes) {
      ajouterTexte(fixes[cle]);
    } else {
      ajouterTexte(m[0]);
    }
  }
  ajouterTexte(gabarit.slice(curseur));
  return morceaux;
}

/** Libellé de l'option choisie, par axe de variante : le gabarit les interpole (`{wealth}`). Un axe sans choix connu est omis. */
export function etiquettesVariantes(
  axes: readonly { key: string; options: readonly { key: string; label: string }[] }[] | undefined,
  choix: Readonly<Record<string, string>>,
): Record<string, string> {
  const etiquettes: Record<string, string> = {};
  for (const axe of axes ?? []) {
    const option = axe.options.find((o) => o.key === choix[axe.key]);
    if (option) etiquettes[axe.key] = option.label;
  }
  return etiquettes;
}

/** Clé de la section « Menu » de la taverne : la seule à avoir sa mise en page propre. */
export const CLE_SECTION_MENU = "taverne-menu";

export interface MenuPalier {
  libelle: string;
  cle: string;
}

export interface MenuStructure {
  /** Entrées, plats, desserts : un emplacement par palier de prix. */
  plats: { libelle: string; paliers: MenuPalier[] }[];
  /** Boissons : un emplacement à tirage multiple chacun. */
  boissons: MenuPalier[];
}

const PALIERS_DE_PRIX = [
  { libelle: "Simple", suffixe: "simple" },
  { libelle: "Moyen", suffixe: "moyen" },
  { libelle: "Cher", suffixe: "cher" },
] as const;

const CATEGORIES_DE_PLATS = [
  { libelle: "Entrées", prefixe: "entree" },
  { libelle: "Plats", prefixe: "plat" },
  { libelle: "Desserts", prefixe: "dessert" },
] as const;

/** Découpe du menu en deux colonnes : les plats par palier d'un côté, les boissons de l'autre. */
export function structureMenu(): MenuStructure {
  return {
    plats: CATEGORIES_DE_PLATS.map((c) => ({
      libelle: c.libelle,
      paliers: PALIERS_DE_PRIX.map((p) => ({ libelle: p.libelle, cle: `${c.prefixe}-${p.suffixe}` })),
    })),
    boissons: [
      { libelle: "Avec alcool", cle: "boisson-alcool" },
      { libelle: "Sans alcool", cle: "boisson-sans-alcool" },
    ],
  };
}

/** Texte de « Copier le texte » : le titre, puis chaque section tirée (les sections vides ou pas encore tirées sont sautées). */
export function texteACopier(titre: string | null, sections: readonly { libelle: string; texte: string | null }[]): string {
  const blocs: string[] = [];
  if (titre?.trim()) blocs.push(titre.trim());
  for (const s of sections) {
    if (s.texte?.trim()) blocs.push(`${s.libelle}\n${s.texte.trim()}`);
  }
  return blocs.join("\n\n");
}

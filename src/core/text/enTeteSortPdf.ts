/**
 * V3.1-189 — l'en-tête d'un sort (temps d'incantation, portée, composantes,
 * durée), relu dans le texte extrait du PDF du SRD français (2014 et 2024).
 * Pur.
 *
 * Le défaut de l'import d'origine : une valeur sur deux lignes dont la seconde
 * commence par un chiffre (« M (encens d'une valeur minimale de⏎25 po…) »)
 * était prise pour le début du texte, et la durée n'était jamais lue. Ici,
 * une ligne continue la valeur en cours tant que ses parenthèses ne sont pas
 * fermées, ou si elle commence par une minuscule ou « ( ». Les pieds de page
 * (2014 : « Interdit à la revente… ») et les marques de page sont sautés.
 */

export interface EnTeteSort {
  casting_time: string;
  range: string;
  components: ("V" | "S" | "M")[];
  material?: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
}

const BRUIT = [
  /^=== page \d+ ===$/,
  /^Interdit à la revente/,
  /^ce document pour votre strict usage personnel/,
  /^\d*\s?Document de Référence du Système 5\.(?:1|2\.1)(?:\s+\d+)?$/,
];
const propre = (l: string) => l.replace(/\s+/g, " ").trim();

const ETIQUETTES = [
  { cle: "casting_time", re: /^Temps d[’']incantation : ?(.*)$/ },
  { cle: "range", re: /^Portée : ?(.*)$/ },
  { cle: "components", re: /^Composantes : ?(.*)$/ },
  { cle: "duration", re: /^Durée : ?(.*)$/ },
] as const;
type Cle = (typeof ETIQUETTES)[number]["cle"];

const ECOLES = "Abjuration|Divination|Enchantement|Évocation|Illusion|Invocation|Nécromancie|Transmutation";
/** La ligne d'école et de niveau : « Divination du 5e niveau (rituel) », « Évocation mineure (Clerc) », « Sort mineur d’évocation ». */
const LIGNE_ECOLE = new RegExp(`^(?:Sort mineur d(?:e |[’'])|(?:${ECOLES}) (?:du \\d+(?:er|e)\\s*niveau|mineure?|de niveau))`);
/** Une valeur qui finit sur un mot de liaison continue à la ligne suivante, même si celle-ci commence par un chiffre. */
const FIN_OUVERTE = /(?:\b(?:ou|et|de|à|au|aux|par|en|jusqu’à)|[,’'])$/;
const ouvertes = (t: string) => (t.match(/\(/g)?.length ?? 0) - (t.match(/\)/g)?.length ?? 0);

function etiquette(l: string): { cle: Cle; valeur: string } | null {
  for (const e of ETIQUETTES) {
    const m = e.re.exec(l);
    if (m) return { cle: e.cle, valeur: m[1].trim() };
  }
  return null;
}

function composantes(brut: string): { components: EnTeteSort["components"]; material?: string } {
  const m = brut.match(/^([^(]+?)\s*\(([\s\S]+)\)\s*$/);
  const lettres = (m ? m[1] : brut)
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is "V" | "S" | "M" => s === "V" || s === "S" || s === "M");
  return { components: lettres, ...(m ? { material: propre(m[2]) } : {}) };
}

export function lireEnTeteDeSort(lignes: readonly string[], titre: string): EnTeteSort | null {
  const u = lignes.map(propre).filter((l) => l !== "" && !BRUIT.some((r) => r.test(l)));
  for (let k = 0; k < u.length; k++) {
    if (u[k] !== propre(titre) || !LIGNE_ECOLE.test(u[k + 1] ?? "")) continue;
    // L'en-tête suit le titre de près (ligne d'école sur 1 à 3 lignes) : sinon, c'est une liste de sorts.
    const premiere = u.slice(k + 1, k + 6).findIndex((l) => etiquette(l)?.cle === "casting_time");
    if (premiere < 0) continue;
    const ecole = u.slice(k + 1, k + 1 + premiere).join(" ");
    const valeurs: Partial<Record<Cle, string>> = {};
    let cle: Cle | null = null;
    for (const l of u.slice(k + 1 + premiere)) {
      const e = etiquette(l);
      if (e) {
        if (valeurs[e.cle] !== undefined) break;
        valeurs[e.cle] = e.valeur;
        cle = e.cle;
        continue;
      }
      if (cle && (ouvertes(valeurs[cle] ?? "") > 0 || FIN_OUVERTE.test(valeurs[cle] ?? "") || /^[a-zà-ÿœ(]/.test(l))) {
        valeurs[cle] = propre(`${valeurs[cle]} ${l}`);
        continue;
      }
      break;
    }
    if (valeurs.casting_time === undefined || valeurs.range === undefined || valeurs.components === undefined || valeurs.duration === undefined) return null;
    return {
      casting_time: valeurs.casting_time,
      range: valeurs.range,
      ...composantes(valeurs.components),
      duration: valeurs.duration,
      concentration: /concentration/i.test(valeurs.duration),
      ritual: /rituel/i.test(valeurs.casting_time) || /\(rituel\)/i.test(ecole),
    };
  }
  return null;
}

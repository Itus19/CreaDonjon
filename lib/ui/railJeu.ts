import type { PerceptionPercue } from "@/src/core/psyche/perception";
import type { SceneView } from "@/lib/solo/types";

/**
 * ADR 0120, V3.2-55 — Les visages du rail de jeu.
 *
 * Six au plus (au-delà, le rail déborderait sous la dalle du dé à 794 px de
 * haut, mesure de la maquette), rangés par distance : au contact, proche,
 * loin ; dans une même zone, les fiches avant les esquisses. Les suivants se
 * résument en « +x », qui ouvre la liste entière dans le volet.
 */
export const VISAGES_MAX = 6;

const ORDRE_ZONES = { engaged: 0, near: 1, far: 2 } as const;

export interface RondRail {
  id: string;
  nom: string;
  zone: keyof typeof ORDRE_ZONES;
  perception: PerceptionPercue | null;
  esquisse: boolean;
}

export function rondsDuRail(
  present: SceneView["present"],
  sketches: SceneView["sketches"],
  max: number = VISAGES_MAX
): { visibles: RondRail[]; autres: number } {
  const tous: RondRail[] = [
    ...present.map((p) => ({ id: p.entityId, nom: p.name, zone: p.zone, perception: p.perception ?? null, esquisse: false })),
    ...sketches.map((s) => ({ id: s.id, nom: s.name, zone: s.zone, perception: null, esquisse: true })),
  ];
  // `sort` est stable : l'ordre de la scène départage deux personnes de la même zone.
  const ranges = [...tous].sort((a, b) => ORDRE_ZONES[a.zone] - ORDRE_ZONES[b.zone] || Number(a.esquisse) - Number(b.esquisse));
  // Exactement `max` : tout le monde tient, sans « +1 » qui prendrait la place d'un visage.
  if (ranges.length <= max) return { visibles: ranges, autres: 0 };
  return { visibles: ranges.slice(0, max), autres: ranges.length - max };
}

/** Ce que le volet lit en entier : une fiche du wiki (par son slug) ou une règle (par sa clé). */
export interface CibleLecture {
  type: "fiche" | "regle";
  cle: string;
}

/**
 * Reconnaît, dans l'adresse d'un lien cliqué dans l'écran de jeu, une fiche du
 * wiki ou une règle de CE monde, pour l'ouvrir dans le volet au lieu de quitter
 * la partie. Une adresse avec requête ou fragment, ou d'un autre monde, n'est
 * pas reconnue : le lien suit son cours.
 */
export function cibleDepuisAdresse(href: string, worldSlug: string): CibleLecture | null {
  // `href` est l'attribut tel qu'écrit par l'app : un chemin absolu du site (« /m/… »).
  if (href.includes("?") || href.includes("#")) return null;
  const base = `/m/${worldSlug}/joueur/`;
  if (!href.startsWith(base)) return null;
  const [section, cle, ...reste] = href.slice(base.length).split("/");
  if (!cle || reste.length > 0) return null;
  if (section === "wiki") return { type: "fiche", cle: decodeURIComponent(cle) };
  if (section === "regles") return { type: "regle", cle: decodeURIComponent(cle) };
  return null;
}

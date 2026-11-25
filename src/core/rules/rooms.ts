import type { SceneRoom, SceneRoomSketch, SceneState } from "./scene";
import type { Room, RoomsBlockData } from "../schemas/blocks/rooms";

/**
 * V3.2-19 — Les pièces d'un lieu (bloc `rooms`) et leurs esquisses.
 *
 * L'IA peut proposer d'entrer dans une pièce qui n'existe pas encore (« la
 * cuisine ») ; le moteur la contrôle (`validerNouvellePiece`), la garde en
 * esquisse dans la scène, puis l'ajoute au bloc « Pièces » de la page du
 * lieu à la seconde visite, ou dès que le joueur la nomme
 * (`pieceDoitEtreAncree`), comme une esquisse de PNJ. Fonctions pures.
 */

const ARTICLES = /^(?:la|le|les|l'|un|une|des)\s*/;

/** Nom comparable : minuscules, sans accents ni article de tête, espaces resserrés. */
export function normaliserNomPiece(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’]/g, "'")
    .toLowerCase()
    .trim()
    .replace(ARTICLES, "")
    .replace(/\s+/g, " ");
}

export function trouverPiece<R extends { name: string }>(name: string, rooms: readonly R[]): R | null {
  const cle = normaliserNomPiece(name);
  return rooms.find((r) => normaliserNomPiece(r.name) === cle) ?? null;
}

export type RefusPiece = "nom_vide" | "nom_trop_long" | "nom_invalide" | "nom_d_un_lieu" | "description_trop_longue";

/**
 * Le contrôle du moteur sur une pièce inventée : un nom court, sans
 * chiffre ni balise, qui n'est ni le lieu lui-même ni un lieu voisin (aller
 * à la forge est un déplacement, pas une pièce de l'auberge). Une pièce
 * déjà connue n'arrive pas ici : `trouverPiece` l'a reconnue avant.
 */
export function validerNouvellePiece(
  piece: { name: string; description: string },
  ctx: { rooms: readonly Room[]; locationName: string; neighbourNames: readonly string[] }
): { ok: true } | { ok: false; reason: RefusPiece } {
  const nom = piece.name.trim();
  if (nom === "") return { ok: false, reason: "nom_vide" };
  if (nom.length > 80) return { ok: false, reason: "nom_trop_long" };
  if (/[\d<>{}[\]]/.test(nom)) return { ok: false, reason: "nom_invalide" };
  const cle = normaliserNomPiece(nom);
  if ([ctx.locationName, ...ctx.neighbourNames].some((n) => normaliserNomPiece(n) === cle)) return { ok: false, reason: "nom_d_un_lieu" };
  if (piece.description.trim().length > 600) return { ok: false, reason: "description_trop_longue" };
  return { ok: true };
}

export function idDePiece(name: string, existingIds: readonly string[]): string {
  const base =
    normaliserNomPiece(name)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "piece";
  if (!existingIds.includes(base)) return base;
  let n = 2;
  while (existingIds.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function ajouterPiece(data: RoomsBlockData, piece: { name: string; description: string }): RoomsBlockData {
  const id = idDePiece(piece.name, data.rooms.map((r) => r.id));
  return { ...data, rooms: [...data.rooms, { id, name: piece.name.trim(), description: piece.description.trim() }] };
}

/** Seconde visite, ou le joueur la nomme : l'esquisse entre dans le wiki. */
export function pieceDoitEtreAncree(sketch: { name: string; visits: number }, playerText: string): boolean {
  if (sketch.visits >= 2) return true;
  const cle = normaliserNomPiece(sketch.name);
  if (cle === "") return false;
  const texte = playerText
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const echappe = cle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${echappe}(?![\\p{L}\\p{N}])`, "u").test(texte);
}

export interface ProposPiece {
  enter: { name: string; description?: string } | undefined;
  leave: boolean;
}

export interface DecisionPiece {
  scene: SceneState;
  /** Vrai si la pièce courante a changé (l'écran relit la scène). */
  changed: boolean;
  /** L'esquisse à écrire dans le bloc « Pièces » du lieu, quand elle doit y entrer. */
  anchor: { name: string; description: string } | null;
  /** Pourquoi une pièce nouvelle a été refusée, pour le journal. */
  refus?: RefusPiece;
}

/**
 * Ce que le moteur fait d'une proposition de pièce (`enter_room`,
 * `leave_room`) : entrer dans une pièce du wiki, dans une esquisse déjà
 * vue (une visite de plus), ou dans une pièce nouvelle si le contrôle
 * l'accepte ; ressortir. Puis, si la pièce courante est une esquisse qui
 * doit entrer dans le wiki (`pieceDoitEtreAncree`), la désigne dans
 * `anchor` : l'écriture, elle, revient au service. Pure.
 */
export function deciderPiece(
  scene: SceneState,
  propos: ProposPiece,
  ctx: { wikiRooms: readonly Room[]; locationName: string; neighbourNames: readonly string[]; playerAction: string }
): DecisionPiece {
  const ici = scene.locationId;
  const avant = scene.room && scene.room.locationId === ici ? scene.room : null;
  let room: SceneRoom | null = avant;
  const avantSketches: SceneRoomSketch[] = scene.roomSketches ?? [];
  let sketches = avantSketches;
  let refus: RefusPiece | undefined;

  if (propos.enter) {
    const wiki = trouverPiece(propos.enter.name, ctx.wikiRooms);
    const deja = avant !== null && normaliserNomPiece(avant.name) === normaliserNomPiece(propos.enter.name);
    if (deja) {
      // rien : on y est déjà
    } else if (wiki) {
      room = { locationId: ici, name: wiki.name, description: wiki.description, anchored: true };
    } else {
      const esquisse = trouverPiece(propos.enter.name, sketches.filter((s) => s.locationId === ici));
      if (esquisse) {
        const vue = { ...esquisse, visits: esquisse.visits + 1 };
        sketches = sketches.map((s) => (s === esquisse ? vue : s));
        room = { locationId: ici, name: vue.name, description: vue.description, anchored: false };
      } else {
        const piece = { name: propos.enter.name.trim(), description: (propos.enter.description ?? "").trim() };
        const verdict = validerNouvellePiece(piece, { rooms: ctx.wikiRooms, locationName: ctx.locationName, neighbourNames: ctx.neighbourNames });
        if (verdict.ok) {
          sketches = [...sketches, { locationId: ici, name: piece.name, description: piece.description, visits: 1 }];
          room = { locationId: ici, name: piece.name, description: piece.description, anchored: false };
        } else {
          refus = verdict.reason;
        }
      }
    }
  } else if (propos.leave) {
    room = null;
  }

  const changed = (room?.name ?? null) !== (avant?.name ?? null);
  let anchor: DecisionPiece["anchor"] = null;
  if (room && !room.anchored) {
    const nom = room.name;
    const esquisse = sketches.find((s) => s.locationId === ici && s.name === nom);
    if (esquisse && pieceDoitEtreAncree(esquisse, ctx.playerAction)) anchor = { name: esquisse.name, description: esquisse.description };
  }

  if (!changed && sketches === avantSketches && anchor === null) return { scene, changed: false, anchor: null, ...(refus ? { refus } : {}) };
  return { scene: { ...scene, room, roomSketches: sketches }, changed, anchor, ...(refus ? { refus } : {}) };
}

/** Après l'écriture dans le wiki : la pièce courante devient ancrée et son esquisse disparaît. */
export function pieceAncree(scene: SceneState, name: string): SceneState {
  const room = scene.room && scene.room.name === name ? { ...scene.room, anchored: true } : (scene.room ?? null);
  return { ...scene, room, roomSketches: (scene.roomSketches ?? []).filter((s) => !(s.locationId === scene.locationId && s.name === name)) };
}

import { z } from "zod";
import type { SceneState } from "./scene";
import { zSettlementBlockData, type SettlementBlockData } from "../schemas/blocks/settlement";
import { archetypeParCle } from "../worldgen/archetypes";
import { attachedPeople, materializeOccupants, OCCUPANT_PLACE_TYPES, type Occupant, type OccupantPlaceType, type WikiWorker } from "../worldgen/occupants";
import { occupantId, occupantLabel, occupantRoom, presenceDiff } from "../worldgen/placePresence";

/**
 * V3.2-31 — La vie du lieu dans la scène (`specs/vie-du-monde.md` §5, §9).
 *
 * Quand la scène est posée dans un lieu dont on sait le type (une auberge,
 * un temple), le moteur y range ce qu'il faut pour calculer qui s'y trouve :
 * la ville en agrégat et les PNJ du wiki qui y travaillent (`works_at`). Ces
 * entrées sont lues une fois, au changement de lieu ; ensuite, chaque fois
 * que l'horloge avance (`advanceSceneTime`), la présence est recalculée sans
 * aucune requête : c'est une fonction pure de l'heure (ADR 0115).
 *
 * Les personnes calculées entrent dans la scène comme les autres : une
 * esquisse (`calc-<graine>`, un libellé sans nom) ou, pour un PNJ du wiki,
 * un présent. Le moteur ne fait sortir que celles qu'il a fait entrer
 * (`computed`) : quelqu'un ajouté à la main au panneau reste.
 *
 * Ce que le personnage voit changer dans SA pièce devient une nouvelle
 * (`news`) : elle part à l'IA comme fait établi au tour suivant (§9), puis
 * elle est marquée dite.
 *
 * Module PUR. N'importe de `scene.ts` que des types, pour que `scene.ts`
 * puisse l'appeler depuis `advanceSceneTime` sans dépendance circulaire.
 */

export const NEWS_KEPT = 20;

export interface SceneNews {
  /** Identifiant dans la scène : une entité, ou `calc-<graine>`. */
  id: string;
  /** Le libellé d'une esquisse au moment du fait ; `null` pour une entité, que le serveur nomme comme le joueur la connaît. */
  name: string | null;
  change: "arrive" | "leave";
  told: boolean;
}

export interface SceneLife {
  /** Le lieu pour lequel ces entrées ont été lues ; ailleurs, elles ne valent rien. */
  locationId: string;
  placeType: OccupantPlaceType;
  settlement: SettlementBlockData;
  workers: WikiWorker[];
  /** Les personnes que le moteur a fait entrer, avec la pièce qu'il leur a donnée. */
  computed: { id: string; room: string | null }[];
  news: SceneNews[];
}

export const zSceneLife = z.object({
  locationId: z.string().min(1),
  placeType: z.enum(OCCUPANT_PLACE_TYPES),
  settlement: zSettlementBlockData,
  workers: z.array(z.object({ entityId: z.string().min(1), archetype: z.string().min(1).optional(), seed: z.number().int().min(0).max(0xffffffff).optional() })).max(40),
  computed: z.array(z.object({ id: z.string().min(1), room: z.string().min(1).max(80).nullable() })).max(80),
  news: z
    .array(z.object({ id: z.string().min(1), name: z.string().min(1).max(160).nullable(), change: z.enum(["arrive", "leave"]), told: z.boolean() }))
    .max(NEWS_KEPT),
});

function pieceDuPersonnage(scene: SceneState): string | null {
  return scene.room && scene.room.locationId === scene.locationId ? scene.room.name : null;
}

/** Qui le personnage voit : les présents et esquisses de sa pièce (même règle que `presentsIci`). */
function visibles(scene: SceneState): Map<string, string> {
  const ici = pieceDuPersonnage(scene);
  const estIci = (room: string | null | undefined) => room === undefined || room === ici;
  const vus = new Map<string, string>();
  for (const p of scene.present) if (estIci(p.room)) vus.set(p.entityId, "");
  for (const s of scene.sketches) if (estIci(s.room)) vus.set(s.id, s.name);
  return vus;
}

interface Calcule {
  id: string;
  room: string | null;
  entityId?: string;
  name: string;
  trait: string;
}

function calculer(scene: SceneState, life: SceneLife): Calcule[] {
  const moment = { day: scene.time.day, hour: scene.time.hour };
  return materializeOccupants(life.settlement, { key: life.locationId, type: life.placeType }, moment, life.workers).map((o) => ({
    id: occupantId(o),
    room: occupantRoom(o, o.at),
    ...(o.entityId ? { entityId: o.entityId } : {}),
    name: occupantLabel(o),
    trait: archetypeParCle(o.archetype)?.label ?? o.archetype,
  }));
}

/**
 * Range la vie du lieu dans la scène et fait entrer ceux qui y sont à cette
 * heure, sans nouvelle : arriver quelque part, c'est trouver les gens déjà
 * là, pas les voir entrer. Sans type de lieu connu, retire la vie : la
 * présence reste celle posée à la main, comme avant ce ticket.
 */
export function poserLaVie(scene: SceneState, entrees: { placeType: OccupantPlaceType; settlement: SettlementBlockData; workers: WikiWorker[] } | null): SceneState {
  const sansVie = { ...scene };
  delete sansVie.life;
  if (!entrees) return sansVie;
  const life: SceneLife = { locationId: scene.locationId, ...entrees, computed: [], news: [] };
  return appliquer({ ...sansVie, life }, life, { nouvelles: false });
}

/**
 * Recalcule la présence à l'heure de la scène. Rien en combat (on ne fait
 * pas sortir un adversaire parce que l'heure tourne), rien si la vie a été
 * lue pour un autre lieu.
 */
export function rafraichirLaVie(scene: SceneState): SceneState {
  const life = scene.life;
  if (!life || life.locationId !== scene.locationId || scene.activeCombatId) return scene;
  return appliquer(scene, life, { nouvelles: true });
}

function appliquer(scene: SceneState, life: SceneLife, options: { nouvelles: boolean }): SceneState {
  const avant = visibles(scene);
  const maintenant = calculer(scene, life);
  const nouveaux = new Map(maintenant.map((c) => [c.id, c]));
  const precedents = new Map(life.computed.map((c) => [c.id, c]));

  // Ceux que le moteur avait fait entrer et qui ne sont plus là s'en vont.
  const partis = new Set([...precedents.keys()].filter((id) => !nouveaux.has(id)));
  // Une pièce ne change que si le calcul la change : quelqu'un qui a suivi le personnage reste où il l'a suivi.
  const nouvellePiece = (id: string): string | null | undefined => {
    const c = nouveaux.get(id);
    const p = precedents.get(id);
    return c && p && c.room !== p.room ? c.room : undefined;
  };

  let present = scene.present
    .filter((p) => !partis.has(p.entityId))
    .map((p) => {
      const room = nouvellePiece(p.entityId);
      return room === undefined ? p : { ...p, room };
    });
  let sketches = scene.sketches
    .filter((s) => !partis.has(s.id))
    .map((s) => {
      const room = nouvellePiece(s.id);
      return room === undefined ? s : { ...s, room };
    });

  for (const c of maintenant) {
    if (precedents.has(c.id)) continue;
    if (c.entityId) {
      if (!present.some((p) => p.entityId === c.entityId)) present = [...present, { entityId: c.entityId, zone: "near", room: c.room }];
    } else if (!sketches.some((s) => s.id === c.id)) {
      sketches = [...sketches, { id: c.id, name: c.name, trait: c.trait, zone: "near", timesSpoken: 0, locationId: scene.locationId, room: c.room }];
    }
  }

  const apres: SceneState = { ...scene, present, sketches };
  const vus = visibles(apres);
  const { arrived, left } = presenceDiff([...avant.keys()], [...vus.keys()]);
  const nouvelles: SceneNews[] = options.nouvelles
    ? [
        ...arrived.map((id) => ({ id, name: vus.get(id) || null, change: "arrive" as const, told: false })),
        ...left.map((id) => ({ id, name: avant.get(id) || null, change: "leave" as const, told: false })),
      ]
    : [];
  const news = [...life.news, ...nouvelles].slice(-NEWS_KEPT);
  return { ...apres, life: { ...life, computed: maintenant.map((c) => ({ id: c.id, room: c.room })), news } };
}

/** La graine d'une personne calculée (`calc-<graine>`), `null` pour tout autre identifiant. */
export function graineCalculee(id: string): number | null {
  const m = /^calc-(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
}

/** Le rôle de la personne calculée de cette graine dans le lieu, aujourd'hui (`head`, `staff`, `regular`…), `null` si elle n'en est pas. */
export function roleCalcule(scene: SceneState, seed: number): Occupant["role"] | null {
  const life = scene.life;
  if (!life || life.locationId !== scene.locationId) return null;
  return attachedPeople(life.settlement, { key: life.locationId, type: life.placeType }, scene.time.day, life.workers).find((o) => o.seed === seed)?.role ?? null;
}

/**
 * V3.2-45 — Une personne calculée s'est ancrée dans le wiki : elle devient
 * un PNJ qui travaille ou passe là avec sa graine (`workers`), pour que le
 * moteur la fasse aller et venir sous sa nouvelle identité, sans jamais
 * refaire surgir son esquisse.
 */
export function ancrerPersonneCalculee(scene: SceneState, params: { sketchId: string; entityId: string }): SceneState {
  const seed = graineCalculee(params.sketchId);
  const life = scene.life;
  if (seed === null || !life) return scene;
  return {
    ...scene,
    life: {
      ...life,
      workers: [...life.workers.filter((w) => w.entityId !== params.entityId), { entityId: params.entityId, seed }],
      computed: life.computed.map((c) => (c.id === params.sketchId ? { ...c, id: params.entityId } : c)),
    },
  };
}

/** Les nouvelles pas encore racontées. */
export function nouvellesNonDites(scene: SceneState): SceneNews[] {
  return (scene.life?.news ?? []).filter((n) => !n.told);
}

/** Toutes les nouvelles deviennent dites (après la narration qui les a reçues). */
export function marquerDites(scene: SceneState): SceneState {
  if (!scene.life || nouvellesNonDites(scene).length === 0) return scene;
  return { ...scene, life: { ...scene.life, news: scene.life.news.map((n) => ({ ...n, told: true })) } };
}

/** Une nouvelle en phrase, pour les faits établis du tour (« aubergiste, d'âge mûr arrive »). */
export function phraseDeNouvelle(name: string, change: SceneNews["change"]): string {
  return change === "arrive" ? `${name} arrive près du personnage.` : `${name} s'en va.`;
}

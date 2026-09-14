import { describe, it, expect } from "vitest";
import { planMusicAttachments, type MusicAttachmentBlock } from "./blockAttachment";

function bloc(id: string, blockType: string, label = id): MusicAttachmentBlock {
  return { id, blockType, display: { label }, data: {} };
}

function musique(
  id: string,
  options: {
    tracks?: { id: string; url: string; title?: string }[];
    autoplayOnVisit?: boolean;
    label?: string;
    fadeInMs?: number;
    fadeOutMs?: number;
    loop?: boolean;
  } = {}
): MusicAttachmentBlock {
  return {
    id,
    blockType: "music",
    display: { label: options.label ?? "Station" },
    data: {
      __v: 1,
      tracks: options.tracks ?? [{ id: `${id}-p1`, url: "https://youtu.be/j940HnlMM8k" }],
      autoplayOnVisit: options.autoplayOnVisit ?? false,
      fadeInMs: options.fadeInMs ?? 1500,
      fadeOutMs: options.fadeOutMs ?? 1500,
      loop: options.loop ?? false,
    },
  };
}

describe("planMusicAttachments (V2.1-6)", () => {
  it("retire les blocs music du fil et laisse les autres dans l'ordre", () => {
    const { contentBlocks, attachments } = planMusicAttachments([
      bloc("a", "text"),
      musique("m1"),
      bloc("b", "infobox"),
    ]);
    expect(contentBlocks.map((b) => b.id)).toEqual(["a", "b"]);
    expect(attachments).toHaveLength(1);
  });

  it("rend un bouton par bloc musique, dans l'ordre de la fiche", () => {
    const { attachments } = planMusicAttachments([musique("m1"), bloc("a", "text"), musique("m2")]);
    expect(attachments.map((a) => a.blockId)).toEqual(["m1", "m2"]);
  });

  it("la position du bloc dans la fiche ne change rien : le bouton vit au titre", () => {
    const enTete = planMusicAttachments([musique("m1"), bloc("a", "text")]);
    const enQueue = planMusicAttachments([bloc("a", "text"), musique("m1")]);
    expect(enTete.attachments).toEqual(enQueue.attachments);
  });

  it("ignore un bloc musique sans aucune piste — il n'y aurait rien a lancer", () => {
    const { attachments } = planMusicAttachments([bloc("a", "text"), musique("m1", { tracks: [] })]);
    expect(attachments).toEqual([]);
  });

  it("remonte toutes les pistes du bloc, dans l'ordre — c'est ce que le lecteur enchaine (lot 2)", () => {
    const { attachments } = planMusicAttachments([
      bloc("a", "text"),
      musique("m1", {
        tracks: [
          { id: "p1", url: "https://youtu.be/aaa" },
          { id: "p2", url: "https://youtu.be/bbb" },
        ],
      }),
    ]);
    expect(attachments).toHaveLength(1);
    expect(attachments[0].tracks.map((t) => t.id)).toEqual(["p1", "p2"]);
  });

  it("reporte les fondus du bloc", () => {
    const { attachments } = planMusicAttachments([bloc("a", "text"), musique("m1", { fadeInMs: 400, fadeOutMs: 2500 })]);
    expect(attachments[0].fadeInMs).toBe(400);
    expect(attachments[0].fadeOutMs).toBe(2500);
  });

  it("donne aux blocs anterieurs au lot 2 les memes fondus qu'a un bloc neuf, jamais un fondu eteint", () => {
    const ancien: MusicAttachmentBlock = {
      id: "m1",
      blockType: "music",
      display: { label: "Station" },
      data: { __v: 1, tracks: [{ id: "p1", url: "https://youtu.be/aaa" }] },
    };
    const { attachments } = planMusicAttachments([ancien]);
    expect(attachments[0].fadeInMs).toBe(1500);
    expect(attachments[0].fadeOutMs).toBe(1500);
  });

  it("reporte la boucle du bloc", () => {
    const { attachments } = planMusicAttachments([musique("m1", { loop: true }), musique("m2")]);
    expect(attachments.map((a) => a.loop)).toEqual([true, false]);
  });

  it("ne fait pas boucler les blocs anterieurs a l'option — ils s'arretaient, ils s'arretent", () => {
    const ancien: MusicAttachmentBlock = {
      id: "m1",
      blockType: "music",
      display: { label: "Station" },
      data: { __v: 1, tracks: [{ id: "p1", url: "https://youtu.be/aaa" }] },
    };
    const { attachments } = planMusicAttachments([ancien]);
    expect(attachments[0].loop).toBe(false);
  });

  it("borne un fondu aberrant plutot que de le transmettre au lecteur", () => {
    const { attachments } = planMusicAttachments([
      musique("m1", { fadeInMs: 99999, fadeOutMs: -30 }),
      musique("m2", { fadeInMs: Number.NaN }),
    ]);
    expect(attachments[0].fadeInMs).toBe(5000);
    expect(attachments[0].fadeOutMs).toBe(0);
    expect(attachments[1].fadeInMs).toBe(1500);
  });

  it("un seul bloc demarre a la visite : le premier dans l'ordre de la fiche", () => {
    const { attachments } = planMusicAttachments([
      bloc("a", "text"),
      musique("m1", { autoplayOnVisit: true }),
      bloc("b", "text"),
      musique("m2", { autoplayOnVisit: true }),
    ]);
    expect(attachments.map((a) => a.autoplay)).toEqual([true, false]);
  });

  it("un bloc coche mais sans piste ne consomme pas le droit de demarrer", () => {
    const { attachments } = planMusicAttachments([
      bloc("a", "text"),
      musique("vide", { tracks: [], autoplayOnVisit: true }),
      musique("m2", { autoplayOnVisit: true }),
    ]);
    expect(attachments).toHaveLength(1);
    expect(attachments[0].autoplay).toBe(true);
  });

  it("aucune lecture automatique quand aucun bloc n'est coche", () => {
    const { attachments } = planMusicAttachments([bloc("a", "text"), musique("m1"), musique("m2")]);
    expect(attachments.every((a) => a.autoplay === false)).toBe(true);
  });

  it("traite l'absence du champ autoplayOnVisit comme un refus (blocs anterieurs a V2.1-6)", () => {
    const ancien: MusicAttachmentBlock = {
      id: "m1",
      blockType: "music",
      display: { label: "Station" },
      data: { __v: 1, tracks: [{ id: "p1", url: "https://youtu.be/aaa" }] },
    };
    const { attachments } = planMusicAttachments([bloc("a", "text"), ancien]);
    expect(attachments[0].autoplay).toBe(false);
  });

  it("porte le libelle du bloc, qui nomme la station", () => {
    const { attachments } = planMusicAttachments([bloc("a", "text"), musique("m1", { label: "Taverne" })]);
    expect(attachments[0].label).toBe("Taverne");
  });

  it("laisse le fil intact quand la fiche ne porte aucun bloc musique", () => {
    const blocks = [bloc("a", "text"), bloc("b", "image"), bloc("c", "infobox")];
    const { contentBlocks, attachments } = planMusicAttachments(blocks);
    expect(contentBlocks).toEqual(blocks);
    expect(attachments).toEqual([]);
  });
});

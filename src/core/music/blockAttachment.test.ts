import { describe, it, expect } from "vitest";
import { planMusicAttachments, type MusicAttachmentBlock } from "./blockAttachment";

function bloc(id: string, blockType: string, label = id): MusicAttachmentBlock {
  return { id, blockType, display: { label }, data: {} };
}

function musique(
  id: string,
  options: { tracks?: { id: string; url: string; title?: string }[]; autoplayOnVisit?: boolean; label?: string } = {}
): MusicAttachmentBlock {
  return {
    id,
    blockType: "music",
    display: { label: options.label ?? "Station" },
    data: {
      __v: 1,
      tracks: options.tracks ?? [{ id: `${id}-p1`, url: "https://youtu.be/j940HnlMM8k" }],
      autoplayOnVisit: options.autoplayOnVisit ?? false,
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

  it("ne retient que la premiere piste du bloc (lot 1 : pas d'enchainement)", () => {
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
    expect(attachments[0].trackId).toBe("p1");
    expect(attachments[0].trackUrl).toBe("https://youtu.be/aaa");
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

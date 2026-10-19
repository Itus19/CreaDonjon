import { describe, expect, it } from "vitest";
import { nextWriter } from "./nextWriter";

/**
 * V3.1-43, ajout (1) « à qui le tour » : la feuille « Assigner le devoir »
 * propose la personne qui n'a pas écrit depuis le plus longtemps. Ordre :
 * jamais écrit > dernier texte le plus ancien > égalité par nom.
 */
const roster = [
  { userId: "u-ines", name: "Inès" },
  { userId: "u-bruno", name: "Bruno" },
  { userId: "u-ana", name: "Ana" },
];

describe("nextWriter", () => {
  it("personne n'a jamais écrit : la première par nom", () => {
    expect(nextWriter(roster, [])).toBe("u-ana");
  });

  it("qui n'a jamais écrit passe avant qui a écrit, même il y a longtemps", () => {
    const entries = [
      { assignedTo: "u-ana", status: "written" as const, writtenAt: "2026-01-01T10:00:00Z" },
      { assignedTo: "u-bruno", status: "written" as const, writtenAt: "2026-09-01T10:00:00Z" },
    ];
    expect(nextWriter(roster, entries)).toBe("u-ines");
  });

  it("tout le monde a écrit : le dernier texte le plus ancien ; seul le plus récent texte de chacun compte", () => {
    const entries = [
      { assignedTo: "u-ana", status: "written" as const, writtenAt: "2026-01-01T10:00:00Z" },
      { assignedTo: "u-ana", status: "written" as const, writtenAt: "2026-10-01T10:00:00Z" },
      { assignedTo: "u-bruno", status: "written" as const, writtenAt: "2026-05-01T10:00:00Z" },
      { assignedTo: "u-ines", status: "written" as const, writtenAt: "2026-07-01T10:00:00Z" },
    ];
    expect(nextWriter(roster, entries)).toBe("u-bruno");
  });

  it("un devoir en attente n'est pas un texte écrit", () => {
    const entries = [
      { assignedTo: "u-ana", status: "pending" as const, writtenAt: null },
      { assignedTo: "u-bruno", status: "written" as const, writtenAt: "2026-05-01T10:00:00Z" },
      { assignedTo: "u-ines", status: "written" as const, writtenAt: "2026-07-01T10:00:00Z" },
    ];
    expect(nextWriter(roster, entries)).toBe("u-ana");
  });

  it("égalité de date : par nom", () => {
    const meme = "2026-05-01T10:00:00Z";
    const entries = roster.map((r) => ({ assignedTo: r.userId, status: "written" as const, writtenAt: meme }));
    expect(nextWriter(roster, entries)).toBe("u-ana");
  });

  it("personne à proposer : null", () => {
    expect(nextWriter([], [])).toBeNull();
  });
});

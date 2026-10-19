import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NextSessionPanel from "./NextSessionPanel";

type Initial = ComponentProps<typeof NextSessionPanel>["initial"];

/** Une demande ouverte et deux séances à venir : de quoi faire apparaître tout outil MJ s'il y en avait un. */
const initial = {
  openData: {
    campaignId: "c1",
    request: { id: "r1", title: "Séance d'octobre", candidate_dates: ["2026-10-17", "2026-10-18"], starts_at: "14:00:00", ends_at: "22:00:00" },
    hasResponded: false,
    myResponses: [],
  },
  board: {
    request: { id: "r1", title: "Séance d'octobre", candidate_dates: ["2026-10-17", "2026-10-18"], starts_at: "14:00:00", ends_at: "22:00:00" },
    // Un jour complet : côté MJ, c'est lui qui porte un « Confirmer » plein.
    days: [{ date: "2026-10-17", count: 4, expected: 4, start: 840, end: 1320, durationMinutes: 480, category: "full", people: [], respondentCount: 4 }],
    heatmap: null,
    expected: 4,
    viewerId: "u1",
    targetMinutes: 300,
  },
  upcoming: [
    { id: "s1", scheduled_date: "2026-10-24", starts_at: "19:00:00", duration_minutes: 240 },
    { id: "s2", scheduled_date: "2026-11-07", starts_at: "19:00:00", duration_minutes: 240 },
  ],
  past: [{ id: "s0", scheduled_date: "2026-09-27", starts_at: "19:00:00", duration_minutes: 300 }],
} as unknown as Initial;

describe("NextSessionPanel (joueuse)", () => {
  const html = renderToStaticMarkup(createElement(NextSessionPanel, { worldSlug: "faerun", initial }));

  it("montre la demande ouverte et les séances", () => {
    expect(html).toContain("Séance d&#x27;octobre");
    expect(html).toContain("Séances à venir");
    expect(html).toContain("Déjà jouées");
    expect(html).toContain("Les dates qui se dessinent");
  });

  it("ne contient aucun outil MJ", () => {
    for (const interdit of ["Annuler la demande", "Confirmer", "Régler une date", "Annuler", "Durée visée", "durée visée"]) {
      expect(html).not.toContain(interdit);
    }
  });
});

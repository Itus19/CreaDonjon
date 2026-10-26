import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import MusicBlockEditor from "@/components/blocks/MusicBlockEditor";
import { MusicPlaybackProvider } from "@/components/shell/MusicPlaybackContext";
import type { MusicBlockData } from "@/src/core/schemas/blocks/music";
import messages from "@/messages/fr.json";

const donnee: MusicBlockData = {
  __v: 1,
  autoplayOnVisit: false,
  loop: true,
  fadeInMs: 1500,
  fadeOutMs: 2000,
  tracks: [
    { id: "y", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Arrivée du méchant", startSeconds: 12 },
    { id: "s", url: "https://open.spotify.com/track/abc", title: "Taverne" },
  ],
};

function rendre(data: MusicBlockData, onChange = vi.fn()): string {
  return renderToStaticMarkup(
    // eslint-disable-next-line react/no-children-prop
    createElement(NextIntlClientProvider, {
      locale: "fr",
      messages,
      // eslint-disable-next-line react/no-children-prop
      children: createElement(MusicPlaybackProvider, {
        children: createElement(MusicBlockEditor, { data, onChange, blockId: "b" }),
      }),
    }),
  );
}
const enTexte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#?\w+;/g, " ").replace(/\s+/g, " ");

describe("Musique : rendu", () => {
  const onChange = vi.fn();
  const html = rendre(donnee, onChange);
  const texte = enTexte(html);

  it("la platine en tête : titre, service, fondus de ce service, bornes", () => {
    expect(texte).toContain("Arrivée du méchant");
    expect(texte).toContain("YouTube");
    expect(texte).toContain("fondu entrant 1,5 s, sortant 2 s");
    expect(texte).toContain("joue 0:12 → fin");
  });
  it("la liste : bornes sous le nom, poignées réservées aux fenêtres larges", () => {
    expect(texte).toContain("0:12 → fin");
    expect(html).toContain("hidden shrink-0 cursor-grab");
    expect(html).toContain("@md/bloc:block");
  });
  it("les trois interrupteurs et les deux pas-à-pas avec « YouTube seulement »", () => {
    expect(texte).toContain("Lancer à la visite de la fiche");
    expect(texte).toContain("En boucle");
    expect(texte).toContain("Fondus (YouTube)");
    expect(texte).toContain("Fondu entrant");
    expect(texte).toContain("1,5 s");
    expect(texte).toContain("2 s");
    expect(texte).toContain("YouTube seulement");
  });
  it("le rappel sous le bloc, et rien d'écrit au montage", () => {
    expect(texte).toContain("Sur la page de lecture, le bloc ne s");
    expect(texte).toContain("affiche pas");
    expect(onChange).not.toHaveBeenCalled();
  });
  it("sans YouTube, la platine dit pourquoi il n'y a pas de fondu", () => {
    const seul = rendre({ ...donnee, tracks: [donnee.tracks[1]] });
    expect(enTexte(seul)).toContain("pas de fondu : Spotify ne le permet pas");
  });
  it("les réglages d'une piste (⋯) ne sont pas ouverts d'office", () => {
    expect(texte).not.toContain("Commencer à");
    expect(html).toContain('aria-expanded="false"');
  });
});

describe("Musique : progression (V3.1-146)", () => {
  it("aucune barre ni durée tant que rien ne joue, YouTube ou Spotify", () => {
    expect(rendre(donnee)).not.toContain("progressbar");
    const spotifyDabord = { ...donnee, tracks: [donnee.tracks[1]!, donnee.tracks[0]!] };
    const html = rendre(spotifyDabord);
    expect(html).not.toContain("progressbar");
    expect(enTexte(html)).not.toMatch(/\d:\d\d \/ \d:\d\d/);
  });
});


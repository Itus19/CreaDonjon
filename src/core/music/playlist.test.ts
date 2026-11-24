import { describe, expect, it } from "vitest";
import { indexDepart, morceauVoisin } from "./playlist";
import { youtubePlaylistId } from "./embedUrl";

describe("playlist YouTube (AG-20)", () => {
  it("reconnaît une playlist, seule ou avec une vidéo de départ", () => {
    expect(youtubePlaylistId("https://www.youtube.com/playlist?list=PL123abc")).toBe("PL123abc");
    expect(youtubePlaylistId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123abc")).toBe("PL123abc");
    expect(youtubePlaylistId("https://music.youtube.com/playlist?list=OLAK5uy")).toBe("OLAK5uy");
  });

  it("refuse une vidéo seule, un autre hôte ou un paramètre vide", () => {
    expect(youtubePlaylistId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youtubePlaylistId("https://evil.example/playlist?list=PL123")).toBeNull();
    expect(youtubePlaylistId("https://www.youtube.com/playlist?list=")).toBeNull();
    expect(youtubePlaylistId("pas une url")).toBeNull();
  });

  it("part de la vidéo du lien quand elle est dans la playlist, sinon du premier morceau", () => {
    expect(indexDepart(["a", "b", "c"], "b")).toBe(1);
    expect(indexDepart(["a", "b", "c"], "z")).toBe(0);
    expect(indexDepart(["a", "b", "c"], null)).toBe(0);
  });

  it("précédent et suivant restent dans la liste ; après le dernier, plus rien", () => {
    expect(morceauVoisin(1, 3, 1)).toBe(2);
    expect(morceauVoisin(2, 3, 1)).toBeNull();
    expect(morceauVoisin(0, 3, -1)).toBe(0);
    expect(morceauVoisin(2, 3, -1)).toBe(1);
    expect(morceauVoisin(0, 0, 1)).toBeNull();
  });
});

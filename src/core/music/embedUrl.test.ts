import { describe, expect, it } from "vitest";
import { detectProvider, toEmbedUrl } from "./embedUrl";

describe("detectProvider", () => {
  it("reconnait les trois fournisseurs autorises", () => {
    expect(detectProvider("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC")).toBe("spotify");
    expect(detectProvider("https://soundcloud.com/artiste/titre")).toBe("soundcloud");
    expect(detectProvider("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("youtube");
    expect(detectProvider("https://youtu.be/dQw4w9WgXcQ")).toBe("youtube");
  });

  it("refuse un hôte hors liste — c'est le controle anti-injection du ticket", () => {
    expect(detectProvider("https://evil.example.com/track/x")).toBeNull();
    expect(detectProvider("https://open.spotify.com.evil.com/track/x")).toBeNull();
  });

  it("refuse un protocole non https", () => {
    expect(detectProvider("http://open.spotify.com/track/x")).toBeNull();
  });

  it("refuse une URL malformee sans lever d'exception", () => {
    expect(detectProvider("not a url")).toBeNull();
  });
});

describe("toEmbedUrl", () => {
  it("traduit un lien Spotify de partage en URL d'integration", () => {
    expect(toEmbedUrl("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC")).toBe(
      "https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC"
    );
    expect(toEmbedUrl("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M")).toBe(
      "https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M"
    );
  });

  it("traduit un lien YouTube (video, avec ou sans liste)", () => {
    expect(toEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ"
    );
    expect(toEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(toEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ?list=PL123"
    );
  });

  it("traduit un lien SoundCloud via son widget officiel", () => {
    const url = "https://soundcloud.com/artiste/titre";
    expect(toEmbedUrl(url)).toBe(`https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=false`);
  });

  it("renvoie null pour un lien hors liste ou non traduisible", () => {
    expect(toEmbedUrl("https://evil.example.com/track/x")).toBeNull();
    expect(toEmbedUrl("https://open.spotify.com/")).toBeNull();
  });

  it("ajoute autoplay=1 (YouTube, Spotify) ou auto_play=true (SoundCloud) quand demande — lecteur cache de la radio et du bloc music", () => {
    expect(toEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ", { autoplay: true })).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1"
    );
    expect(toEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123", { autoplay: true })).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ?list=PL123&autoplay=1"
    );
    expect(toEmbedUrl("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", { autoplay: true })).toBe(
      "https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC?autoplay=1"
    );
    const url = "https://soundcloud.com/artiste/titre";
    expect(toEmbedUrl(url, { autoplay: true })).toBe(
      `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=true`
    );
  });

  it("traduit un lien de radio/mix YouTube (v + list=RD...) — c'est le format d'une playlist demarree depuis une video", () => {
    expect(
      toEmbedUrl("https://www.youtube.com/watch?v=XuMqqaq0unM&list=RDXuMqqaq0unM&start_radio=1", { autoplay: true })
    ).toBe("https://www.youtube.com/embed/XuMqqaq0unM?list=RDXuMqqaq0unM&autoplay=1");
  });
});

import { describe, expect, it } from "vitest";
import { detectProvider, toEmbedUrl, youtubeVideoId } from "./embedUrl";

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

  it("traduit un lien Spotify localise — le prefixe de langue que Spotify pose lui-meme", () => {
    // Le bouton "Copier le lien" de Spotify rend un chemin prefixe par la
    // langue de l'interface (V2.1-6, trouve sur un vrai lien fourni par
    // l'auteur : `/intl-fr/track/...`). Sans ce cas, la piste s'ajoutait —
    // `detectProvider` ne regarde que l'hote — puis ne jouait rien, en
    // silence : le bouton passait en pause et aucune iframe n'etait montee.
    expect(toEmbedUrl("https://open.spotify.com/intl-fr/track/5aFkncSW2aZuYByqKC0Gse")).toBe(
      "https://open.spotify.com/embed/track/5aFkncSW2aZuYByqKC0Gse"
    );
    expect(toEmbedUrl("https://open.spotify.com/intl-pt-br/album/1DFixLWuPkv3KT3TnV35m3")).toBe(
      "https://open.spotify.com/embed/album/1DFixLWuPkv3KT3TnV35m3"
    );
    // Le parametre `si` de partage ne change rien : seul le chemin compte.
    expect(toEmbedUrl("https://open.spotify.com/intl-fr/track/5aFkncSW2aZuYByqKC0Gse?si=5100c65291354591")).toBe(
      "https://open.spotify.com/embed/track/5aFkncSW2aZuYByqKC0Gse"
    );
  });

  it("n'accepte pas n'importe quel segment avant le type de ressource", () => {
    // Le prefixe tolere est celui de Spotify, pas un joker : un chemin
    // arbitraire reste non traduisible plutot que de faire deviner un
    // identifiant au hasard.
    expect(toEmbedUrl("https://open.spotify.com/nimporte/track/abc123")).toBeNull();
    expect(toEmbedUrl("https://open.spotify.com/intl-francais/track/abc123")).toBeNull();
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

describe("youtubeVideoId (V2.1-6, lot 2)", () => {
  it("extrait l'identifiant des deux formes de lien YouTube", () => {
    expect(youtubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeVideoId("https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RD123")).toBe("dQw4w9WgXcQ");
  });

  it("ignore les parametres de suivi colles au lien partage", () => {
    expect(youtubeVideoId("https://youtu.be/j940HnlMM8k?si=BbyYnFYZnA6Weaos")).toBe("j940HnlMM8k");
  });

  it("renvoie null pour un autre fournisseur — c'est ce qui decide du repli sur l'iframe bete", () => {
    expect(youtubeVideoId("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC")).toBeNull();
    expect(youtubeVideoId("https://soundcloud.com/artiste/titre")).toBeNull();
  });

  it("renvoie null pour un hôte mystifie ou une URL malformee", () => {
    expect(youtubeVideoId("https://youtu.be.evil.com/dQw4w9WgXcQ")).toBeNull();
    expect(youtubeVideoId("pas une url")).toBeNull();
  });

  it("renvoie null pour une page YouTube sans video (liste seule)", () => {
    expect(youtubeVideoId("https://www.youtube.com/playlist?list=PL123")).toBeNull();
  });
});

describe("toEmbedUrl : bornes debut/fin (V2.1-6, lot 2)", () => {
  it("pose start et end sur un lien YouTube", () => {
    expect(toEmbedUrl("https://youtu.be/dQw4w9WgXcQ", { startSeconds: 80, endSeconds: 220 })).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ?start=80&end=220"
    );
  });

  it("accepte une borne sans l'autre", () => {
    expect(toEmbedUrl("https://youtu.be/dQw4w9WgXcQ", { startSeconds: 80 })).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ?start=80"
    );
    expect(toEmbedUrl("https://youtu.be/dQw4w9WgXcQ", { endSeconds: 220 })).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ?end=220"
    );
  });

  it("se combine avec autoplay et avec une liste", () => {
    expect(
      toEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123", { autoplay: true, startSeconds: 5 })
    ).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ?list=PL123&autoplay=1&start=5");
  });

  it("ignore les bornes sur Spotify et SoundCloud — aucun des deux ne sait les honorer", () => {
    expect(toEmbedUrl("https://open.spotify.com/track/abc123", { startSeconds: 80, endSeconds: 220 })).toBe(
      "https://open.spotify.com/embed/track/abc123"
    );
    expect(toEmbedUrl("https://soundcloud.com/artiste/titre", { startSeconds: 80 })).toBe(
      "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fartiste%2Ftitre&auto_play=false"
    );
  });

  it("ignore une borne absurde plutot que de la transmettre", () => {
    // Une fin avant le debut, ou un nombre negatif, donnerait un lecteur
    // bloque a l'arret sans le moindre message : on ne pose que ce qui a un sens.
    expect(toEmbedUrl("https://youtu.be/dQw4w9WgXcQ", { startSeconds: 200, endSeconds: 100 })).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ?start=200"
    );
    expect(toEmbedUrl("https://youtu.be/dQw4w9WgXcQ", { startSeconds: -5 })).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ"
    );
  });
});

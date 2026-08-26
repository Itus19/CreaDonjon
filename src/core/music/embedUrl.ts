/**
 * Bloc `music` (V2-G3) : jamais de fichier audio heberge par nous — un
 * lien vers une plateforme sous licence (Spotify, SoundCloud, YouTube),
 * comme n'importe quel site qui integre une video YouTube. Domaine valide
 * contre une liste fermee (sinon c'est un vecteur d'injection, un `src`
 * d'iframe arbitraire) ; le fournisseur n'est jamais stocke tel quel cote
 * client, toujours redetecte depuis l'URL — un `provider` declare qui ne
 * correspond pas a l'URL reelle n'a aucune prise ici.
 */

export const MUSIC_PROVIDERS = ["spotify", "soundcloud", "youtube"] as const;
export type MusicProvider = (typeof MUSIC_PROVIDERS)[number];

const ALLOWED_HOSTS: Record<MusicProvider, readonly string[]> = {
  spotify: ["open.spotify.com"],
  youtube: ["www.youtube.com", "youtube.com", "youtu.be", "music.youtube.com"],
  soundcloud: ["soundcloud.com", "www.soundcloud.com"],
};

/** `null` si l'URL est malformee ou son hôte hors de la liste autorisee — jamais une exception, un lien invalide est un refus ordinaire. */
export function detectProvider(url: string): MusicProvider | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  for (const provider of MUSIC_PROVIDERS) {
    if (ALLOWED_HOSTS[provider].includes(parsed.hostname)) return provider;
  }
  return null;
}

/**
 * Traduit un lien "de partage" (ce qu'on copie depuis l'app du fournisseur)
 * en URL d'integration (`/embed/...`) — les deux formes different a chaque
 * fournisseur. `null` si l'URL est reconnue comme venant du bon hôte mais
 * dans une forme qu'on ne sait pas traduire (ex. page d'accueil Spotify
 * sans piste).
 *
 * `autoplay` sert le lecteur cache (radio d'arriere-plan, bloc `music`) :
 * le clic sur le bouton Lecture est le geste utilisateur qui autorise la
 * lecture automatique dans l'iframe (`allow="autoplay"` sur l'iframe,
 * navigateur declenche par ce geste) — sans lui, chaque fournisseur
 * afficherait sa vignette figee en attente d'un second clic a l'interieur
 * du lecteur, invisible ici puisque l'iframe est masquee.
 */
export function toEmbedUrl(url: string, options?: { autoplay?: boolean }): string | null {
  const provider = detectProvider(url);
  if (!provider) return null;
  const parsed = new URL(url);
  const autoplay = options?.autoplay ?? false;

  switch (provider) {
    case "spotify": {
      const match = parsed.pathname.match(/^\/(track|playlist|album|artist|episode|show)\/([a-zA-Z0-9]+)/);
      if (!match) return null;
      return `https://open.spotify.com/embed/${match[1]}/${match[2]}${autoplay ? "?autoplay=1" : ""}`;
    }
    case "youtube": {
      let videoId: string | null = null;
      if (parsed.hostname === "youtu.be") {
        videoId = parsed.pathname.slice(1) || null;
      } else {
        videoId = parsed.searchParams.get("v");
      }
      const listId = parsed.searchParams.get("list");
      const params = new URLSearchParams();
      if (listId) params.set("list", listId);
      if (autoplay) params.set("autoplay", "1");
      const query = params.toString();
      if (videoId) return `https://www.youtube.com/embed/${videoId}${query ? `?${query}` : ""}`;
      if (listId) return `https://www.youtube.com/embed/videoseries?${query}`;
      return null;
    }
    case "soundcloud":
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=${autoplay}`;
  }
}

export const PROVIDER_LABELS: Record<MusicProvider, string> = {
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  youtube: "YouTube",
};

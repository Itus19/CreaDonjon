# 0022 — Lecteur YouTube piloté : le fondu contre l'iframe bête

**Date :** 2026-09-14
**Statut :** acceptée

## Contexte

V2-G3 a construit la lecture de musique sur un choix explicite, écrit dans
`components/shell/MusicPlaybackContext.tsx` : **une iframe cachée, démontée et
remontée au changement de source, sans dépendre d'un SDK par plateforme**. Une
seule iframe existe pour toute l'application, ce qui donne gratuitement
l'exclusion mutuelle entre la radio d'arrière-plan et les blocs `music` — en
démarrer une en démonte forcément une autre.

V2.1-6 demande un **fondu entrant et sortant**, par analogie avec le `fadeMs`
du bloc `image`. L'analogie ne tient pas : le fondu d'une image de fond est
une transition CSS sur *notre* élément, gratuite ; le son vit dans une iframe
d'un **autre domaine**, dont la politique d'origine nous interdit de toucher le
volume. Il n'existe aucun équivalent CSS, aucun attribut HTML, aucun moyen
côté parent.

Le fondu est donc impossible **tant que le lecteur reste une iframe bête**. La
décision de V2-G3 doit être rouverte, ou la demande abandonnée.

L'auteur a par ailleurs demandé, dans le même mouvement, l'enchaînement des
pistes d'un bloc et des bornes début/fin par piste. Les trois besoins ont la
même serrure et la même clé.

## Options

**A. Renoncer au fondu.** Zéro coût, zéro risque, et la règle « une seule
iframe » reste vraie. Rejeté : la demande est explicite et répétée.

**B. Une API JS par fournisseur.** Couvre le plus de cas, mais Spotify —
vérifié — n'expose pas le volume dans son API d'embed : le fondu y resterait
impossible quoi qu'on fasse. Trois intégrations à écrire et à maintenir pour
un résultat qui reste inégal. Rejeté.

**C. L'IFrame Player API de YouTube seulement, avec repli sur l'iframe
actuelle.** Retenu, sur choix explicite de l'auteur.

## Décision

Charger `https://www.youtube.com/iframe_api` **à la demande**, et seulement
quand une piste YouTube est effectivement jouée. Une piste Spotify ou
SoundCloud continue de passer par l'iframe actuelle, inchangée.

Ce seul script débloque les trois demandes d'un coup :

| Besoin | Ce qui le permet |
|---|---|
| Fondu | `setVolume(0-100)`, appelé par paliers |
| Enchaînement | `onStateChange` → `ENDED` |
| Bornes début/fin | `loadVideoById({ videoId, startSeconds, endSeconds })` |

**La règle « une seule iframe » devient « une seule source active ».** Un
fondu croisé — choix de l'auteur contre un enchaînement séquentiel — exige que
l'ancienne source vive pendant que la nouvelle monte. Deux lecteurs coexistent
donc le temps de la transition, l'ancien étant détruit une fois son volume à
zéro. L'exclusion mutuelle avec la radio est préservée, mais elle n'est plus un
effet de bord du démontage : elle devient une règle tenue explicitement par le
fournisseur de contexte.

Aucune dépendance npm n'est ajoutée. Le script est tiers, chargé depuis un
domaine Google.

## Conséquences

- **Le comportement devient inégal selon le lien collé.** Une piste YouTube
  sait se fondre, s'enchaîner et se borner ; une piste Spotify ou SoundCloud
  ne sait rien de tout cela. L'éditeur doit le dire à côté du lien concerné,
  plutôt que d'afficher des réglages sans effet. C'est le prix direct de
  l'option C, accepté en connaissance de cause.
- **Un script tiers entre sur le wiki public**, y compris pour un visiteur
  anonyme de `/partage`. Signalé à l'auteur, qui a maintenu les trois pages de
  lecture dans le périmètre. Atténué par le chargement à la demande : une
  fiche sans bloc musique YouTube ne le télécharge pas.
- **`endSeconds` est approximatif à la seconde près.** Ce n'est pas un point
  de montage : ne pas promettre une précision d'édition audio.
- **Le calcul du fondu ne vit pas dans le composant.** La rampe de volume est
  une fonction pure de `src/core/music/fade.ts`, testée — le lecteur ne fait
  que l'appliquer. C'est ce qui permet d'éprouver la partie difficile sans
  navigateur ni réseau.
- **La radio d'arrière-plan ne change pas.** Les durées de fondu sont portées
  par la source qu'on lance, pas par le lecteur : la radio n'en fournit
  aucune, donc son comportement reste exactement celui d'aujourd'hui.
- Si un jour SoundCloud devient nécessaire, son API expose bien `setVolume` :
  l'ajouter sera une extension de ce même modèle, pas un nouveau renversement.

# 0120 — L'écran de jeu : rail de jeu, volet de consultation, volet d'une personne

**Date :** 2026-11-27
**Statut :** acceptée le 27 novembre 2026 (choix de l'auteur dans le fil « Repenser les écrans solo et à distance », maquettes à l'appui). Livrée par V3.2-55 à 68 (`docs/backlog-v3.2/09-ecran-de-jeu.md`).

Maquettes : écran entier <https://claude.ai/artifact/PVTf6Lvj167TpHx43vFzPA> (option B, v2) ; volet d'une personne et matrice des données <https://claude.ai/artifact/WBb2ad4MJytXezSDnQmUzs> (v3).

## Contexte

Partie test avec Mabelle, 26 novembre. Un clic sur une règle ou une fiche du wiki fait **quitter la partie** (on change de page). Le rail de l'app garde en jeu des entrées sans objet (Chat, Prochaine session). Le petit volet Monde à onglets est trop étroit pour lire une fiche. Les présents n'ont pas d'endroit où on lit ce qu'on sait d'eux. Attaquer un PNJ n'ouvre pas de combat en solo (seul l'outil du MJ en ouvre un). Les jauges d'attitude ne bougent jamais : aucun tour solo n'écrit d'attitude (V3.2-15 pas fait).

## Options

- **A** : garder les onglets du Monde, lire règles et fiches dedans.
- **B** : en jeu, le rail de l'app devient un **rail de jeu** ; le volet Monde perd ses onglets et devient un **volet de consultation** qui montre ce qu'on a choisi dans le rail.
- **C** : B, plus une bande de scène au-dessus du fil pour les présents.

Retenue **B**, avec les présents en ronds-jauges à la suite dans le rail (pas la bande de C).

## Décision

1. **Rail de jeu** (`/joueur/solo`, ordinateur). Au lieu des destinations de l'app : Quitter, Quêtes, Changements, Wiki, Règles, Notes, Combat, puis les présents (six visages au plus, rangés par distance, puis « +x » qui ouvre la liste groupée au contact ≤ 1,5 m, proche ≤ 9 m, loin), Réglages et le dé. Le rail garde son repli (204 px ↔ 64 px) ; déplié, chaque visage montre son nom et son attitude perçue. Le rail est rendu par `PlayerShell` (même place, même animation) ; son contenu de jeu vient de la page par un portail, parce que les données (scène, quêtes) arrivent avec la page (`docs/CABLAGE.md`, C1). Le MJ à distance garde l'option A (ADR 0103) ; le joueur à distance suivra plus tard.
2. **Volet de consultation** à gauche du fil : 380 px ouvert, 0 fermé, animé en 320 ms ; fermé, le fil prend toute la largeur. Il reste ouvert pendant qu'on joue. Un second clic sur l'entrée active le ferme. Il montre la sélection du rail ; une fiche du wiki ou une règle s'y lit **en entier**, par les routes `/window` existantes, sans quitter la partie.
3. **Combat dans le rail** : l'entrée Combat passe au rouge et pulse quand un combat commence, et ouvre le volet sur le combat ; elle garde l'historique des combats (clic = déroulé round par round). Contour rouge autour de la zone de jeu ; dans le bandeau, une pastille d'état seulement. L'initiative est une pastille de jet dans le fil (rangs des PNJ cachés tant qu'on n'a pas lancé), puis une carte « Ordre d'initiative » dans le fil. Rounds de 6 s, économie d'action en pastilles, distances en mètres (ADR 0059, 0077). **L'ouverture d'un combat en solo** (qui entre, de quel côté, contre qui) est une décision du moteur à écrire dans son propre ADR avant le lot 4.
4. **Volet d'une personne** (clic sur un visage), une seule colonne : grand anneau-jauge (116 px) avec le portrait du wiki dedans (initiales sinon) ; sous le nom, l'état physique (couleurs propres : indemne vert, blessé jaune, en sang rouge, à terre gris, jamais les PV), les conditions, l'humeur visible ; puis « Envers toi », la Fiche (remontée en tête pendant un combat), l'Inventaire vu, la Magie vue, Tempérament, Convictions, Aspirations, Lignes et limites, Façon de parler, Ses liens, Ce qui a changé son attitude, et le lien vers sa page du wiki.
5. **Règle de contenu** (auteur) : tout ce que porte la page du wiki d'une personne se voit dans le volet, **sauf les blocs de texte**, qui restent sur la page ; partout, seul ce que le personnage a découvert s'affiche, jamais ce qui est `gm`. La matrice des 26 types de blocs fait foi (maquette v3). Jamais affichés : PV maximum, FP, point de départ des attitudes, ressources restantes. Aucun indice du genre « il y a autre chose ».
6. **Barres continues avec zone floue** pour toutes les attitudes perçues, attirance comprise, toujours affichée (« rien de perceptible » quand rien ne se voit). Le serveur envoie la **valeur perçue arrondie à 5** et une largeur de flou ; la valeur ressentie ne quitte jamais le serveur (règle 5). Les bandes nommées restent ce que reçoit l'IA (`specs/psyche-pnj.md` §1.5). L'attirance montrée seulement quand elle est positive (ADR 0111) est renversée : on montre aussi « rien de perceptible ».
7. **Une seule table de facettes découvertes** pour la fiche et la psyché : celle de l'ADR 0118 (`entity_facet_discoveries`, V3.2-49), étendue aux facettes de psyché (`pole:<clé>`, `aspiration:<id>`, `line:<id>`, `speech`, `link:<id>`, `worldview:<clé>`, `orientation:<sexual|romantic|relational>`).
8. **Ce que l'IA observe, le moteur l'enregistre.** Façon de parler, objet vu, émotion visible : l'IA les déclare dans sa sortie structurée ; le moteur les confronte au wiki et les écrit comme découverts ; aux tours suivants l'IA les reçoit comme faits établis. Ce que le wiki n'a pas (un tic de langage) est une proposition (`ai_proposals`, règle 9). Le wiki l'emporte toujours.
9. **Classe d'armure estimée** d'après l'armure vue (exacte pour une armure lourde, « armure + ? » sinon), resserrée par les attaques du personnage (touché à 17, raté à 15 : entre 16 et 17). **Sort vu** : « sait lancer des sorts » et ce qu'on a vu ; nommé sur un jet d'Intelligence (Arcanes) dont le moteur fixe le DD (Xanathar : 15 + niveau, à vérifier en 2024). **Bourse** en mots tant qu'on ne l'a pas comptée. **Humeur visible** : un mot par présent dans `scene.disposition`, proposé par l'IA, validé par le moteur, valable pour la scène.
10. **La date** (jour de la semaine, jour, mois, année, saison) précède l'heure dans le bandeau, quand le calendrier du monde a une date du jour ; la même date, saison comprise, entre dans le contexte du tour de l'IA.
11. **Orientation** (retour de l'auteur, 27 novembre) : le bloc `personality` gagne trois champs facultatifs, orientation sexuelle, romantique et relationnelle ; le moteur plafonne l'attirance quand le personnage n'y entre pas. Le défaut pour un PNJ généré est en attente du choix de l'auteur.

## Conséquences

- Pas de migration pour les lots 1 et 3. Le lot 2 s'appuie sur la migration de V3.2-49 (ADR 0118) et sur V3.2-15 (écrire les attitudes) ; le lot 4 attend son ADR moteur.
- `PlayerShell` sait qu'il est sur la page solo et laisse la page remplir le rail ; une page solo sans personnage garde au moins « Quitter ».
- Les tablettes et téléphones gardent leurs dispositions actuelles (onglets, vues `?vue=`) dans ce premier temps.

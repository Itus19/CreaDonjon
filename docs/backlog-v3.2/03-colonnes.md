# V3.2 — Les colonnes du solo

*Partie du backlog V3.2. L'index et la feuille de route : [`docs/BACKLOG_V3.2.md`](../BACKLOG_V3.2.md).*

---

### ☐ V3.2-7 — L'onglet Wiki : chercher et lire sur place · `M` · sans modèle IA — **prêt (Sonnet), Opus relit l'audience**

**Demandé le 18 novembre** : « j'aimerais revoir l'onglet wiki pour qu'il permette de voir la page wiki d'un élément directement dedans. Mais du coup il faudrait un champ de recherche dedans. »

**Aujourd'hui**, la colonne gauche du solo (V3-D3) liste les fiches connues par groupe, et chaque nom est un **lien qui quitte l'écran de jeu** pour l'onglet Wiki. En pleine séance, on perd la scène, le fil, et la place qu'on avait dans le texte — pour relire trois lignes sur une auberge.

**À faire.**
- Un **champ de recherche** en tête de l'onglet. La logique pure existe déjà : `filtrerWiki` (`lib/ui/solo.ts`) filtre les groupes par nom, accents et casse ignorés, et vide les groupes sans résultat. Rien à inventer, juste à poser.
- La fiche **s'ouvre dans la colonne**, sans quitter le jeu : le même composant que la fiche d'accompagnement du cahier (`FicheCompanion`, qui sait déjà afficher une entité ou une règle dans un panneau, et se replie au téléphone en feuille du bas).
- Un retour franc vers la liste, et le fil qui ne bouge pas derrière.

**Ce qu'Opus relit** : l'audience. La colonne ne liste que les fiches **découvertes** (V3-C4) ; ouvrir une fiche sur place doit passer par le même filtrage côté serveur que l'onglet Wiki, jamais par un rendu plus bavard parce qu'il est « dans le jeu » (règle absolue 5).

**Câblage** (`docs/CABLAGE.md`) : la liste arrive déjà avec la page. Le contenu d'une fiche se charge **au clic**, une fois, jamais en masse à l'ouverture de la colonne.

**Critères d'acceptation**
- [ ] Chercher « fan » trouve « Mabelle, du Fanal » ; la fiche s'ouvre dans la colonne ; le fil n'a pas bougé.
- [ ] Une fiche non découverte reste introuvable et illisible.
- [ ] À 390 px, la fiche s'ouvre en feuille du bas et se referme sur la liste.
- [ ] Aucun chargement de plus à l'ouverture de l'écran solo.

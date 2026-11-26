# Backlog VM — 3. La psyché

Spécification : `specs/vie-du-monde.md` §10. Ne dépend pas de la PR #17.

### ☐ VM-12 — Franchise, centres d'intérêt, normes et façades · `M` · sans modèle IA

**Modèle conseillé : Opus** (schéma du bloc, noyau).

- Septième pôle du bloc `personality` : `franchise ↔ dissimulation` (décision de l'auteur, 26 novembre) ; met à jour `specs/psyche-pnj.md` §2.
- Liste commune d'une trentaine de centres d'intérêt, jauge de −100 (dégoût) à +100 (passion), stockage des seules valeurs non nulles (§10.2). La sexualité est une entrée comme une autre, montrée seulement si les romances sont actives, le réglage « Récit » le permet et le personnage est adulte.
- Facette `intimacy` facultative : attirance (genres, aucun, neutre), situation (§10.1).
- Valeur montrée quand elle diffère de la vécue (§10.3), même mécanique que l'ADR 0111 ; normes par ville ; choix se conformer / cacher / assumer / militer, calculé ; le juste milieu calibré par des tests de répartition.
- L'IA reçoit les trois intérêts montrés les plus forts et le dégoût montré le plus fort de chaque présent.

**Critères d'acceptation**
- [ ] Dans une ville tolérante, presque personne n'a de façade ; dans une ville pieuse et répressive, une minorité cache un goût condamné, quelques-uns militent.
- [ ] La valeur vécue ne quitte jamais le serveur.
- [ ] La fiche montre les quatre ou cinq intérêts les plus marqués, le reste se déroule.

**Sous-tâches Haiku** : libellés des intérêts et des bandes dans `messages/`, planche du catalogue.

### ☐ VM-8 — Le questionnaire de psyché à la Ultima IV · `M` · sans modèle IA

**Modèle conseillé : Opus** pour la banque de dilemmes, **Sonnet** pour l'écran.

- Proposé au choix après la création d'un personnage joué ou d'un PNJ, et par un bouton « Passer le questionnaire » sur une fiche existante, avec aperçu avant d'écraser (décision 17).
- Une dizaine de dilemmes tirés d'une banque d'une trentaine (décision 18), chacun lié à deux pôles du tempérament ou des convictions (décision 15).
- Puis les aspirations (listes plus champ libre, décision 16), les centres d'intérêt, et une partie intimité facultative, affichée seulement si les romances sont actives.
- Le résultat se corrige à la main ; l'IA n'y répond jamais à la place de quelqu'un.

**Critères d'acceptation**
- [ ] Un passage complet remplit les pôles, les convictions, trois aspirations et quelques intérêts.
- [ ] La banque de dilemmes est relue par l'auteur avant fusion.
- [ ] Planche du catalogue pour l'écran du questionnaire.

**Sous-tâches Haiku** : libellés, planche du catalogue.

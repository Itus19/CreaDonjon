# Rugosités de novembre

Ce qu'on a constaté en jouant, à partir du 1ᵉʳ novembre. Même règle que le reste de V3.1 : un ticket par constat, taille `S` ou `M`.

---

*V3.1-150 à 154 et 186 sont terminés (`termines.md`).*

### V3.1-187 — La montée de niveau refuse tout personnage qui a une date de naissance (8 novembre)

**Modèle conseillé : Opus** — fait par Opus seul (petit, contexte chargé). Constat de l'auteur : en montant Terk de 2 à 3, l'erreur « La montée de niveau ne peut pas changer l'espèce, l'historique ou l'identité du personnage », alors que rien n'a changé.
- **Cause** : `applyLevelUp` (`src/server/services/characterActions.ts`) comparait la naissance par `JSON.stringify`. La colonne `jsonb` réordonne les clés (`day, end, year, label, month, precision`) ; l'objet reçu, passé par Zod, suit l'ordre du schéma (`year, month, day, precision, end, label`). Chaînes toujours différentes : refus `forbidden_field_change` pour **tout** personnage né. Constaté sur la vraie base (Terk, 21/5/1398, et deux autres fiches).
- **Correction** : `sameGameDate` (`src/core/calendar/sameGameDate.ts`), comparaison champ par champ, `end` et `label` absents valent `null`. 7 tests écrits d'abord, dont la date de Terk telle que Postgres la rend.
- **Vérifié** : typecheck, lint, tests unitaires. Pas de test d'intégration pour la montée de niveau.
- **Reste** : refaire la montée de Terk au navigateur, après déploiement.

### V3.1-188 — Le Wiki du joueur ne s'ouvre plus en édition (9 novembre)

**Modèle conseillé : Opus** — fait par Opus seul (petit, contexte chargé). Demande de l'auteur : quand un joueur peut modifier une fiche, l'édition s'ouvrait aussi dans l'onglet Wiki ; elle ne doit plus vivre que dans l'onglet Édition, le Wiki étant une visualisation comme le public.
- **Page** `app/m/[worldSlug]/joueur/wiki/[entitySlug]/page.tsx` : la branche `canUserEditEntity` → `EditEntityForm` est retirée ; la fiche passe toujours par `getPlayerEntityDetail` + `PublicEntityBody`.
- **Rien de perdu** : l'onglet Édition (`joueur/fiche`) liste les mêmes fiches (`listPlayerEditableEntities` : personnage revendiqué et octrois du MJ, les cas 3 et 4 de `canEditEntity`).
- **Sécurité** : aucune barrière ne bouge. Le Wiki n'envoie plus, pour toutes les fiches, que ce que la résolution de visibilité joueur autorise ; l'édition et ses droits sont inchangés.
- **`CABLAGE.md`** : les deux mentions de cette page mises à jour.
- **Vérifié** : typecheck, lint, tests unitaires.
- **Reste** : au navigateur, en Testeuse A : son PJ s'ouvre en lecture dans Wiki, en édition dans Édition.

### V3.1-189 — Bloc image : le placer dans le texte, à la souris, comme dans Word (9 novembre)

**Modèle conseillé : Opus** pour la conception et l'éditeur (Tiptap, glisser-déposer, décorations) ; **Sonnet** possible pour le bloc image allégé une fois la conception décidée.

Demande de l'auteur : l'aperçu de placement dans le bloc image (curseur à crans + miniature) laisse place à un placement **dans le bloc texte lié**, par cliquer-glisser. Cliquer l'image dans le texte ouvre une bulle d'habillage, dans le style de la bulle de mise en forme (gras, spoiler…). Le bloc image dit seulement dans quel bloc texte l'image apparaît.

**Esquisses validées par l'auteur** (9 novembre, « elles reflètent exactement ma vision ») : planche « Image dans le texte », quatre écrans — glisser dans le texte, la bulle d'habillage, le bloc image allégé, le résultat dans le wiki.

**Ce qui existe déjà et sert tel quel** : `zImageBlockData` porte `placement: "anchored"`, `anchor { blockId, segmentId, position }`, `anchorFlow: "float" | "break"`, `align`, `sizePct` ; `planImageAnchors` (`src/core/images/blockAnchor.ts`) et `PublicEntityBody` rendent déjà une image accrochée à un paragraphe, avec ses replis (paragraphe supprimé ou caché → en tête du bloc).

**Décision (9 novembre) : option A**, celle que montrent les esquisses validées. L'option B reste écrite pour mémoire :
- **Option A, recommandée : entre deux paragraphes.** L'image se dépose entre deux segments, comme le curseur à crans d'aujourd'hui, mais à la souris dans le texte. Aucun changement de schéma, aucune migration : on change l'éditeur, pas les données. Limite : jamais au milieu d'une phrase.
- **Option B : n'importe où dans le texte.** Un nœud image en ligne dans le contenu des segments. Change le schéma des segments (`zNarrativeContent`), `SCHEMA.md`, la synchronisation Tiptap, la détection de liens, l'export ; demande un ADR. Et une image au milieu d'un paragraphe caché à un joueur poserait la question de sa propre visibilité.

**Découpage (option A)** :
1. **Éditeur de texte** (`RichTextEditor.tsx`) : afficher les images accrochées à ce bloc comme des widgets non éditables entre les paragraphes (décorations Tiptap, pas de nœud dans le document, donc rien dans les segments) ; glisser-déposer avec une ligne d'insertion dorée qui s'aimante entre deux paragraphes ; le dépôt écrit `anchor` sur le bloc image (une écriture, comme aujourd'hui).
2. **Bulle d'habillage** à la sélection de l'image : texte à gauche (`float` + `left`), texte à droite (`float` + `right`), haut et bas (`break`, puis gauche/centre/droite) ; taille −/+ (`sizePct`, pas de 10, 50 à 200 %) ; « Légende » ; « Bloc image » (ouvre ses autres réglages) ; « Retirer du texte » (`placement: "flow"`). Même composant visuel que la bulle existante.
3. **Bloc image allégé** (`ImageBlockEditor.tsx`) : « Où l'image apparaît » : seule, à sa place, ou dans un bloc texte (liste des blocs texte de la fiche) ; choisir un bloc sans glisser place l'image en tête. Le curseur à crans, l'aperçu, l'alignement et la taille quittent ce bloc. Parallaxe et fond de page restent.
4. **Droits** : une image ne se glisse que si l'on peut éditer la fiche (`canEditEntity`, inchangé) ; jamais dans le Wiki joueur (V3.1-188).

**Critères d'acceptation** :
- Faire glisser une image entre deux paragraphes la place là, en édition comme en lecture, sans rechargement.
- La bulle change l'habillage et la taille ; le rendu public suit.
- Un bloc image posé avant ce ticket s'affiche à l'identique (aucune réécriture en base).
- Téléphone : le glisser est remplacé par « Monter » / « Descendre » dans la bulle (pas de glisser au doigt dans un texte qui défile).
- Catalogue (`docs/catalogue/`) : planches de la bulle et du bloc image mises à jour.

**Sous-tâches Haiku** : libellés dans `messages/` ; planche du catalogue d'après le code écrit ; recensement des usages de `cransDe` et de l'aperçu à retirer.

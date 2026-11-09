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

**Modèle conseillé : Opus** — fait par Opus seul (format du texte, visibilité, éditeur : contexte chargé, rien de délégable sans tout reprendre).

Demande de l'auteur : l'aperçu de placement dans le bloc image (curseur à crans + miniature) laisse place à un placement **dans le texte**, par cliquer-glisser. Cliquer l'image dans le texte ouvre une bulle d'habillage, dans le style de la bulle de mise en forme. Le bloc image dit seulement dans quel bloc texte l'image apparaît, et garde ses trois modes de fond, le flou, le fondu et la parallaxe.

**Esquisses validées par l'auteur** (9 novembre, « elles reflètent exactement ma vision ») : planche « Image dans le texte ».

**Décision (9 novembre) : option B**, n'importe où dans une phrase (ADR 0079). Règle de visibilité de l'auteur : une image cachée à un lecteur l'est partout, texte compris ; le texte se comporte comme si elle n'était pas là.

**Fait :**
- **Format** : nœud de segment `{ t: "image", blockId }` (`zSegmentContentNode`) ; les valeurs d'infobox gardent un format sans image (`zMentionNode`). `nodeText` remplace cinq aplatissements « paragraphe → texte ». `SCHEMA.md` §6.
- **Noyau** (tests d'abord) : `src/core/images/inlineImage.ts` (images citées, visibilité), `inlineImagePlacement.ts` (choisir le bloc texte), `src/core/linker/remapBlockIds.ts` ; `planImageAnchors` sort du fil une image citée par le texte, qui prime sur l'ancien ancrage ; aller-retour Tiptap (`tiptapSync`).
- **Serveur** : `applyInlineImageVisibility` sur le chemin joueur (`playerEntityDetail`) et le partage public (`publicShare`). Une image cachée est retirée du texte (paragraphe vide supprimé) ; une image posée dans un paragraphe caché disparaît avec lui ; une image de fond y reste un fond.
- **Duplications** : fiche et monde recalent les blocs cités (et l'ancien `anchor.blockId`, qu'elles ne recalaient pas) ; l'export porte l'id d'origine du bloc (`ref`, facultatif).
- **Lecture** : `PublicInlineImage` (que des `<span>`, valides dans un `<p>`), parallaxe comprise.
- **Éditeur** : extension `inlineImage` (`components/entities/richtext/InlineImage.tsx`), toujours chargée ; glisser-déposer natif ; bulle d'habillage (texte à gauche, à droite, haut et bas + alignement, taille −/+, « Bloc image », « Retirer du texte » ; au téléphone, ▲ ▼ d'un paragraphe).
- **Bloc image allégé** : « Seule, à sa place » / « Dans un bloc de texte » + liste des blocs texte ; curseur à crans, aperçu et barre retirés ; légende, parallaxe, fond, flou et fondu gardés.

**Vérifié** :
- typecheck, lint, tests unitaires.
- **Au navigateur** (Banc d'essai, fiche d'essai supprimée ensuite) :
  - en Testeur MJ, poser l'image depuis le bloc image, l'ouvrir dans la bulle, la glisser au milieu d'une phrase du second paragraphe, texte à gauche, 80 % : enregistré tel quel en base ;
  - en Testeuse A, l'image s'affiche dans la phrase ; bloc image passé en MJ seulement : légende et nœud absents du HTML reçu, le texte se referme (« …montées en une seule nuit… »).

**Reste** :
- Les boutons ▲ ▼ du téléphone n'ont pas été essayés au navigateur.
- Planche du catalogue (`docs/catalogue/`, bloc image et bulle) à refaire d'après le code : sous-tâche Haiku.
- Le cadre doré autour de l'éditeur pendant une sélection vient de la règle globale `:focus-visible`, antérieure à ce ticket (tous les éditeurs de texte l'ont).

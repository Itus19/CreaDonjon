# V3.2 — La narration qui fait avancer l'histoire

*Partie du backlog V3.2. L'index et la feuille de route : [`docs/BACKLOG_V3.2.md`](../BACKLOG_V3.2.md).*

**Constaté le 25 novembre**, à l'auberge du Gué-aux-Corbeaux. La personne qui joue propose ses services à Mabelle, accepte trois heures de plonge contre une nuit, puis écrit « Ok alors je fais ces trois heures de travail ». Le récit répond : « Tu acceptes d'accomplir ces trois heures de travail… Le Sergent Ourse et Petit Wil demeurent immobiles à portée », suivi d'une réplique de Mabelle. L'horloge reste à 19:54. Attendu : passer en cuisine, la voir décrite, et vivre trois heures de vaisselle racontées en accéléré, avec des détails.

Quatre défauts, trois tickets : la consigne (V3.2-17), l'horloge (V3.2-18), le déplacement (V3.2-19). Décisions de l'auteur du 25 novembre : tout faire, et une pièce qui n'existe pas encore (la cuisine) devient une **esquisse de pièce**, ancrée dans un **bloc typé « pièces » de la page du lieu**, jamais dans une page à part.

---

### ☐ V3.2-17 — Une consigne de MJ, et le contexte pour la suivre · `M` · **avec modèle IA** — **en cours (Opus)**

**Pourquoi c'était plat.** La consigne demandait « deux à quatre phrases qui intègrent les faits ». Pour une action libre, le seul fait est le texte du joueur : le modèle le reformulait. Trois endroits poussaient le PNJ à répondre à chaque tour (consigne, description du champ `npc_reaction`, second essai dès qu'un PNJ était nommé). Les présents étaient listés sans rien dire de quand les citer. Et le contexte ne donnait que le **nom** du lieu.

**Ce qui change**
- La consigne système (`src/server/ai/soloNarration.ts`) : un but (chaque tour change quelque chose), un rythme (bref pour un échange, accéléré en un à deux paragraphes pour une activité longue, descriptif pour un lieu nouveau), un PNJ ne parle que si sa parole apporte quelque chose, jamais de présents « immobiles ».
- `narration` passe de 1 000 à 1 800 caractères.
- Le second essai « le PNJ doit répondre » ne part plus que sur une **question directe** (`estQuestionDirecte` : point d'interrogation ou verbe qui demande). Sans question, la consigne du tour laisse le PNJ se taire.
- Le contexte gagne la description du lieu (premier paragraphe visible de sa page, filtré pour le joueur, encadré), la météo tirée, et les trois dernières actions du joueur.

**Ce que ça consomme** : une lecture de plus par tour narré (les blocs `text` du lieu). Les actions passées viennent de la même requête que les narrations récentes.

**Critères d'acceptation**
- [x] Tests du noyau : question directe, premier paragraphe, contexte (description encadrée, météo, actions hors balise, consigne PNJ selon la question).
- [ ] Rejoué avec le fournisseur local sur la scène du Fanal : moins de répliques non demandées, plus de présents « immobiles », un lieu décrit.

---

### ☐ V3.2-18 — L'horloge suit l'histoire · `M` · sans modèle IA pour le cœur — **en cours (Opus, [ADR 0112](../adr/0112-l-horloge-suit-l-histoire.md))**

**Constat.** Une action libre vaut une minute, codée en dur (`minutesForTurn`, `turnLoop.ts`) ; l'IA n'a aucun moyen d'annoncer une ellipse ; et l'en-tête de l'écran solo, rendu par la page serveur, ne se recharge pas après un tour.

**Ce qui est prévu**
1. Durée explicite dans le texte du joueur (« trois heures », « 2 h », « une demi-heure », « jusqu'au matin ») lue par un lexique fermé du noyau ; l'horloge avance **avant** la narration, et le fait « Trois heures passent. Il est maintenant 22h54. » part dans le contexte.
2. Sinon l'IA propose `elapsed` dans une liste fermée (instant, quelques minutes, un quart d'heure, une demi-heure, une heure, plusieurs heures de 2 à 8, jusqu'au lendemain matin). Le moteur refuse toute ellipse en combat, plafonne à 8 heures, et l'applique après la narration.
3. Le temps de parole : au moins 2 minutes, plus 1 par tranche de 100 mots échangés.
4. L'en-tête se rafraîchit après chaque tour.
5. ADR : le moteur accepte une durée proposée par l'IA dans une liste fermée.

**Ce que ça consomme** : une lecture de la scène après chaque narration, et une écriture seulement si l'horloge bouge. Aucun chargement de plus à l'écran : l'heure revient dans la réponse du tour.

**Critères d'acceptation**
- [x] Tests du noyau : durées écrites (lettres, chiffres, fractions, matin), heure du jour ignorée, bornes de la proposition, temps de parole, phrase de durée, `elapsed` fermé dans le schéma.
- [ ] Rejoué : « je fais ces trois heures de travail » à 19:54 affiche 22:54 sans recharger la page.

---

### ☐ V3.2-19 — L'IA t'emmène ailleurs : lieux et pièces · `M` · **avec modèle IA** — **en cours (Opus)** : point 1 livré, points 2 et 3 à suivre

**Ce qui est prévu**
1. `move_to` vers un lieu du wiki rattaché au lieu actuel et connu du joueur (liste fermée) ; le moteur change le lieu de la scène, comme le panneau de scène.
2. Une pièce qui n'existe pas encore (« la cuisine ») : esquisse de pièce dans l'état de scène, comme les esquisses de PNJ. Elle rejoint le **bloc typé `rooms`** de la page du lieu (nom, deux ou trois phrases, visibilité par pièce) quand on y revient ou qu'on la nomme. Pas de page à part, pas de migration (le type de bloc est un texte validé par Zod).
3. Le contexte d'un tour dans une pièce porte la description de la pièce, tirée du bloc.

**Point 1, livré** : `lieuxVoisins` (`src/core/rules/moveTargets.ts`) donne les lieux reliés par `part_of` (contenus, contenant, voisins du même parent) ; seuls ceux dont un bloc est visible du joueur entrent dans le contexte (`lieux-accessibles`) et dans l'enum de `move_to`. Après la narration, `moveSceneAfterNarration` appelle `setScene` avec le personnage joué et les PNJ réels qui suivent (`with`). La réponse du tour porte la nouvelle scène ; l'écran la pose et se rafraîchit par le même chemin que le panneau de scène (aucun `router.refresh()` de plus).

**Ce que ça consomme** : trois lectures de plus par tour narré (arêtes `part_of`, visibilité des blocs voisins, leurs noms) ; un déplacement coûte ce que coûte `setScene` depuis le panneau, plus la relecture de la scène pour l'écran.

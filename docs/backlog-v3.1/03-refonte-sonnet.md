# Backlog V3.1 — Tickets de la refonte « verre minéral » prêts pour Sonnet (4 octobre)

Partie de [`BACKLOG_V3.1.md`](../BACKLOG_V3.1.md), qui tient la feuille de route et l'index des tickets. Les tickets terminés (☑) sont dans [`termines.md`](termines.md).

Découpage de V3.1-19, sur la base de l'ADR 0036 (données) et de l'esquisse
https://claude.ai/artifact/EzWpfdYv6xP9H9gMp6L8Lm (planches citées par leur
titre). Ordre conseillé : 24, puis 25 à 36 dans l'ordre des dépendances ;
V3.1-20 (lot g) peut partir dès que 25 est fait.

**Règles communes à ces tickets** — à relire avant d'en prendre un :
- Lire `docs/CHARTE-UI.md` et la planche du catalogue concernée **avant**
  d'écrire ; réutiliser ce qui existe ; mettre la planche à jour avec le code.
- Un écran n'est fini que s'il marche à **390 px**, à 820 px (tablette) et
  sur ordinateur, dans les quatre modes et en contraste élevé.
- Mouvement : chaque animation est sautée sous `prefers-reduced-motion`.
- Aucun calcul de règle côté client ; aucune donnée cachée envoyée au client.
- Ce qui n'est pas dans le ticket n'est pas fait : un manque trouvé en
  route s'écrit dans ce backlog, il ne s'ajoute pas au ticket.
- Fini quand `npm run typecheck && npm run lint && npm run test` passent.

---

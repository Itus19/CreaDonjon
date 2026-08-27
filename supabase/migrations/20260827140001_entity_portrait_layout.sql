-- Reglages d'affichage du portrait dans le wiki (V2-G11) : taille (50-200%)
-- et alignement (gauche/droite) — le texte du premier bloc contourne le
-- portrait cote flottant, jamais centre (un flottement centre n'a pas de
-- sens en CSS).
alter table entity_portraits
  add column display_size_pct int not null default 100 check (display_size_pct between 50 and 200),
  add column align text not null default 'right' check (align in ('left', 'right'));

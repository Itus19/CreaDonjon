-- V1-D7 (passe Objet) : deux entry_type de plus, sur retour utilisateur
-- explicite. `magic_item` separe les objets magiques (rarete presente,
-- 303 fiches) des objets mondains restes sous `item` (170 fiches) — meme
-- logique que weapon/armor deja distincts d'item, jamais melanges dans
-- une seule categorie fourre-tout. `mount` isole les huit montures
-- achetables (cheval, mule, chameau...) qui avaient chacune deja leur
-- propre fiche Monstre (stats de combat) mais restaient noyees dans les
-- 473 fiches Objet cote achat — meme raisonnement de lisibilite qui a
-- motive la nidification Classe/Sous-classe et Espece/Sous-espece.
alter table ruleset_entries
  drop constraint ruleset_entries_entry_type_check;

alter table ruleset_entries
  add constraint ruleset_entries_entry_type_check
  check (entry_type in
           ('spell','item','weapon','armor','class','subclass','feature',
            'monster','condition','rule','background','species',
            'magic_item','mount'));

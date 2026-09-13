-- V2.1-5 : rien n'empechait d'ajouter plusieurs blocs personality/worldview
-- a une meme fiche via "+ Bloc" (createBlock ne verifiait aucune unicite
-- par type) - source de confusion pour le MJ. Deux doublons reels trouves
-- en base avant cette migration (meme entite "Candide Fausset" dans deux
-- copies de monde, meme motif de race que blocks_generator_section_key_uniq :
-- une seconde ecriture concurrente créait un second bloc vierge) et
-- nettoyes a la main (le bloc vierge supprime, celui avec de vraies
-- valeurs conserve) avant de poser cette contrainte.
create unique index blocks_personality_worldview_uniq
  on blocks (entity_id, block_type)
  where block_type in ('personality', 'worldview');

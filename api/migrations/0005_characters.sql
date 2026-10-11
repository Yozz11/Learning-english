-- Los personajes: la biblioteca del inicio.
--
-- La ficha completa sigue viviendo en `config` (el mismo JSON que guardaba
-- teacher_profiles), así que añadir campos a la ficha no necesita migración.
-- En columnas solo va lo que se ordena o se filtra: nombre, frase, favorito y fechas.

CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  config TEXT NOT NULL,
  favorite INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  -- Se actualiza al abrir la charla: sirve para ordenar "Para ti".
  last_used_at INTEGER,
  -- Se actualiza al abrir la ficha: con esto el punto azul de "novedad" sabe
  -- si ya lo miraste.
  last_viewed_at INTEGER
);

CREATE INDEX idx_characters_user ON characters(user_id, sort_order, created_at);

-- La charla ahora es con un personaje. Las charlas viejas quedan con null y
-- siguen funcionando con la ficha suelta de teacher_profiles.
ALTER TABLE conversations ADD COLUMN character_id TEXT REFERENCES characters(id);

CREATE INDEX idx_conversations_character ON conversations(character_id);

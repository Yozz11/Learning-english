-- Modo de las conversaciones con personaje: 'chat' (conversar, por defecto)
-- o 'train' (entrenar: práctica y ejercicios con ese profesor).
ALTER TABLE conversations ADD COLUMN mode TEXT NOT NULL DEFAULT 'chat';
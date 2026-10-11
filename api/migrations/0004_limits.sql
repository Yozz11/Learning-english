-- Límite de intentos de login y tope diario de llamadas a la IA.
-- Son contadores de la app, no datos del usuario: nada personal vive aquí.

-- Un registro por IP. La ventana se reinicia sola cuando pasa el tiempo.
CREATE TABLE login_attempts (
  ip TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL DEFAULT 0
);

-- Una fila por día (UTC). El tope se aplica antes de llamar al modelo.
CREATE TABLE ai_usage (
  day TEXT PRIMARY KEY,
  calls INTEGER NOT NULL DEFAULT 0
);

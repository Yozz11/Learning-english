-- Los archivos que subes para transcribir o traducir.
--
-- El archivo no se guarda: se manda a la IA y se tira. Aquí vive solo el
-- resultado en texto, para poder releerlo después sin volver a gastar cuota.

CREATE TABLE uploads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  -- 'transcribe' o 'translate'.
  mode TEXT NOT NULL,
  -- El resultado del modelo, tal cual lo devolvió (JSON).
  result TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_uploads_user ON uploads(user_id, created_at DESC);

-- Esquema inicial de la etapa 1.
-- Convenciones: ids de texto, fechas en milisegundos (INTEGER), JSON en columnas TEXT.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER
);

CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  native_language TEXT NOT NULL DEFAULT 'es',
  goals TEXT NOT NULL DEFAULT '[]',
  correction_preference TEXT NOT NULL DEFAULT '',
  onboarded_at INTEGER,
  updated_at INTEGER NOT NULL
);

-- Arbol de habilidades: padres = habilidades generales, hijos = temas concretos.
CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES skills(id),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE user_skills (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  score REAL,
  cefr TEXT,
  mastery REAL NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at INTEGER,
  next_review_at INTEGER,
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE assessment_questions (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  section TEXT NOT NULL,
  cefr TEXT NOT NULL,
  position INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL,
  passage_id TEXT,
  passage_title TEXT,
  passage_text TEXT,
  instructions TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL,
  options TEXT,
  answer_key TEXT,
  rubric TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_questions_section ON assessment_questions(section, position, sort_order);

CREATE TABLE assessment_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  result TEXT,
  provider TEXT,
  model TEXT
);

CREATE INDEX idx_attempts_user ON assessment_attempts(user_id, started_at DESC);

CREATE TABLE assessment_answers (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES assessment_questions(id),
  answer TEXT NOT NULL,
  is_correct INTEGER,
  score REAL,
  cefr TEXT,
  feedback TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (attempt_id, question_id)
);

-- La configuración del profesor vive en JSON para poder añadir opciones sin migrar.
CREATE TABLE teacher_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  config TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  summary_message_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_message_at INTEGER
);

CREATE INDEX idx_conversations_user ON conversations(user_id, last_message_at DESC);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  meta TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);

CREATE TABLE learner_errors (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  topic TEXT NOT NULL,
  original TEXT NOT NULL,
  correction TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  occurrences INTEGER NOT NULL DEFAULT 1,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  UNIQUE (user_id, topic, original, correction)
);

CREATE INDEX idx_errors_user ON learner_errors(user_id, occurrences DESC, last_seen_at DESC);

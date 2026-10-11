-- Habilidades generales (kind='skill') y temas (kind='topic').
-- Los temas existen desde ya para que la etapa 2 solo tenga que escribir en ellos.

INSERT INTO skills (id, parent_id, code, name, kind, sort_order) VALUES
  ('grammar',       NULL, 'grammar',       'Gramática',      'skill', 1),
  ('vocabulary',    NULL, 'vocabulary',    'Vocabulario',    'skill', 2),
  ('reading',       NULL, 'reading',       'Lectura',        'skill', 3),
  ('listening',     NULL, 'listening',     'Listening',      'skill', 4),
  ('speaking',      NULL, 'speaking',      'Speaking',       'skill', 5),
  ('writing',       NULL, 'writing',       'Escritura',      'skill', 6),
  ('pronunciation', NULL, 'pronunciation', 'Pronunciación',  'skill', 7),

  ('g.present_simple', 'grammar', 'grammar.present_simple', 'Present Simple', 'topic', 1),
  ('g.past_simple',    'grammar', 'grammar.past_simple',    'Past Simple',    'topic', 2),
  ('g.present_perfect','grammar', 'grammar.present_perfect','Present Perfect','topic', 3),
  ('g.future',         'grammar', 'grammar.future',         'Futuro',         'topic', 4),
  ('g.articles',       'grammar', 'grammar.articles',       'Artículos',      'topic', 5),
  ('g.prepositions',   'grammar', 'grammar.prepositions',   'Preposiciones',  'topic', 6),
  ('g.comparatives',   'grammar', 'grammar.comparatives',   'Comparativos',   'topic', 7),
  ('g.modals',         'grammar', 'grammar.modals',         'Modales',        'topic', 8),
  ('g.conditionals',   'grammar', 'grammar.conditionals',   'Condicionales',  'topic', 9),
  ('g.questions',      'grammar', 'grammar.questions',      'Preguntas',      'topic', 10),
  ('g.verb_patterns',  'grammar', 'grammar.verb_patterns',  'Patrones verbales', 'topic', 11),
  ('g.inversion',      'grammar', 'grammar.inversion',      'Inversión',      'topic', 12),

  ('v.everyday',    'vocabulary', 'vocabulary.everyday',    'Palabras del día a día', 'topic', 1),
  ('v.phrasal',     'vocabulary', 'vocabulary.phrasal',     'Phrasal verbs',          'topic', 2),
  ('v.collocations','vocabulary', 'vocabulary.collocations','Colocaciones',           'topic', 3),
  ('v.academic',    'vocabulary', 'vocabulary.academic',    'Vocabulario académico',  'topic', 4),

  ('r.main_idea',   'reading', 'reading.main_idea',   'Idea principal',        'topic', 1),
  ('r.detail',      'reading', 'reading.detail',      'Detalles',              'topic', 2),
  ('r.inference',   'reading', 'reading.inference',   'Inferencia',            'topic', 3),
  ('r.context',     'reading', 'reading.context',     'Vocabulario en contexto','topic', 4),

  ('w.sentences',   'writing', 'writing.sentences',   'Oraciones',        'topic', 1),
  ('w.paragraphs',  'writing', 'writing.paragraphs',  'Párrafos',         'topic', 2),
  ('w.connectors',  'writing', 'writing.connectors',  'Conectores',       'topic', 3),
  ('w.register',    'writing', 'writing.register',    'Registro formal',  'topic', 4),

  ('l.gist',        'listening', 'listening.gist',    'Entender la idea general', 'topic', 1),
  ('l.detail',      'listening', 'listening.detail',  'Detalles al escuchar',     'topic', 2),

  ('s.fluency',     'speaking', 'speaking.fluency',   'Fluidez',  'topic', 1),
  ('s.accuracy',    'speaking', 'speaking.accuracy',  'Precisión', 'topic', 2),

  ('p.vowels',      'pronunciation', 'pronunciation.vowels',     'Vocales',    'topic', 1),
  ('p.stress',      'pronunciation', 'pronunciation.stress',     'Acento',     'topic', 2),
  ('p.intonation',  'pronunciation', 'pronunciation.intonation', 'Entonación', 'topic', 3);

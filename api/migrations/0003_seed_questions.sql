-- Banco de preguntas del test. position = 0 (A1) .. 5 (C2).
-- La respuesta correcta vive aquí y nunca se manda al navegador.

INSERT INTO assessment_questions
  (id, skill_id, section, cefr, position, sort_order, type, passage_id, passage_title, passage_text, instructions, prompt, options, answer_key) VALUES

-- GRAMÁTICA
('g1', 'grammar', 'grammar', 'A1', 0, 0, 'mcq', NULL, NULL, NULL,
 'Elige la opción correcta.', 'She ___ a doctor.', '["is","are","be","am"]', '{"index":0}'),
('g2', 'grammar', 'grammar', 'A2', 1, 0, 'mcq', NULL, NULL, NULL,
 'Elige la opción correcta.', 'We ___ to the beach last weekend.', '["go","went","gone","going"]', '{"index":1}'),
('g3', 'grammar', 'grammar', 'B1', 2, 0, 'mcq', NULL, NULL, NULL,
 'Elige la opción correcta.', 'If I ___ more time, I would learn to play the guitar.', '["have","had","would have","has"]', '{"index":1}'),
('g4', 'grammar', 'grammar', 'B2', 3, 0, 'mcq', NULL, NULL, NULL,
 'Elige la opción correcta.', 'By the end of next year, she ___ in this company for a decade.', '["will work","will be working","will have worked","works"]', '{"index":2}'),
('g5', 'grammar', 'grammar', 'C1', 4, 0, 'mcq', NULL, NULL, NULL,
 'Elige la opción correcta.', 'Hardly ___ the meeting started when the power went out.', '["had","has","did","was"]', '{"index":0}'),
('g6', 'grammar', 'grammar', 'C2', 5, 0, 'mcq', NULL, NULL, NULL,
 'Elige la opción correcta.', '___ the committee''s objections, the project went ahead.', '["Despite of","Notwithstanding","Although","Even though"]', '{"index":1}'),

-- VOCABULARIO
('v1', 'vocabulary', 'vocabulary', 'A1', 0, 0, 'mcq', NULL, NULL, NULL,
 'Elige la palabra correcta.', '¿Cuál se acerca más a "big"?', '["huge","tiny","short","slow"]', '{"index":0}'),
('v2', 'vocabulary', 'vocabulary', 'A2', 1, 0, 'mcq', NULL, NULL, NULL,
 'Elige la palabra correcta.', 'The opposite of "expensive" is ___.', '["cheap","rich","costly","priceless"]', '{"index":0}'),
('v3', 'vocabulary', 'vocabulary', 'B1', 2, 0, 'mcq', NULL, NULL, NULL,
 'Elige la palabra correcta.', 'The film was utterly ___ ; I fell asleep after twenty minutes.', '["thrilling","tedious","hilarious","gripping"]', '{"index":1}'),
('v4', 'vocabulary', 'vocabulary', 'B2', 3, 0, 'mcq', NULL, NULL, NULL,
 'Elige la palabra correcta.', 'He gave a ___ apology, so nobody believed he was sorry.', '["heartfelt","half-hearted","sincere","wholehearted"]', '{"index":1}'),
('v5', 'vocabulary', 'vocabulary', 'C1', 4, 0, 'mcq', NULL, NULL, NULL,
 'Elige la palabra correcta.', 'Her remark was completely ___ : she said it without preparing anything.', '["offhand","deliberate","premeditated","rehearsed"]', '{"index":0}'),
('v6', 'vocabulary', 'vocabulary', 'C2', 5, 0, 'mcq', NULL, NULL, NULL,
 'Elige la palabra correcta.', 'The politician''s speech was so ___ that few listeners could pin down a single concrete promise.', '["lucid","grandiloquent","succinct","blunt"]', '{"index":1}'),

-- LECTURA (3 textos de 2 preguntas)
('r1', 'reading', 'reading', 'A2', 1, 1, 'mcq', 'p1', 'The bike that pays',
 'Marco lives in a small town near the mountains. Every morning he rides his bike to work because the bus is expensive and often late. The trip takes forty minutes, but he says he does not mind. "I arrive awake and I save money," he says. Last year his doctor told him he needed more exercise. Now he rides every day, even when it rains.',
 'Lee el texto y responde.', 'Why does Marco ride his bike to work?',
 '["Because the bus is expensive and often late","Because he does not have a car","Because he lives far from work","Because his doctor bought him a bike"]', '{"index":0}'),
('r2', 'reading', 'reading', 'A2', 1, 2, 'mcq', 'p1', 'The bike that pays',
 'Marco lives in a small town near the mountains. Every morning he rides his bike to work because the bus is expensive and often late. The trip takes forty minutes, but he says he does not mind. "I arrive awake and I save money," he says. Last year his doctor told him he needed more exercise. Now he rides every day, even when it rains.',
 'Lee el texto y responde.', 'What happened last year?',
 '["He sold his car","His doctor told him he needed more exercise","He moved to another town","He started taking the bus"]', '{"index":1}'),
('r3', 'reading', 'reading', 'B1', 2, 1, 'mcq', 'p2', 'Why sleep matters',
 'Scientists have known for decades that sleep helps the body recover, but recent studies suggest it also plays a key role in memory. During deep sleep, the brain appears to replay the events of the day and store the important parts. People who sleep less than six hours tend to remember less of what they studied, even if they spent the same time reading. The effect is stronger for complex material, such as a new language or a musical instrument. This is why many teachers now recommend studying in the evening and sleeping before reviewing the next morning.',
 'Lee el texto y responde.', 'According to the text, what does the brain do during deep sleep?',
 '["It stores the important parts of the day","It stops working completely","It prepares the body for exercise","It forgets unnecessary events"]', '{"index":0}'),
('r4', 'reading', 'reading', 'B1', 2, 2, 'mcq', 'p2', 'Why sleep matters',
 'Scientists have known for decades that sleep helps the body recover, but recent studies suggest it also plays a key role in memory. During deep sleep, the brain appears to replay the events of the day and store the important parts. People who sleep less than six hours tend to remember less of what they studied, even if they spent the same time reading. The effect is stronger for complex material, such as a new language or a musical instrument. This is why many teachers now recommend studying in the evening and sleeping before reviewing the next morning.',
 'Lee el texto y responde.', 'What do the teachers recommend?',
 '["Studying only in the morning","Sleeping less than six hours","Studying in the evening and sleeping before reviewing","Never reviewing what you studied"]', '{"index":2}'),
('r5', 'reading', 'reading', 'C1', 4, 1, 'mcq', 'p3', 'The quiet cost of remote work',
 'Remote work was long presented as a straightforward gain: fewer commutes, more autonomy, and time returned to the worker. Yet as the practice matured, a subtler cost emerged. Junior employees, in particular, lost the incidental learning that comes from overhearing a colleague''s phone call or watching a senior colleague handle a difficult client. Firms that measured productivity found little change; firms that tracked how quickly new hires became independent found a marked delay. The lesson is not that remote work is bad, but that the informal channels through which expertise travels are easily overlooked until they are gone.',
 'Lee el texto y responde.', 'What is the main argument of the text?',
 '["Remote work always reduces productivity","Remote work has a hidden cost for how expertise is passed on","Remote work is better for junior employees","Commuting is the main problem of office work"]', '{"index":1}'),
('r6', 'reading', 'reading', 'C1', 4, 2, 'mcq', 'p3', 'The quiet cost of remote work',
 'Remote work was long presented as a straightforward gain: fewer commutes, more autonomy, and time returned to the worker. Yet as the practice matured, a subtler cost emerged. Junior employees, in particular, lost the incidental learning that comes from overhearing a colleague''s phone call or watching a senior colleague handle a difficult client. Firms that measured productivity found little change; firms that tracked how quickly new hires became independent found a marked delay. The lesson is not that remote work is bad, but that the informal channels through which expertise travels are easily overlooked until they are gone.',
 'Lee el texto y responde.', 'In the text, "incidental learning" means learning that is ___.',
 '["planned in advance","a side effect of everyday situations","taught in formal training","measured by productivity"]', '{"index":1}');

-- ESCRITURA (se evalúa con IA)
INSERT INTO assessment_questions
  (id, skill_id, section, cefr, position, sort_order, type, instructions, prompt, rubric) VALUES
('w1', 'writing', 'writing', 'A2', 1, 1, 'writing',
 'Escribe en inglés. Sin traductor.', 'Write 3 or 4 sentences about a normal day in your life.',
 'A2 esperado: frases simples, presente simple, vocabulario cotidiano.'),
('w2', 'writing', 'writing', 'B2', 3, 2, 'writing',
 'Escribe en inglés. Sin traductor.', 'Describe a problem in your city and suggest one solution. Write 4 or 5 sentences.',
 'B2 esperado: conectores variados, causa y consecuencia, mezcla de tiempos.'),
('w3', 'writing', 'writing', 'C1', 5, 3, 'writing',
 'Escribe en inglés. Sin traductor.', 'Some people believe exams are the best way to measure learning. Give your opinion with reasons. Write 5 or 6 sentences.',
 'C1 esperado: argumentación clara, matices, vocabulario preciso, registro formal.');

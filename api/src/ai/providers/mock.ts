import type { AIProvider, ChatInput, ChatResult } from '../types'

// Proveedor de prueba: respuestas fijas, sin red y sin gastar cuota.
// Sirve para desarrollar y probar todo el flujo sin API key.

const WRITING_JSON = JSON.stringify({
  cefr: 'B1',
  position: 2.2,
  strengths: ['Usa oraciones completas', 'Se entiende bien'],
  weaknesses: ['Confunde el presente simple con el gerundio', 'Faltan conectores'],
  errors: [
    {
      original: 'I am go to the university',
      correction: 'I go to the university',
      explanation: 'El presente simple no lleva "am" antes del verbo.',
      topic: 'present simple',
    },
  ],
})

function replyFor(input: ChatInput): string {
  const lastUserMessage =
    [...input.messages].reverse().find((message) => message.role === 'user')?.content ?? ''

  if (input.tag === 'writing') return WRITING_JSON

  if (input.tag === 'upload') {
    // Respuesta fija, pero con el archivo que llegó, para poder ver en la app
    // que el texto y el modo viajaron de verdad.
    const fileName = lastUserMessage.match(/^File name: (.+)$/m)?.[1] ?? 'Archivo'
    const translates = lastUserMessage.includes('Task: transcribe the file and translate')
    return JSON.stringify({
      title: `Prueba: ${fileName}`,
      transcript: 'This is the fixed transcript of the mock provider. It never reads the file.',
      translation: translates ? 'Esta es la transcripción fija del proveedor de prueba.' : null,
      notes: ['El proveedor de prueba no lee el archivo: devuelve siempre este texto.'],
    })
  }

  if (input.tag === 'summary') {
    return 'Hablamos de rutinas diarias. Te costó el presente simple en tercera persona y confundiste "have" con "be" para la edad. Repasemos eso.'
  }

  // Marca de prueba: deja ver qué personaje llegó al prompt (lo usan las pruebas).
  const role = input.system.match(/^You are (.+?),/m)?.[1]

  return [
    '[respuesta de prueba] Good, I understood what you wrote.',
    '',
    'Quick fix: "I have 20 years" → "I\'m 20 years old". Age uses "be", not "have". Try it again.',
    '',
    `[[fix: I have 20 years | I'm 20 years old | Age uses "be", not "have". | expressions with be | grammar]]`,
    '',
    `(Recibí: "${lastUserMessage.slice(0, 80)}")`,
    ...(role ? [`(Me llaman ${role} en esta charla.)`] : []),
  ].join('\n')
}

export function mockProvider(): AIProvider {
  return {
    id: 'mock',

    async chat(input: ChatInput): Promise<ChatResult> {
      return { text: replyFor(input), provider: 'mock', model: 'mock' }
    },
  }
}

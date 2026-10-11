/** Fechas cortas y en español, sin librerías. */
export function formatRelative(timestamp: number | null): string {
  if (!timestamp) return 'todavía no'

  const minutes = Math.round((Date.now() - timestamp) / 60_000)
  if (minutes < 1) return 'ahora mismo'
  if (minutes < 60) return `hace ${minutes} min`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`

  const days = Math.round(hours / 24)
  if (days === 1) return 'ayer'
  if (days < 30) return `hace ${days} días`

  return new Date(timestamp).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('es', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

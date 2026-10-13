import type { ReactNode } from 'react'

/*
 * Iconos propios: los mismos trazos del plano, en SVG a mano.
 * No hay ninguna librería de iconos y no se copia ningún dibujo de otra app.
 */
const PATHS: Record<string, ReactNode> = {
  home: <path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  chat: <path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" />,
  plus: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  bell: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  sliders: <path d="M7 4h10M7 12h10M7 20h10" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  send: <path d="M5 12h14M13 6l6 6-6 6" />,
  pencil: <path d="M4 20l4-1 11-11-3-3L5 16z" />,
  volume: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M17 9a4 4 0 0 1 0 6" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="16" r="2" />
    </>
  ),
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  thumbUp: <path d="M7 11v9H4v-9zM7 11l4-5a2 2 0 0 1 3.7 1.1L14 10h4.5a2 2 0 0 1 2 2.4l-1.2 6A2 2 0 0 1 17.3 20H7" />,
  repeat: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.7" />
      <path d="M20 4v5h-5" />
    </>
  ),
  book: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2z" />
      <path d="M8 3v18" />
    </>
  ),
  /* --- adornos de temporada (Halloween), dibujados a mano como el resto --- */
  cobweb: (
    <>
      <path d="M2.5 2.5v14M2.5 2.5h14M2.5 2.5l10 10" />
      <path d="M6 2.5c0 1.9 1.6 3.5 3.5 3.5M2.5 6c1.9 0 3.5 1.6 3.5 3.5" />
      <path d="M10 2.5c0 4.1 3.4 7.5 7.5 7.5M2.5 10c4.1 0 7.5 3.4 7.5 7.5" />
    </>
  ),
  bat: (
    <>
      <path d="M12 10.5c-1.6-2-3.4-3-5.9-3.2.6 1.2.9 2.4.8 3.7-1.2-.6-2.4-.7-3.6-.4 1.2 1.3 1.9 2.7 2.1 4.2" />
      <path d="M12 10.5c1.6-2 3.4-3 5.9-3.2-.6 1.2-.9 2.4-.8 3.7 1.2-.6 2.4-.7 3.6-.4-1.2 1.3-1.9 2.7-2.1 4.2" />
      <path d="M10.6 9.4 10 7.8M13.4 9.4l.6-1.6" />
      <circle cx="12" cy="11" r="1.8" />
    </>
  ),
  pumpkin: (
    <>
      <path d="M12 7c-3.3 0-6 2.5-6 5.8C6 16 8.7 19 12 19s6-3 6-6.2C18 9.5 15.3 7 12 7Z" />
      <path d="M12 7c-1.2 1.3-1.8 3-1.8 5s.6 3.7 1.8 5M12 7c1.2 1.3 1.8 3 1.8 5s-.6 3.7-1.8 5" />
      <path d="M12 7V5.2c0-.7.5-1.2 1.2-1.2.9 0 1.6.6 1.8 1.4" />
    </>
  ),
  ghost: (
    <>
      <path d="M12 4a5 5 0 0 0-5 5v9.5c0 .6.7 1 1.2.6l1.4-1 1.4 1c.3.2.7.2 1 0l1.4-1 1.4 1c.5.4 1.2 0 1.2-.6V9a5 5 0 0 0-5-5Z" />
      <path d="M10.2 9.8h.01M13.8 9.8h.01" />
    </>
  ),
}

export type IconName = keyof typeof PATHS

export function Icon({
  name,
  size = 24,
  className = 'i',
}: {
  name: IconName
  size?: number
  className?: string
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}

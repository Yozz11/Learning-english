import { avatarSrc } from '@english-coach/shared'

/** Avatares que se pueden mostrar: si no hay imagen, quedan las iniciales. */
export function Avatar({
  avatar,
  name,
  size = 44,
}: {
  avatar: string | null
  name: string
  size?: number
}) {
  const src = avatarSrc(avatar)
  const initials = name.trim().slice(0, 2).toUpperCase() || '?'

  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {src ? <img src={src} alt="" width={size} height={size} /> : <span>{initials}</span>}
    </span>
  )
}

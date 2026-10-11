import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function Card({ children, soft = false }: { children: ReactNode; soft?: boolean }) {
  return <section className={soft ? 'card card-soft' : 'card'}>{children}</section>
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'ghost'
}

export function Button({ variant = 'default', className = '', children, ...rest }: ButtonProps) {
  const base = variant === 'primary' ? 'btn btn-primary' : variant === 'ghost' ? 'btn btn-ghost' : 'btn'
  return (
    <button type="button" className={`${base} ${className}`.trim()} {...rest}>
      {children}
    </button>
  )
}

export function Spinner() {
  return <span className="spinner" role="status" aria-label="Cargando" />
}

export function LoadingBox() {
  return (
    <div className="center-box">
      <Spinner />
    </div>
  )
}

export function Alert({ children }: { children: ReactNode }) {
  return <div className="alert">{children}</div>
}

export function Note({ children }: { children: ReactNode }) {
  return <div className="note">{children}</div>
}

export function LevelChip({ label }: { label: string | null }) {
  return (
    <span className="chip">
      Nivel <span className="chip-level">{label ?? '—'}</span>
    </span>
  )
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const percent = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="bar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className="bar-fill" style={{ width: `${percent}%` }} />
    </div>
  )
}

export function SkillMeter({
  name,
  label,
  score,
}: {
  name: string
  label: string | null
  score: number | null
}) {
  const percent = score === null ? 0 : Math.min(100, Math.max(0, (score / 5) * 100))
  return (
    <div className="skill">
      <div className="spread">
        <span>{name}</span>
        {score === null ? (
          <span className="tiny">pendiente (etapa 2)</span>
        ) : (
          <span className="chip-level">{label}</span>
        )}
      </div>
      <div className="skill-track">
        <div className="skill-fill" style={{ width: `${percent}%`, opacity: score === null ? 0.25 : 1 }} />
      </div>
    </div>
  )
}

export function Slider({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  hint?: string
}) {
  return (
    <label>
      <span className="spread">
        <span>{label}</span>
        <span className="tiny">{value}/10</span>
      </span>
      <input
        type="range"
        min={0}
        max={10}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}

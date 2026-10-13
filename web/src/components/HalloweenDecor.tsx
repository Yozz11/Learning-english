import { Icon } from './icons'

/*
 * Adornos de temporada (Halloween): unos dibujos tranquilos y fijos en las
 * esquinas, por detrás del contenido y sin recibir clics (ver `.halloween` en
 * app.css). No ocupan sitio ni mueven nada: van en su propia capa.
 */
export function HalloweenDecor() {
  return (
    <div className="halloween" aria-hidden="true">
      <Icon name="cobweb" className="cobweb" />
      <Icon name="bat" className="bat" />
      <Icon name="bat" className="bat bat-far" />
      <Icon name="ghost" className="ghost" />
      <Icon name="pumpkin" className="pumpkin" />
    </div>
  )
}

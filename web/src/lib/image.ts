// Convierte la foto que elijas en un avatar cuadrado y pequeño, y devuelve un
// data URL. Así viaja dentro de la configuración del profesor y no hace falta
// ningún servicio de archivos ni un bucket de almacenamiento.

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No pude leer esa imagen.'))
    image.src = url
  })
}

/** Recorta al centro, reduce a `size`x`size` y devuelve el data URL. */
export async function fileToAvatarDataUrl(file: File, size = 256): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Ese archivo no es una imagen.')
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(objectUrl)
    if (image.width === 0 || image.height === 0) throw new Error('La imagen está vacía.')

    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('El navegador no me deja procesar la imagen.')

    // Recorte tipo "cover": llena el cuadro sin deformar la cara.
    const scale = Math.max(size / image.width, size / image.height)
    const width = image.width * scale
    const height = image.height * scale
    context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height)

    const webp = canvas.toDataURL('image/webp', 0.82)
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

'use client'

import { Capacitor, registerPlugin } from '@capacitor/core'

interface BlisterPhotoPlugin {
  takePhoto(): Promise<{ uri: string }>
}

const NativeBlisterPhoto = registerPlugin<BlisterPhotoPlugin>('BlisterPhoto')
const MAX_EDGE = 1280

const openCameraFile = (): Promise<File | null> =>
  new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null)
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.setAttribute('capture', 'environment')
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    document.body.appendChild(input)

    const cleanup = () => {
      input.value = ''
      input.remove()
    }

    input.addEventListener('change', () => {
      const file = input.files?.[0] ?? null
      cleanup()
      resolve(file)
    }, { once: true })

    input.addEventListener('cancel', () => {
      cleanup()
      resolve(null)
    }, { once: true })

    input.click()
  })

const fileToJpegDataUrl = async (file: File): Promise<string> => {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Не удалось прочитать фотографию.'))
      element.src = objectUrl
    })

    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Камера недоступна.')
    context.drawImage(image, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', 0.78)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export const captureBlisterPhoto = async (): Promise<string | null> => {
  if (Capacitor.isNativePlatform()) {
    const result = await NativeBlisterPhoto.takePhoto()
    return result.uri || null
  }

  const file = await openCameraFile()
  return file ? fileToJpegDataUrl(file) : null
}

export const blisterPhotoSrc = (uri?: string | null): string => {
  if (!uri) return ''
  if (uri.startsWith('data:') || uri.startsWith('blob:') || uri.startsWith('http')) return uri
  return Capacitor.isNativePlatform() ? Capacitor.convertFileSrc(uri) : uri
}
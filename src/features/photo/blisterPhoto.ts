'use client'

import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'

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
  const file = await openCameraFile()
  if (!file) return null
  const dataUrl = await fileToJpegDataUrl(file)

  if (!Capacitor.isNativePlatform()) return dataUrl

  const comma = dataUrl.indexOf(',')
  if (comma < 0) throw new Error('Не удалось сохранить фотографию.')
  const data = dataUrl.slice(comma + 1)
  const path = `blister-photos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
  await Filesystem.writeFile({
    path,
    data,
    directory: Directory.Data,
    recursive: true,
  })
  const result = await Filesystem.getUri({ path, directory: Directory.Data })
  return result.uri
}

export const blisterPhotoSrc = (uri?: string | null): string => {
  if (!uri) return ''
  if (uri.startsWith('data:') || uri.startsWith('blob:') || uri.startsWith('http')) return uri
  return Capacitor.isNativePlatform() ? Capacitor.convertFileSrc(uri) : uri
}

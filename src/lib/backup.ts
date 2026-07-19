import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

export type BackupPayload = {
  version: 1
  app: 'Pills-05'
  exportedAt: string
  medicines: unknown[]
  history: unknown[]
  settings: Record<string, unknown>
}

const safeParse = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function createBackupPayload(): BackupPayload {
  if (typeof window === 'undefined') {
    throw new Error('Резервная копия доступна только на устройстве')
  }

  return {
    version: 1,
    app: 'Pills-05',
    exportedAt: new Date().toISOString(),
    medicines: safeParse<unknown[]>(localStorage.getItem('medicines'), []),
    history: safeParse<unknown[]>(localStorage.getItem('history'), []),
    settings: safeParse<Record<string, unknown>>(localStorage.getItem('settings'), {}),
  }
}

export async function exportBackup(): Promise<void> {
  const payload = createBackupPayload()
  const json = JSON.stringify(payload, null, 2)
  const date = new Date().toISOString().slice(0, 10)
  const fileName = `moi-lekarstva-${date}.json`

  if (Capacitor.isNativePlatform()) {
    const saved = await Filesystem.writeFile({
      path: fileName,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    })

    await Share.share({
      title: 'Резервная копия лекарств',
      text: 'Сохраните этот файл. Его можно открыть на другом телефоне или планшете.',
      files: [saved.uri],
      dialogTitle: 'Куда сохранить резервную копию',
    })
    return
  }

  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function validateBackup(value: unknown): BackupPayload {
  if (!value || typeof value !== 'object') throw new Error('Файл не похож на резервную копию')
  const candidate = value as Partial<BackupPayload>

  if (candidate.version !== 1 || candidate.app !== 'Pills-05') {
    throw new Error('Это резервная копия другого приложения или неподдерживаемой версии')
  }
  if (!Array.isArray(candidate.medicines) || !Array.isArray(candidate.history)) {
    throw new Error('В резервной копии повреждён список лекарств или история')
  }
  if (!candidate.settings || typeof candidate.settings !== 'object') {
    throw new Error('В резервной копии повреждены настройки')
  }

  return candidate as BackupPayload
}

export async function importBackupFile(file: File): Promise<BackupPayload> {
  if (typeof window === 'undefined') throw new Error('Импорт доступен только на устройстве')
  if (file.size > 5 * 1024 * 1024) throw new Error('Файл слишком большой')

  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error('Не удалось прочитать файл. Выберите файл с расширением .json')
  }

  const backup = validateBackup(parsed)
  localStorage.setItem('medicines', JSON.stringify(backup.medicines))
  localStorage.setItem('history', JSON.stringify(backup.history))
  localStorage.setItem('settings', JSON.stringify(backup.settings))
  return backup
}

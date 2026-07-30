import { Capacitor, registerPlugin } from '@capacitor/core'
import { stopReminderPreview } from '@/features/sound/nativeAudio'

interface ReminderStopPlugin {
  stopAll(): Promise<{ stopped: boolean; generation?: number }>
}

const NativeReminderStop = registerPlugin<ReminderStopPlugin>('ReminderStop')

/**
 * Останавливает и обычный предпросмотр, и фоновую Android-службу напоминания.
 * Эту функцию нужно использовать для любой кнопки «Остановить звук».
 */
export async function stopAllReminderAudio(): Promise<boolean> {
  await stopReminderPreview()
  if (!Capacitor.isNativePlatform()) return true

  try {
    const result = await NativeReminderStop.stopAll()
    console.info('All reminder audio stopped', result)
    return result.stopped !== false
  } catch (error) {
    console.error('Background reminder stop failed:', error)
    return false
  }
}

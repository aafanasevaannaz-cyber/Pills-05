import { App } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import { requestNotificationPermission } from '@/features/reminders/nativeNotifications.logic'

export const isCapacitorAvailable = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).capacitor
}

export const initializeCapacitor = async (): Promise<void> => {
  if (!isCapacitorAvailable()) {
    console.log('Capacitor not available - running in web mode')
    return
  }

  try {
    // Запросить разрешение на уведомления
    const hasPermission = await requestNotificationPermission()
    if (hasPermission) {
      console.log('Notifications permission granted')
    } else {
      console.warn('Notifications permission denied or not available')
    }

    // Подписаться на события приложения
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log('App is now active')
      } else {
        console.log('App is now inactive')
      }
    })

    // Подписаться на события уведомлений
    await LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
      console.log('Notification clicked:', notification)
    })

    await LocalNotifications.addListener('localNotificationReceived', (notification) => {
      console.log('Notification received:', notification)
    })

    console.log('Capacitor initialized successfully')
  } catch (e) {
    console.error('Capacitor initialization failed:', e)
  }
}

export const getPlatformInfo = async (): Promise<string> => {
  if (!isCapacitorAvailable()) {
    return 'web'
  }

  try {
    const info = await App.getInfo()
    return `${info.platform} ${info.version}`
  } catch (e) {
    return 'unknown'
  }
}

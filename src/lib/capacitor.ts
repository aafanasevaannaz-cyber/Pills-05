import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { requestNotificationPermission } from '@/features/reminders/nativeNotifications.logic'

let initialized = false

export const isCapacitorAvailable = (): boolean => Capacitor.isNativePlatform()

export const initializeCapacitor = async (): Promise<void> => {
  if (!isCapacitorAvailable() || initialized) {
    return
  }

  initialized = true

  try {
    const hasPermission = await requestNotificationPermission()
    if (hasPermission) {
      console.log('Notifications permission granted')
    } else {
      console.warn('Notifications permission denied')
    }

    await App.addListener('appStateChange', ({ isActive }) => {
      console.log(isActive ? 'App is now active' : 'App is now inactive')
    })

    await LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
      console.log('Notification clicked:', notification)
    })

    await LocalNotifications.addListener('localNotificationReceived', (notification) => {
      console.log('Notification received:', notification)
    })

    console.log('Capacitor initialized successfully')
  } catch (error) {
    initialized = false
    console.error('Capacitor initialization failed:', error)
  }
}

export const getPlatformInfo = async (): Promise<string> => {
  if (!isCapacitorAvailable()) {
    return 'web'
  }

  try {
    const info = await App.getInfo()
    return `${Capacitor.getPlatform()} ${info.version}`
  } catch {
    return Capacitor.getPlatform()
  }
}

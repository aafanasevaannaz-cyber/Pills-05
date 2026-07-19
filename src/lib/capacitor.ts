import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

let initialized = false

export const isCapacitorAvailable = (): boolean => Capacitor.isNativePlatform()

export const initializeCapacitor = async (): Promise<void> => {
  if (!isCapacitorAvailable() || initialized) return

  initialized = true

  try {
    await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log('App is now active')
      }
    })

    await LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (notification) => {
        console.log('Notification clicked:', notification)
      }
    )

    await LocalNotifications.addListener(
      'localNotificationReceived',
      (notification) => {
        console.log('Notification received:', notification)
      }
    )
  } catch (error) {
    initialized = false
    console.error('Capacitor initialization failed:', error)
  }
}

export const getPlatformInfo = async (): Promise<string> => {
  if (!isCapacitorAvailable()) return 'web'

  try {
    const info = await App.getInfo()
    return `${Capacitor.getPlatform()} ${info.version}`
  } catch {
    return Capacitor.getPlatform()
  }
}
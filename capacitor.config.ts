import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.moi.tabletki.reminder',
  appName: 'Мои таблетки',
  webDir: 'out',
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      style: 'LIGHT',
      hidden: false,
      animation: 'NONE',
    },
    LocalNotifications: {
      iconColor: '#2F6B4F',
      sound: 'medicine_alarm.wav',
    },
  },
}

export default config

import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.chaipodusham.pochasam.rebuild2',
  appName: 'По часам 2',
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
    },
  },
}

export default config

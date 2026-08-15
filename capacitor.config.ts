import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.chaipodusham.pochasam.final20260815',
  appName: 'По часам — финал',
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

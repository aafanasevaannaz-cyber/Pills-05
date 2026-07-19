/// <reference types="@capacitor/local-notifications" />

import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.pills.reminder',
  appName: 'Pills-05',
  webDir: 'out',
  plugins: {
    LocalNotifications: {
      iconColor: '#488AFF',
    },
  },
}

export default config

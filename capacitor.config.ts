import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kuryeantalya.app',
  appName: 'Kurye Antalya',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;

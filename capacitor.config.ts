import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kuryeantalya.app',
  appName: 'Antalya Teslimat',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;

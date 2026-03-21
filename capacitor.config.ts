import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.antalyateslimat.app',
  appName: 'Antalya Teslimat',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    allowNavigation: ['*']
  }
};

export default config;

import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.antalyateslimat.app',
  appName: 'Antalya Teslimat',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: 'https://paket-wyne.onrender.com',
    cleartext: true
  }
};

export default config;

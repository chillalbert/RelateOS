import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.relateos.app',
  appName: 'RelateOS',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nelio.financeiro',
  appName: 'Nelio R$',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      androidClientId: '351620900465-qlhn5479j2jhhi4742inejkf544eq1f1.apps.googleusercontent.com',
    },
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: '#00A1E8',
      style: 'DARK',
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
    },
  },
};

export default config;

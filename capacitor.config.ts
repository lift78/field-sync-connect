import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.da3c5a951a55424bb1b2b102a1fdb4b2',
  appName: 'Lift Offline',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    Keyboard: {
      resize: 'none',            
      resizeOnFullScreen: false,   
    },
  },
};

export default config;

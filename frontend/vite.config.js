import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const certDir = path.resolve(__dirname, '../infrastructure/certs');
const certFile = path.join(certDir, 'quillow.local.crt');
const keyFile = path.join(certDir, 'quillow.local.key');
const isFile = (filePath) => {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
};
const hasLocalCert = isFile(certFile) && isFile(keyFile);
const devHost = process.env.VITE_DEV_HOST || 'localhost';
const wafHost = process.env.VITE_WAF_HOST || devHost;
const wafPort = process.env.VITE_WAF_PORT || '8081';
const wafProtocol = process.env.VITE_WAF_PROTOCOL || 'https';
const wafTarget = `${wafProtocol}://${wafHost}:${wafPort}`;
const useCustomCert = String(process.env.VITE_USE_LOCAL_CERT || '')
  .trim()
  .toLowerCase() === 'true';
const httpsConfig = useCustomCert && hasLocalCert
  ? {
      cert: fs.readFileSync(certFile),
      key: fs.readFileSync(keyFile),
    }
  : true;

export default defineConfig({
  plugins: [react()],
  server: {
    host: devHost,
    port: 5173,
    strictPort: true,
    https: httpsConfig,
    proxy: {
      '/api': {
        target: wafTarget,
        changeOrigin: true,
        secure: wafProtocol === 'https' ? false : undefined,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/socket.io': {
        target: wafTarget,
        changeOrigin: true,
        ws: true,
        secure: wafProtocol === 'https' ? false : undefined,
      },
    },
  },
});

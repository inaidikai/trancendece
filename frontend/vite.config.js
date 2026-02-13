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
const hasLocalCert = fs.existsSync(certFile) && fs.existsSync(keyFile);
const devHost = process.env.VITE_DEV_HOST || 'localhost';
const wafHost = process.env.VITE_WAF_HOST || devHost;
const wafPort = process.env.VITE_WAF_PORT || '8081';
const wafProtocol = process.env.VITE_WAF_PROTOCOL || 'https';

export default defineConfig({
  plugins: [react()],
  server: {
    host: devHost,
    port: 5173,
    https: hasLocalCert
      ? {
          cert: fs.readFileSync(certFile),
          key: fs.readFileSync(keyFile),
        }
      : undefined,
    proxy: {
      '/api': {
        target: `${wafProtocol}://${wafHost}:${wafPort}`,
        changeOrigin: true,
        secure: wafProtocol === 'https' ? false : undefined,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },

});

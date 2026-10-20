import { defineConfig, devices } from '@playwright/test';

// Configuração E2E do +JUNTOS.
//
// Local (browser): o Playwright arranca um servidor Express em modo produção a
// servir o artefacto de teste `dist-e2e/` (separado do build de produção). Antes
// de correr, constrói esse artefacto:
//   npm run build:e2e
//   npm run test:e2e
// O `webServer` trata do `npm start` (com DIST_DIR=dist-e2e), pelo que não é
// preciso arrancar nada à mão. O artefacto de produção (`npm run build` → dist/)
// nunca aponta para localhost.
//
// Staging (protocolo contra o Worker): só corre com E2E_STAGING=1.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // O modo staging fala diretamente com o Worker; não precisa de servidor local.
  webServer:
    process.env.E2E_STAGING === '1'
      ? undefined
      : {
          command: 'npm start',
          url: 'http://localhost:3000/api/healthz',
          reuseExistingServer: !process.env.CI,
          timeout: 90_000,
          env: {
            NODE_ENV: 'production',
            DIST_DIR: 'dist-e2e',
          },
        },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

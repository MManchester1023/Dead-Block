// Probes: slow, printed-result simulation runs (balance bots, fingerprints). Not part of `npm test`.
//   npm run probe                 all of them (several minutes)
//   npm run probe -- region2      just the ones whose file name matches
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['tools/probes/**/*.probe.ts'], testTimeout: 900000 },
});

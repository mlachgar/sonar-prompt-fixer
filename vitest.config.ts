import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'src/prompt/**/*.ts',
        'src/sonar/SonarBackendFactory.ts',
        'src/sonar/SonarCloudBackend.ts',
        'src/sonar/SonarQubeServerBackend.ts',
        'src/sonar/mappers.ts',
        'src/state/**/*.ts',
        'src/util/**/*.ts'
      ],
      exclude: [
        'src/prompt/types.ts',
        'src/sonar/types.ts',
        'src/util/secrets.ts'
      ],
      thresholds: {
        lines: 96,
        functions: 96,
        statements: 96,
        branches: 96
      }
    }
  }
});

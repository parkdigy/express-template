import { type Config } from 'jest';

const config: Config = {
  verbose: false,
  transform: {
    '^.+\\.(js|ts)$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  testEnvironment: 'node',
  setupFiles: ['dotenv/config'],
  forceExit: true,
  detectOpenHandles: true,
  transformIgnorePatterns: ['/node_modules/(?!uuid)'],
};

module.exports = config;

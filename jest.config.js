module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^db$': '<rootDir>/packages/db/src/index.ts',
    '^shared$': '<rootDir>/packages/shared/src/index.ts'
  },
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/e2e/'],
  collectCoverage: true,
  coverageReporters: ['text', 'json', 'lcov'],
  collectCoverageFrom: [
    'server/src/services/billing/conversion.service.ts',
    'server/src/services/radar/radar.service.ts'
  ]
};

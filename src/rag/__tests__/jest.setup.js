// Jest setup file for RAG tests

// Suppress console logs during tests unless explicitly needed
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Mock timers for tests that need precise timing control
jest.useFakeTimers();

// Increase timeout for async operations
jest.setTimeout(30000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// Reset modules between tests to ensure clean state
afterEach(() => {
  jest.resetModules();
});
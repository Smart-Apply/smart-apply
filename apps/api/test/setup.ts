/**
 * Test environment setup
 * Sets required environment variables for E2E tests
 */

// Set a strong test JWT secret (meets 64+ char requirement)
process.env.JWT_SECRET =
  'test_jwt_secret_for_e2e_tests_minimum_64_characters_required_for_security_validation';

// Ensure test database URL is set
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/smartapply_test';

// Use in-memory/mock providers for tests
process.env.STORAGE_DRIVER = 'disk';
process.env.LLM_PROVIDER = 'mock';
process.env.JOBS_DRIVER = 'in-memory';
process.env.NODE_ENV = 'test';

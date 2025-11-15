import { validateEnv } from './env.schema';

describe('JWT Secret Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env before each test
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should reject JWT_SECRET shorter than 64 characters', () => {
    process.env.JWT_SECRET = 'weak_secret_only_32_characters!';

    expect(() => validateEnv()).toThrow('JWT_SECRET must be at least 64 characters');
  });

  it('should reject JWT_SECRET containing "change"', () => {
    process.env.JWT_SECRET =
      'change_me_to_a_strong_secret_minimum_64_characters_long_for_production';

    expect(() => validateEnv()).toThrow('JWT_SECRET cannot contain placeholder text');
  });

  it('should reject JWT_SECRET containing "REPLACE"', () => {
    process.env.JWT_SECRET =
      'REPLACE_WITH_SECURE_RANDOM_SECRET_MINIMUM_64_CHARACTERS_USE_OPENSSL_RAND_BASE64_64';

    expect(() => validateEnv()).toThrow('JWT_SECRET cannot contain placeholder text');
  });

  it('should reject JWT_SECRET containing "example"', () => {
    process.env.JWT_SECRET = 'example_secret_for_testing_minimum_64_characters_long_not_production';

    expect(() => validateEnv()).toThrow('JWT_SECRET cannot contain placeholder text');
  });

  it('should accept JWT_SECRET with 64+ characters and no placeholders', () => {
    // Real secret generated with: openssl rand -base64 64
    process.env.JWT_SECRET =
      'sXeS4t0WUUSGWSNF39j81hVFFpaCX3xgWco3a2Sb+ClEvHlcmxd//0IUlLdAAxza3cNkxoci8UuFtyVxeLONkg==';

    expect(() => validateEnv()).not.toThrow();
    const config = validateEnv();
    expect(config.JWT_SECRET.length).toBeGreaterThanOrEqual(64);
  });
});

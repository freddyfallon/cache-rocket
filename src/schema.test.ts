import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ServerEnvSchema, type ServerEnv } from '../src/launch-server';

describe('Zod Schema Validation', () => {
  it('should validate minimal required environment', () => {
    const validEnv = {
      PORT: '3000',
      TURBO_TOKEN: 'abc123',
    };

    const result = ServerEnvSchema.parse(validEnv);
    expect(result).toEqual(validEnv);
  });

  it('should validate environment with storage provider', () => {
    const validEnv: ServerEnv = {
      PORT: '4000',
      TURBO_TOKEN: 'xyz789',
      STORAGE_PROVIDER: 's3',
      STORAGE_PATH: 'my-bucket',
    };

    const result = ServerEnvSchema.parse(validEnv);
    expect(result).toEqual(validEnv);
  });

  it('should validate environment with only storage provider', () => {
    const validEnv = {
      PORT: '5000',
      TURBO_TOKEN: 'provider-only-token',
      STORAGE_PROVIDER: 'google-cloud-storage',
    };

    const result = ServerEnvSchema.parse(validEnv);
    expect(result).toEqual(validEnv);
  });

  it('should validate environment with only storage path', () => {
    const validEnv = {
      PORT: '6000',
      TURBO_TOKEN: 'path-only-token',
      STORAGE_PATH: 'my-container',
    };

    const result = ServerEnvSchema.parse(validEnv);
    expect(result).toEqual(validEnv);
  });

  it('should reject environment missing PORT', () => {
    const invalidEnv = {
      TURBO_TOKEN: 'missing-port-token',
    };

    expect(() => ServerEnvSchema.parse(invalidEnv)).toThrow();
  });

  it('should reject environment missing TURBO_TOKEN', () => {
    const invalidEnv = {
      PORT: '7000',
    };

    expect(() => ServerEnvSchema.parse(invalidEnv)).toThrow();
  });

  it('should reject environment with invalid PORT type', () => {
    const invalidEnv = {
      PORT: 8000, // number instead of string
      TURBO_TOKEN: 'invalid-port-type',
    };

    expect(() => ServerEnvSchema.parse(invalidEnv)).toThrow();
  });

  it('should reject environment with invalid TURBO_TOKEN type', () => {
    const invalidEnv = {
      PORT: '9000',
      TURBO_TOKEN: null, // null instead of string
    };

    expect(() => ServerEnvSchema.parse(invalidEnv)).toThrow();
  });

  it('should reject environment with invalid STORAGE_PROVIDER type', () => {
    const invalidEnv = {
      PORT: '10000',
      TURBO_TOKEN: 'invalid-provider-type',
      STORAGE_PROVIDER: 123, // number instead of string
    };

    expect(() => ServerEnvSchema.parse(invalidEnv)).toThrow();
  });

  it('should reject environment with invalid STORAGE_PATH type', () => {
    const invalidEnv = {
      PORT: '11000',
      TURBO_TOKEN: 'invalid-path-type',
      STORAGE_PATH: [], // array instead of string
    };

    expect(() => ServerEnvSchema.parse(invalidEnv)).toThrow();
  });

  it('should provide detailed error messages', () => {
    const invalidEnv = {};

    try {
      ServerEnvSchema.parse(invalidEnv);
      expect.fail('Should have thrown validation error');
    } catch (error) {
      expect(error).toBeInstanceOf(z.ZodError);
      const zodError = error as z.ZodError;

      expect(zodError.issues).toHaveLength(2); // PORT and TURBO_TOKEN required
      expect(zodError.issues.some((issue) => issue.path.includes('PORT'))).toBe(
        true
      );
      expect(
        zodError.issues.some((issue) => issue.path.includes('TURBO_TOKEN'))
      ).toBe(true);
    }
  });

  it('should handle all supported storage providers', () => {
    const providers = ['s3', 'google-cloud-storage', 'azure-blob-storage'];

    providers.forEach((provider) => {
      const validEnv = {
        PORT: '12000',
        TURBO_TOKEN: `${provider}-token`,
        STORAGE_PROVIDER: provider,
        STORAGE_PATH: `${provider}-path`,
      };

      expect(() => ServerEnvSchema.parse(validEnv)).not.toThrow();
    });
  });

  it('should preserve type information correctly', () => {
    const validEnv = {
      PORT: '13000',
      TURBO_TOKEN: 'type-test-token',
      STORAGE_PROVIDER: 's3',
      STORAGE_PATH: 'type-test-bucket',
    };

    const result = ServerEnvSchema.parse(validEnv);

    // TypeScript should infer the correct types
    const port: string = result.PORT;
    const token: string = result.TURBO_TOKEN;
    const provider: string | undefined = result.STORAGE_PROVIDER;
    const path: string | undefined = result.STORAGE_PATH;

    expect(typeof port).toBe('string');
    expect(typeof token).toBe('string');
    expect(typeof provider).toBe('string');
    expect(typeof path).toBe('string');
  });
});

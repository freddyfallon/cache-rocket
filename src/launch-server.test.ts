import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as core from '@actions/core';
import portfinder from 'portfinder';
import waitPort from 'wait-port';
import { randomBytes } from 'crypto';
import { startCacheServer } from '../src/launch-server';

// Mock all external dependencies
vi.mock('@actions/core');
vi.mock('child_process');
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
  },
}));
vi.mock('portfinder');
vi.mock('wait-port');
vi.mock('crypto');

// Mock the start module
const mockSpawn = vi.mocked(spawn);
const mockCore = vi.mocked(core);
const mockPortfinder = vi.mocked(portfinder);
const mockWaitPort = vi.mocked(waitPort);
const mockFs = vi.mocked(fs);
const mockRandomBytes = vi.mocked(randomBytes);

describe('start.ts - Main Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mocks
    mockCore.getInput = vi.fn().mockReturnValue('');
    mockCore.exportVariable = vi.fn();
    mockCore.info = vi.fn();
    mockCore.saveState = vi.fn();
    mockCore.setFailed = vi.fn();

    mockPortfinder.getPortPromise = vi.fn().mockResolvedValue(3000);

    mockRandomBytes.mockReturnValue(Buffer.alloc(32) as any);

    mockFs.mkdir = vi.fn().mockResolvedValue(undefined);

    mockWaitPort.mockResolvedValue({ open: true, ipVersion: 4 });

    mockSpawn.mockReturnValue({
      pid: 12345,
      unref: vi.fn(),
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create logs directory', async () => {
    await startCacheServer();

    expect(mockFs.mkdir).toHaveBeenCalledWith('logs', { recursive: true });
  });

  it('should get available port using portfinder', async () => {
    await startCacheServer();

    expect(mockPortfinder.getPortPromise).toHaveBeenCalled();
  });

  it('should generate secure token', async () => {
    await startCacheServer();

    expect(mockRandomBytes).toHaveBeenCalledWith(32);
  });

  it('should read action inputs correctly', async () => {
    mockCore.getInput
      .mockReturnValueOnce('s3') // storage-provider
      .mockReturnValueOnce('my-bucket') // storage-path
      .mockReturnValueOnce('my-team') // team-id
      .mockReturnValueOnce('http://localhost'); // host

    await startCacheServer();

    expect(mockCore.getInput).toHaveBeenCalledWith('storage-provider');
    expect(mockCore.getInput).toHaveBeenCalledWith('storage-path');
    expect(mockCore.getInput).toHaveBeenCalledWith('team-id');
    expect(mockCore.getInput).toHaveBeenCalledWith('host');
  });

  it('should export environment variables for Turborepo', async () => {
    await startCacheServer();

    expect(mockCore.exportVariable).toHaveBeenCalledWith(
      'TURBO_API',
      'http://127.0.0.1:3000'
    );
    expect(mockCore.exportVariable).toHaveBeenCalledWith(
      'TURBO_TOKEN',
      expect.any(String)
    );
    expect(mockCore.exportVariable).toHaveBeenCalledWith('TURBO_TEAM', 'ci');
  });

  it('should spawn turborepo-remote-cache with correct arguments', async () => {
    await startCacheServer();

    expect(mockSpawn).toHaveBeenCalledWith(
      'npx',
      ['turborepo-remote-cache'],
      expect.objectContaining({
        detached: true,
        stdio: 'ignore',
        env: expect.any(Object),
      })
    );
  });

  it('should wait for port to be available', async () => {
    await startCacheServer();

    expect(mockWaitPort).toHaveBeenCalledWith({
      host: 'localhost',
      port: 3000,
      timeout: 30000,
    });
  });

  it('should log server information when started successfully', async () => {
    await startCacheServer();

    expect(mockCore.info).toHaveBeenCalledWith(
      '✅ Turborepo Remote Cache Server started'
    );
    expect(mockCore.info).toHaveBeenCalledWith('   PID: 12345');
    expect(mockCore.info).toHaveBeenCalledWith('   Port: 3000');
    expect(mockCore.info).toHaveBeenCalledWith('   API: http://127.0.0.1:3000');
    expect(mockCore.info).toHaveBeenCalledWith('   Team: ci');
  });

  it('should log storage provider information when provided', async () => {
    mockCore.getInput
      .mockReturnValueOnce('s3') // storage-provider
      .mockReturnValueOnce('my-bucket'); // storage-path

    await startCacheServer();

    expect(mockCore.info).toHaveBeenCalledWith('   Storage Provider: s3');
    expect(mockCore.info).toHaveBeenCalledWith('   Storage Path: my-bucket');
  });

  it('should save server state for cleanup', async () => {
    await startCacheServer();

    expect(mockCore.saveState).toHaveBeenCalledWith('serverPid', '12345');
    expect(mockCore.saveState).toHaveBeenCalledWith('serverPort', '3000');
  });

  it('should handle port not opening within timeout', async () => {
    mockWaitPort.mockResolvedValue({ open: false, ipVersion: 4 });

    await startCacheServer();

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      'Failed to start Turborepo Remote Cache Server: Port 3000 did not open within 30 seconds'
    );
  });

  it('should handle errors gracefully', async () => {
    mockPortfinder.getPortPromise.mockRejectedValue(
      new Error('No ports available')
    );

    await startCacheServer();

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      'Failed to start Turborepo Remote Cache Server: No ports available'
    );
  });

  it('should include storage environment variables in spawn env', async () => {
    mockCore.getInput
      .mockReturnValueOnce('s3') // storage-provider
      .mockReturnValueOnce('my-bucket'); // storage-path

    await startCacheServer();

    expect(mockSpawn).toHaveBeenCalledWith(
      'npx',
      ['turborepo-remote-cache'],
      expect.objectContaining({
        env: expect.objectContaining({
          STORAGE_PROVIDER: 's3',
          STORAGE_PATH: 'my-bucket',
          PORT: '3000',
          TURBO_TOKEN: expect.any(String),
        }),
      })
    );
  });
});

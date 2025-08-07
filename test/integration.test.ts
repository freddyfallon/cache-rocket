import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as core from '@actions/core';
import { startCacheServer } from '../src/launch-server';
import { cleanupCacheServer } from '../src/cleanup-server';

// Mock all external dependencies for integration tests
vi.mock('@actions/core');
vi.mock('child_process');
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(''),
  },
}));
vi.mock('portfinder');
vi.mock('wait-port');
vi.mock('crypto');

const mockCore = vi.mocked(core);

describe('Integration Tests - Full Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up realistic mocks for full workflow
    mockCore.getInput = vi.fn();
    mockCore.exportVariable = vi.fn();
    mockCore.info = vi.fn();
    mockCore.saveState = vi.fn();
    mockCore.getState = vi.fn();
    mockCore.setFailed = vi.fn();
    mockCore.debug = vi.fn();
    mockCore.startGroup = vi.fn();
    mockCore.endGroup = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle complete workflow with S3 storage', async () => {
    // Configure inputs for S3 workflow
    mockCore.getInput
      .mockReturnValueOnce('s3') // storage-provider
      .mockReturnValueOnce('my-s3-bucket') // storage-path
      .mockReturnValueOnce('production') // team-id
      .mockReturnValueOnce('http://localhost'); // host

    // Mock successful start
    const { spawn } = await import('child_process');
    const { default: portfinder } = await import('portfinder');
    const { default: waitPort } = await import('wait-port');
    const { randomBytes } = await import('crypto');

    vi.mocked(portfinder.getPortPromise).mockResolvedValue(4000);
    vi.mocked(randomBytes).mockReturnValue(Buffer.alloc(32) as any);
    vi.mocked(waitPort).mockResolvedValue({ open: true, ipVersion: 4 });
    vi.mocked(spawn).mockReturnValue({ pid: 54321, unref: vi.fn() } as any);

    // Run start action
    await startCacheServer();

    // Verify start action behavior
    expect(mockCore.exportVariable).toHaveBeenCalledWith(
      'TURBO_API',
      'http://localhost:4000'
    );
    expect(mockCore.exportVariable).toHaveBeenCalledWith(
      'TURBO_TOKEN',
      expect.any(String)
    );
    expect(mockCore.exportVariable).toHaveBeenCalledWith(
      'TURBO_TEAM',
      'production'
    );

    expect(mockCore.info).toHaveBeenCalledWith(
      '✅ Turborepo Remote Cache Server started'
    );
    expect(mockCore.info).toHaveBeenCalledWith('   Storage Provider: s3');
    expect(mockCore.info).toHaveBeenCalledWith('   Storage Path: my-s3-bucket');

    expect(mockCore.saveState).toHaveBeenCalledWith('serverPid', '54321');
    expect(mockCore.saveState).toHaveBeenCalledWith('serverPort', '4000');

    // Clear mocks for post action
    vi.clearAllMocks();
    mockCore.getState.mockReturnValue('54321');

    // Mock successful cleanup
    const originalKill = process.kill;
    const mockKill = vi.fn().mockReturnValue(true);
    process.kill = mockKill as any;

    // Run post action
    await cleanupCacheServer();

    // Verify post action behavior
    expect(mockCore.getState).toHaveBeenCalledWith('serverPid');
    expect(mockKill).toHaveBeenCalledWith(54321, 'SIGTERM');
    expect(mockCore.info).toHaveBeenCalledWith(
      '✅ Turborepo Remote Cache Server stopped (PID: 54321)'
    );

    // Restore process.kill
    process.kill = originalKill;
  });

  it('should handle workflow with minimal configuration', async () => {
    // Configure minimal inputs (all defaults)
    mockCore.getInput.mockReturnValue('');

    // Mock successful minimal setup
    const { spawn } = await import('child_process');
    const { default: portfinder } = await import('portfinder');
    const { default: waitPort } = await import('wait-port');
    const { randomBytes } = await import('crypto');

    vi.mocked(portfinder.getPortPromise).mockResolvedValue(3001);
    vi.mocked(randomBytes).mockReturnValue(Buffer.alloc(32) as any);
    vi.mocked(waitPort).mockResolvedValue({ open: true, ipVersion: 4 });
    vi.mocked(spawn).mockReturnValue({ pid: 11111, unref: vi.fn() } as any);

    await startCacheServer();

    // Should use defaults
    expect(mockCore.exportVariable).toHaveBeenCalledWith(
      'TURBO_API',
      'http://127.0.0.1:3001'
    );
    expect(mockCore.exportVariable).toHaveBeenCalledWith('TURBO_TEAM', 'ci');

    // Should not log storage info when not provided
    expect(mockCore.info).not.toHaveBeenCalledWith(
      expect.stringContaining('Storage Provider:')
    );
  });

  it('should handle error cascade from start to post', async () => {
    // Configure inputs
    mockCore.getInput.mockReturnValue('gcs');

    // Mock successful port finding but port failure to open
    const { default: portfinder } = await import('portfinder');
    const { default: waitPort } = await import('wait-port');
    const { randomBytes } = await import('crypto');
    const { spawn } = await import('child_process');

    vi.mocked(portfinder.getPortPromise).mockResolvedValue(4001);
    vi.mocked(randomBytes).mockReturnValue(Buffer.alloc(32) as any);
    vi.mocked(spawn).mockReturnValue({ pid: 99999, unref: vi.fn() } as any);
    vi.mocked(waitPort).mockResolvedValue({ open: false, ipVersion: 4 });
    await startCacheServer();

    // Should fail start action
    expect(mockCore.setFailed).toHaveBeenCalledWith(
      'Failed to start Turborepo Remote Cache Server: Port 4001 did not open within 30 seconds'
    );

    // Clear and setup for post action with no PID (because start failed)
    vi.clearAllMocks();
    mockCore.getState.mockReturnValue(''); // No PID saved

    await cleanupCacheServer();

    // Should handle missing PID gracefully
    expect(mockCore.info).toHaveBeenCalledWith(
      '❌ Turborepo Remote Cache Server was not started or PID not found'
    );
  });

  it('should validate environment variables with Zod', async () => {
    // This test ensures our Zod schema works in practice
    mockCore.getInput
      .mockReturnValueOnce('azure-blob-storage')
      .mockReturnValueOnce('my-container');

    const { spawn } = await import('child_process');
    const { default: portfinder } = await import('portfinder');
    const { default: waitPort } = await import('wait-port');
    const { randomBytes } = await import('crypto');

    vi.mocked(portfinder.getPortPromise).mockResolvedValue(5000);
    vi.mocked(randomBytes).mockReturnValue(Buffer.alloc(32) as any);
    vi.mocked(waitPort).mockResolvedValue({ open: true, ipVersion: 4 });
    vi.mocked(spawn).mockReturnValue({ pid: 99999, unref: vi.fn() } as any);

    await startCacheServer();

    // Should not throw Zod validation errors
    expect(mockCore.setFailed).not.toHaveBeenCalled();
    expect(mockCore.info).toHaveBeenCalledWith(
      '✅ Turborepo Remote Cache Server started'
    );
  });

  it('should handle all supported storage providers', async () => {
    const providers = [
      { provider: 's3', path: 's3-bucket' },
      { provider: 'google-cloud-storage', path: 'gcs-bucket' },
      { provider: 'azure-blob-storage', path: 'azure-container' },
    ];

    for (const { provider, path } of providers) {
      vi.clearAllMocks();

      mockCore.getInput.mockReturnValueOnce(provider).mockReturnValueOnce(path);

      const { spawn } = await import('child_process');
      const { default: portfinder } = await import('portfinder');
      const { default: waitPort } = await import('wait-port');
      const { randomBytes } = await import('crypto');

      vi.mocked(portfinder.getPortPromise).mockResolvedValue(6000);
      vi.mocked(randomBytes).mockReturnValue(Buffer.alloc(32) as any);
      vi.mocked(waitPort).mockResolvedValue({ open: true, ipVersion: 4 });

      const mockSpawn = vi
        .mocked(spawn)
        .mockReturnValue({ pid: 77777, unref: vi.fn() } as any);

      await startCacheServer();

      // Verify provider-specific environment variables are passed
      expect(mockSpawn).toHaveBeenCalledWith(
        'npx',
        ['turborepo-remote-cache'],
        expect.objectContaining({
          env: expect.objectContaining({
            STORAGE_PROVIDER: provider,
            STORAGE_PATH: path,
          }),
        })
      );

      expect(mockCore.info).toHaveBeenCalledWith(
        `   Storage Provider: ${provider}`
      );
      expect(mockCore.info).toHaveBeenCalledWith(`   Storage Path: ${path}`);
    }
  });
});

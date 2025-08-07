import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as core from '@actions/core';
import { cleanupCacheServer } from '../src/cleanup-server';

// Mock all external dependencies
vi.mock('@actions/core');
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

// Mock process.kill
const originalKill = process.kill;
const mockKill = vi.fn();

const mockCore = vi.mocked(core);
const mockFs = vi.mocked(fs);

describe('post.ts - Cleanup Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock process.kill
    process.kill = mockKill as any;

    // Set up default mocks
    mockCore.getState = vi.fn().mockReturnValue('12345');
    mockCore.info = vi.fn();
    mockCore.debug = vi.fn();
    mockCore.setFailed = vi.fn();
    mockCore.startGroup = vi.fn();
    mockCore.endGroup = vi.fn();

    mockFs.readFile = vi.fn().mockResolvedValue('');
    mockKill.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.kill = originalKill;
  });

  it('should get server PID from state', async () => {
    await cleanupCacheServer();

    expect(mockCore.getState).toHaveBeenCalledWith('serverPid');
  });

  it('should handle missing server PID gracefully', async () => {
    mockCore.getState.mockReturnValue('');

    await cleanupCacheServer();

    expect(mockCore.info).toHaveBeenCalledWith(
      '❌ Turborepo Remote Cache Server was not started or PID not found'
    );
    expect(mockKill).not.toHaveBeenCalled();
  });

  it('should terminate server process with SIGTERM', async () => {
    await cleanupCacheServer();

    expect(mockKill).toHaveBeenCalledWith(12345, 'SIGTERM');
    expect(mockCore.info).toHaveBeenCalledWith(
      '✅ Turborepo Remote Cache Server stopped (PID: 12345)'
    );
  });

  it('should handle process kill failure gracefully', async () => {
    mockKill.mockImplementation(() => {
      throw new Error('Process not found');
    });

    await cleanupCacheServer();

    expect(mockCore.info).toHaveBeenCalledWith(
      '❌ Failed to stop server process 12345: Process not found'
    );
  });

  it('should attempt to read log files', async () => {
    await cleanupCacheServer();

    expect(mockFs.readFile).toHaveBeenCalledWith(
      'logs/turborepo-remote-cache.log',
      'utf8'
    );
    expect(mockFs.readFile).toHaveBeenCalledWith(
      'logs/turborepo-remote-cache-error.log',
      'utf8'
    );
  });

  it('should display log content when available', async () => {
    const logContent = 'Server started successfully\nProcessing cache request';
    mockFs.readFile.mockResolvedValue(logContent);

    await cleanupCacheServer();

    expect(mockCore.startGroup).toHaveBeenCalledWith(
      '📋 logs/turborepo-remote-cache.log'
    );
    expect(mockCore.info).toHaveBeenCalledWith(
      '  Server started successfully\n  Processing cache request'
    );
    expect(mockCore.endGroup).toHaveBeenCalled();
  });

  it('should skip empty log files', async () => {
    mockFs.readFile.mockResolvedValue('   '); // whitespace only

    await cleanupCacheServer();

    expect(mockCore.startGroup).not.toHaveBeenCalled();
    expect(mockCore.endGroup).not.toHaveBeenCalled();
  });

  it('should handle log file read errors gracefully', async () => {
    mockFs.readFile.mockRejectedValue(new Error('File not found'));

    await cleanupCacheServer();

    expect(mockCore.debug).toHaveBeenCalledWith(
      'Could not read log file logs/turborepo-remote-cache.log: File not found'
    );
    expect(mockCore.debug).toHaveBeenCalledWith(
      'Could not read log file logs/turborepo-remote-cache-error.log: File not found'
    );
  });

  it('should indent log content correctly', async () => {
    const logContent = 'Line 1\nLine 2\nLine 3';
    mockFs.readFile.mockResolvedValue(logContent);

    await cleanupCacheServer();

    expect(mockCore.info).toHaveBeenCalledWith('  Line 1\n  Line 2\n  Line 3');
  });

  it('should handle multiple log files independently', async () => {
    mockFs.readFile
      .mockResolvedValueOnce('Main log content')
      .mockRejectedValueOnce(new Error('Error log not found'));

    await cleanupCacheServer();

    // Should process the successful log
    expect(mockCore.startGroup).toHaveBeenCalledWith(
      '📋 logs/turborepo-remote-cache.log'
    );
    expect(mockCore.info).toHaveBeenCalledWith('  Main log content');
    expect(mockCore.endGroup).toHaveBeenCalled();

    // Should handle the failed log gracefully
    expect(mockCore.debug).toHaveBeenCalledWith(
      'Could not read log file logs/turborepo-remote-cache-error.log: Error log not found'
    );
  });

  it('should handle general errors without failing workflow', async () => {
    mockCore.getState.mockImplementation(() => {
      throw new Error('State access failed');
    });

    await cleanupCacheServer();

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      'Error in post action: State access failed'
    );
  });

  it('should process log files even if kill fails', async () => {
    mockKill.mockImplementation(() => {
      throw new Error('Kill failed');
    });
    mockFs.readFile.mockResolvedValue('Log content after kill failure');

    await cleanupCacheServer();

    // Should still try to read logs
    expect(mockFs.readFile).toHaveBeenCalledWith(
      'logs/turborepo-remote-cache.log',
      'utf8'
    );
    expect(mockCore.info).toHaveBeenCalledWith(
      '  Log content after kill failure'
    );
  });
});

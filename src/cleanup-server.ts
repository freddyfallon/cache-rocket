import * as core from '@actions/core';
import { promises as fs } from 'fs';

async function stopServer(serverPid: string): Promise<void> {
  try {
    process.kill(parseInt(serverPid), 'SIGTERM');
    core.info(`✅ Turborepo Remote Cache Server stopped (PID: ${serverPid})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.info(`❌ Failed to stop server process ${serverPid}: ${message}`);
  }
}

async function displayLogFile(logFile: string): Promise<void> {
  try {
    const logContent = await fs.readFile(logFile, 'utf8');
    if (logContent.trim()) {
      core.startGroup(`📋 ${logFile}`);
      const indentedContent = logContent
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n');
      core.info(indentedContent);
      core.endGroup();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.debug(`Could not read log file ${logFile}: ${message}`);
  }
}

async function displayLogs(): Promise<void> {
  const logFiles = [
    'logs/turborepo-remote-cache.log',
    'logs/turborepo-remote-cache-error.log',
  ];

  await Promise.all(logFiles.map(displayLogFile));
}

export async function cleanupCacheServer(): Promise<void> {
  try {
    const serverPid = core.getState('serverPid');

    if (!serverPid) {
      core.info(
        '❌ Turborepo Remote Cache Server was not started or PID not found'
      );
      return;
    }

    await stopServer(serverPid);
    await displayLogs();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`Error in post action: ${message}`);
  }
}

// Only run main if this module is executed directly (not imported for testing)
if (require.main === module) {
  cleanupCacheServer().catch(core.setFailed);
}

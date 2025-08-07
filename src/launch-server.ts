import * as core from '@actions/core';
import { ChildProcess, spawn } from 'child_process';
import { promises as fs } from 'fs';
import portfinder from 'portfinder';
import { randomBytes } from 'crypto';
import waitPort from 'wait-port';
import { z } from 'zod';

export const ServerEnvSchema = z.object({
  PORT: z.string(),
  TURBO_TOKEN: z.string(),
  STORAGE_PROVIDER: z.string().optional(),
  STORAGE_PATH: z.string().optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export async function startCacheServer(): Promise<void> {
  try {
    const logDir = 'logs';
    await fs.mkdir(logDir, { recursive: true });

    const port = await portfinder.getPortPromise();
    const token = randomBytes(32).toString('hex');

    const storageProvider = core.getInput('storage-provider');
    const storagePath = core.getInput('storage-path');
    const teamId = core.getInput('team-id') || 'ci';
    const host = core.getInput('host') || 'http://127.0.0.1';

    const turboApi = `${host}:${port}`;

    core.exportVariable('TURBO_API', turboApi);
    core.exportVariable('TURBO_TOKEN', token);
    core.exportVariable('TURBO_TEAM', teamId);

    const serverEnvData: ServerEnv = {
      PORT: port.toString(),
      TURBO_TOKEN: token,
      ...(storageProvider && { STORAGE_PROVIDER: storageProvider }),
      ...(storagePath && { STORAGE_PATH: storagePath }),
    };

    const validatedEnv = ServerEnvSchema.parse(serverEnvData);

    const env = {
      ...process.env,
      ...validatedEnv,
    };

    const serverProcess: ChildProcess = spawn(
      'npx',
      ['turborepo-remote-cache'],
      {
        detached: true,
        stdio: 'ignore',
        env,
      }
    );

    // Ensure the process doesn't keep the parent alive
    serverProcess.unref();

    const result = await waitPort({
      host: 'localhost',
      port,
      timeout: 30000,
    });

    if (!result.open) {
      throw new Error(`Port ${port} did not open within 30 seconds`);
    }

    core.info(`✅ Turborepo Remote Cache Server started`);
    core.info(`   PID: ${serverProcess.pid}`);
    core.info(`   Port: ${port}`);
    core.info(`   API: ${turboApi}`);
    core.info(`   Team: ${teamId}`);

    if (storageProvider) {
      core.info(`   Storage Provider: ${storageProvider}`);
    }
    if (storagePath) {
      core.info(`   Storage Path: ${storagePath}`);
    }

    core.saveState('serverPid', serverProcess.pid?.toString() ?? '');
    core.saveState('serverPort', port.toString());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`Failed to start Turborepo Remote Cache Server: ${message}`);
  }
}

// Only run main if this module is executed directly (not imported for testing)
if (require.main === module) {
  startCacheServer().catch(core.setFailed);
}

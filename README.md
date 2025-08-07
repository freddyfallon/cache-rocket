# 🚀 Cache Rocket

**Supercharge your Turborepo builds with a blazing-fast remote cache server!**

Cache Rocket is a GitHub Action that turbocharges your Turborepo builds by automatically starting and managing the powerful [`turborepo-remote-cache`](https://github.com/ducktors/turborepo-remote-cache) server during your CI/CD workflows. This action eliminates the need for manual setup by launching the `turborepo-remote-cache` server in the background and configuring all necessary environment variables for seamless Turborepo integration.

🚀 **Lightning-fast builds** • 🌐 **Multi-cloud support** • ⚡ **Zero configuration** • 🛠️ **Production ready**

## How It Works

### Startup Process (Main Action)

1. **Creates a logs directory** for server output capture
2. **Finds an available port** using `portfinder` to avoid conflicts
3. **Generates a secure 64-character hex token** using Node.js crypto for cache authentication
4. **Reads action inputs** for storage configuration (provider, path, team-id, host)
5. **Exports Turborepo environment variables**:
   - `TURBO_API`: Complete API endpoint (e.g., `http://127.0.0.1:3001`)
   - `TURBO_TOKEN`: Generated secure token
   - `TURBO_TEAM`: Team identifier for cache organization (default: "ci")
6. **Spawns the `turborepo-remote-cache` server** using `npx turborepo-remote-cache` in detached mode
7. **Waits for server readiness** by polling the port until it's in use (30-second timeout)
8. **Reports server status** including PID, port, API endpoint, and storage configuration
9. **Saves server state** (PID and port) for cleanup in the post-action

### Cleanup Process (Post Action)

1. **Retrieves saved server state** from Cache Rocket's main action
2. **Terminates the `turborepo-remote-cache` server** using `SIGTERM` signal
3. **Attempts to read and display logs** from:
   - `logs/turborepo-remote-cache.log` (standard output)
   - `logs/turborepo-remote-cache-error.log` (error output)
4. **Formats and groups log output** with proper indentation using GitHub Actions collapsible groups
5. **Handles cleanup errors gracefully** without failing the workflow

## Usage

### Basic S3 Example

```yaml
name: Build with Remote Cache
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: 🚀 Launch Cache Rocket
        uses: freddyfallon/cache-rocket@v1
        with:
          storage-provider: s3
          storage-path: my-turborepo-cache-bucket
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: us-east-1

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build with Turbo (using Cache Rocket remote cache)
        run: npx turbo build
        # Cache Rocket automatically sets TURBO_API, TURBO_TOKEN, and TURBO_TEAM variables
```

### Google Cloud Storage Example

```yaml
- name: 🚀 Launch Cache Rocket
  uses: freddyfallon/cache-rocket@v1
  with:
    storage-provider: google-cloud-storage
    storage-path: my-gcs-bucket
    team-id: my-team
  env:
    GOOGLE_APPLICATION_CREDENTIALS: ${{ secrets.GCP_SA_KEY }}
```

### Azure Blob Storage Example

```yaml
- name: 🚀 Launch Cache Rocket
  uses: freddyfallon/cache-rocket@v1
  with:
    storage-provider: azure-blob-storage
    storage-path: my-container
    team-id: production
  env:
    AZURE_STORAGE_ACCOUNT: ${{ secrets.AZURE_STORAGE_ACCOUNT }}
    AZURE_STORAGE_KEY: ${{ secrets.AZURE_STORAGE_KEY }}
```

## Inputs

| Input              | Description                   | Required | Default            | Notes                                                       |
| ------------------ | ----------------------------- | -------- | ------------------ | ----------------------------------------------------------- |
| `storage-provider` | Storage backend type          | No       | -                  | Options: `s3`, `google-cloud-storage`, `azure-blob-storage` |
| `storage-path`     | Bucket/container name         | No       | -                  | Must exist and be accessible with provided credentials      |
| `team-id`          | Cache organization identifier | No       | `ci`               | Creates separate cache directories per team                 |
| `host`             | Server bind address           | No       | `http://127.0.0.1` | Usually doesn't need to be changed                          |
| `port`             | Specific port to use          | No       | auto-assigned      | Action finds available port automatically                   |

## Environment Variables Set

Cache Rocket automatically configures these variables for Turborepo to connect to the `turborepo-remote-cache` server:

- **`TURBO_API`**: Full API endpoint URL (e.g., `http://127.0.0.1:45123`)
- **`TURBO_TOKEN`**: Cryptographically secure authentication token
- **`TURBO_TEAM`**: Team identifier for cache namespace isolation

## Storage Provider Requirements

### AWS S3

- Bucket must exist and be accessible
- Required environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- Optional: `AWS_REGION` (recommended for performance)
- IAM permissions: `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`

### Google Cloud Storage

- Bucket must exist with appropriate permissions
- Required: `GOOGLE_APPLICATION_CREDENTIALS` pointing to service account key
- Service account needs: Storage Object Admin role

### Azure Blob Storage

- Container must exist
- Required: `AZURE_STORAGE_ACCOUNT`, `AZURE_STORAGE_KEY`
- Storage account needs: Blob Data Contributor role

## Technical Details

### Port Management

- Uses `portfinder` library to find available ports automatically
- Waits for port availability with `wait-port` before considering server ready
- 30-second timeout for server startup

### Process Management

- `turborepo-remote-cache` server runs in detached mode to prevent GitHub Actions from waiting
- Cache Rocket uses `SIGTERM` for graceful server shutdown in post-action
- Server process state is saved between Cache Rocket's main and post actions using GitHub Actions state

### Security

- Generates unique 64-character hexadecimal tokens per workflow run
- Tokens are not logged or persisted beyond the workflow execution
- Server only binds to localhost by default

### Error Handling

- Cache Rocket's main action fails workflow if `turborepo-remote-cache` server cannot start
- Post action logs errors but doesn't fail workflow during cleanup
- Gracefully handles missing log files and server processes

## Troubleshooting

### Cache Rocket Server Won't Start

- Check storage provider credentials are correctly set
- Verify bucket/container exists and is accessible
- Review GitHub Actions logs for Cache Rocket and `turborepo-remote-cache` error messages

### Cache Not Working

- Ensure `TURBO_API` and `TURBO_TOKEN` are set (Cache Rocket logs these)
- Verify Turborepo is configured to use remote cache
- Check that `team-id` matches between workflows sharing cache

### Port Conflicts

- Cache Rocket automatically finds available ports
- If issues persist, try specifying a custom port range in your runner environment

## Development

```bash
# Install dependencies
pnpm install

# Build Cache Rocket
pnpm run build

# Run linting
pnpm run lint

# Type check
pnpm run type-check
```

The built files in `dist/` are committed to the repository for GitHub Actions to use.

## What's Under the Hood

Cache Rocket is powered by the excellent [`turborepo-remote-cache`](https://github.com/ducktors/turborepo-remote-cache) project by Ducktors. We provide the GitHub Actions integration layer that:

- 🚀 **Auto-discovers available ports** to avoid conflicts
- ⚡ **Manages the server lifecycle** (start/stop) automatically
- 🔐 **Generates secure tokens** for each workflow run
- 🌐 **Configures all environment variables** Turborepo needs
- 📋 **Captures and displays logs** for easy debugging

This means you get all the power of `turborepo-remote-cache` with zero configuration! 🎯

## License

MIT

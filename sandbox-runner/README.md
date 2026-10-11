# IRHCF isolated sandbox runner

This is a **separate service**, not part of the main Render web service. It requires a dedicated Linux VM with Docker Engine. Do not mount the host Docker socket into the main IRHCF application or run this beside production application secrets.

## Build

From the repository root:

```sh
docker build -f sandbox-runner/worker.Dockerfile -t irhcf-sandbox:latest .
docker build -f sandbox-runner/Dockerfile -t irhcf-sandbox-runner:latest sandbox-runner
```

## Run on a dedicated VM

Generate a long random token and configure it as `IRHCF_SANDBOX_RUNNER_TOKEN` on both this service and the main IRHCF service. Keep the token in a secret manager; never commit it. Run the service with access to the Docker Engine socket on this dedicated host:

```sh
docker run -d --name irhcf-sandbox-runner --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  -e IRHCF_SANDBOX_RUNNER_TOKEN="$IRHCF_SANDBOX_RUNNER_TOKEN" \
  -v /var/run/docker.sock:/var/run/docker.sock \
  irhcf-sandbox-runner:latest
```

Place it behind a TLS reverse proxy or private network. Do not expose port 8080 directly to the public internet. Configure the main app's `IRHCF_SANDBOX_RUNNER_URL=https://<private-or-TLS-host>` and `IRHCF_SANDBOX_RUNNER_TOKEN` in Render's secret environment settings.

## Security model and limitations

- The runner authenticates requests, validates a strict command allowlist and file names, and limits request/file size and execution duration.
- Every job runs in a fresh Docker container with `--network=none`, memory/CPU/PID limits, read-only root filesystem, read-only source mount, dropped Linux capabilities, non-root UID, no-new-privileges, and a bounded tmpfs.
- This is hardened container isolation, **not a microVM**. The service has access to the Docker daemon and therefore must be on a dedicated, patched host with no unrelated workloads or credentials. A compromised runner API can abuse that daemon; treat it as a high-trust boundary.
- The worker image does not include application-specific third-party dependencies. Candidate tests requiring packages must provide a reviewed, prebuilt worker image or a separate dependency strategy; do not enable network access for arbitrary generated code.
- The service is not deployed by this repository change. A dedicated host, TLS/private routing, secret configuration, image build, and authenticated live smoke test are still required before claiming production isolation.

# Deployment

The release pipeline publishes a public multi-arch image (linux/amd64, linux/arm64) to GHCR:

```
ghcr.io/raisedadead/sentry-google-chat
```

Tags: `latest`, `vX.Y.Z` / `vX.Y`. Pin to a version tag or digest for reproducible deploys. The image runs as a non-root user and writes nothing to disk. How and where you run it is your call — the rest of this page is operational guidance plus one worked example (DigitalOcean App Platform).

```sh
docker run -p 8080:8080 --env-file .env ghcr.io/raisedadead/sentry-google-chat:latest
```

Required env: `SENTRY_CLIENT_SECRET`, `GCHAT_WEBHOOK_DEFAULT` (see the [configuration table](./README.md#configuration)).

## Resources

A small, stateless Node service. ~64Mi requested / ~192Mi is a comfortable ceiling. Any 512 MB / shared-CPU tier is plenty. `@sentry/node` raises memory only when `SENTRY_DSN` is set (init is a no-op otherwise).

## Run a single instance — do not autoscale

The delivery queue, per-space rate limiter (~1 msg/sec), and Request-ID idempotency cache all live in process memory. Running more than one replica causes duplicate Google Chat messages, broken per-space throttling, and missed deduplication. Set the instance/replica count to **1** and leave autoscaling **off**. Horizontal scale-out requires swapping the in-process delivery port for a durable queue (Redis / Cloud Tasks) — see the README *Limitations*.

## Health check

The service exposes `GET /healthz` → `200 {"status":"ok"}`. It has no external dependencies, so the same endpoint serves liveness and readiness. The image's `HEALTHCHECK` already probes it.

## DigitalOcean App Platform

Deploys the public GHCR image; App Platform provides an HTTPS URL automatically.

```yaml
# app.yaml
name: sentry-google-chat
region: blr # change to your nearest region
services:
  - name: web
    image:
      registry_type: GHCR
      registry: raisedadead
      repository: sentry-google-chat
      tag: latest # pin to vX.Y.Z for immutable deploys
    http_port: 8080
    instance_count: 1 # do NOT add an `autoscaling` block — state is in-process
    instance_size_slug: basic-xxs # 512 MB / shared CPU
    health_check:
      http_path: /healthz
    envs:
      - { key: NODE_ENV, scope: RUN_TIME, value: production }
      - { key: SENTRY_CLIENT_SECRET, scope: RUN_TIME, type: SECRET, value: replace-me }
      - { key: GCHAT_WEBHOOK_DEFAULT, scope: RUN_TIME, type: SECRET, value: replace-me }
```

```sh
doctl apps create --spec app.yaml
```

Then set the real `SECRET` values in the dashboard and point the Sentry integration's Webhook URL at `https://<your-app>.ondigitalocean.app/sentry/webhook`. App Platform does not auto-redeploy from GHCR (a DOCR-only feature), so redeploy on a new image with `doctl apps create-deployment <app-id>`.

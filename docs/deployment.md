# Deployment

This service publishes a public container image. How and where you run it is your call — the examples below are starting points, not requirements. For setup and configuration, see [README.md](./README.md).

## Container image

The release pipeline publishes a public multi-arch image (linux/amd64, linux/arm64) to the GitHub Container Registry on every change to the `live` branch and on `v*` tags:

```
ghcr.io/raisedadead/sentry-google-chat
```

Tags: `latest` (tip of `live`), `vX.Y.Z` / `vX.Y` (version tags), and the short commit SHA. Pin to a version tag or digest for reproducible deploys. The image runs as a non-root user and writes nothing to disk.

```sh
docker run -p 8080:8080 --env-file .env ghcr.io/raisedadead/sentry-google-chat:latest
```

Required env: `SENTRY_CLIENT_SECRET`, `GCHAT_WEBHOOK_DEFAULT` (see the [configuration table](./README.md#configuration)). The container exposes `/healthz` and listens on `PORT` (default `8080`).

To build it yourself instead: `docker build -t sentry-google-chat .`

## DigitalOcean App Platform

[`.do/app.yaml`](../.do/app.yaml) is an example spec that deploys the public GHCR image; App Platform provides an HTTPS URL automatically.

```sh
doctl apps create --spec .do/app.yaml
```

Then set the real `SECRET` env values in the dashboard, and point the Sentry integration's Webhook URL at `https://<your-app>.ondigitalocean.app/sentry/webhook`.

App Platform does not auto-redeploy from GHCR (a DOCR-only feature), so redeploy on a new image with `doctl apps create-deployment <app-id>` (manually, or wire it into your own automation). `instance_count` is `1` by design (in-process queue).

## Kubernetes

Example manifests are in [`../k8s`](../k8s) — see [`../k8s/README.md`](../k8s/README.md). Create the Secret out of band, then apply the Deployment, Service, and Ingress. Run a single replica (in-process queue).

## Cloud Run

The same image runs on Cloud Run unchanged. Set `min-instances >= 1` (and enable startup CPU boost) so cold starts do not threaten the sub-1s Sentry ACK budget.

# Kubernetes manifests

Plain manifests for deploying `sentry-google-chat`. Apply in order:

```sh
# 1. Create the Secret out of band (see secret.example.yaml header — do NOT
#    apply the example file with placeholder values).
kubectl create secret generic sentry-google-chat \
  --from-literal=SENTRY_CLIENT_SECRET=... \
  --from-literal=GCHAT_WEBHOOK_DEFAULT='https://chat.googleapis.com/v1/spaces/.../messages?key=...&token=...'

# 2. Apply the workload.
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml   # edit host + TLS first
```

Notes:

- Build and push the image first, then set `image:` in `deployment.yaml`.
- `replicas: 1` is intentional — the delivery queue, per-space rate limiting, and Request-ID idempotency live in process memory. Horizontal scale-out needs the delivery port swapped for a durable queue (Redis / Cloud Tasks).
- `readOnlyRootFilesystem: true` — the app writes nothing to disk.
- The same container image runs on Cloud Run unchanged; set `min-instances >= 1` there to protect the sub-1s Sentry ACK from cold starts.

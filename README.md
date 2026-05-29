# sentry-google-chat

> Forward Sentry alerts to Google Chat (Google Workspace) spaces.

A small, stateless service that receives Sentry alert webhooks, verifies them, and posts a formatted card to a Google Chat space. Sentry SaaS cannot post to a Google Chat Incoming Webhook directly — the payload shapes differ — so this sits in between, translating issue and metric alerts into Google Chat `cardsV2` messages. It runs as a Sentry internal integration for a single organization.

## Quickstart

```sh
docker run -p 8080:8080 \
  -e SENTRY_CLIENT_SECRET=... \
  -e 'GCHAT_WEBHOOK_DEFAULT=https://chat.googleapis.com/v1/spaces/.../messages?key=...&token=...' \
  ghcr.io/raisedadead/sentry-google-chat:latest
```

## Documentation

- [Setup, configuration, and architecture](./docs/README.md)

## Development

```sh
pnpm install
pnpm test
```

See [docs/README.md](./docs/README.md#development) for the full workflow.

## License

ISC License - see [LICENSE](./LICENSE) file for details.

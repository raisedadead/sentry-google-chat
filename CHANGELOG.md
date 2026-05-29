# Changelog

## 1.0.0 (2026-05-29)


### Features

* add entrypoint, pino logger, and Sentry self-instrumentation ([a720aeb](https://github.com/raisedadead/sentry-google-chat/commit/a720aeb5493d2938792f45f181d92111502007e8))
* add env config loader with Zod validation ([2b846a4](https://github.com/raisedadead/sentry-google-chat/commit/2b846a4b4341384c12281358366d88b21850b751))
* add Google Chat webhook client with retry classification ([d0d3f80](https://github.com/raisedadead/sentry-google-chat/commit/d0d3f8017c8c5db24900d7b92e4cfa6a5e3028c7))
* add per-space delivery queue with throttling and retries ([3e4c5a0](https://github.com/raisedadead/sentry-google-chat/commit/3e4c5a021591cd6acc65391ec3ba232bc97a9f85))
* add Zod schemas for event_alert and metric_alert webhooks ([2a308fd](https://github.com/raisedadead/sentry-google-chat/commit/2a308fdcaba63528c733b43f0f9fe576e0561f99))
* normalize Sentry payloads into AlertEvent domain model ([d13d5f0](https://github.com/raisedadead/sentry-google-chat/commit/d13d5f0db3e28a7c96196368b3d010959211e86c))
* render AlertEvent as Google Chat cardsV2 message ([bfe1c16](https://github.com/raisedadead/sentry-google-chat/commit/bfe1c161439e6701bf8f1e3f721fdc6c2a6b2132))
* route alerts to Google Chat spaces by project slug ([46f0072](https://github.com/raisedadead/sentry-google-chat/commit/46f00728fe62fc5f710d69bb133e31600a662cd6))
* verify Sentry webhook HMAC-SHA256 signature ([83a736f](https://github.com/raisedadead/sentry-google-chat/commit/83a736f35d5be126765d794dd970bc9e720426c1))
* wire Hono webhook endpoint with verify, route, enqueue ([45d9510](https://github.com/raisedadead/sentry-google-chat/commit/45d951008daa6c17ace9189968de0804676f0b4f))

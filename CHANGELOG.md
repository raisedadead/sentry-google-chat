# Changelog

## [1.0.1](https://github.com/raisedadead/sentry-google-chat/compare/v1.0.0...v1.0.1) (2026-09-03)


### Bug Fixes

* **deps:** update dependency @hono/node-server to v2.1.0 ([#3](https://github.com/raisedadead/sentry-google-chat/issues/3)) ([ebaca5c](https://github.com/raisedadead/sentry-google-chat/commit/ebaca5cc2a4bd4f8ad27c738ec9601a3e316dce4))
* **deps:** update dependency @sentry/node to v10.69.0 ([#11](https://github.com/raisedadead/sentry-google-chat/issues/11)) ([486ee27](https://github.com/raisedadead/sentry-google-chat/commit/486ee279a85763356097fae39681fc45589e7a80))
* **deps:** update dependency @sentry/node to v10.70.0 ([#17](https://github.com/raisedadead/sentry-google-chat/issues/17)) ([7e77ce1](https://github.com/raisedadead/sentry-google-chat/commit/7e77ce1ba21cfef87363a449f36f7c28be30c761))
* **deps:** update dependency hono to v4.12.30 ([#7](https://github.com/raisedadead/sentry-google-chat/issues/7)) ([2b08d24](https://github.com/raisedadead/sentry-google-chat/commit/2b08d241bab828e68ea18b08b4c64f8d24ec9436))
* **deps:** update dependency hono to v4.13.1 ([#12](https://github.com/raisedadead/sentry-google-chat/issues/12)) ([9428a01](https://github.com/raisedadead/sentry-google-chat/commit/9428a01b6813bbf113f71567651e40ae3e457593))
* **deps:** update dependency hono to v4.13.3 ([#20](https://github.com/raisedadead/sentry-google-chat/issues/20)) ([5678dd6](https://github.com/raisedadead/sentry-google-chat/commit/5678dd6fe3aa377d578010ac2a35090d7af7da9f))
* **deps:** update dependency hono to v4.13.5 ([#21](https://github.com/raisedadead/sentry-google-chat/issues/21)) ([87e68e6](https://github.com/raisedadead/sentry-google-chat/commit/87e68e61d19c473f58be60e6a9c1130ba09067c5))

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

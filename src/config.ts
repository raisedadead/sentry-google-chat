import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
const NODE_ENVS = ['development', 'test', 'production'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];
export type NodeEnv = (typeof NODE_ENVS)[number];

export interface Config {
  sentry: {
    clientSecret: string;
    dsn: string | undefined;
  };
  gchat: {
    defaultWebhookUrl: string;
    routes: Record<string, string>;
  };
  server: {
    port: number;
    logLevel: LogLevel;
    nodeEnv: NodeEnv;
  };
}

const gchatWebhookUrl = z.url().refine(
  (value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.host === 'chat.googleapis.com';
    } catch {
      return false;
    }
  },
  { message: 'must be a https://chat.googleapis.com/... Incoming Webhook URL' }
);

const optionalNonEmpty = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

const envSchema = z.object({
  SENTRY_CLIENT_SECRET: z.string().min(1),
  SENTRY_DSN: optionalNonEmpty,
  GCHAT_WEBHOOK_DEFAULT: gchatWebhookUrl,
  GCHAT_ROUTES: optionalNonEmpty,
  PORT: z.coerce.number().int().positive().max(65535).default(8080),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  NODE_ENV: z.enum(NODE_ENVS).default('development'),
});

const routesSchema = z.record(z.string().min(1), gchatWebhookUrl);

function formatIssues(prefix: string, issues: z.core.$ZodIssue[]): string {
  const lines = issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `  - ${path}: ${issue.message}`;
  });
  return `${prefix}\n${lines.join('\n')}`;
}

function parseRoutes(raw: string | undefined): Record<string, string> {
  if (raw === undefined) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid configuration: GCHAT_ROUTES must be valid JSON');
  }
  const result = routesSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(formatIssues('Invalid configuration in GCHAT_ROUTES:', result.error.issues));
  }
  return result.data;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(formatIssues('Invalid configuration:', result.error.issues));
  }
  const parsed = result.data;

  return {
    sentry: {
      clientSecret: parsed.SENTRY_CLIENT_SECRET,
      dsn: parsed.SENTRY_DSN,
    },
    gchat: {
      defaultWebhookUrl: parsed.GCHAT_WEBHOOK_DEFAULT,
      routes: parseRoutes(parsed.GCHAT_ROUTES),
    },
    server: {
      port: parsed.PORT,
      logLevel: parsed.LOG_LEVEL,
      nodeEnv: parsed.NODE_ENV,
    },
  };
}

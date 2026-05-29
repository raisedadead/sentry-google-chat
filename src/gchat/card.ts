import type { AlertEvent, Severity } from '../domain/alert-event.js';

interface DecoratedText {
  topLabel?: string;
  text: string;
  wrapText?: boolean;
}

interface Button {
  text: string;
  onClick: { openLink: { url: string } };
}

type Widget =
  | { decoratedText: DecoratedText }
  | { textParagraph: { text: string } }
  | { buttonList: { buttons: Button[] } }
  | { divider: Record<string, never> };

interface CardSection {
  header?: string;
  widgets: Widget[];
}

interface GoogleChatCard {
  header?: { title: string; subtitle?: string };
  sections: CardSection[];
}

export interface GoogleChatMessage {
  fallbackText: string;
  cardsV2: { cardId: string; card: GoogleChatCard }[];
  thread?: { threadKey: string };
}

const SEVERITY: Record<Severity, { emoji: string; label: string }> = {
  critical: { emoji: '🔴', label: 'Critical' },
  warning: { emoji: '🟠', label: 'Warning' },
  info: { emoji: '🔵', label: 'Info' },
  resolved: { emoji: '✅', label: 'Resolved' },
};

const MAX_TITLE = 512;
const MAX_DESCRIPTION = 4096;
const MAX_FIELD = 512;

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderAlertCard(event: AlertEvent): GoogleChatMessage {
  const { emoji, label } = SEVERITY[event.severity];
  const project = event.projectSlug ?? 'unknown';

  const subtitleParts = [project];
  if (event.environment) subtitleParts.push(event.environment);

  const widgets: Widget[] = [
    { textParagraph: { text: `<b>${escapeHtml(truncate(event.title, MAX_TITLE))}</b>` } },
  ];

  if (event.culprit) {
    widgets.push({
      decoratedText: {
        topLabel: 'Culprit',
        text: escapeHtml(truncate(event.culprit, MAX_FIELD)),
        wrapText: true,
      },
    });
  }
  if (event.description) {
    widgets.push({
      textParagraph: { text: escapeHtml(truncate(event.description, MAX_DESCRIPTION)) },
    });
  }
  if (event.ruleLabel) {
    widgets.push({
      decoratedText: {
        topLabel: 'Alert rule',
        text: escapeHtml(truncate(event.ruleLabel, MAX_FIELD)),
        wrapText: true,
      },
    });
  }
  if (event.timestamp) {
    widgets.push({ decoratedText: { topLabel: 'When', text: escapeHtml(event.timestamp) } });
  }
  if (event.url) {
    widgets.push({
      buttonList: {
        buttons: [{ text: 'View in Sentry', onClick: { openLink: { url: event.url } } }],
      },
    });
  }

  return {
    fallbackText: truncate(`${emoji} ${label}: ${event.title} (${project})`, 1024),
    cardsV2: [
      {
        cardId: 'sentry-alert',
        card: {
          header: { title: `${emoji} ${label}`, subtitle: subtitleParts.join(' · ') },
          sections: [{ widgets }],
        },
      },
    ],
    thread: { threadKey: `${event.kind}:${event.groupingKey}` },
  };
}

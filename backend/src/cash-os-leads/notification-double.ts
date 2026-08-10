import type { LeadNotificationService } from './lead-notification.service';

/**
 * A notifier that delivers nothing.
 *
 * Used wherever a test exercises lead *storage*. Without it a test run would
 * construct the real service, which reads SMTP and Telegram settings from the
 * environment and would attempt a network connection on any machine where those
 * happen to be set — including a developer's, including CI.
 *
 * It reports both channels as undelivered rather than throwing, which is also
 * what the real service does when nothing is configured.
 */
export function stubNotifications(): LeadNotificationService {
  return {
    notify: async () => ({ email: false, telegram: false }),
  } as unknown as LeadNotificationService;
}

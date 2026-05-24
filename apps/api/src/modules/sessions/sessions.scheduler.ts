import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PostHogService } from "../../common/posthog/posthog.service";
import { SessionsService } from "./sessions.service";

const TZ = "America/Sao_Paulo";

@Injectable()
export class SessionsScheduler {
  private readonly logger = new Logger(SessionsScheduler.name);

  constructor(
    private readonly sessions: SessionsService,
    private readonly posthog: PostHogService
  ) {}

  // Every day at 23:00 BRT — closes any session still "scheduled" past its time
  @Cron("0 23 * * *", { timeZone: TZ })
  async closeOpenPastSessions(): Promise<void> {
    const now = new Date();
    this.logger.log(
      `[cron] sessions-auto-close start cutoff=${now.toISOString()}`
    );

    try {
      const { updated } = await this.sessions.closeOpenPastSessions(now);
      this.logger.log(`[cron] sessions-auto-close done updated=${updated}`);
    } catch (err) {
      this.logger.error("[cron] sessions-auto-close failed", err);
      this.posthog.captureException(err as Error, {
        distinctId: "system",
        properties: { job: "sessions-auto-close" },
      });
    }
  }
}

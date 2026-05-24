import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { format, toZonedTime } from "date-fns-tz";
import { PostHogService } from "../../common/posthog/posthog.service";
import { RecurringExpensesService } from "./recurring-expenses.service";

const TZ = "America/Sao_Paulo";

@Injectable()
export class RecurringExpensesScheduler {
  private readonly logger = new Logger(RecurringExpensesScheduler.name);

  constructor(
    private readonly service: RecurringExpensesService,
    private readonly posthog: PostHogService
  ) {}

  // Day 25 of each month at 03:00 BRT — generates payables for M+1
  @Cron("0 3 25 * *", { timeZone: TZ })
  async generateNextMonthPayables(): Promise<void> {
    const nowBRT = toZonedTime(new Date(), TZ);
    const nextMonth = new Date(
      Date.UTC(nowBRT.getFullYear(), nowBRT.getMonth() + 1, 1)
    );
    const monthLabel = format(nextMonth, "yyyy-MM", { timeZone: "UTC" });

    this.logger.log(`[cron] recurring-expenses start month=${monthLabel}`);

    try {
      const result = await this.service.runForMonth(nextMonth);
      this.logger.log(
        `[cron] recurring-expenses done month=${monthLabel} created=${result.created} skipped=${result.skipped} errors=${result.errors.length}`
      );
      if (result.errors.length > 0) {
        result.errors.forEach((e) =>
          this.logger.warn(
            `[cron] rule ${e.ruleId} (${e.description}) failed: ${e.error}`
          )
        );
      }
    } catch (err) {
      this.logger.error("[cron] recurring-expenses failed", err);
      this.posthog.captureException(err as Error, {
        distinctId: "system",
        properties: { job: "recurring-expenses-monthly", month: monthLabel },
      });
    }
  }
}

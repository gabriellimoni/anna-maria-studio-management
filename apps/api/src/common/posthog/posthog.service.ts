import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PostHog } from 'posthog-node';

@Injectable()
export class PostHogService implements OnModuleDestroy {
  readonly client: PostHog | null;

  constructor() {
    const apiKey = process.env.POSTHOG_API_KEY;
    if (apiKey) {
      this.client = new PostHog(apiKey, {
        host: process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com',
      });
    } else {
      this.client = null;
    }
  }

  captureException(err: Error, meta: { distinctId: string; properties?: Record<string, unknown> }): void {
    if (!this.client) return;
    this.client.capture({
      distinctId: meta.distinctId,
      event: '$exception',
      properties: {
        $exception_message: err.message,
        $exception_type: err.constructor.name,
        $exception_stack_trace_raw: err.stack,
        ...meta.properties,
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.shutdown();
  }
}

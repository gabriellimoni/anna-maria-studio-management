import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { PostHogService } from '../posthog/posthog.service';
import { User } from '../../user/user.entity';

@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly logger: PinoLogger,
    private readonly posthog: PostHogService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { user?: User }>();
    const res = ctx.getResponse<Response>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : 500;
    const message = isHttpException ? exception.message : 'Internal server error';

    if (!isHttpException || status >= 500) {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error({ err, route: req.path, method: req.method }, err.message);
      this.posthog.captureException(err, {
        distinctId: req.user?.id ?? 'anon',
        properties: {
          route: req.path,
          method: req.method,
          status,
        },
      });
    }

    res.status(status).json({
      statusCode: status,
      error: isHttpException ? exception.constructor.name : 'InternalServerError',
      message,
    });
  }
}

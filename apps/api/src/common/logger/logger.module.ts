import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

const SENSITIVE_FIELDS = ['authorization', 'password', 'amount', 'paidAt', 'paymentMethod', 'phone', 'email', 'birthDate', 'notes'];

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport: process.env.NODE_ENV !== 'production' ? { target: require.resolve('pino-pretty') } : undefined,
        genReqId: (req) => req.headers['x-request-id'] ?? crypto.randomUUID(),
        redact: {
          paths: SENSITIVE_FIELDS.flatMap((f) => [`req.headers.${f}`, `req.body.${f}`, `res.body.${f}`]),
          censor: '[REDACTED]',
        },
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}

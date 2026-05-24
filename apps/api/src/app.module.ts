import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { FirebaseAuthGuard } from './common/guards/firebase-auth.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggerModule } from './common/logger/logger.module';
import { PostHogModule } from './common/posthog/posthog.module';
import { FirebaseModule } from './firebase/firebase.module';
import { HealthController } from './health.controller';
import { UserModule } from './user/user.module';
import { StudentsModule } from './modules/students/students.module';
import { PlanCatalogModule } from './modules/plan-catalog/plan-catalog.module';
import { PlansModule } from './modules/plans/plans.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { DropInsModule } from './modules/drop-ins/drop-ins.module';
import { ReceivablesModule } from './modules/receivables/receivables.module';
import { PayablesModule } from './modules/payables/payables.module';
import { ScheduleModule } from '@nestjs/schedule';
import { RecurringExpensesModule } from './modules/recurring-expenses/recurring-expenses.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { validateEnv } from './config/env.validation';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),
    LoggerModule,
    PostHogModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: false,
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
    FirebaseModule,
    UserModule,
    StudentsModule,
    PlanCatalogModule,
    PlansModule,
    SessionsModule,
    DropInsModule,
    ReceivablesModule,
    PayablesModule,
    RecurringExpensesModule,
    ContractsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: FirebaseAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionsController } from './sessions.controller';
import { SessionService } from './session.service';
import { SessionCleanupCron } from './session-cleanup.cron';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.jwtSecret,
        signOptions: { expiresIn: config.jwtAccessExpiresIn as any },
      }),
    }),
    ScheduleModule.forRoot(),
    ConfigModule,
  ],
  controllers: [AuthController, SessionsController],
  providers: [
    AuthService,
    SessionService,
    SessionCleanupCron,
    JwtStrategy,
    PrismaService,
    ConfigService,
  ],
  exports: [AuthService, SessionService, JwtModule],
})
export class AuthModule {}

import { Module, Logger, type Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionsController } from './sessions.controller';
import { TwoFactorController } from './two-factor.controller';
import { SessionService } from './session.service';
import { TwoFactorService } from './two-factor.service';
import { SessionCleanupCron } from './session-cleanup.cron';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { MicrosoftStrategy } from './strategies/microsoft.strategy';
import { CloudflareTurnstileService } from './services/cloudflare-turnstile.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { ConfigModule } from '../config/config.module';

/**
 * OAuth strategies (Google, Microsoft) crash on instantiation when their
 * client IDs are missing or empty. Wrap them as conditional providers so
 * they're only registered when the necessary env vars are configured.
 * This lets the API boot cleanly even if no OAuth provider is configured.
 */
const oauthLogger = new Logger('AuthModule');

const googleStrategyProvider: Provider = {
  provide: GoogleStrategy,
  inject: [AuthService, ConfigService],
  useFactory: (authService: AuthService, config: ConfigService) => {
    if (!config.googleClientId || !config.googleClientSecret) {
      oauthLogger.warn(
        'Google OAuth disabled — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable',
      );
      return null;
    }
    return new GoogleStrategy(authService, config);
  },
};

const microsoftStrategyProvider: Provider = {
  provide: MicrosoftStrategy,
  inject: [AuthService, ConfigService],
  useFactory: (authService: AuthService, config: ConfigService) => {
    if (!config.azureAdClientId || !config.azureAdClientSecret) {
      oauthLogger.warn(
        'Microsoft OAuth disabled — set AZURE_AD_CLIENT_ID and AZURE_AD_CLIENT_SECRET to enable',
      );
      return null;
    }
    return new MicrosoftStrategy(authService, config);
  },
};

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
  controllers: [AuthController, SessionsController, TwoFactorController],
  providers: [
    AuthService,
    SessionService,
    TwoFactorService,
    SessionCleanupCron,
    JwtStrategy,
    googleStrategyProvider,
    microsoftStrategyProvider,
    CloudflareTurnstileService,
    PrismaService,
    ConfigService,
  ],
  exports: [
    AuthService,
    SessionService,
    TwoFactorService,
    JwtModule,
    // Exported so the global `CaptchaGuard` (registered in AppModule)
    // can resolve it via DI.
    CloudflareTurnstileService,
  ],
})
export class AuthModule {}

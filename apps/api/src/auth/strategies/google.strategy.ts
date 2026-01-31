import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '../../config/config.service';
import { AuthService } from '../auth.service';
import { OAuthProviderType } from '../dto/oauth.dto';

/**
 * Google OAuth Strategy
 * Uses passport-google-oauth20 to authenticate users with Google
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    super({
      clientID: configService.googleClientId || '',
      clientSecret: configService.googleClientSecret || '',
      callbackURL: configService.googleCallbackUrl,
      scope: ['email', 'profile'],
      passReqToCallback: false,
    });
  }

  /**
   * Validate OAuth callback from Google
   * @param accessToken OAuth access token
   * @param refreshToken OAuth refresh token
   * @param profile User profile from Google
   * @param done Passport callback
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const { id, emails, name, photos } = profile;

      // Extract user data from Google profile
      const email = emails?.[0]?.value;
      if (!email) {
        return done(new Error('Email not provided by Google'), false);
      }

      // Validate OAuth user with our auth service
      const user = await this.authService.validateOAuthUser({
        provider: OAuthProviderType.GOOGLE,
        providerId: id,
        email,
        firstName: name?.givenName,
        lastName: name?.familyName,
        avatarUrl: photos?.[0]?.value,
        accessToken,
        refreshToken,
      });

      return done(null, user);
    } catch (error) {
      return done(error as Error, false);
    }
  }
}

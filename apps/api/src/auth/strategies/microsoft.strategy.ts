import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { BearerStrategy, IBearerStrategyOptionWithRequest, ITokenPayload } from 'passport-azure-ad';
import { ConfigService } from '../../config/config.service';
import { AuthService } from '../auth.service';
import { OAuthProviderType } from '../dto/oauth.dto';

/**
 * Microsoft OAuth Strategy
 * Uses passport-azure-ad to authenticate users with Microsoft/Azure AD
 * 
 * Note: passport-azure-ad uses BearerStrategy for OAuth 2.0 flows
 * The strategy validates the JWT token from Microsoft and extracts user info
 */
@Injectable()
export class MicrosoftStrategy extends PassportStrategy(BearerStrategy, 'microsoft') {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    const options: IBearerStrategyOptionWithRequest = {
      identityMetadata: `https://login.microsoftonline.com/${configService.azureAdTenantId}/v2.0/.well-known/openid-configuration`,
      clientID: configService.azureAdClientId,
      validateIssuer: true,
      issuer: [
        `https://login.microsoftonline.com/${configService.azureAdTenantId}/v2.0`,
        `https://sts.windows.net/${configService.azureAdTenantId}/`,
      ],
      passReqToCallback: false,
      loggingLevel: 'info',
      scope: ['openid', 'profile', 'email'],
    };

    super(options);
  }

  /**
   * Validate OAuth token from Microsoft
   * @param token JWT token payload from Microsoft
   */
  async validate(token: ITokenPayload): Promise<any> {
    try {
      // Extract user data from Microsoft token
      const { oid, preferred_username, given_name, family_name } = token;

      if (!preferred_username) {
        throw new Error('Email not provided by Microsoft');
      }

      // Validate OAuth user with our auth service
      const user = await this.authService.validateOAuthUser({
        provider: OAuthProviderType.MICROSOFT,
        providerId: oid || '', // Object ID is the unique identifier
        email: preferred_username,
        firstName: given_name,
        lastName: family_name,
        // Note: Microsoft strategy doesn't provide access/refresh tokens directly
        // These would need to be obtained through a separate OAuth flow
      });

      return user;
    } catch (error) {
      throw error;
    }
  }
}

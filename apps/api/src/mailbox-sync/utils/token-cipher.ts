import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '../../config/config.service';

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

/**
 * AES-256-GCM symmetric cipher for encrypting OAuth refresh tokens at rest.
 *
 * Mirrors the pattern used by `TwoFactorService.encryptSecret` so we have
 * one consistent way to wrap secrets in the database. Uses a per-call
 * random IV; the auth tag detects tampering.
 *
 * The key is read once from `ConfigService.mailboxTokenEncryptionKey`. When
 * unset, every call throws `ServiceUnavailableException` so we never
 * accidentally write plaintext tokens (or crash during decryption).
 */
@Injectable()
export class TokenCipher {
  private readonly logger = new Logger(TokenCipher.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12; // 96 bits is the GCM-recommended IV size

  constructor(private readonly configService: ConfigService) {}

  encrypt(plaintext: string): EncryptedPayload {
    const key = this.requireKey();
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');

    return {
      ciphertext,
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  }

  decrypt(payload: EncryptedPayload): string {
    const key = this.requireKey();
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(payload.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));

    let plaintext = decipher.update(payload.ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
  }

  private requireKey(): Buffer {
    const key = this.configService.mailboxTokenEncryptionKey;
    if (!key) {
      this.logger.error('MAILBOX_TOKEN_ENCRYPTION_KEY is not configured');
      throw new ServiceUnavailableException(
        'Email tracking is temporarily unavailable (server misconfigured).',
      );
    }
    return key;
  }
}

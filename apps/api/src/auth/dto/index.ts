import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

// Re-export 2FA DTOs
export * from './two-factor.dto';
export * from './oauth.dto';

// Password policy:
//   - 8–128 characters (cap protects argon2 from DoS via huge inputs)
//   - at least one lowercase, one uppercase, one digit
//   - at least one non-alphanumeric character (any printable symbol/punctuation)
//   - no whitespace
//
// We deliberately DO NOT restrict the special-character set to a small
// allow-list — password managers (1Password, Bitwarden, browser keychains)
// generate strong passwords from a much wider symbol pool (e.g. -, +, =, (,
// ), [, ], {, }, /, \, |, :, ;, ., ,, <, >, ~, ^), and rejecting them
// silently is what users experience as "my password is too long / broken".
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])[!-~]{8,128}$/;
const PASSWORD_MESSAGE =
  'Password must be 8–128 characters and include at least one uppercase letter, one lowercase letter, one number and one special character. Whitespace is not allowed.';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'SecurePass123!',
    minLength: 8,
    maxLength: 128,
    description: PASSWORD_MESSAGE,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must be at most 128 characters long' })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  password: string;

  @ApiProperty({ example: 'John', required: false })
  @IsOptional()
  @Sanitize()
  @IsString()
  firstName?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsOptional()
  @Sanitize()
  @IsString()
  lastName?: string;

  @ApiProperty({
    example: '0.XXXX...',
    required: false,
    description:
      'Cloudflare Turnstile token from the frontend widget. Required in production when TURNSTILE_SECRET_KEY is configured; optional otherwise so local dev keeps working.',
  })
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  password: string;
  // Note: Password is not sanitized to preserve special characters
}

export class UpdateUserProfileDto {
  @ApiProperty({ example: 'John', required: false })
  @IsOptional()
  @Sanitize()
  @IsString()
  firstName?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsOptional()
  @Sanitize()
  @IsString()
  lastName?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPass123!', description: 'Current password' })
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword: string;

  @ApiProperty({
    example: 'NewPass123!',
    minLength: 8,
    maxLength: 128,
    description: PASSWORD_MESSAGE,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must be at most 128 characters long' })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword: string;
}

export class DeleteAccountDto {
  @ApiProperty({
    example: 'SecurePass123!',
    required: false,
    description:
      'Password confirmation. Required for password-based accounts; ignored for OAuth-only accounts (e.g. Google/Microsoft sign-in users who never set a password).',
  })
  @IsOptional()
  @IsString()
  password?: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'abc123token', description: 'Password reset token from email' })
  @IsString()
  @IsNotEmpty({ message: 'Token is required' })
  token: string;

  @ApiProperty({
    example: 'NewSecurePass123!',
    minLength: 8,
    maxLength: 128,
    description: PASSWORD_MESSAGE,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must be at most 128 characters long' })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  password: string;
}

import { IsEmail, IsString, MinLength, IsOptional, Matches, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

// Re-export 2FA DTOs
export * from './two-factor.dto';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[\w@$!%*?&#]{8,}$/;

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'SecurePass123!',
    minLength: 8,
    description:
      'Password must contain at least 8 characters, one uppercase, one lowercase, one number and one special character (@$!%*?&#)',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(PASSWORD_REGEX, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character (@$!%*?&#)',
  })
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
    description:
      'New password must contain at least 8 characters, one uppercase, one lowercase, one number and one special character (@$!%*?&#)',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(PASSWORD_REGEX, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character (@$!%*?&#)',
  })
  newPassword: string;
}

export class DeleteAccountDto {
  @ApiProperty({
    example: 'SecurePass123!',
    description: 'Password confirmation for account deletion',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required to delete account' })
  password: string;
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
    description:
      'New password must contain at least 8 characters, one uppercase, one lowercase, one number and one special character (@$!%*?&#)',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(PASSWORD_REGEX, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character (@$!%*?&#)',
  })
  password: string;
}

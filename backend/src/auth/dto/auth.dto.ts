import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Jane CFO' })
  name!: string;

  @ApiProperty({ example: 'jane@acme.com' })
  email!: string;

  @ApiProperty({ example: 'SecurePass123!' })
  password!: string;

  @ApiPropertyOptional({ example: 'en' })
  locale?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'jane@acme.com' })
  email!: string;

  @ApiProperty({ example: 'SecurePass123!' })
  password!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'jane@acme.com' })
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token from the reset email link' })
  token!: string;

  @ApiProperty({ example: 'NewSecurePass123!' })
  password!: string;
}

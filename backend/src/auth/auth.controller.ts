import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { Public } from './decorators';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';
import { AuthUser } from './auth.types';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user account (company setup happens in onboarding)' })
  register(@Body() body: RegisterDto) {
    return this.auth.register(body);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Body() body: LoginDto) {
    return this.auth.login(body);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({
    summary: 'Request a password reset email (always returns the same message)',
  })
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.auth.requestPasswordReset(body);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.auth.resetPassword(body);
  }

  @Public()
  @Post('demo-guest')
  @ApiOperation({
    summary: 'Start a read-only demo session without registering',
  })
  demoGuest() {
    return this.auth.createDemoGuest();
  }

  @Get('me')
  @ApiOperation({ summary: 'Current authenticated user' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.getMe(user.id);
  }
}

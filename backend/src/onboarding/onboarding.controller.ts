import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { SkipCompanyAccess } from '../auth/decorators';
import { AuthUser } from '../auth/auth.types';
import {
  AddEntityDto,
  OnboardingCreateCompanyDto,
  SelectCompanyDto,
} from './dto/onboarding.dto';
import { OnboardingService } from './onboarding.service';

@ApiTags('Onboarding')
@SkipCompanyAccess()
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get('context')
  @ApiOperation({
    summary: 'Pre-boarding context: company links, workspace state, suggested phase',
  })
  context(@CurrentUser() user: AuthUser) {
    return this.onboarding.getContext(user.id);
  }

  @Post('select-company')
  @ApiOperation({ summary: 'Select an organization from UserCompanyLink records' })
  selectCompany(@CurrentUser() user: AuthUser, @Body() body: SelectCompanyDto) {
    return this.onboarding.selectCompany(user, body);
  }

  @Post('demo-mode')
  @ApiOperation({ summary: 'Enter demo mode with pre-populated sample data' })
  demoMode(@CurrentUser() user: AuthUser) {
    return this.onboarding.enableDemoMode(user);
  }

  @Post('create-company')
  @ApiOperation({ summary: 'Create a new company and link the current user as admin' })
  createCompany(@CurrentUser() user: AuthUser, @Body() body: OnboardingCreateCompanyDto) {
    return this.onboarding.createCompany(user, body);
  }

  @Post('add-entity')
  @ApiOperation({
    summary: 'Add a new entity and link the current user (existing accounts may manage multiple entities)',
  })
  addEntity(@CurrentUser() user: AuthUser, @Body() body: AddEntityDto) {
    return this.onboarding.addEntity(user, body);
  }

  @Get('status')
  @ApiOperation({ summary: 'Onboarding completion status for current company workspace' })
  status(@CurrentUser() user: AuthUser) {
    return this.onboarding.getStatus(user.id);
  }

  @Get('preview')
  @ApiOperation({ summary: 'Summary of company, team and uploads before finishing setup' })
  preview(@CurrentUser() user: AuthUser) {
    return this.onboarding.getPreview(user);
  }

  @Post('complete')
  @ApiOperation({ summary: 'Mark onboarding complete and generate initial forecast' })
  complete(@CurrentUser() user: AuthUser) {
    return this.onboarding.complete(user);
  }
}

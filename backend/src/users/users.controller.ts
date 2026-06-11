import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/decorators';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { CreateUserDto } from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'List users in your company' })
  list(@CurrentUser() user: AuthUser) {
    return this.users.listCompanyUsers(user.companyId!);
  }

  @Post()
  @UseGuards(WorkspaceGuard)
  @Roles(UserRole.admin, UserRole.owner)
  @ApiOperation({ summary: 'Add a company user (admin only)' })
  create(@CurrentUser() user: AuthUser, @Body() body: CreateUserDto) {
    return this.users.createUser(user, body);
  }
}

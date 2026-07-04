import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/decorators';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(WorkspaceGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Permissions('treasury:read')
  @ApiOperation({ summary: 'List notifications for the current company (gated by plan)' })
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.list(user.companyId!);
  }

  @Post(':id/read')
  @Permissions('treasury:read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user.companyId!, id);
  }
}

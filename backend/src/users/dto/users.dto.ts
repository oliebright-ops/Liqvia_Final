import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'new.user@acme.com' })
  email!: string;

  @ApiProperty({ example: 'New User' })
  name!: string;

  @ApiProperty({ example: 'TempPass123!' })
  password!: string;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.member })
  role?: UserRole;
}

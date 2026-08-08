import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCashOsLeadDto } from './dto/create-cash-os-lead.dto';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class CashOsLeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCashOsLeadDto) {
    const name = dto.name?.trim();
    const companyName = dto.companyName?.trim();
    const email = dto.email?.trim();

    if (!name) {
      throw new BadRequestException('Name is required');
    }
    if (!companyName) {
      throw new BadRequestException('Company name is required');
    }
    if (!email || !EMAIL_PATTERN.test(email)) {
      throw new BadRequestException('A valid email is required');
    }

    await this.prisma.cashOsLead.create({
      data: {
        name,
        role: dto.role?.trim() || null,
        companyName,
        phone: dto.phone?.trim() || null,
        email,
        employeeCount: dto.employeeCount?.trim() || null,
        industry: dto.industry?.trim() || null,
        comment: dto.comment?.trim() || null,
        source: dto.source?.trim() || null,
      },
    });

    return { status: 'ok' as const };
  }
}

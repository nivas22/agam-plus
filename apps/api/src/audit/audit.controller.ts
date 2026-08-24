import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuditService } from './audit.service';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('hospitals/:id/audit')
@UseGuards(HospitalContextGuard)
@Roles('admin')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async list(
    @Param('id') hospitalId: string,
    @Query('actor') actor?: string,
    @Query('area') area?: string,
    @Query('moneyOnly') moneyOnly?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const entries = await this.auditService.list(hospitalId, {
      actorUserId: actor || undefined,
      area: area || undefined,
      moneyOnly: moneyOnly === 'true',
      search: search || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
    return { entries, total: entries.length };
  }

  @Get('export.csv')
  async exportCsv(
    @Param('id') hospitalId: string,
    @Res() res: Response,
    @Query('actor') actor?: string,
    @Query('area') area?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const entries = await this.auditService.list(hospitalId, {
      actorUserId: actor || undefined,
      area: area || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: 10000,
    });
    const csv = this.auditService.toCsv(entries);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-trail-${hospitalId}.csv"`);
    res.send(csv);
  }
}

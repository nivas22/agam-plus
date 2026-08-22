import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { toCsv } from '../common/csv.util';

@Controller('hospitals/:id/reports')
@UseGuards(HospitalContextGuard)
@Roles('admin')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('daily-collection')
  getDailyCollection(
    @Param('id') hospitalId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getDailyCollection(hospitalId, { startDate, endDate });
  }

  @Get('daily-collection/export.csv')
  async exportDailyCollection(
    @Param('id') hospitalId: string,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const report = await this.reportsService.getDailyCollection(hospitalId, { startDate, endDate });
    const csv = toCsv(report.byUser, [
      { label: 'Member', value: (r) => r.name },
      { label: 'Cash', value: (r) => r.cash },
      { label: 'UPI', value: (r) => r.upi },
      { label: 'Total', value: (r) => r.total },
      { label: 'Payments', value: (r) => r.paymentCount },
      { label: 'Drawer variance', value: (r) => r.drawerVariance },
      { label: 'Days closed', value: (r) => `${r.closedDays} of ${r.activeDays}` },
    ]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="daily-collection-${hospitalId}.csv"`);
    res.send(csv);
  }

  @Get('doctor-revenue')
  getDoctorRevenue(
    @Param('id') hospitalId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getDoctorRevenue(hospitalId, { startDate, endDate });
  }

  @Get('doctor-revenue/export.csv')
  async exportDoctorRevenue(
    @Param('id') hospitalId: string,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const report = await this.reportsService.getDoctorRevenue(hospitalId, { startDate, endDate });
    const csv = toCsv(report.table, [
      { label: 'Doctor', value: (r) => r.name },
      { label: 'Specialization', value: (r) => r.specialization },
      { label: 'Visits', value: (r) => r.visits },
      { label: 'Billed', value: (r) => r.billed },
      { label: 'Collected', value: (r) => r.collected },
      { label: 'Outstanding', value: (r) => r.outstanding },
      { label: 'From packages', value: (r) => r.fromPackages },
      { label: 'Avg per visit', value: (r) => r.avgPerVisit },
      { label: 'Diary full %', value: (r) => r.diaryFullPct ?? '' },
      { label: 'No-show %', value: (r) => r.noShowPct ?? '' },
    ]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="doctor-revenue-${hospitalId}.csv"`);
    res.send(csv);
  }

  @Get('dues-aging')
  getDuesAging(@Param('id') hospitalId: string) {
    return this.reportsService.getDuesAging(hospitalId);
  }

  @Get('dues-aging/export.csv')
  async exportDuesAging(@Param('id') hospitalId: string, @Res() res: Response) {
    const report = await this.reportsService.getDuesAging(hospitalId);
    const csv = toCsv(report.table, [
      { label: 'Patient', value: (r) => r.patientName },
      { label: 'Phone', value: (r) => r.patientPhone },
      { label: 'Doctor', value: (r) => r.doctorName },
      { label: 'Invoice', value: (r) => r.invoiceNumber },
      { label: 'Amount', value: (r) => r.amount },
      { label: 'Age (days)', value: (r) => r.ageDays },
    ]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="dues-aging-${hospitalId}.csv"`);
    res.send(csv);
  }

  @Get('no-shows')
  getNoShows(
    @Param('id') hospitalId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getNoShows(hospitalId, { startDate, endDate });
  }

  @Get('no-shows/export.csv')
  async exportNoShows(
    @Param('id') hospitalId: string,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const report = await this.reportsService.getNoShows(hospitalId, { startDate, endDate });
    const csv = toCsv(report.byDoctor, [
      { label: 'Doctor', value: (r) => r.name },
      { label: 'Booked', value: (r) => r.totalCount },
      { label: 'No-shows', value: (r) => r.noShowCount },
      { label: 'No-show %', value: (r) => r.rate },
    ]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="no-shows-${hospitalId}.csv"`);
    res.send(csv);
  }
}

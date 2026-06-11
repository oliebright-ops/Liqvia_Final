import { Injectable } from '@nestjs/common';
import { DEFAULT_DEMO_COMPANY_ID, SummaryReport } from '@liqvia2/shared';
import { TreasuryDataService } from './treasury-data.service';

/** @deprecated Use SummaryReport from @liqvia2/shared — alias for backward compatibility. */
export type DashboardPayload = SummaryReport;

@Injectable()
export class DashboardService {
  constructor(private readonly treasuryData: TreasuryDataService) {}

  async getDashboard(
    companyId: string = DEFAULT_DEMO_COMPANY_ID,
    horizonWeeks?: number,
  ): Promise<SummaryReport> {
    return this.treasuryData.getSummaryReport(companyId, horizonWeeks);
  }
}

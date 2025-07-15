import { dbOperations } from './database';

interface SyncEndpoints {
  cashCollections: string;
  loanApplications: string;
  loanDisbursements: string;
  advanceLoans: string;
}

export class SyncService {
  private baseUrl: string;
  private endpoints: SyncEndpoints;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.endpoints = {
      cashCollections: `${baseUrl}/api/cash-collections`,
      loanApplications: `${baseUrl}/api/loan-applications`,
      loanDisbursements: `${baseUrl}/api/loan-disbursements`,
      advanceLoans: `${baseUrl}/api/advance-loans`
    };
  }

  async isOnline(): Promise<boolean> {
    if (!navigator.onLine) {
      return false;
    }
    
    try {
      // Try to fetch a simple resource to verify real connectivity
      const response = await fetch('https://httpbin.org/get', {
        method: 'GET',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async syncRecordType<T extends { id?: number }>(
    records: T[],
    endpoint: string,
    markSyncedFn: (id: number) => Promise<any>
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const record of records) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record)
        });

        if (response.ok) {
          if (record.id) await markSyncedFn(record.id);
          success++;
        } else {
          failed++;
          errors.push(`Failed: ${record.id} - ${response.statusText}`);
        }
      } catch (error: any) {
        failed++;
        errors.push(`Error: ${record.id} - ${error.message}`);
      }
    }

    return { success, failed, errors };
  }

  async syncAllData(): Promise<{
    success: boolean;
    summary: {
      cashCollections: { success: number; failed: number };
      loanApplications: { success: number; failed: number };
      loanDisbursements: { success: number; failed: number };
      advanceLoans: { success: number; failed: number };
    };
    errors: string[];
  }> {
    if (!(await this.isOnline())) {
      throw new Error('Offline — cannot sync.');
    }

    const unsynced = await dbOperations.getAllUnsyncedRecords();
    if (unsynced.total === 0) {
      return {
        success: true,
        summary: {
          cashCollections: { success: 0, failed: 0 },
          loanApplications: { success: 0, failed: 0 },
          loanDisbursements: { success: 0, failed: 0 },
          advanceLoans: { success: 0, failed: 0 }
        },
        errors: []
      };
    }

    const [cash, loanApp, disburse, advance] = await Promise.all([
      this.syncRecordType(
        unsynced.cashCollections,
        this.endpoints.cashCollections,
        dbOperations.markCashCollectionSynced
      ),
      this.syncRecordType(
        unsynced.loanApplications,
        this.endpoints.loanApplications,
        dbOperations.markLoanApplicationSynced
      ),
      this.syncRecordType(
        unsynced.loanDisbursements,
        this.endpoints.loanDisbursements,
        dbOperations.markLoanDisbursementSynced
      ),
      this.syncRecordType(
        unsynced.advanceLoans,
        this.endpoints.advanceLoans,
        dbOperations.markAdvanceLoanSynced
      )
    ]);

    const errors = [...cash.errors, ...loanApp.errors, ...disburse.errors, ...advance.errors];
    const totalFailed = cash.failed + loanApp.failed + disburse.failed + advance.failed;

    return {
      success: totalFailed === 0,
      summary: {
        cashCollections: { success: cash.success, failed: cash.failed },
        loanApplications: { success: loanApp.success, failed: loanApp.failed },
        loanDisbursements: { success: disburse.success, failed: disburse.failed },
        advanceLoans: { success: advance.success, failed: advance.failed }
      },
      errors
    };
  }

  async backgroundSync(): Promise<void> {
    try {
      if (await this.isOnline()) {
        await this.syncAllData();
      }
    } catch (err) {
      console.log('Background sync failed:', err);
    }
  }
}
export const syncService = new SyncService('https://your-backend-api.com');

// Singleton instanc

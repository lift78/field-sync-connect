// Import the interfaces from your database file
import { CashCollection, LoanApplication, LoanDisbursement, AdvanceLoan, Allocation } from './database';
import { dbOperations } from './database';

interface SyncEndpoints {
  cashCollections: string;
  loanApplications: string;
  loanDisbursements: string;
  advanceLoans: string;
  allocations: string;
  login: string;
}

interface SyncResponse {
  success: boolean;
  message?: string;
  error?: string;
  record_id?: string | number;
  member_id?: string;
  cash_transaction_id?: string;
  allocation_response?: any;
  // Batch response properties
  total_records?: number;
  successful?: number;
  failed?: number;
  results?: Array<{
    success: boolean;
    error?: string;
    record_id: string | number;
    member_id?: string;
    cash_transaction_id?: string;
    allocation_response?: any;
  }>;
  errors?: Array<{
    record_id: string | number;
    error: string;
  }>;
}

interface AuthResponse {
  success: boolean;
  token?: string;
  refresh_token?: string;
  user?: any;
  error?: string;
  message?: string;
}

export class SyncService {
  private baseUrl: string;
  private endpoints: SyncEndpoints;
  private authToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.endpoints = {
      cashCollections: `${baseUrl}/api/collect-cash/`,
      loanApplications: `${baseUrl}/api/loan-applications/`,
      loanDisbursements: `${baseUrl}/api/loan-disbursements/`,
      advanceLoans: `${baseUrl}/api/advance-loans/`,
      allocations: `${baseUrl}/api/members/{memberId}/allocate_funds/`,
      login: `${baseUrl}/api/auth/login/`
    };
  }

  private async authenticate(): Promise<boolean> {
    try {
      // Get stored credentials
      const credentials = await dbOperations.getUserCredentials();
      if (!credentials) {
        console.error('No stored credentials found');
        return false;
      }

      // Check if we already have a valid token
      if (this.authToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return true;
      }

      // Attempt login
      const response = await fetch(this.endpoints.login, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password
        })
      });

      if (!response.ok) {
        console.error(`Authentication failed: ${response.status} ${response.statusText}`);
        return false;
      }

      const authResult: AuthResponse = await response.json();

      if (authResult.success && authResult.token) {
        this.authToken = authResult.token;
        // Set token expiry to 23 hours from now (assuming 24h token validity)
        this.tokenExpiry = Date.now() + (23 * 60 * 60 * 1000);
        
        // Update last login time
        await dbOperations.updateUserCredentials({
          username: credentials.username,
          password: credentials.password
        });

        console.log('Authentication successful');
        return true;
      } else {
        console.error('Authentication failed:', authResult.error || authResult.message);
        return false;
      }
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    }
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (this.authToken) {
      // Common token formats - adjust based on your backend
      (headers as any)['Authorization'] = `Bearer ${this.authToken}`;
      // Alternative formats if your backend uses different auth header:
      // (headers as any)['Authorization'] = `Token ${this.authToken}`;
      // (headers as any)['X-Auth-Token'] = this.authToken;
    }

    return headers;
  }

  private async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    // First attempt
    let response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...(await this.getAuthHeaders())
      }
    });

    // If we get 401/403, try to re-authenticate and retry
    if (response.status === 401 || response.status === 403) {
      console.log('Authentication required, attempting login...');
      
      const authSuccess = await this.authenticate();
      if (authSuccess) {
        // Retry the request with new token
        response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            ...(await this.getAuthHeaders())
          }
        });
      }
    }

    return response;
  }

  async isOnline(): Promise<boolean> {
    if (!navigator.onLine) return false;
  
    try {
      // First try unauthenticated ping
      const res = await fetch(`${this.baseUrl}/api/auth/ping/`, {
        method: "GET",
        cache: "no-cache",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        signal: AbortSignal.timeout?.(5000)  // Optional: browser support may vary
      });
  
      return res.ok;
    } catch (err) {
      console.error("Ping failed, assuming offline:", err);
      return false;
    }
  }
  

  private async syncCashCollections(records: CashCollection[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    if (records.length === 0) {
      return { success: 0, failed: 0, errors: [] };
    }
  
    let success = 0;
    let failed = 0;
    const errors: string[] = [];
  
    for (const record of records) {
      try {
        let cashSyncSuccess = true;
        let cashResult = null;
  
        // Only create cash transaction if amount > 0
        if (record.cashAmount && record.cashAmount > 0) {
          const cashPayload = {
            member_id: record.memberId,
            officer_name: 'Offline Officer',
            amount: record.cashAmount,
            remarks: 'Synced from offline app',
            timestamp:
              record.timestamp instanceof Date
                ? record.timestamp.toISOString()
                : new Date(record.timestamp).toISOString(),
            transaction_id: record.cashReference, // include this if your API accepts it
          };
  
          console.log("📤 Syncing cash:", cashPayload);
  
          const response = await this.authenticatedFetch(this.endpoints.cashCollections, {
            method: 'POST',
            body: JSON.stringify(cashPayload),
          });
  
          cashResult = await response.json();
  
          if (response.ok && cashResult.success) {
            cashSyncSuccess = true;
          } else {
            // Check if this is a duplicate transaction ID error
            const isDuplicateError = cashResult.error && (
              cashResult.error.includes('UNIQUE constraint failed') ||
              cashResult.error.includes('transaction_id') ||
              cashResult.error.toLowerCase().includes('duplicate')
            );
  
            if (isDuplicateError) {
              console.log(`⚠️ Cash record ${record.id} already exists on server, continuing with allocations`);
              cashSyncSuccess = true;
            } else {
              console.error(`❌ Cash sync failed for ${record.id}:`, cashResult.error);
              cashSyncSuccess = false;
            }
          }
        } else {
          console.log(`⏭️ Skipping zero amount cash transaction for record ${record.id}, processing allocations only`);
          cashSyncSuccess = true; // No cash to sync, but we can still process allocations
        }
  
        // ✅ Process allocations if cash sync was successful (or skipped) AND allocations exist
        if (cashSyncSuccess && record.allocations && record.allocations.length > 0) {
          const allocationPayload: any = {
            savings: 0,
            loan_repayment: 0,
            registration_fee: 0,
            amount_for_advance_payment: 0,
            other: 0,
            other_description: '',
            confirmed: true,
            timestamp:
              record.timestamp instanceof Date
                ? record.timestamp.toISOString()
                : new Date(record.timestamp).toISOString(),
            allocation_id: record.allocationId,
            other_items: [],
          };
  
          // Build allocation payload from individual allocations
          for (const alloc of record.allocations) {
            switch (alloc.type) {
              case 'savings':
                allocationPayload.savings += alloc.amount;
                break;
              case 'loan':
                allocationPayload.loan_repayment += alloc.amount;
                break;
              case 'amount_for_advance_payment':
                allocationPayload.amount_for_advance_payment += alloc.amount;
                break;
              case 'other':
                allocationPayload.other += alloc.amount;
                allocationPayload.other_description = alloc.reason || '';
                break;
            }
          }
  
          console.log("📋 Syncing allocations:", allocationPayload);
  
          // Use the proper endpoint with base URL
          const allocationEndpoint = this.endpoints.allocations.replace('{memberId}', record.memberId);
  
          const allocRes = await this.authenticatedFetch(allocationEndpoint, {
            method: 'POST',
            body: JSON.stringify(allocationPayload),
          });
  
          const allocJson = await allocRes.json();
          if (!allocRes.ok || !allocJson.success) {
            console.warn(`⚠️ Allocation sync failed for ${record.id}`, allocJson);
            errors.push(`Allocation failed for ${record.id}: ${allocJson.error || 'Unknown error'}`);
            failed++;
            continue; // Skip marking as synced
          } else {
            console.log(`✅ Allocations synced successfully for ${record.id}`);
          }
        }
  
        // Mark as synced if cash sync was successful (or skipped for zero amount)
        if (cashSyncSuccess) {
          if (record.id) {
            await dbOperations.markCashCollectionSynced(record.id);
          }
          success++;
          console.log(`✅ Record ${record.id} marked as synced`);
        } else {
          failed++;
          errors.push(`Cash sync failed for ${record.id}: ${cashResult?.error || 'Unknown error'}`);
        }
  
      } catch (error: any) {
        failed++;
        errors.push(`Exception for ${record.id}: ${error.message}`);
        console.error(`💥 Exception during sync for ${record.id}:`, error);
      }
    }
  
    return { success, failed, errors };
  }
  
  
  private async syncRecordType<T extends { id?: number }>(
    records: T[],
    endpoint: string,
    markSyncedFn: (id: number) => Promise<number>
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const record of records) {
      try {
        const response = await this.authenticatedFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify(record)
        });

        if (response.ok) {
          if (record.id) await markSyncedFn(record.id);
          success++;
        } else {
          failed++;
          const errorText = await response.text();
          errors.push(`Record ${record.id}: ${response.status} ${response.statusText} - ${errorText}`);
        }
      } catch (error: any) {
        failed++;
        errors.push(`Record ${record.id}: ${error.message}`);
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
    
    // Authenticate first
    const authSuccess = await this.authenticate();
    if (!authSuccess) {
      throw new Error('Authentication failed - cannot sync');
    }

    if (!(await this.isOnline())) {
      throw new Error('Offline — cannot sync.');
    }

    const unsynced = await dbOperations.getAllUnsyncedRecords();
    console.log("🧾 Unsynced cashCollections count:", unsynced.cashCollections?.length);
    console.log("🧾 Unsynced object:", unsynced);

    
    // Initialize summary
    const summary = {
      cashCollections: { success: 0, failed: 0 },
      loanApplications: { success: 0, failed: 0 },
      loanDisbursements: { success: 0, failed: 0 },
      advanceLoans: { success: 0, failed: 0 }
    };

    if (unsynced.total === 0) {
      return { success: true, summary, errors: [] };
    }

    // Sync cash collections first
    const cashCollectionsResult = await this.syncCashCollections(unsynced.cashCollections || []);
    summary.cashCollections = { success: cashCollectionsResult.success, failed: cashCollectionsResult.failed };

    // Sync other record types
    const [loanApp, disburse, advance] = await Promise.all([
      this.syncRecordType(
        unsynced.loanApplications || [],
        this.endpoints.loanApplications,
        dbOperations.markLoanApplicationSynced
      ),
      this.syncRecordType(
        unsynced.loanDisbursements || [],
        this.endpoints.loanDisbursements,
        dbOperations.markLoanDisbursementSynced
      ),
      this.syncRecordType(
        unsynced.advanceLoans || [],
        this.endpoints.advanceLoans,
        dbOperations.markAdvanceLoanSynced
      )
    ]);

    summary.loanApplications = { success: loanApp.success, failed: loanApp.failed };
    summary.loanDisbursements = { success: disburse.success, failed: disburse.failed };
    summary.advanceLoans = { success: advance.success, failed: advance.failed };

    const errors = [
      ...cashCollectionsResult.errors,
      ...loanApp.errors,
      ...disburse.errors,
      ...advance.errors
    ];

    const totalFailed = 
      cashCollectionsResult.failed + 
      loanApp.failed + 
      disburse.failed + 
      advance.failed;

    return {
      success: totalFailed === 0,
      summary,
      errors
    };
  }

  async syncSingleCashCollection(record: CashCollection): Promise<{
    success: boolean;
    error?: string;
    result?: any;
  }> {
    // Authenticate first
    const authSuccess = await this.authenticate();
    if (!authSuccess) {
      return { success: false, error: 'Authentication failed' };
    }

    if (!(await this.isOnline())) {
      return { success: false, error: 'Offline — cannot sync.' };
    }

    try {
      const response = await this.authenticatedFetch(this.endpoints.cashCollections, {
        method: 'POST',
        body: JSON.stringify(record)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: SyncResponse = await response.json();

      if (result.success && record.id) {
        await dbOperations.markCashCollectionSynced(record.id);
      }

      return {
        success: result.success,
        error: result.error,
        result: result
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async backgroundSync(): Promise<void> {
    try {
      if (await this.isOnline()) {
        await this.syncAllData();
        console.log('Background sync completed successfully');
      }
    } catch (err) {
      console.log('Background sync failed:', err);
    }
  }

  // Helper method to get sync status
  async getSyncStatus(): Promise<{
    isOnline: boolean;
    isAuthenticated: boolean;
    pendingRecords: {
      cashCollections: number;
      loanApplications: number;
      loanDisbursements: number;
      advanceLoans: number;
      total: number;
    };
  }> {
    const isAuthenticated = await this.authenticate();
    const isOnline = isAuthenticated && await this.isOnline();
    const unsynced = await dbOperations.getAllUnsyncedRecords();

    return {
      isOnline,
      isAuthenticated,
      pendingRecords: {
        cashCollections: unsynced.cashCollections?.length || 0,
        loanApplications: unsynced.loanApplications?.length || 0,
        loanDisbursements: unsynced.loanDisbursements?.length || 0,
        advanceLoans: unsynced.advanceLoans?.length || 0,
        total: unsynced.total
      }
    };
  }

  // Method to manually clear auth token (for logout)
  clearAuth(): void {
    this.authToken = null;
    this.tokenExpiry = null;
  }

  // Method to check if user is authenticated
  isAuthenticated(): boolean {
    return this.authToken !== null && 
           this.tokenExpiry !== null && 
           Date.now() < this.tokenExpiry;
  }
}

// Create singleton instance with safe environment variable access
export const syncService = new SyncService(
  (typeof process !== 'undefined' && process.env?.REACT_APP_API_BASE_URL) || 'https://api.liftipoa.com'
);

export default syncService;
// Import the interfaces from your database file
import { CashCollection, LoanApplication, LoanDisbursement, AdvanceLoan, GroupCollection, Allocation, NewMember } from './database';
import { dbOperations } from './database';
import { memberDataService } from './memberDataService';

interface SyncEndpoints {
  cashCollections: string;
  loanApplications: string;
  loanDisbursements: string;
  advanceLoans: string;
  groupCollections: string;
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
      loanApplications: `${baseUrl}/api/loans/`,
      loanDisbursements: `${baseUrl}/api/loans/preview_disbursement/`,
      advanceLoans: `${baseUrl}/api/advance-loans/`,
      groupCollections: `${baseUrl}/api/diary/meetings/record_collections/`,
      allocations: `${baseUrl}/api/members/{memberId}/allocate_funds/`,
      login: `${baseUrl}/api/auth/login/`
    };
  }

  // Helper function to format member identifier for API calls
  // For new members, we use their id_number with "id:" prefix
  // Regular member IDs are small integers (< 10000), id_numbers are typically longer
  private formatMemberIdentifier(memberId: string | number): string | number {
    const memberIdStr = String(memberId);
    
    // Check if this looks like an id_number (longer than typical member IDs)
    // Member IDs are usually small integers (1-9999), id_numbers are longer strings
    if (memberIdStr.length > 5 && !memberIdStr.startsWith('id:')) {
      // This is likely an id_number, prefix it
      return `id:${memberIdStr}`;
    }
    
    // If already prefixed or is a regular member ID, return as is
    return memberIdStr.startsWith('id:') ? memberIdStr : memberId;
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
        // Share auth token with member data service
        memberDataService.setAuthToken(this.authToken, this.tokenExpiry);
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
        
        // Share auth token with member data service
        memberDataService.setAuthToken(this.authToken, this.tokenExpiry);
        
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
    
    const syncSingleRecord = async (record: CashCollection) => {
      try {
        // NEW: Prepare payload with both cash and mpesa portions
        // Format member_id - use "id:" prefix for new members
        const cashPayload = {
          member_id: this.formatMemberIdentifier(record.memberId),
          officer_name: 'Offline Officer',
          cash_amount: record.cashAmount,        // Cash portion
          mpesa_amount: record.mpesaAmount,      // M-Pesa portion (NEW)
          total_amount: record.totalAmount,      // Total amount
          cash_reference: record.cashReference,  // Reference for cash transaction
          allocation_id: record.allocationId,    // Allocation ID
          remarks: 'Synced from offline app',
          timestamp:
            record.timestamp instanceof Date
              ? record.timestamp.toISOString()
              : new Date(record.timestamp).toISOString(),
        };
  
        console.log("📤 Syncing cash collection:", cashPayload);
  
        const response = await this.authenticatedFetch(this.endpoints.cashCollections, {
          method: 'POST',
          body: JSON.stringify(cashPayload),
        });
  
        const result = await response.json();
  
        if (response.ok && result.success) {
          console.log(`✅ Cash collection ${record.id} synced successfully`);
          
          // Process allocations if they exist
          if (record.allocations && record.allocations.length > 0) {
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
  
            // Format member_id for the endpoint - use "id:" prefix for new members
            const formattedMemberId = this.formatMemberIdentifier(record.memberId);
            const allocationEndpoint = this.endpoints.allocations.replace('{memberId}', String(formattedMemberId));
  
            const allocRes = await this.authenticatedFetch(allocationEndpoint, {
              method: 'POST',
              body: JSON.stringify(allocationPayload),
            });
  
            const allocJson = await allocRes.json();
            if (!allocRes.ok || !allocJson.success) {
              console.warn(`⚠️ Allocation sync failed for ${record.id}`, allocJson);
              const errorMsg = `${allocJson.error || 'Unknown error'}`;
              throw new Error(`Allocation failed for ${record.id}: ${errorMsg}`);
            } else {
              console.log(`✅ Allocations synced successfully for ${record.id}`);
            }
          }
  
          if (record.id) {
            await dbOperations.markCashCollectionSynced(record.id);
          }
          console.log(`✅ Record ${record.id} marked as synced`);
          return { success: true, error: null };
        } else {
          // Check for duplicate errors
          const isDuplicateError = result.error && (
            result.error.includes('UNIQUE constraint failed') ||
            result.error.includes('transaction_id') ||
            result.error.toLowerCase().includes('duplicate')
          );
  
          if (isDuplicateError) {
            console.log(`⚠️ Cash record ${record.id} already exists on server`);
            if (record.id) {
              await dbOperations.markCashCollectionSynced(record.id);
            }
            return { success: true, error: null };
          } else {
            const errorMsg = `Cash sync failed for ${record.id}: ${result?.error || 'Unknown error'}`;
            if (record.id) {
              await dbOperations.markCashCollectionFailed(record.id, result?.error || 'Unknown error');
            }
            return { success: false, error: errorMsg };
          }
        }
  
      } catch (error: any) {
        console.error(`💥 Exception during sync for ${record.id}:`, error);
        if (record.id) {
          await dbOperations.markCashCollectionFailed(record.id, error.message);
        }
        return { success: false, error: `Exception for ${record.id}: ${error.message}` };
      }
    };
  
    // Process records in batches of 5
    const batchSize = 5;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} records)`);
      
      const batchResults = await Promise.all(
        batch.map(record => syncSingleRecord(record))
      );
      
      batchResults.forEach(result => {
        if (result.success) {
          success++;
        } else {
          failed++;
          if (result.error) {
            errors.push(result.error);
          }
        }
      });
      
      console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} completed: ${batchResults.filter(r => r.success).length} succeeded, ${batchResults.filter(r => !r.success).length} failed`);
    }
  
    return { success, failed, errors };
  }
  
  private async syncLoanApplications(records: LoanApplication[]): Promise<{
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
        // Format member identifier - use "id:" prefix for new members
        const formattedMemberId = this.formatMemberIdentifier(record.memberId);
        const payload = {
          member: formattedMemberId,
          amount: record.loanAmount,
          installments: record.installments,
          guarantors: record.guarantors.map(id => parseInt(id, 10)), 
          officer_name: 'Offline Officer',
          notes: record.purpose || '',
          loan_type: 'longterm',
          security_items: record.securityItems || [],
        };
        console.log("📤 Syncing loan application:", payload);
  
        const response = await this.authenticatedFetch(this.endpoints.loanApplications, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
  
        // Check if response is OK first (HTTP 200-299)
        if (response.ok) {
          // Try to parse JSON response
          let result: SyncResponse;
          try {
            result = await response.json();
          } catch (jsonError) {
            // If JSON parsing fails but HTTP response was OK, assume success
            console.log(`✅ Loan application ${record.id} synced successfully (no JSON response)`);
            if (record.id) {
              await dbOperations.markLoanApplicationSynced(record.id);
            }
            success++;
            continue;
          }
  
          // If we have JSON response, check success field
          // Some backends might not include a 'success' field, so treat absence as success if HTTP was OK
          if (result.success !== false) {
            console.log(`✅ Loan application ${record.id} synced successfully`);
            if (record.id) {
              await dbOperations.markLoanApplicationSynced(record.id);
            }
            success++;
          } else {
            // Response was OK but success is explicitly false
            console.error(`❌ Loan application sync failed for ${record.id}:`, result.error);
            failed++;
            const errorMsg = result.error || 'Unknown error from server';
            errors.push(`LoanApplication ${record.id}: ${errorMsg}`);
            // Mark record as failed
            if (record.id) {
              await dbOperations.markLoanApplicationFailed(record.id, errorMsg);
            }
          }
        } else {
          // HTTP error occurred
          let result: SyncResponse;
          try {
            result = await response.json();
          } catch (jsonError) {
            // Can't parse JSON, use HTTP status as error
            console.error(`❌ Loan application sync failed for ${record.id}: HTTP ${response.status}`);
            failed++;
            const errorMsg = `HTTP ${response.status} ${response.statusText}`;
            errors.push(`LoanApplication ${record.id}: ${errorMsg}`);
            // Mark record as failed
            if (record.id) {
              await dbOperations.markLoanApplicationFailed(record.id, errorMsg);
            }
            continue;
          }
  
          // Check for duplicate errors (similar to cash collections)
          const isDuplicateError = result.error && (
            result.error.includes('UNIQUE constraint failed') ||
            result.error.includes('duplicate') ||
            result.error.toLowerCase().includes('already exists')
          );
  
          if (isDuplicateError) {
            console.log(`⚠️ Loan application ${record.id} already exists on server`);
            if (record.id) {
              await dbOperations.markLoanApplicationSynced(record.id);
            }
            success++;
          } else {
            console.error(`❌ Loan application sync failed for ${record.id}:`, result.error);
            failed++;
            const errorMsg = result.error || `HTTP ${response.status}`;
            errors.push(`LoanApplication ${record.id}: ${errorMsg}`);
            // Mark record as failed
            if (record.id) {
              await dbOperations.markLoanApplicationFailed(record.id, errorMsg);
            }
          }
        }
  
      } catch (error: any) {
        failed++;
        errors.push(`LoanApplication ${record.id}: ${error.message}`);
        console.error(`💥 Exception during loan application sync for ${record.id}:`, error);
        // Mark record as failed
        if (record.id) {
          await dbOperations.markLoanApplicationFailed(record.id, error.message);
        }
      }
    }
  
    return { success, failed, errors };
  }

  private async syncAdvanceLoans(records: AdvanceLoan[]): Promise<{
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
        // Map Dexie AdvanceLoan fields to backend expected format
        // Format member identifier - use "id:" prefix for new members
        const formattedMemberId = this.formatMemberIdentifier(record.memberId);
        const payload = {
          member: formattedMemberId,
          principal_amount: record.amount, // Map amount to principal_amount
          officer_name: 'Offline Officer',
          notes: record.reason || 'Advance short-term loans', // Use reason or default message
          loan_type: 'advance',
          timestamp: record.timestamp instanceof Date 
            ? record.timestamp.toISOString() 
            : new Date(record.timestamp).toISOString()
        };

        console.log("📤 Syncing advance loan:", payload);

        const response = await this.authenticatedFetch(this.endpoints.advanceLoans, {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        // Check if response is OK first (HTTP 200-299)
        if (response.ok) {
          // Try to parse JSON response
          let result: SyncResponse;
          try {
            result = await response.json();
          } catch (jsonError) {
            // If JSON parsing fails but HTTP response was OK, assume success
            console.log(`✅ Advance loan ${record.id} synced successfully (no JSON response)`);
            if (record.id) {
              await dbOperations.markAdvanceLoanSynced(record.id);
            }
            success++;
            continue;
          }

          // If we have JSON response, check success field
          // Some backends might not include a 'success' field, so treat absence as success if HTTP was OK
          if (result.success !== false) {
            console.log(`✅ Advance loan ${record.id} synced successfully`);
            if (record.id) {
              await dbOperations.markAdvanceLoanSynced(record.id);
            }
            success++;
          } else {
            // Response was OK but success is explicitly false
            console.error(`❌ Advance loan sync failed for ${record.id}:`, result.error);
            failed++;
            const errorMsg = result.error || 'Unknown error from server';
            errors.push(`AdvanceLoan ${record.id}: ${errorMsg}`);
            // Mark record as failed
            if (record.id) {
              await dbOperations.markAdvanceLoanFailed(record.id, errorMsg);
            }
          }
        } else {
          // HTTP error occurred
          let result: SyncResponse;
          try {
            result = await response.json();
          } catch (jsonError) {
            // Can't parse JSON, use HTTP status as error
            console.error(`❌ Advance loan sync failed for ${record.id}: HTTP ${response.status}`);
            failed++;
            errors.push(`AdvanceLoan ${record.id}: HTTP ${response.status} ${response.statusText}`);
            continue;
          }

          // Check for duplicate errors
          const isDuplicateError = result.error && (
            result.error.includes('UNIQUE constraint failed') ||
            result.error.includes('duplicate') ||
            result.error.toLowerCase().includes('already exists')
          );

          if (isDuplicateError) {
            console.log(`⚠️ Advance loan ${record.id} already exists on server`);
            if (record.id) {
              await dbOperations.markAdvanceLoanSynced(record.id);
            }
            success++;
          } else {
            console.error(`❌ Advance loan sync failed for ${record.id}:`, result.error);
            failed++;
            const errorMsg = result.error || `HTTP ${response.status}`;
            errors.push(`AdvanceLoan ${record.id}: ${errorMsg}`);
            // Mark record as failed
            if (record.id) {
              await dbOperations.markAdvanceLoanFailed(record.id, errorMsg);
            }
          }
        }

      } catch (error: any) {
        failed++;
        errors.push(`AdvanceLoan ${record.id}: ${error.message}`);
        console.error(`💥 Exception during advance loan sync for ${record.id}:`, error);
        // Mark record as failed
        if (record.id) {
          await dbOperations.markAdvanceLoanFailed(record.id, error.message);
        }
      }
    }

    return { success, failed, errors };
  }

  private async syncGroupCollections(records: GroupCollection[]): Promise<{
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
        const payload = {
          group_id: parseInt(record.groupId, 10),
          cash_collected: record.cashCollected.toFixed(2),
          fines_collected: record.finesCollected.toFixed(2)
        };

        console.log("📤 Syncing group collection:", payload);

        const response = await this.authenticatedFetch(this.endpoints.groupCollections, {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        // Check if response is OK first (HTTP 200-299)
        if (response.ok) {
          // Try to parse JSON response
          let result: SyncResponse;
          try {
            result = await response.json();
          } catch (jsonError) {
            // If JSON parsing fails but HTTP response was OK, assume success
            console.log(`✅ Group collection ${record.id} synced successfully (no JSON response)`);
            if (record.id) {
              await dbOperations.markGroupCollectionSynced(record.id);
            }
            success++;
            continue;
          }

          // If we have JSON response, check success field
          if (result.success !== false) {
            console.log(`✅ Group collection ${record.id} synced successfully`);
            if (record.id) {
              await dbOperations.markGroupCollectionSynced(record.id);
            }
            success++;
          } else {
            console.error(`❌ Group collection sync failed for ${record.id}:`, result.error);
            failed++;
            const errorMsg = result.error || 'Unknown error from server';
            errors.push(`GroupCollection ${record.id}: ${errorMsg}`);
            if (record.id) {
              await dbOperations.markGroupCollectionFailed(record.id, errorMsg);
            }
          }
        } else {
          // HTTP error occurred
          let result: SyncResponse;
          try {
            result = await response.json();
          } catch (jsonError) {
            console.error(`❌ Group collection sync failed for ${record.id}: HTTP ${response.status}`);
            failed++;
            const errorMsg = `HTTP ${response.status} ${response.statusText}`;
            errors.push(`GroupCollection ${record.id}: ${errorMsg}`);
            if (record.id) {
              await dbOperations.markGroupCollectionFailed(record.id, errorMsg);
            }
            continue;
          }

          // Check for duplicate errors
          const isDuplicateError = result.error && (
            result.error.includes('UNIQUE constraint failed') ||
            result.error.includes('duplicate') ||
            result.error.toLowerCase().includes('already exists')
          );

          if (isDuplicateError) {
            console.log(`⚠️ Group collection ${record.id} already exists on server`);
            if (record.id) {
              await dbOperations.markGroupCollectionSynced(record.id);
            }
            success++;
          } else {
            console.error(`❌ Group collection sync failed for ${record.id}:`, result.error);
            failed++;
            const errorMsg = result.error || `HTTP ${response.status}`;
            errors.push(`GroupCollection ${record.id}: ${errorMsg}`);
            if (record.id) {
              await dbOperations.markGroupCollectionFailed(record.id, errorMsg);
            }
          }
        }

      } catch (error: any) {
        failed++;
        errors.push(`GroupCollection ${record.id}: ${error.message}`);
        console.error(`💥 Exception during group collection sync for ${record.id}:`, error);
        if (record.id) {
          await dbOperations.markGroupCollectionFailed(record.id, error.message);
        }
      }
    }

    return { success, failed, errors };
  }

  private async syncNewMembers(records: NewMember[]): Promise<{
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
        const payload = {
          name: record.name,
          group: record.group,
          phone: record.phone,
          location: record.location,
          id_number: record.id_number,
          email: record.email && record.email.trim() !== '' ? record.email : null,
          occupation: record.occupation || '',
          notes: record.notes || ''
        };
  
        console.log("📤 Syncing new member:", payload);
  
        const response = await this.authenticatedFetch(`${this.baseUrl}/api/members/`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
  
        if (response.ok) {
          const result = await response.json();
          
          if (result.success !== false) {
            console.log(`✅ New member ${record.id} (${record.name}) synced successfully`);
            if (record.id) {
              await dbOperations.markNewMemberSynced(record.id);
            }
            success++;
          } else {
            console.error(`❌ New member sync failed for ${record.id}:`, result.error);
            failed++;
            const errorMsg = result.error || 'Unknown error from server';
            errors.push(`NewMember ${record.id} (${record.name}): ${errorMsg}`);
            if (record.id) {
              await dbOperations.markNewMemberFailed(record.id, errorMsg);
            }
          }
        } else {
          let result;
          try {
            result = await response.json();
          } catch (jsonError) {
            console.error(`❌ New member sync failed for ${record.id}: HTTP ${response.status}`);
            failed++;
            const errorMsg = `HTTP ${response.status} ${response.statusText}`;
            errors.push(`NewMember ${record.id} (${record.name}): ${errorMsg}`);
            if (record.id) {
              await dbOperations.markNewMemberFailed(record.id, errorMsg);
            }
            continue;
          }
          
          console.error(`❌ New member sync failed for ${record.id}:`, result.error);
          failed++;
          const errorMsg = result.error || `HTTP ${response.status}`;
          errors.push(`NewMember ${record.id} (${record.name}): ${errorMsg}`);
          if (record.id) {
            await dbOperations.markNewMemberFailed(record.id, errorMsg);
          }
        }
      } catch (error: any) {
        failed++;
        errors.push(`NewMember ${record.id} (${record.name}): ${error.message}`);
        console.error(`💥 Exception during new member sync for ${record.id}:`, error);
        if (record.id) {
          await dbOperations.markNewMemberFailed(record.id, error.message);
        }
      }
    }
  
    return { success, failed, errors };
  }
  
  private async syncLoanDisbursements(records: LoanDisbursement[]): Promise<{
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
        // Extract numeric ID from loan_id string (e.g., "LN0039" -> 39)
        const extractNumericId = (loanId: string): number => {
          // Remove letters and leading zeros, then convert to number
          const numericPart = loanId.replace(/[A-Za-z]/g, '').replace(/^0+/, '');
          const numericId = parseInt(numericPart, 10);
          
          if (isNaN(numericId)) {
            throw new Error(`Invalid loan ID format: ${loanId}`);
          }
          
          return numericId;
        };
  
        const numericLoanId = extractNumericId(record.loan_id);
  
        // Map Dexie LoanDisbursement fields to backend expected format
        const payload = {
          loan_id: numericLoanId, // Use extracted numeric ID
          include_processing_fee: record.include_processing_fee,
          include_advocate_fee: record.include_advocate_fee,
          include_advance_deduction: record.include_advance_deduction,
          custom_deductions: record.custom_deductions,
          timestamp: record.timestamp instanceof Date 
            ? record.timestamp.toISOString() 
            : new Date(record.timestamp).toISOString()
        };
  
        console.log(`📤 Syncing loan disbursement for loan ${record.loan_id} (numeric: ${numericLoanId}):`, payload);
  
        // Step 1: Call preview endpoint to prepare the loan
        const previewEndpoint = `${this.baseUrl}/api/loans/${numericLoanId}/preview_disbursement/`;
        
        console.log(`🔄 Step 1: Calling preview endpoint for loan ${numericLoanId}`);
        const previewResponse = await this.authenticatedFetch(previewEndpoint, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
  
        if (!previewResponse.ok) {
          throw new Error(`Preview failed: HTTP ${previewResponse.status}: ${previewResponse.statusText}`);
        }
  
        let previewResult: SyncResponse;
        try {
          previewResult = await previewResponse.json();
        } catch (jsonError) {
          throw new Error(`Preview response parsing failed: ${jsonError}`);
        }
  
        if (previewResult.success === false) {
          throw new Error(`Preview failed: ${previewResult.error || 'Unknown preview error'}`);
        }
  
        console.log(`✅ Step 1 completed: Preview successful for loan ${numericLoanId}`);
  
        // Step 2: Call disburse endpoint to actually disburse the loan
        const disburseEndpoint = `${this.baseUrl}/api/loans/${numericLoanId}/disburse/`;
        
        console.log(`🔄 Step 2: Calling disburse endpoint for loan ${numericLoanId}`);
        const response = await this.authenticatedFetch(disburseEndpoint, {
          method: 'POST',
          body: JSON.stringify({
            loan_id: numericLoanId,
            timestamp: payload.timestamp
          })
        });
  
        // Rest of the method remains the same...
        if (response.ok) {
          let result: SyncResponse;
          try {
            result = await response.json();
          } catch (jsonError) {
            console.log(`✅ Loan disbursement ${record.id} synced successfully (no JSON response)`);
            if (record.id) {
              await dbOperations.markLoanDisbursementSynced(record.id);
            }
            success++;
            continue;
          }
  
          if (result.success !== false) {
            console.log(`✅ Loan disbursement ${record.id} completed successfully`);
            if (record.id) {
              await dbOperations.markLoanDisbursementSynced(record.id);
            }
            
            // Mark the loan as disbursed in the local database
            try {
              await dbOperations.markLoanAsDisbursed(record.loan_id);
              console.log(`✅ Loan ${record.loan_id} marked as disbursed in local database`);
            } catch (markError) {
              console.warn(`⚠️ Failed to mark loan ${record.loan_id} as disbursed locally:`, markError);
              // Don't fail the sync for this - the disbursement was successful
            }
            
            success++;
          } else {
            console.error(`❌ Loan disbursement sync failed for ${record.id}:`, result.error);
            failed++;
            const errorMsg = result.error || 'Unknown error from server';
            errors.push(`LoanDisbursement ${record.id}: ${errorMsg}`);
            if (record.id) {
              await dbOperations.markLoanDisbursementFailed(record.id, errorMsg);
            }
          }
        } else {
          let result: SyncResponse;
          try {
            result = await response.json();
          } catch (jsonError) {
            console.error(`❌ Loan disbursement sync failed for ${record.id}: HTTP ${response.status}`);
            failed++;
            const errorMsg = `HTTP ${response.status} ${response.statusText}`;
            errors.push(`LoanDisbursement ${record.id}: ${errorMsg}`);
            if (record.id) {
              await dbOperations.markLoanDisbursementFailed(record.id, errorMsg);
            }
            continue;
          }
  
          const isDuplicateError = result.error && (
            result.error.includes('already disbursed') ||
            result.error.includes('duplicate') ||
            result.error.includes('loan is already disbursed') ||
            result.error.toLowerCase().includes('already exists')
          );
  
          if (isDuplicateError) {
            console.log(`Loan disbursement ${record.id} already processed on server`);
            if (record.id) {
              await dbOperations.markLoanDisbursementSynced(record.id);
            }
            
            // Mark the loan as disbursed in local database even if it was already disbursed
            try {
              await dbOperations.markLoanAsDisbursed(record.loan_id);
              console.log(`Loan ${record.loan_id} marked as disbursed in local database (was already disbursed on server)`);
            } catch (markError) {
              console.warn(`Failed to mark loan ${record.loan_id} as disbursed locally:`, markError);
            }
            
            success++;
          } else {
            console.error(`❌ Loan disbursement sync failed for ${record.id}:`, result.error);
            failed++;
            const errorMsg = result.error || `HTTP ${response.status}`;
            errors.push(`LoanDisbursement ${record.id}: ${errorMsg}`);
            if (record.id) {
              await dbOperations.markLoanDisbursementFailed(record.id, errorMsg);
            }
          }
        }
  
      } catch (error: any) {
        failed++;
        errors.push(`LoanDisbursement ${record.id}: ${error.message}`);
        console.error(`💥 Exception during loan disbursement sync for ${record.id}:`, error);
        if (record.id) {
          await dbOperations.markLoanDisbursementFailed(record.id, error.message);
        }
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
      newMembers: { success: number; failed: number };
      cashCollections: { success: number; failed: number };
      loanApplications: { success: number; failed: number };
      loanDisbursements: { success: number; failed: number };
      advanceLoans: { success: number; failed: number };
      groupCollections: { success: number; failed: number };
      memberData?: { success: boolean; totalMembers: number; totalMeetings: number; error?: string };
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
  
    // Sync member data first (since other operations depend on current member data)
    console.log('🔄 Starting member data sync...');
    const memberDataResult = await memberDataService.syncMemberData();
    
    if (memberDataResult.success) {
      console.log(`✅ Member data sync completed: ${memberDataResult.totalMembers} members, ${memberDataResult.totalMeetings} meetings`);
      
      // After successful member data sync, fetch loans for available groups
      try {
        const memberBalances = await dbOperations.getAllMembers();
        const uniqueGroupIds = [...new Set(memberBalances.map(member => {
          // Extract group ID from group_name if it's in a format like "Group 123"
          const match = member.group_name.match(/\d+/);
          return match ? parseInt(match[0]) : null;
        }).filter(id => id !== null))];

        if (uniqueGroupIds.length > 0) {
          console.log('🔄 Fetching loans for groups:', uniqueGroupIds);
          const loansResult = await memberDataService.fetchAllLoansForGroups(uniqueGroupIds as number[]);
          if (loansResult.success) {
            console.log(`✅ Loans sync completed: ${loansResult.loans.length} loans retrieved`);
          } else {
            console.warn('⚠️ Loans sync failed:', loansResult.error);
          }
        }
      } catch (loansError) {
        console.warn('⚠️ Loans fetching failed:', loansError);
      }
    } else {
      console.warn('⚠️ Member data sync failed:', memberDataResult.error);
    }
  
    const unsynced = await dbOperations.getAllUnsyncedRecords();
    console.log("🧾 Unsynced newMembers count:", unsynced.newMembers?.length);
    console.log("🧾 Unsynced cashCollections count:", unsynced.cashCollections?.length);
    console.log("🧾 Unsynced loanApplications count:", unsynced.loanApplications?.length);
    console.log("🧾 Unsynced advanceLoans count:", unsynced.advanceLoans?.length);
    console.log("🧾 Unsynced groupCollections count:", unsynced.groupCollections?.length);
    console.log("🧾 Unsynced object:", unsynced);
  
    
    // Initialize summary
    const summary = {
      newMembers: { success: 0, failed: 0 },
      cashCollections: { success: 0, failed: 0 },
      loanApplications: { success: 0, failed: 0 },
      loanDisbursements: { success: 0, failed: 0 },
      advanceLoans: { success: 0, failed: 0 },
      groupCollections: { success: 0, failed: 0 },
      memberData: memberDataResult
    };
  
    if (unsynced.total === 0) {
      return { success: memberDataResult.success, summary, errors: memberDataResult.error ? [memberDataResult.error] : [] };
    }
  
    // Sync NEW MEMBERS FIRST (before cash collections, since they may have initial allocations)
    const newMembersResult = await this.syncNewMembers(unsynced.newMembers || []);
    summary.newMembers = { success: newMembersResult.success, failed: newMembersResult.failed };

    // Continue with existing sync operations - LOAN DISBURSEMENTS next
    const disbursementsResult = await this.syncLoanDisbursements(unsynced.loanDisbursements || []);
    summary.loanDisbursements = { success: disbursementsResult.success, failed: disbursementsResult.failed };

    // Then cash collections (which may include initial allocations from new members)
    const cashCollectionsResult = await this.syncCashCollections(unsynced.cashCollections || []);
    summary.cashCollections = { success: cashCollectionsResult.success, failed: cashCollectionsResult.failed };
  
    const loanApplicationsResult = await this.syncLoanApplications(unsynced.loanApplications || []);
    summary.loanApplications = { success: loanApplicationsResult.success, failed: loanApplicationsResult.failed };
  
    const advanceLoansResult = await this.syncAdvanceLoans(unsynced.advanceLoans || []);
    summary.advanceLoans = { success: advanceLoansResult.success, failed: advanceLoansResult.failed };

    const groupCollectionsResult = await this.syncGroupCollections(unsynced.groupCollections || []);
    summary.groupCollections = { success: groupCollectionsResult.success, failed: groupCollectionsResult.failed };

    const errors = [
      ...newMembersResult.errors,
      ...disbursementsResult.errors,
      ...cashCollectionsResult.errors,
      ...loanApplicationsResult.errors,
      ...advanceLoansResult.errors,
      ...groupCollectionsResult.errors
    ];
  
    // Add member data error if it failed
    if (memberDataResult.error) {
      errors.push(`Member data sync: ${memberDataResult.error}`);
    }
  
    const totalFailed = 
      newMembersResult.failed +
      disbursementsResult.failed +
      cashCollectionsResult.failed + 
      loanApplicationsResult.failed +
      advanceLoansResult.failed + 
      groupCollectionsResult.failed;
  
    return {
      success: totalFailed === 0 && memberDataResult.success,
      summary,
      errors
    };
  }

  clearAuth(): void {
    this.authToken = null;
    this.tokenExpiry = null;
    memberDataService.clearAuth(); // Clear auth from member service too
  }
  
  // Add a dedicated method for syncing only member data:
  async syncMemberDataOnly(): Promise<{
    success: boolean;
    totalMembers: number;
    totalMeetings: number;
    error?: string;
  }> {
    // Authenticate first
    const authSuccess = await this.authenticate();
    if (!authSuccess) {
      return {
        success: false,
        totalMembers: 0,
        totalMeetings: 0,
        error: 'Authentication failed'
      };
    }
  
    if (!(await this.isOnline())) {
      return {
        success: false,
        totalMembers: 0,
        totalMeetings: 0,
        error: 'Offline — cannot sync'
      };
    }
  
    return await memberDataService.syncMemberData();
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

  async syncSingleAdvanceLoan(record: AdvanceLoan): Promise<{
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
      // Map Dexie AdvanceLoan fields to backend expected format
      // Format member identifier - use "id:" prefix for new members
      const formattedMemberId = this.formatMemberIdentifier(record.memberId);
      const payload = {
        member: formattedMemberId,
        principal_amount: record.amount, // Map amount to principal_amount
        officer_name: 'Offline Officer',
        notes: record.reason || 'Advance short-term loans', // Use reason or default message
        loan_type: 'advance',
        timestamp: record.timestamp instanceof Date 
          ? record.timestamp.toISOString() 
          : new Date(record.timestamp).toISOString()
      };

      const response = await this.authenticatedFetch(this.endpoints.advanceLoans, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: SyncResponse = await response.json();

      if (result.success && record.id) {
        await dbOperations.markAdvanceLoanSynced(record.id);
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

  async syncSingleLoanDisbursement(record: LoanDisbursement): Promise<{
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
      // Extract numeric ID from loan_id string (e.g., "LN0039" -> 39)
      const extractNumericId = (loanId: string): number => {
        const numericPart = loanId.replace(/[A-Za-z]/g, '').replace(/^0+/, '');
        const numericId = parseInt(numericPart, 10);
        
        if (isNaN(numericId)) {
          throw new Error(`Invalid loan ID format: ${loanId}`);
        }
        
        return numericId;
      };
  
      const numericLoanId = extractNumericId(record.loan_id);
  
      const payload = {
        loan_id: numericLoanId, // Use extracted numeric ID
        include_processing_fee: record.include_processing_fee,
        include_advocate_fee: record.include_advocate_fee,
        include_advance_deduction: record.include_advance_deduction,
        custom_deductions: record.custom_deductions,
        timestamp: record.timestamp instanceof Date 
          ? record.timestamp.toISOString() 
          : new Date(record.timestamp).toISOString()
      };
  
      // Use the numeric ID in the URL
      const previewEndpoint = `${this.baseUrl}/api/loans/${numericLoanId}/preview_disbursement/`;
      const disburseEndpoint = `${this.baseUrl}/api/loans/${numericLoanId}/disburse/`;
  
      // Step 1: Call preview endpoint
      console.log(`Step 1: Calling preview endpoint for loan ${numericLoanId}`);
      const previewResponse = await this.authenticatedFetch(previewEndpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
  
      if (!previewResponse.ok) {
        throw new Error(`Preview failed: HTTP ${previewResponse.status}: ${previewResponse.statusText}`);
      }
  
      let previewResult: SyncResponse;
      try {
        previewResult = await previewResponse.json();
      } catch (jsonError) {
        throw new Error(`Preview response parsing failed: ${jsonError}`);
      }
  
      if (previewResult.success === false) {
        throw new Error(`Preview failed: ${previewResult.error || 'Unknown preview error'}`);
      }
  
      console.log(`Step 1 completed: Preview successful for loan ${numericLoanId}`);
  
      // Step 2: Call disburse endpoint
      console.log(`Step 2: Calling disburse endpoint for loan ${numericLoanId}`);
      const response = await this.authenticatedFetch(disburseEndpoint, {
        method: 'POST',
        body: JSON.stringify({
          loan_id: numericLoanId,
          timestamp: payload.timestamp
        })
      });
  
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
  
      const result: SyncResponse = await response.json();
  
      if (result.success && record.id) {
        await dbOperations.markLoanDisbursementSynced(record.id);
        
        // Mark the loan as disbursed in the local database
        try {
          await dbOperations.markLoanAsDisbursed(record.loan_id);
          console.log(`Loan ${record.loan_id} marked as disbursed in local database`);
        } catch (markError) {
          console.warn(`Failed to mark loan ${record.loan_id} as disbursed locally:`, markError);
          // Don't fail the sync for this - the disbursement was successful
        }
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
      groupCollections: number;
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
        groupCollections: unsynced.groupCollections?.length || 0,
        total: unsynced.total
      }
    };
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
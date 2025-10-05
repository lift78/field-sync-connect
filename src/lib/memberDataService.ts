interface MemberBalance {
  member_id: string;
  name: string;
  phone: string;
  group_id: number;
  group_name: string;
  meeting_date: string;
  balances: {
    savings_balance: number;
    loan_balance: number;
    advance_loan_balance: number;
    unallocated_funds: number;
    total_outstanding: number;
  };
}

interface MemberDataResponse {
  success: boolean;
  message: string;
  data: {
    meetings: any[];
    members: MemberBalance[];
    summary: {
      total_meetings: number;
      total_members: number;
      financial_totals: any;
    };
  };
}

interface TodaysLoansResponse {
  success: boolean;
  message: string;
  meeting_date: string;
  groups_with_meetings: Array<{
    meeting_id: number;
    group_id: number;
    group_name: string;
    meeting_status: string;
    scheduled_status: string;
  }>;
  loans: Array<{
    id: string;
    database_id: number;
    member: {
      member_id: string;
      name: string;
      phone: string;
      advance_balance: number;
    };
    group: {
      id: number;
      name: string;
    };
    principalAmount: number;
    repaymentAmount: number;
    monthlyRepayment: number;
    installments: number;
    status: string;
    applicationDate: string;
  }>;
  summary: {
    total_groups_with_meetings: number;
    total_approved_loans: number;
  };
}

class MemberDataService {
  private baseUrl: string;
  private authToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.liftipoa.com';
  }

  // Set auth token from sync service
  setAuthToken(token: string, expiry: number) {
    this.authToken = token;
    this.tokenExpiry = expiry;
  }

  // Clear auth token
  clearAuth() {
    this.authToken = null;
    this.tokenExpiry = null;
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Try to get token from sync service first, then fallback to stored credentials
    if (this.authToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      (headers as any)['Authorization'] = `Bearer ${this.authToken}`;
    } else {
      // Fallback to getting credentials from database
      const credentials = await dbOperations.getUserCredentials();
      if (credentials?.token) {
        (headers as any)['Authorization'] = `Bearer ${credentials.token}`;
      }
    }

    return headers;
  }

  private async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...(await this.getAuthHeaders())
      }
    });

    return response;
  }

  async fetchMemberBalances(): Promise<MemberDataResponse> {
    const response = await this.authenticatedFetch(`${this.baseUrl}/api/offline-sync/member-balances/`, {
      method: 'GET'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch member balances: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  async refreshMemberBalances(): Promise<MemberDataResponse> {
    const response = await this.authenticatedFetch(`${this.baseUrl}/api/offline-sync/member-balances/`, {
      method: 'POST'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to refresh member balances: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  async fetchGroupData(groupId: string): Promise<any> {
    const response = await this.authenticatedFetch(`${this.baseUrl}/api/offline-sync/group/${groupId}/`, {
      method: 'GET'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch group data: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  async cleanupOldData(): Promise<any> {
    const response = await this.authenticatedFetch(`${this.baseUrl}/api/offline-sync/cleanup/`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to cleanup old data: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  // NEW: Fetch loans for today's meetings (replaces the old fetchLoansByGroup)
  async fetchTodaysLoans(): Promise<TodaysLoansResponse> {
    const response = await this.authenticatedFetch(`${this.baseUrl}/api/loans/list_loans_for_today_meetings/`, {
      method: 'GET'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch today's loans: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  // DEPRECATED: Keep for backward compatibility but log warning
  async fetchLoansByGroup(groupId: number): Promise<any> {
    console.warn('⚠️ fetchLoansByGroup is deprecated. Use fetchTodaysLoans() instead.');
    
    // For now, return empty response to prevent breaking
    return {
      success: false,
      error: 'This endpoint has been replaced with fetchTodaysLoans()',
      loans: []
    };
  }

  // UPDATED: Fetch loans for today's meetings instead of specific groups
  async fetchAllLoansForToday(): Promise<{success: boolean; loans: any[]; groupsWithMeetings: any[]; error?: string}> {
    try {
      console.log('📄 Fetching loans for today\'s meetings...');
      
      const response = await this.fetchTodaysLoans();
      
      if (response.success) {
        console.log(`📊 Retrieved ${response.loans.length} loans for ${response.summary.total_groups_with_meetings} groups with meetings today`);
        
        // Store in local database
        if (response.loans.length > 0) {
          await dbOperations.storeLoans(response.loans);
          console.log('✅ Today\'s loans stored successfully');
        }
        
        return {
          success: true,
          loans: response.loans,
          groupsWithMeetings: response.groups_with_meetings
        };
      } else {
        throw new Error(response.message || 'Failed to fetch today\'s loans');
      }
    } catch (error: any) {
      console.error('❌ Error fetching today\'s loans:', error);
      return {
        success: false,
        loans: [],
        groupsWithMeetings: [],
        error: error.message
      };
    }
  }

  // DEPRECATED: Keep for backward compatibility
  async fetchAllLoansForGroups(groupIds: number[]): Promise<{success: boolean; loans: any[]; error?: string}> {
    console.warn('⚠️ fetchAllLoansForGroups is deprecated. Use fetchAllLoansForToday() instead.');
    
    // Redirect to new method
    const result = await this.fetchAllLoansForToday();
    return {
      success: result.success,
      loans: result.loans,
      error: result.error
    };
  }

  // UPDATED: Sync member data AND today's loans
  async syncMemberData(): Promise<{
    success: boolean;
    totalMembers: number;
    totalMeetings: number;
    totalLoans?: number;
    groupsWithMeetings?: number;
    error?: string;
  }> {
    try {
      console.log('📄 Starting member data sync...');
      
      // Fetch latest member data using POST to refresh data
      const memberResponse = await this.refreshMemberBalances();
      
      if (!memberResponse.success || !memberResponse.data.members) {
        throw new Error(memberResponse.message || 'No member data received');
      }

      console.log(`📊 Retrieved ${memberResponse.data.members.length} members across ${memberResponse.data.summary.total_meetings} meetings`);
      
      // Store member data in local database
      const membersToStore = memberResponse.data.members.map((member) => ({
        ...member,
        last_updated: new Date().toISOString()
      }));
      
      await dbOperations.storeMemberBalances(membersToStore);
      console.log('✅ Member balances stored successfully');

      // Fetch and store today's loans for disbursement
      console.log('📄 Fetching loans for disbursement...');
      const loansResult = await this.fetchAllLoansForToday();
      
      let totalLoans = 0;
      let groupsWithMeetings = 0;
      
      if (loansResult.success) {
        totalLoans = loansResult.loans.length;
        groupsWithMeetings = loansResult.groupsWithMeetings.length;
        console.log(`✅ Retrieved ${totalLoans} loans for disbursement from ${groupsWithMeetings} groups`);
      } else {
        console.warn('⚠️ Failed to fetch loans but member sync succeeded:', loansResult.error);
        // Don't fail the whole sync if loans fetch fails
      }

      // Cleanup old data periodically
      try {
        await this.cleanupOldData();
        console.log('🧹 Old data cleanup completed');
      } catch (cleanupError) {
        console.warn('⚠️ Cleanup failed but member sync succeeded:', cleanupError);
        // Don't fail the whole sync if cleanup fails
      }

      return {
        success: true,
        totalMembers: memberResponse.data.members.length,
        totalMeetings: memberResponse.data.summary.total_meetings,
        totalLoans,
        groupsWithMeetings
      };

    } catch (error: any) {
      console.error('❌ Error syncing member data:', error);
      return {
        success: false,
        totalMembers: 0,
        totalMeetings: 0,
        error: error.message
      };
    }
  }

  // Method to sync with authentication token from sync service
  async syncWithAuth(authToken: string, tokenExpiry: number): Promise<{
    success: boolean;
    totalMembers: number;
    totalMeetings: number;
    totalLoans?: number;
    groupsWithMeetings?: number;
    error?: string;
  }> {
    // Set auth token first
    this.setAuthToken(authToken, tokenExpiry);
    
    // Then sync
    return await this.syncMemberData();
  }

  // Check if service is ready (has auth)
  isAuthenticated(): boolean {
    return (this.authToken !== null && this.tokenExpiry !== null && Date.now() < this.tokenExpiry);
  }
}

// Import dbOperations for auth credentials
import { dbOperations } from './database';

export const memberDataService = new MemberDataService();
export type { MemberBalance, MemberDataResponse, TodaysLoansResponse };
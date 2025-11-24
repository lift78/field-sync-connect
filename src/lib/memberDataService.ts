// memberDataService.ts - UPDATED with qualification integration

import { dbOperations } from './database';
import { getMemberLoanQualifications, getBulkMemberQualifications } from './qualificationCalculator';
import type { MemberBalance } from './database';

interface MemberBalanceWithQualifications extends MemberBalance {
  loan_qualifications?: any;
  qualification_inputs?: any;
}

interface MemberDataResponse {
  success: boolean;
  message: string;
  data: {
    meetings: any[];
    members: MemberBalanceWithQualifications[];
    summary: {
      total_meetings: number;
      total_members: number;
      financial_totals: any;
      qualification_summary?: any;
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

  setAuthToken(token: string, expiry: number) {
    this.authToken = token;
    this.tokenExpiry = expiry;
  }

  clearAuth() {
    this.authToken = null;
    this.tokenExpiry = null;
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (this.authToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      (headers as any)['Authorization'] = `Bearer ${this.authToken}`;
    } else {
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

  async fetchLoansByGroup(groupId: number): Promise<any> {
    console.warn('⚠️ fetchLoansByGroup is deprecated. Use fetchTodaysLoans() instead.');
    return {
      success: false,
      error: 'This endpoint has been replaced with fetchTodaysLoans()',
      loans: []
    };
  }

  async fetchAllLoansForToday(): Promise<{success: boolean; loans: any[]; groupsWithMeetings: any[]; error?: string}> {
    try {
      console.log('🔄 Fetching loans for today\'s meetings...');
      
      const response = await this.fetchTodaysLoans();
      
      if (response.success) {
        console.log(`📊 Retrieved ${response.loans.length} loans for ${response.summary.total_groups_with_meetings} groups with meetings today`);
        
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

  async fetchAllLoansForGroups(groupIds: number[]): Promise<{success: boolean; loans: any[]; error?: string}> {
    console.warn('⚠️ fetchAllLoansForGroups is deprecated. Use fetchAllLoansForToday() instead.');
    const result = await this.fetchAllLoansForToday();
    return {
      success: result.success,
      loans: result.loans,
      error: result.error
    };
  }

  /**
   * NEW: Sync member data with client-side qualification recalculation
   * This includes pending/unsynced contributions in qualification calculations
   */
  async syncMemberData(): Promise<{
    success: boolean;
    totalMembers: number;
    totalMeetings: number;
    totalLoans?: number;
    groupsWithMeetings?: number;
    qualificationsSummary?: {
      longterm_qualified: number;
      advance_qualified: number;
      members_with_pending_contributions: number;
    };
    error?: string;
  }> {
    try {
      console.log('🔄 Starting member data sync...');
      
      // Fetch latest member data from backend
      const memberResponse = await this.refreshMemberBalances();
      
      if (!memberResponse.success || !memberResponse.data.members) {
        throw new Error(memberResponse.message || 'No member data received');
      }

      console.log(`📊 Retrieved ${memberResponse.data.members.length} members across ${memberResponse.data.summary.total_meetings} meetings`);
      
      // Store base member data in local database (WITHOUT qualifications yet)
      const membersToStore = memberResponse.data.members.map((member) => ({
        member_id: member.member_id,
        name: member.name,
        phone: member.phone,
        group_id: member.group_id,
        group_name: member.group_name,
        meeting_date: member.meeting_date,
        balances: member.balances,
        inst: member.inst,
        last_updated: new Date().toISOString()
      }));
      
      await dbOperations.storeMemberBalances(membersToStore);
      console.log('✅ Member balances stored successfully');

      // NEW: Recalculate qualifications CLIENT-SIDE including pending records
      console.log('🔄 Recalculating qualifications with pending contributions...');
      
      const storedMembers = await dbOperations.getAllMembers();
      const qualificationsMap = await getBulkMemberQualifications(storedMembers, true);
      
      // Count qualifications
      let longtermQualified = 0;
      let advanceQualified = 0;
      let membersWithPending = 0;
      
      qualificationsMap.forEach(qual => {
        if (qual.longterm_loan.qualifies) longtermQualified++;
        if (qual.advance_loan.qualifies) advanceQualified++;
        if (qual.includes_pending_records) membersWithPending++;
      });
      
      console.log(`✅ Qualifications recalculated:`);
      console.log(`   - Long-term qualified: ${longtermQualified}/${storedMembers.length}`);
      console.log(`   - Advance qualified: ${advanceQualified}/${storedMembers.length}`);
      console.log(`   - Members with pending contributions: ${membersWithPending}`);

      // Fetch and store today's loans
      console.log('🔄 Fetching loans for disbursement...');
      const loansResult = await this.fetchAllLoansForToday();
      
      let totalLoans = 0;
      let groupsWithMeetings = 0;
      
      if (loansResult.success) {
        totalLoans = loansResult.loans.length;
        groupsWithMeetings = loansResult.groupsWithMeetings.length;
        console.log(`✅ Retrieved ${totalLoans} loans for disbursement from ${groupsWithMeetings} groups`);
      } else {
        console.warn('⚠️ Failed to fetch loans but member sync succeeded:', loansResult.error);
      }

      // Cleanup old data
      try {
        await this.cleanupOldData();
        console.log('🧹 Old data cleanup completed');
      } catch (cleanupError) {
        console.warn('⚠️ Cleanup failed but member sync succeeded:', cleanupError);
      }

      return {
        success: true,
        totalMembers: memberResponse.data.members.length,
        totalMeetings: memberResponse.data.summary.total_meetings,
        totalLoans,
        groupsWithMeetings,
        qualificationsSummary: {
          longterm_qualified: longtermQualified,
          advance_qualified: advanceQualified,
          members_with_pending_contributions: membersWithPending
        }
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

  async syncWithAuth(authToken: string, tokenExpiry: number): Promise<{
    success: boolean;
    totalMembers: number;
    totalMeetings: number;
    totalLoans?: number;
    groupsWithMeetings?: number;
    qualificationsSummary?: {
      longterm_qualified: number;
      advance_qualified: number;
      members_with_pending_contributions: number;
    };
    error?: string;
  }> {
    this.setAuthToken(authToken, tokenExpiry);
    return await this.syncMemberData();
  }

  isAuthenticated(): boolean {
    return (this.authToken !== null && this.tokenExpiry !== null && Date.now() < this.tokenExpiry);
  }

  /**
   * NEW: Get member with real-time qualifications (includes pending contributions)
   */
  async getMemberWithQualifications(memberId: string): Promise<{
    member: MemberBalance | undefined;
    qualifications: any;
    error?: string;
  }> {
    try {
      const member = await dbOperations.getMemberById(memberId);
      
      if (!member) {
        return {
          member: undefined,
          qualifications: null,
          error: 'Member not found'
        };
      }
      
      // Calculate qualifications including pending records
      const qualifications = await getMemberLoanQualifications(member, true);
      
      return {
        member,
        qualifications,
      };
    } catch (error: any) {
      console.error('Error getting member with qualifications:', error);
      return {
        member: undefined,
        qualifications: null,
        error: error.message
      };
    }
  }
}

export const memberDataService = new MemberDataService();
export type { MemberBalance, MemberDataResponse, TodaysLoansResponse };
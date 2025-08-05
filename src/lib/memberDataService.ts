interface MemberBalance {
  member_id: string;
  name: string;
  phone: string;
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

class MemberDataService {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://your-api-url.com';
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    // Get auth token from your existing auth system
    const credentials = await dbOperations.getUserCredentials();
    if (credentials?.token) {
      this.authToken = credentials.token;
    }

    return {
      'Content-Type': 'application/json',
      ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
    };
  }

  async fetchMemberBalances(): Promise<MemberDataResponse> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/api/offline-sync/member-balances/`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch member balances: ${response.statusText}`);
    }

    return await response.json();
  }

  async refreshMemberBalances(): Promise<MemberDataResponse> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/api/offline-sync/member-balances/`, {
      method: 'POST',
      headers
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh member balances: ${response.statusText}`);
    }

    return await response.json();
  }

  async fetchGroupData(groupId: string): Promise<any> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/api/offline-sync/group/${groupId}/`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch group data: ${response.statusText}`);
    }

    return await response.json();
  }

  async cleanupOldData(): Promise<any> {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`${this.baseUrl}/api/offline-sync/cleanup/`, {
      method: 'DELETE',
      headers
    });

    if (!response.ok) {
      throw new Error(`Failed to cleanup old data: ${response.statusText}`);
    }

    return await response.json();
  }

  async syncMemberData(): Promise<void> {
    try {
      // Fetch latest member data
      const response = await this.fetchMemberBalances();
      
      if (response.success && response.data.members) {
        // Store in local database with proper typing
        const membersToStore = response.data.members.map((member) => ({
          ...member,
          last_updated: new Date().toISOString()
        }));
        await dbOperations.storeMemberBalances(membersToStore);
        
        // Cleanup old data periodically
        const lastCleanup = localStorage.getItem('lastDataCleanup');
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        
        if (!lastCleanup || parseInt(lastCleanup) < oneDayAgo) {
          await this.cleanupOldData();
          localStorage.setItem('lastDataCleanup', now.toString());
        }
      }
    } catch (error) {
      console.error('Error syncing member data:', error);
      throw error;
    }
  }
}

// Import dbOperations for auth credentials
import { dbOperations } from './database';

export const memberDataService = new MemberDataService();
export type { MemberBalance, MemberDataResponse };
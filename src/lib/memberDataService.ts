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
  
    async syncMemberData(): Promise<{
      success: boolean;
      totalMembers: number;
      totalMeetings: number;
      error?: string;
    }> {
      try {
        console.log('🔄 Starting member data sync...');
        
        // Fetch latest member data using POST to refresh data
        const response = await this.refreshMemberBalances();
        
        if (response.success && response.data.members) {
          console.log(`📊 Retrieved ${response.data.members.length} members across ${response.data.summary.total_meetings} meetings`);
          
          // Store in local database with proper typing
          const membersToStore = response.data.members.map((member) => ({
            ...member,
            last_updated: new Date().toISOString()
          }));
          
          await dbOperations.storeMemberBalances(membersToStore);
          console.log('✅ Member balances stored successfully');
          
          // Cleanup old data periodically (but don't use localStorage as it's not supported in artifacts)
          try {
            const now = Date.now();
            const sessionKey = 'lastDataCleanup_' + new Date().getDate(); // Use day as key
            
            // Simple cleanup check without localStorage dependency
            await this.cleanupOldData();
            console.log('🧹 Old data cleanup completed');
          } catch (cleanupError) {
            console.warn('⚠️ Cleanup failed but member sync succeeded:', cleanupError);
            // Don't fail the whole sync if cleanup fails
          }
  
          return {
            success: true,
            totalMembers: response.data.members.length,
            totalMeetings: response.data.summary.total_meetings
          };
        } else {
          throw new Error(response.message || 'No member data received');
        }
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
  export type { MemberBalance, MemberDataResponse };
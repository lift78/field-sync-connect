import Dexie, { Table } from 'dexie';

// Define interfaces for your data
export interface Allocation {
  memberId: string;
  type: 'savings' | 'loan' | 'amount_for_advance_payment' | 'other';
  amount: number;
  reason?: string;
}

export interface UserCredentials {
  id?: number;
  username: string;
  password: string;
  lastLogin: Date;
  token?: string;
}

export interface MemberBalance {
  id?: number;
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
  inst?: number;
  last_updated: string;
  
  // NEW: Qualification data from backend (base values)
  loan_qualifications?: {
    longterm_loan: {
      qualifies: boolean;
      max_amount: number;
      reason: string;
      details: any;
    };
    advance_loan: {
      qualifies: boolean;
      max_amount: number;
      reason: string;
      details: any;
    };
  };
  
  // NEW: Raw inputs for recalculation
  qualification_inputs?: {
    savings_balance: number;
    loan_balance: number;
    advance_balance: number;
    has_pending_loan: boolean;
    original_loan_repayment?: number;
  };
}

export interface CashCollection {
  id?: number;
  memberId: string;
  memberName: string;
  totalAmount: number;        // Total amount collected
  cashAmount: number;         // Cash portion
  mpesaAmount: number;        // M-Pesa portion
  cashReference?: string;     // Reference number for cash only
  allocationId: string;       // Single ID for all allocations
  allocations: Allocation[];
  timestamp: Date;
  synced: boolean;
  syncStatus?: 'pending' | 'failed' | 'synced';
  syncError?: string;
}

export interface LoanApplication {
  id?: number;
  memberId: string;
  memberName: string;
  loanAmount: number;
  purpose?: string;
  tenure?: number;
  interestRate?: number;
  installments: number;
  guarantors: string[];
  timestamp: Date;
  synced: boolean;
  syncStatus?: 'pending' | 'failed' | 'synced';
  syncError?: string;
}

export interface Loan {
  id?: number;
  loan_id: string;
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
  disbursed?: boolean;
}

export interface LoanDisbursement {
  id?: number;
  loan_id: string;
  database_id: number;
  include_processing_fee: boolean;
  include_advocate_fee: boolean;
  include_advance_deduction: boolean;
  custom_deductions: Array<{
    description: string;
    amount: number;
  }>;
  timestamp: Date;
  synced: boolean;
  syncStatus?: 'pending' | 'failed' | 'synced';
  syncError?: string;
}

export interface AdvanceLoan {
  id?: number;
  memberId: string;
  memberName: string;
  amount: number;
  reason?: string;
  repaymentDate?: string;
  timestamp: Date;
  synced: boolean;
  syncStatus?: 'pending' | 'failed' | 'synced';
  syncError?: string;
}

export interface GroupCollection {
  id?: number;
  groupId: string;
  groupName: string;
  cashCollected: number;
  finesCollected: number;
  timestamp: Date;
  synced: boolean;
  syncStatus?: 'pending' | 'failed' | 'synced';
  syncError?: string;
}

export interface NewMember {
  id?: number;
  name: string;
  phone: string;
  group: number;
  location: string;
  id_number: string;
  email?: string;
  occupation?: string;
  notes?: string;
  // Initial allocations (stored as cash collection reference)
  cashCollectionId?: number;
  timestamp: Date;
  synced: boolean;
  syncStatus?: 'pending' | 'failed' | 'synced';
  syncError?: string;
}

export interface OfficeCash {
  id?: number;
  groupId: string;
  amount: number;
  timestamp: Date;
}

// Database class
export class FieldOfficerDB extends Dexie {
  cashCollections!: Table<CashCollection>;
  loanApplications!: Table<LoanApplication>;
  loans!: Table<Loan>;
  loanDisbursements!: Table<LoanDisbursement>;
  advanceLoans!: Table<AdvanceLoan>;
  groupCollections!: Table<GroupCollection>;
  newMembers!: Table<NewMember>;
  officeCash!: Table<OfficeCash>;
  userCredentials!: Table<UserCredentials>;
  memberBalances!: Table<MemberBalance>;

  constructor() {
    super('FieldOfficerDB');
    this.version(12).stores({
      // Enhanced indexing for better search performance
      cashCollections: '++id, memberId, memberName, totalAmount, cashAmount, mpesaAmount, allocationId, timestamp',
      loanApplications: '++id, memberId, memberName, loanAmount, installments, timestamp',
      loans: '++id, loan_id, database_id, [member.member_id], [group.id], status, applicationDate',
      loanDisbursements: '++id, loan_id, database_id, timestamp',
      advanceLoans: '++id, memberId, memberName, amount, timestamp',
      groupCollections: '++id, groupId, groupName, cashCollected, finesCollected, timestamp',
      newMembers: '++id, id_number, name, phone, group, timestamp',
      officeCash: '++id, &groupId, amount, timestamp', // Not synced, just for calculations
      userCredentials: '++id, username, lastLogin',
      memberBalances: '++id, member_id, name, phone, group_id, group_name, last_updated'
    });
  }
}

export const db = new FieldOfficerDB();

// Helper function to generate cash reference
function generateCashReference(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `CASH-${timestamp}-${random}`.toUpperCase();
}

// Helper function to generate allocation ID
function generateAllocationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ALLOC-${timestamp}-${random}`.toUpperCase();
}

export const dbOperations = {
  // =============================================================================
  // CASH COLLECTIONS
  // =============================================================================
  async addCashCollection(data: Omit<CashCollection, 'id' | 'synced' | 'allocationId' | 'cashReference'>) {
    const allocationId = generateAllocationId();
    const cashReference = data.cashAmount > 0 ? generateCashReference() : undefined;
    
    return await db.cashCollections.add({ 
      ...data, 
      allocationId,
      cashReference,
      synced: false,
      syncStatus: 'pending'
    });
  },

  async getCashCollections() {
    return await db.cashCollections.orderBy('timestamp').reverse().toArray();
  },

  async getUnsyncedCashCollections() {
    return await db.cashCollections.filter(record => record.synced === false).toArray();
  },

  async markCashCollectionSynced(id: number): Promise<number> {
    return await db.cashCollections.update(id, { 
      synced: true, 
      syncStatus: 'synced',
      syncError: undefined
    });
  },

  async markCashCollectionFailed(id: number, error: string): Promise<number> {
    return await db.cashCollections.update(id, { 
      syncStatus: 'failed', 
      syncError: error 
    });
  },

  async updateCashCollection(id: string, data: CashCollection) {
    // CRITICAL: Preserve existing allocationId and cashReference to prevent duplicates
    // These IDs must NEVER change once created, even on retry or update
    const updates: Partial<CashCollection> = { 
      ...data, 
      synced: false,
      syncStatus: 'pending',
      syncError: undefined,
      // Keep the original allocationId and cashReference - NEVER regenerate
      allocationId: data.allocationId,
      cashReference: data.cashReference
    };
    
    return await db.cashCollections.update(Number(id), updates);
  },

  async deleteCashCollection(id: string | number) {
    return await db.cashCollections.delete(Number(id));
  },

  // =============================================================================
  // LOAN APPLICATIONS
  // =============================================================================
  async addLoanApplication(data: Omit<LoanApplication, 'id' | 'synced'>) {
    return await db.loanApplications.add({ 
      ...data, 
      synced: false,
      syncStatus: 'pending'
    });
  },

  async getLoanApplications() {
    return await db.loanApplications.orderBy('timestamp').reverse().toArray();
  },

  async getUnsyncedLoanApplications() {
    return await db.loanApplications.filter(record => record.synced === false).toArray();
  },

  async markLoanApplicationSynced(id: number): Promise<number> {
    return await db.loanApplications.update(id, { 
      synced: true,
      syncStatus: 'synced',
      syncError: undefined
    });
  },

  async markLoanApplicationFailed(id: number, error: string): Promise<number> {
    return await db.loanApplications.update(id, { 
      syncStatus: 'failed', 
      syncError: error 
    });
  },

  async updateLoanApplication(id: string, data: LoanApplication) {
    return await db.loanApplications.update(Number(id), { 
      ...data, 
      synced: false, 
      syncStatus: 'pending', 
      syncError: undefined 
    });
  },

  async deleteLoanApplication(id: string | number) {
    return await db.loanApplications.delete(Number(id));
  },

  // =============================================================================
  // LOANS
  // =============================================================================
  async storeLoans(loans: any[]) {
    try {
      // Map backend loan format to our Loan interface
      const formattedLoans = loans.map(loan => ({
        loan_id: loan.id, // Map backend 'id' to 'loan_id'
        database_id: loan.database_id,
        member: loan.member,
        group: loan.group,
        principalAmount: loan.principalAmount,
        repaymentAmount: loan.repaymentAmount,
        monthlyRepayment: loan.monthlyRepayment,
        installments: loan.installments,
        status: loan.status,
        applicationDate: loan.applicationDate,
        disbursed: loan.disbursed
      }));
      
      // Clear existing loans and store new ones
      await db.loans.clear();
      await db.loans.bulkAdd(formattedLoans);
      return formattedLoans.length;
    } catch (error) {
      console.error('Error storing loans:', error);
      throw error;
    }
  },

  async getAllLoans() {
    return await db.loans.toArray();
  },

  async getLoansByGroup(groupId: number) {
    return await db.loans.filter(loan => loan.group.id === groupId).toArray();
  },

  async getLoanById(loanId: string) {
    return await db.loans.where('loan_id').equals(loanId).first();
  },

  async markLoanAsDisbursed(loanId: string) {
    if (!loanId || typeof loanId !== 'string') {
      throw new Error('Invalid loan ID provided');
    }
    return await db.loans.where('loan_id').equals(loanId).modify({ disbursed: true });
  },

  async getUniqueGroups() {
    const loans = await db.loans.toArray();
    const uniqueGroups = loans.reduce((acc, loan) => {
      const existing = acc.find(g => g.id === loan.group.id);
      if (!existing) {
        acc.push(loan.group);
      }
      return acc;
    }, [] as Array<{ id: number; name: string }>);
    return uniqueGroups;
  },

  async getAllGroups() {
    const members = await db.memberBalances.toArray();
    const uniqueGroups = members.reduce((acc, member) => {
      const existing = acc.find(g => g.id === member.group_id);
      if (!existing) {
        acc.push({ 
          id: member.group_id, 
          name: member.group_name 
        });
      }
      return acc;
    }, [] as Array<{ id: number; name: string }>);
    return uniqueGroups.sort((a, b) => a.name.localeCompare(b.name));
  },

  // =============================================================================
  // LOAN DISBURSEMENTS
  // =============================================================================
  async addLoanDisbursement(data: Omit<LoanDisbursement, 'id' | 'synced'>) {
    return await db.loanDisbursements.add({ 
      ...data, 
      synced: false,
      syncStatus: 'pending'
    });
  },

  async getLoanDisbursements() {
    return await db.loanDisbursements.orderBy('timestamp').reverse().toArray();
  },

  async getUnsyncedLoanDisbursements() {
    return await db.loanDisbursements.filter(record => record.synced === false).toArray();
  },

  async markLoanDisbursementSynced(id: number): Promise<number> {
    return await db.loanDisbursements.update(id, { 
      synced: true,
      syncStatus: 'synced',
      syncError: undefined
    });
  },

  async markLoanDisbursementFailed(id: number, error: string): Promise<number> {
    return await db.loanDisbursements.update(id, { 
      syncStatus: 'failed', 
      syncError: error 
    });
  },

  async updateLoanDisbursement(id: string, data: LoanDisbursement) {
    return await db.loanDisbursements.update(Number(id), { 
      ...data, 
      synced: false, 
      syncStatus: 'pending', 
      syncError: undefined 
    });
  },

  async updateLoanDisbursementSyncStatus(id: number, status: 'pending' | 'failed' | 'synced', error?: string): Promise<number> {
    return await db.loanDisbursements.update(id, { 
      syncStatus: status, 
      syncError: error,
      synced: status === 'synced'
    });
  },

  async deleteLoanDisbursement(id: string | number) {
    return await db.loanDisbursements.delete(Number(id));
  },

  async getLoanDisbursementByLoanId(loanId: string) {
    return await db.loanDisbursements.where('loan_id').equals(loanId).first();
  },

  // =============================================================================
  // ADVANCE LOANS
  // =============================================================================
  async addAdvanceLoan(data: Omit<AdvanceLoan, 'id' | 'synced'>) {
    return await db.advanceLoans.add({ 
      ...data, 
      synced: false,
      syncStatus: 'pending'
    });
  },

  async getAdvanceLoans() {
    return await db.advanceLoans.orderBy('timestamp').reverse().toArray();
  },

  async getUnsyncedAdvanceLoans() {
    return await db.advanceLoans.filter(record => record.synced === false).toArray();
  },

  async markAdvanceLoanSynced(id: number): Promise<number> {
    return await db.advanceLoans.update(id, { 
      synced: true,
      syncStatus: 'synced',
      syncError: undefined
    });
  },

  async markAdvanceLoanFailed(id: number, error: string): Promise<number> {
    return await db.advanceLoans.update(id, { 
      syncStatus: 'failed', 
      syncError: error 
    });
  },

  async updateAdvanceLoan(id: string, data: AdvanceLoan) {
    return await db.advanceLoans.update(Number(id), { 
      ...data, 
      synced: false, 
      syncStatus: 'pending', 
      syncError: undefined 
    });
  },

  async deleteAdvanceLoan(id: string | number) {
    return await db.advanceLoans.delete(Number(id));
  },

  // =============================================================================
  // GROUP COLLECTIONS
  // =============================================================================
  async addGroupCollection(data: Omit<GroupCollection, 'id' | 'synced'>) {
    return await db.groupCollections.add({
      ...data,
      synced: false,
      syncStatus: 'pending'
    });
  },

  async getGroupCollections() {
    return await db.groupCollections.orderBy('timestamp').reverse().toArray();
  },

  async getUnsyncedGroupCollections() {
    return await db.groupCollections.filter(record => record.synced === false).toArray();
  },

  async markGroupCollectionSynced(id: number): Promise<number> {
    return await db.groupCollections.update(id, {
      synced: true,
      syncStatus: 'synced',
      syncError: undefined
    });
  },

  async markGroupCollectionFailed(id: number, error: string): Promise<number> {
    return await db.groupCollections.update(id, {
      syncStatus: 'failed',
      syncError: error
    });
  },

  async updateGroupCollection(id: string, data: GroupCollection) {
    return await db.groupCollections.update(Number(id), {
      ...data,
      synced: false,
      syncStatus: 'pending',
      syncError: undefined
    });
  },

  async deleteGroupCollection(id: string | number) {
    return await db.groupCollections.delete(Number(id));
  },


  

  // =============================================================================
  // USER CREDENTIALS
  // =============================================================================
  async getUserCredentials() {
    return await db.userCredentials.limit(1).first();
  },

  async saveUserCredentials(credentials: { username: string; password: string; token?: string }) {
    await db.userCredentials.clear();
    return await db.userCredentials.add({
      ...credentials,
      lastLogin: new Date()
    });
  },

  async updateUserCredentials(credentials: { username: string; password: string; token?: string }) {
    const existing = await db.userCredentials.limit(1).first();
    if (existing) {
      return await db.userCredentials.update(existing.id!, {
        ...credentials,
        lastLogin: new Date()
      });
    }
    return this.saveUserCredentials(credentials);
  },

  // =============================================================================
  // MEMBER BALANCES - ENHANCED
  // =============================================================================
  
  /**
   * Store member balances (bulk operation - clears and replaces all)
   */
  async storeMemberBalances(members: Omit<MemberBalance, 'id'>[]) {
    try {
      const now = new Date().toISOString();
      const membersWithTimestamp = members.map(member => ({
        ...member,
        last_updated: now
      }));
      
      // Clear existing data and store new
      await db.memberBalances.clear();
      await db.memberBalances.bulkAdd(membersWithTimestamp);
      
      return membersWithTimestamp.length;
    } catch (error) {
      console.error('Error storing member balances:', error);
      throw error;
    }
  },

  /**
   * Add individual member balance
   */
  async addMemberBalance(member: Omit<MemberBalance, 'id'>): Promise<number> {
    try {
      return await db.memberBalances.add({
        ...member,
        last_updated: member.last_updated || new Date().toISOString()
      });
    } catch (error) {
      console.error('Error adding member balance:', error);
      throw error;
    }
  },

  /**
   * Update existing member balance
   */
  async updateMemberBalance(memberId: string, updates: Partial<Omit<MemberBalance, 'id'>>): Promise<number> {
    try {
      const existingMember = await db.memberBalances.where('member_id').equals(memberId).first();
      if (!existingMember) {
        throw new Error(`Member ${memberId} not found`);
      }
      
      return await db.memberBalances.update(existingMember.id!, {
        ...updates,
        last_updated: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating member balance:', error);
      throw error;
    }
  },

  /**
   * Enhanced search with better performance
   */
  async searchMembers(query: string): Promise<MemberBalance[]> {
    try {
      if (!query.trim()) return [];
      
      const queryLower = query.toLowerCase().trim();
      
      // Use Dexie's where clause for better performance on indexed fields
      let results = await db.memberBalances
        .where('member_id').startsWithIgnoreCase(query)
        .or('name').startsWithIgnoreCase(query)
        .or('phone').startsWith(query)
        .limit(10)
        .toArray();

      // If no results with startsWith, try contains search
      if (results.length === 0) {
        results = await db.memberBalances
          .filter(member => 
            member.member_id.toLowerCase().includes(queryLower) ||
            member.name.toLowerCase().includes(queryLower) ||
            member.phone.includes(query.trim())
          )
          .limit(10)
          .toArray();
      }

      return results;
    } catch (error) {
      console.error('Error searching members:', error);
      return [];
    }
  },

  /**
   * Get member by ID
   */
  async getMemberById(memberId: string): Promise<MemberBalance | undefined> {
    try {
      return await db.memberBalances.where('member_id').equals(memberId).first();
    } catch (error) {
      console.error('Error getting member by ID:', error);
      return undefined;
    }
  },

  /**
   * Get members by multiple IDs (batch operation)
   */
  async getMembersByIds(memberIds: string[]): Promise<MemberBalance[]> {
    try {
      return await db.memberBalances.where('member_id').anyOf(memberIds).toArray();
    } catch (error) {
      console.error('Error getting members by IDs:', error);
      return [];
    }
  },

  /**
   * Get all members with optional sorting
   */
  async getAllMembers(sortBy: 'name' | 'member_id' | 'last_updated' = 'name'): Promise<MemberBalance[]> {
    try {
      return await db.memberBalances.orderBy(sortBy).toArray();
    } catch (error) {
      console.error('Error getting all members:', error);
      return [];
    }
  },

  /**
   * Get member count
   */
  async getMemberCount(): Promise<number> {
    try {
      return await db.memberBalances.count();
    } catch (error) {
      console.error('Error getting member count:', error);
      return 0;
    }
  },

  /**
   * Get members with low balances (for alerts)
   */
  async getMembersWithLowBalances(savingsThreshold: number = 1000): Promise<MemberBalance[]> {
    try {
      return await db.memberBalances
        .filter(member => member.balances.savings_balance < savingsThreshold)
        .toArray();
    } catch (error) {
      console.error('Error getting members with low balances:', error);
      return [];
    }
  },

  /**
   * Get members with outstanding loans
   */
  async getMembersWithOutstandingLoans(): Promise<MemberBalance[]> {
    try {
      return await db.memberBalances
        .filter(member => 
          member.balances.loan_balance > 0 || 
          member.balances.advance_loan_balance > 0
        )
        .toArray();
    } catch (error) {
      console.error('Error getting members with outstanding loans:', error);
      return [];
    }
  },

  /**
   * Get member balance summary statistics
   */
  async getMemberBalanceSummary(): Promise<{
    totalMembers: number;
    totalSavings: number;
    totalLoanBalance: number;
    totalAdvanceBalance: number;
    totalUnallocatedFunds: number;
    averageSavings: number;
  }> {
    try {
      const members = await this.getAllMembers();
      
      if (members.length === 0) {
        return {
          totalMembers: 0,
          totalSavings: 0,
          totalLoanBalance: 0,
          totalAdvanceBalance: 0,
          totalUnallocatedFunds: 0,
          averageSavings: 0
        };
      }

      const summary = members.reduce(
        (acc, member) => ({
          totalSavings: acc.totalSavings + member.balances.savings_balance,
          totalLoanBalance: acc.totalLoanBalance + member.balances.loan_balance,
          totalAdvanceBalance: acc.totalAdvanceBalance + member.balances.advance_loan_balance,
          totalUnallocatedFunds: acc.totalUnallocatedFunds + member.balances.unallocated_funds,
        }),
        { totalSavings: 0, totalLoanBalance: 0, totalAdvanceBalance: 0, totalUnallocatedFunds: 0 }
      );

      return {
        totalMembers: members.length,
        ...summary,
        averageSavings: summary.totalSavings / members.length
      };
    } catch (error) {
      console.error('Error getting member balance summary:', error);
      return {
        totalMembers: 0,
        totalSavings: 0,
        totalLoanBalance: 0,
        totalAdvanceBalance: 0,
        totalUnallocatedFunds: 0,
        averageSavings: 0
      };
    }
  },

  /**
   * Clean up old member records (if needed)
   */
  async cleanupOldMemberRecords(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      const cutoffISOString = cutoffDate.toISOString();
      
      return await db.memberBalances
        .filter(member => member.last_updated < cutoffISOString)
        .delete();
    } catch (error) {
      console.error('Error cleaning up old member records:', error);
      return 0;
    }
  },

  // =============================================================================
  // BULK OPERATIONS
  // =============================================================================

  /**
   * Get all unsynced records across all tables
   */
  async getAllUnsyncedRecords(): Promise<{
    cashCollections: CashCollection[];
    loanApplications: LoanApplication[];
    loanDisbursements: LoanDisbursement[];
    advanceLoans: AdvanceLoan[];
    groupCollections: GroupCollection[];
    newMembers: NewMember[];
    total: number;
  }> {
    const [cashCollections, loanApplications, loanDisbursements, advanceLoans, groupCollections, newMembers] = await Promise.all([
      this.getUnsyncedCashCollections(),
      this.getUnsyncedLoanApplications(),
      this.getUnsyncedLoanDisbursements(),
      this.getUnsyncedAdvanceLoans(),
      this.getUnsyncedGroupCollections(),
      this.getUnsyncedNewMembers()
    ]);

    return {
      cashCollections,
      loanApplications,
      loanDisbursements,
      advanceLoans,
      groupCollections,
      newMembers,
      total: cashCollections.length + loanApplications.length + loanDisbursements.length + advanceLoans.length + groupCollections.length + newMembers.length
    };
  },

  /**
   * Get all failed records across all tables
   */
  async getFailedRecords(): Promise<{
    cashCollections: CashCollection[];
    loanApplications: LoanApplication[];
    loanDisbursements: LoanDisbursement[];
    advanceLoans: AdvanceLoan[];
    groupCollections: GroupCollection[];
    total: number;
  }> {
    const [cashCollections, loanApplications, loanDisbursements, advanceLoans, groupCollections] = await Promise.all([
      db.cashCollections.filter(record => record.syncStatus === 'failed').toArray(),
      db.loanApplications.filter(record => record.syncStatus === 'failed').toArray(),
      db.loanDisbursements.filter(record => record.syncStatus === 'failed').toArray(),
      db.advanceLoans.filter(record => record.syncStatus === 'failed').toArray(),
      db.groupCollections.filter(record => record.syncStatus === 'failed').toArray()
    ]);

    return {
      cashCollections,
      loanApplications,
      loanDisbursements,
      advanceLoans,
      groupCollections,
      total: cashCollections.length + loanApplications.length + loanDisbursements.length + advanceLoans.length + groupCollections.length
    };
  },

  /**
   * Clear all synced records to free up space
   */
  async clearSyncedRecords(): Promise<number> {
    const results = await Promise.all([
      db.cashCollections.filter(record => record.synced === true).delete(),
      db.loanApplications.filter(record => record.synced === true).delete(),
      db.loanDisbursements.filter(record => record.synced === true).delete(),
      db.advanceLoans.filter(record => record.synced === true).delete(),
      db.groupCollections.filter(record => record.synced === true).delete()
    ]);
    
    return results.reduce((sum, count) => sum + count, 0);
  },

  /**
   * Get count of old pending records (older than specified days)
   */
  async getOldPendingRecordsCount(daysOld: number = 3): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    const counts = await Promise.all([
      db.cashCollections.filter(record => 
        record.synced === false && 
        record.syncStatus !== 'failed' && 
        record.timestamp < cutoffDate
      ).count(),
      db.loanApplications.filter(record => 
        record.synced === false && 
        record.syncStatus !== 'failed' && 
        record.timestamp < cutoffDate
      ).count(),
      db.loanDisbursements.filter(record => 
        record.synced === false && 
        record.syncStatus !== 'failed' && 
        record.timestamp < cutoffDate
      ).count(),
      db.advanceLoans.filter(record => 
        record.synced === false && 
        record.syncStatus !== 'failed' && 
        record.timestamp < cutoffDate
      ).count()
    ]);
    
    return counts.reduce((sum, count) => sum + count, 0);
  },

  /**
   * Delete old pending records (older than specified days)
   */
  async deleteOldPendingRecords(daysOld: number = 3): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    const results = await Promise.all([
      db.cashCollections.filter(record => 
        record.synced === false && 
        record.syncStatus !== 'failed' && 
        record.timestamp < cutoffDate
      ).delete(),
      db.loanApplications.filter(record => 
        record.synced === false && 
        record.syncStatus !== 'failed' && 
        record.timestamp < cutoffDate
      ).delete(),
      db.loanDisbursements.filter(record => 
        record.synced === false && 
        record.syncStatus !== 'failed' && 
        record.timestamp < cutoffDate
      ).delete(),
      db.advanceLoans.filter(record => 
        record.synced === false && 
        record.syncStatus !== 'failed' && 
        record.timestamp < cutoffDate
      ).delete()
    ]);
    
    return results.reduce((sum, count) => sum + count, 0);
  },

  // =============================================================================
  // OFFICE CASH (for calculations, not synced)
  // =============================================================================
  
  async setOfficeCash(groupId: string, amount: number): Promise<void> {
    await db.officeCash.put({
      groupId,
      amount,
      timestamp: new Date()
    });
  },

  async getOfficeCash(groupId: string): Promise<number> {
    const record = await db.officeCash.get({ groupId });
    return record?.amount || 0;
  },

  async removeOfficeCash(groupId: string): Promise<void> {
    await db.officeCash.where('groupId').equals(groupId).delete();
  },

  // =============================================================================
  // PLACEHOLDER SYNC METHODS (for future implementation)
  // =============================================================================
  
  async syncSingleLoanApplication(record: LoanApplication): Promise<{success: boolean; error?: string; result?: any}> {
    // This method can be implemented by the sync service
    return { success: true };
  },
  
  async syncSingleLoanDisbursement(record: LoanDisbursement): Promise<{success: boolean; error?: string; result?: any}> {
    // This method can be implemented by the sync service
    return { success: true };
  },
  
  async syncSingleAdvanceLoan(record: AdvanceLoan): Promise<{success: boolean; error?: string; result?: any}> {
    // This method can be implemented by the sync service
    return { success: true };
  },

  // =============================================================================
  // STATUS UPDATE METHODS (for failed record resolution)
  // =============================================================================
  
  async getPendingRecords(): Promise<Array<{id: string; type: 'cash' | 'loan' | 'advance' | 'group'; memberId: string}>> {
    const records: Array<{id: string; type: 'cash' | 'loan' | 'advance' | 'group'; memberId: string}> = [];
    
    // Get pending cash collections
    const cashCollections = await db.cashCollections
      .filter(record => record.syncStatus === 'pending' || (!record.synced && !record.syncStatus))
      .toArray();
    cashCollections.forEach(record => {
      records.push({ 
        id: record.id?.toString() || '',
        type: 'cash',
        memberId: record.memberId
      });
    });

    // Get pending loan applications
    const loanApplications = await db.loanApplications
      .filter(record => record.syncStatus === 'pending' || (!record.synced && !record.syncStatus))
      .toArray();
    loanApplications.forEach(record => {
      records.push({
        id: record.id?.toString() || '',
        type: 'loan',
        memberId: record.memberId
      });
    });

    // Get pending advance loans
    const advanceLoans = await db.advanceLoans
      .filter(record => record.syncStatus === 'pending' || (!record.synced && !record.syncStatus))
      .toArray();
    advanceLoans.forEach(record => {
      records.push({
        id: record.id?.toString() || '',
        type: 'advance',
        memberId: record.memberId
      });
    });

    // Get pending group collections
    const groupCollections = await db.groupCollections
      .filter(record => record.syncStatus === 'pending' || (!record.synced && !record.syncStatus))
      .toArray();
    groupCollections.forEach(record => {
      records.push({
        id: record.id?.toString() || '',
        type: 'group',
        memberId: record.groupId
      });
    });

    return records;
  },
  
  async updateCashCollectionStatus(id: string, status: 'pending' | 'failed' | 'synced'): Promise<boolean> {
    try {
      const numericId = parseInt(id);
      await db.cashCollections.update(numericId, { 
        syncStatus: status,
        syncError: status === 'pending' ? undefined : undefined
      });
      return true;
    } catch (error) {
      console.error('Failed to update cash collection status:', error);
      return false;
    }
  },

  async updateLoanApplicationStatus(id: string, status: 'pending' | 'failed' | 'synced'): Promise<boolean> {
    try {
      const numericId = parseInt(id);
      await db.loanApplications.update(numericId, { 
        syncStatus: status,
        syncError: status === 'pending' ? undefined : undefined
      });
      return true;
    } catch (error) {
      console.error('Failed to update loan application status:', error);
      return false;
    }
  },

  async updateAdvanceLoanStatus(id: string, status: 'pending' | 'failed' | 'synced'): Promise<boolean> {
    try {
      const numericId = parseInt(id);
      await db.advanceLoans.update(numericId, { 
        syncStatus: status,
        syncError: status === 'pending' ? undefined : undefined
      });
      return true;
    } catch (error) {
      console.error('Failed to update advance loan status:', error);
      return false;
    }
  },

  async updateLoanDisbursementStatus(id: string, status: 'pending' | 'failed' | 'synced'): Promise<boolean> {
    try {
      const numericId = parseInt(id);
      await db.loanDisbursements.update(numericId, { 
        syncStatus: status,
        syncError: status === 'pending' ? undefined : undefined
      });
      return true;
    } catch (error) {
      console.error('Failed to update loan disbursement status:', error);
      return false;
    }
  },

  async updateGroupCollectionStatus(id: string, status: 'pending' | 'failed' | 'synced'): Promise<boolean> {
    try {
      const numericId = parseInt(id);
      await db.groupCollections.update(numericId, { 
        syncStatus: status,
        syncError: status === 'pending' ? undefined : undefined
      });
      return true;
    } catch (error) {
      console.error('Failed to update group collection status:', error);
      return false;
    }
  },

  // =============================================================================
  // NEW MEMBERS
  // =============================================================================
  async addNewMember(data: Omit<NewMember, 'id' | 'synced'>) {
    return await db.newMembers.add({ 
      ...data, 
      synced: false,
      syncStatus: 'pending'
    });
  },

  async getNewMembers() {
    return await db.newMembers.orderBy('timestamp').reverse().toArray();
  },

  async getUnsyncedNewMembers() {
    return await db.newMembers.filter(record => record.synced === false).toArray();
  },

  async markNewMemberSynced(id: number): Promise<number> {
    return await db.newMembers.update(id, { 
      synced: true,
      syncStatus: 'synced',
      syncError: undefined
    });
  },

  async markNewMemberFailed(id: number, error: string): Promise<number> {
    return await db.newMembers.update(id, { 
      syncStatus: 'failed', 
      syncError: error 
    });
  },

  async deleteNewMember(id: string | number) {
    return await db.newMembers.delete(Number(id));
  },

  async updateNewMember(id: string, data: Partial<Omit<NewMember, 'id'>>) {
    const numericId = Number(id);
    return await db.newMembers.update(numericId, { 
      ...data,
      synced: false,
      syncStatus: 'pending',
      syncError: undefined
    });
  },

  async updateNewMemberStatus(id: string, status: 'pending' | 'failed' | 'synced'): Promise<boolean> {
    try {
      const numericId = parseInt(id);
      await db.newMembers.update(numericId, { 
        syncStatus: status,
        syncError: status === 'pending' ? undefined : undefined
      });
      return true;
    } catch (error) {
      console.error('Failed to update new member status:', error);
      return false;
    }
  }
}; // <-- dbOperations ends here

// =============================================================================
// QUALIFICATION HELPERS (NEW)
// =============================================================================

export const qualificationHelpers = {
  /**
   * Get member with fresh qualifications (includes pending records)
   */
  async getMemberWithLiveQualifications(memberId: string) {
    const member = await dbOperations.getMemberById(memberId);
    if (!member) return null;
    
    // Import here to avoid circular dependency
    const { getMemberLoanQualifications } = await import('./qualificationCalculator');
    const qualifications = await getMemberLoanQualifications(member, true);
    
    return {
      ...member,
      live_qualifications: qualifications
    };
  },
  
  /**
   * Get all members with live qualifications
   */
  async getAllMembersWithLiveQualifications() {
    const members = await dbOperations.getAllMembers();
    const { getBulkMemberQualifications } = await import('./qualificationCalculator');
    const qualificationsMap = await getBulkMemberQualifications(members, true);
    
    return members.map(member => ({
      ...member,
      live_qualifications: qualificationsMap.get(member.member_id)
    }));
  },
  
  /**
   * Search members with live qualifications
   */
  async searchMembersWithLiveQualifications(query: string) {
    const members = await dbOperations.searchMembers(query);
    const { getBulkMemberQualifications } = await import('./qualificationCalculator');
    const qualificationsMap = await getBulkMemberQualifications(members, true);
    
    return members.map(member => ({
      ...member,
      live_qualifications: qualificationsMap.get(member.member_id)
    }));
  },
  
  /**
   * Get qualification summary for a group
   */
  async getGroupQualificationSummary(groupId: number) {
    const allMembers = await dbOperations.getAllMembers();
    const groupMembers = allMembers.filter(m => m.group_id === groupId);
    
    if (groupMembers.length === 0) {
      return {
        group_id: groupId,
        total_members: 0,
        longterm_qualified: 0,
        advance_qualified: 0,
        total_longterm_capacity: 0,
        total_advance_capacity: 0
      };
    }
    
    const { getBulkMemberQualifications } = await import('./qualificationCalculator');
    const qualificationsMap = await getBulkMemberQualifications(groupMembers, true);
    
    let longtermQualified = 0;
    let advanceQualified = 0;
    let totalLongtermCapacity = 0;
    let totalAdvanceCapacity = 0;
    
    qualificationsMap.forEach(qual => {
      if (qual.longterm_loan.qualifies) {
        longtermQualified++;
        totalLongtermCapacity += qual.longterm_loan.max_amount;
      }
      if (qual.advance_loan.qualifies) {
        advanceQualified++;
        totalAdvanceCapacity += qual.advance_loan.max_amount;
      }
    });
    
    return {
      group_id: groupId,
      total_members: groupMembers.length,
      longterm_qualified: longtermQualified,
      advance_qualified: advanceQualified,
      total_longterm_capacity: totalLongtermCapacity,
      total_advance_capacity: totalAdvanceCapacity,
      percentage_longterm_qualified: (longtermQualified / groupMembers.length) * 100,
      percentage_advance_qualified: (advanceQualified / groupMembers.length) * 100
    };
  }
};
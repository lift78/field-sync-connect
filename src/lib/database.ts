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

export interface LoanDisbursement {
  id?: number;
  loanId: string;
  amountType: 'all' | 'custom';
  customAmount?: number;
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

// Database class
export class FieldOfficerDB extends Dexie {
  cashCollections!: Table<CashCollection>;
  loanApplications!: Table<LoanApplication>;
  loanDisbursements!: Table<LoanDisbursement>;
  advanceLoans!: Table<AdvanceLoan>;
  userCredentials!: Table<UserCredentials>;

  constructor() {
    super('FieldOfficerDB');
    this.version(4).stores({
      // Removed 'synced' from indexes since it's boolean and causes TypeScript errors
      cashCollections: '++id, memberId, memberName, totalAmount, cashAmount, mpesaAmount, allocationId, timestamp',
      loanApplications: '++id, memberId, memberName, loanAmount, installments, timestamp',
      loanDisbursements: '++id, loanId, amountType, customAmount, timestamp',
      advanceLoans: '++id, memberId, memberName, amount, timestamp',
      userCredentials: '++id, username, lastLogin'
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

export const dbOperations = {
  // Cash Collections
  async addCashCollection(data: Omit<CashCollection, 'id' | 'synced' | 'allocationId' | 'cashReference'>) {
    const allocationId = `ALLOC-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`.toUpperCase();
    const cashReference = data.cashAmount > 0 ? generateCashReference() : undefined;
    
    return await db.cashCollections.add({ 
      ...data, 
      allocationId,
      cashReference,
      synced: false 
    });
  },

  async getCashCollections() {
    return await db.cashCollections.orderBy('timestamp').reverse().toArray();
  },

  async getUnsyncedCashCollections() {
    return await db.cashCollections.filter(record => record.synced === false).toArray();
  },

  async markCashCollectionSynced(id: number): Promise<number> {
    return await db.cashCollections.update(id, { synced: true });
  },

  async updateCashCollection(id: string, data: CashCollection) {
    // Generate new cash reference if cash amount changed and is > 0
    const updates: Partial<CashCollection> = { 
      ...data, 
      synced: false,
      syncStatus: 'pending',
      syncError: undefined
    };
    
    if (data.cashAmount > 0 && !data.cashReference) {
      updates.cashReference = generateCashReference();
    } else if (data.cashAmount === 0) {
      updates.cashReference = undefined;
    }
    
    return await db.cashCollections.update(Number(id), updates);
  },

  // Loan Applications
  async addLoanApplication(data: Omit<LoanApplication, 'id' | 'synced'>) {
    return await db.loanApplications.add({ ...data, synced: false });
  },

  async getLoanApplications() {
    return await db.loanApplications.orderBy('timestamp').reverse().toArray();
  },

  async getUnsyncedLoanApplications() {
    return await db.loanApplications.filter(record => record.synced === false).toArray();
  },

  async markLoanApplicationSynced(id: number): Promise<number> {
    return await db.loanApplications.update(id, { synced: true });
  },

  async updateLoanApplication(id: string, data: LoanApplication) {
    return await db.loanApplications.update(Number(id), { ...data, synced: false, syncStatus: 'pending', syncError: undefined });
  },

  // Loan Disbursements
  async addLoanDisbursement(data: Omit<LoanDisbursement, 'id' | 'synced'>) {
    return await db.loanDisbursements.add({ ...data, synced: false });
  },

  async getLoanDisbursements() {
    return await db.loanDisbursements.orderBy('timestamp').reverse().toArray();
  },

  async getUnsyncedLoanDisbursements() {
    return await db.loanDisbursements.filter(record => record.synced === false).toArray();
  },

  async markLoanDisbursementSynced(id: number): Promise<number> {
    return await db.loanDisbursements.update(id, { synced: true });
  },

  // Advance Loans
  async addAdvanceLoan(data: Omit<AdvanceLoan, 'id' | 'synced'>) {
    return await db.advanceLoans.add({ ...data, synced: false });
  },

  async getAdvanceLoans() {
    return await db.advanceLoans.orderBy('timestamp').reverse().toArray();
  },

  async getUnsyncedAdvanceLoans() {
    return await db.advanceLoans.filter(record => record.synced === false).toArray();
  },

  async markAdvanceLoanSynced(id: number): Promise<number> {
    return await db.advanceLoans.update(id, { synced: true });
  },

  async updateAdvanceLoan(id: string, data: AdvanceLoan) {
    return await db.advanceLoans.update(Number(id), { ...data, synced: false, syncStatus: 'pending', syncError: undefined });
  },

  // User Credentials
  async getUserCredentials() {
    return await db.userCredentials.limit(1).first();
  },

  async saveUserCredentials(credentials: { username: string; password: string }) {
    await db.userCredentials.clear();
    return await db.userCredentials.add({
      ...credentials,
      lastLogin: new Date()
    });
  },

  async updateUserCredentials(credentials: { username: string; password: string }) {
    const existing = await db.userCredentials.limit(1).first();
    if (existing) {
      return await db.userCredentials.update(existing.id!, credentials);
    }
    return this.saveUserCredentials(credentials);
  },

  // Get all unsynced records
  async getAllUnsyncedRecords(): Promise<{
    cashCollections: CashCollection[];
    loanApplications: LoanApplication[];
    loanDisbursements: LoanDisbursement[];
    advanceLoans: AdvanceLoan[];
    total: number;
  }> {
    const [cashCollections, loanApplications, loanDisbursements, advanceLoans] = await Promise.all([
      this.getUnsyncedCashCollections(),
      this.getUnsyncedLoanApplications(),
      this.getUnsyncedLoanDisbursements(),
      this.getUnsyncedAdvanceLoans()
    ]);

    return {
      cashCollections,
      loanApplications,
      loanDisbursements,
      advanceLoans,
      total: cashCollections.length + loanApplications.length + loanDisbursements.length + advanceLoans.length
    };
  },

  // Mark records as failed with error message
  async markCashCollectionFailed(id: number, error: string): Promise<number> {
    return await db.cashCollections.update(id, { syncStatus: 'failed', syncError: error });
  },

  async markLoanApplicationFailed(id: number, error: string): Promise<number> {
    return await db.loanApplications.update(id, { syncStatus: 'failed', syncError: error });
  },

  async markLoanDisbursementFailed(id: number, error: string): Promise<number> {
    return await db.loanDisbursements.update(id, { syncStatus: 'failed', syncError: error });
  },

  async markAdvanceLoanFailed(id: number, error: string): Promise<number> {
    return await db.advanceLoans.update(id, { syncStatus: 'failed', syncError: error });
  },

  // Get failed records
  async getFailedRecords(): Promise<{
    cashCollections: CashCollection[];
    loanApplications: LoanApplication[];
    loanDisbursements: LoanDisbursement[];
    advanceLoans: AdvanceLoan[];
    total: number;
  }> {
    const [cashCollections, loanApplications, loanDisbursements, advanceLoans] = await Promise.all([
      db.cashCollections.filter(record => record.syncStatus === 'failed').toArray(),
      db.loanApplications.filter(record => record.syncStatus === 'failed').toArray(),
      db.loanDisbursements.filter(record => record.syncStatus === 'failed').toArray(),
      db.advanceLoans.filter(record => record.syncStatus === 'failed').toArray()
    ]);

    return {
      cashCollections,
      loanApplications,
      loanDisbursements,
      advanceLoans,
      total: cashCollections.length + loanApplications.length + loanDisbursements.length + advanceLoans.length
    };
  },

  // Clear synced records
  async clearSyncedRecords(): Promise<number> {
    const results = await Promise.all([
      db.cashCollections.filter(record => record.synced === true).delete(),
      db.loanApplications.filter(record => record.synced === true).delete(),
      db.loanDisbursements.filter(record => record.synced === true).delete(),
      db.advanceLoans.filter(record => record.synced === true).delete()
    ]);
    
    return results.reduce((sum, count) => sum + count, 0);
  },

  // Get count of old pending records (older than 3 days)
  async getOldPendingRecordsCount(): Promise<number> {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    
    const counts = await Promise.all([
      db.cashCollections.filter(record => 
        record.synced === false && 
        record.syncStatus !== 'failed' && 
        record.timestamp < threeDaysAgo
      ).count(),
      db.loanApplications.filter(record => 
        record.synced === false && 
        record.syncStatus !== 'failed' && 
        record.timestamp < threeDaysAgo
      ).count(),
      db.loanDisbursements.filter(record => 
        record.synced === false && 
        record.syncStatus !== 'failed' && 
        record.timestamp < threeDaysAgo
      ).count(),
      db.advanceLoans.filter(record => 
        record.synced === false && 
        record.syncStatus !== 'failed' && 
        record.timestamp < threeDaysAgo
      ).count()
    ]);
    
    return counts.reduce((sum, count) => sum + count, 0);
  },

  // Delete old pending records (older than 3 days)
  async deleteOldPendingRecords(): Promise<number> {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    
    const results = await Promise.all([
      db.cashCollections.filter(record => 
        record.synced === false && 
        record.syncStatus !== 'failed' && 
        record.timestamp < threeDaysAgo
      ).delete(),
      db.loanApplications.filter(record => 
        record.synced === false && 
        record.syncStatus !== 'failed' && 
        record.timestamp < threeDaysAgo
      ).delete(),
      db.loanDisbursements.filter(record => 
        record.synced === false && 
        record.syncStatus !== 'failed' && 
        record.timestamp < threeDaysAgo
      ).delete(),
      db.advanceLoans.filter(record => 
        record.synced === false && 
        record.syncStatus !== 'failed' && 
        record.timestamp < threeDaysAgo
      ).delete()
    ]);
    
    return results.reduce((sum, count) => sum + count, 0);
  },
  
  // Add individual sync methods for each record type
  async syncSingleLoanApplication(record: LoanApplication): Promise<{success: boolean; error?: string; result?: any}> {
    // This method can be used by the sync service if needed
    return { success: true };
  },
  
  async syncSingleLoanDisbursement(record: LoanDisbursement): Promise<{success: boolean; error?: string; result?: any}> {
    // This method can be used by the sync service if needed
    return { success: true };
  },
  
  async syncSingleAdvanceLoan(record: AdvanceLoan): Promise<{success: boolean; error?: string; result?: any}> {
    // This method can be used by the sync service if needed
    return { success: true };
  }
};
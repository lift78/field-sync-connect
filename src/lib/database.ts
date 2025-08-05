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
}

export interface LoanDisbursement {
  id?: number;
  loanId: string;
  amountType: 'all' | 'custom';
  customAmount?: number;
  timestamp: Date;
  synced: boolean;
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
      synced: false 
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
    return await db.loanApplications.update(Number(id), { ...data, synced: false });
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
    return await db.advanceLoans.update(Number(id), { ...data, synced: false });
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
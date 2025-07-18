import Dexie, { Table } from 'dexie';

// Define interfaces for your data
export interface Allocation {
  id: string;
  type: 'savings' | 'loan' | 'advance' | 'advance-interest' | 'other';
  amount: number;
  reason?: string;
}

export interface CashCollection {
  id?: number;
  memberId: string;
  memberName: string;
  amount: number;
  allocations: Allocation[];
  timestamp: Date;
  synced: boolean;
}

export interface LoanApplication {
  id?: number;
  memberId: string;
  memberName: string;
  loanAmount: number;
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
  timestamp: Date;
  synced: boolean;
}

// Database class
export class FieldOfficerDB extends Dexie {
  cashCollections!: Table<CashCollection>;
  loanApplications!: Table<LoanApplication>;
  loanDisbursements!: Table<LoanDisbursement>;
  advanceLoans!: Table<AdvanceLoan>;

  constructor() {
    super('FieldOfficerDB');
    this.version(2).stores({
      cashCollections: '++id, memberId, memberName, amount, timestamp, synced',
      loanApplications: '++id, memberId, memberName, loanAmount, installments, timestamp, synced',
      loanDisbursements: '++id, loanId, amountType, customAmount, timestamp, synced',
      advanceLoans: '++id, memberId, memberName, amount, timestamp, synced'
    });
  }
}

export const db = new FieldOfficerDB();


export const dbOperations = {
    // Cash Collections
    async addCashCollection(data: Omit<CashCollection, 'id' | 'synced'>) {
      return await db.cashCollections.add({ ...data, synced: false });
    },
  
    async getCashCollections() {
      return await db.cashCollections.orderBy('timestamp').reverse().toArray();
    },
  
    async getUnsyncedCashCollections() {
      return await db.cashCollections.where('synced').equals(0).toArray();
    },
  
    async markCashCollectionSynced(id: number) {
      return await db.cashCollections.update(id, { synced: true });
    },
  
    // Loan Applications
    async addLoanApplication(data: Omit<LoanApplication, 'id' | 'synced'>) {
      return await db.loanApplications.add({ ...data, synced: false });
    },
  
    async getLoanApplications() {
      return await db.loanApplications.orderBy('timestamp').reverse().toArray();
    },
  
    async getUnsyncedLoanApplications() {
      return await db.loanApplications.where('synced').equals(0).toArray();
    },
  
    async markLoanApplicationSynced(id: number) {
      return await db.loanApplications.update(id, { synced: true });
    },
  
    // Loan Disbursements
    async addLoanDisbursement(data: Omit<LoanDisbursement, 'id' | 'synced'>) {
      return await db.loanDisbursements.add({ ...data, synced: false });
    },
  
    async getLoanDisbursements() {
      return await db.loanDisbursements.orderBy('timestamp').reverse().toArray();
    },
  
    async getUnsyncedLoanDisbursements() {
      return await db.loanDisbursements.where('synced').equals(0).toArray();
    },
  
    async markLoanDisbursementSynced(id: number) {
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
      return await db.advanceLoans.where('synced').equals(0).toArray();
    },
  
    async markAdvanceLoanSynced(id: number) {
      return await db.advanceLoans.update(id, { synced: true });
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
      }      
  };
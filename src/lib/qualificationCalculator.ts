// qualificationCalculator.ts
// Client-side loan qualification calculator that includes pending/unsynced records

import { dbOperations } from './database';
import type { MemberBalance, CashCollection, LoanApplication, AdvanceLoan } from './database';

interface LoanQualification {
  qualifies: boolean;
  max_amount: number;
  reason: string;
  calculation: {
    savings_balance?: number;
    loan_balance?: number;
    advance_balance?: number;
    original_repayment?: number;
    fifty_percent_threshold?: number;
    amount_paid?: number;
    percentage_paid?: number;
    multiplier?: number;
    max_before_rounding?: number;
    max_after_rounding?: number;
    max_advance_amount?: number;
    formula?: string;
    requirement?: string;
    note?: string;
    // NEW: Show contributions from unsynced records
    pending_contributions?: {
      savings_from_pending: number;
      loan_payments_from_pending: number;
      advance_payments_from_pending: number;
    };
  };
}

interface MemberQualifications {
  member_id: string;
  member_name: string;
  longterm_loan: LoanQualification;
  advance_loan: LoanQualification;
  qualification_inputs: {
    savings_balance: number;
    loan_balance: number;
    advance_balance: number;
    has_pending_loan: boolean;
    original_loan_repayment?: number;
  };
  // Track if calculated with pending records
  includes_pending_records: boolean;
  pending_records_summary?: {
    total_pending_savings: number;
    total_pending_loan_payments: number;
    total_pending_advance_payments: number;
    pending_records_count: number;
  };
}

/**
 * Round down to the nearest hundred
 */
function roundDownToHundreds(amount: number): number {
  if (amount <= 0) return 0;
  return Math.floor(amount / 100) * 100;
}

/**
 * Calculate pending contributions for a member from unsynced cash collections
 */
async function getPendingContributions(memberId: string): Promise<{
  savings: number;
  loan_repayment: number;
  advance_repayment: number;
}> {
  try {
    // Get all unsynced cash collections for this member
    const unsyncedCollections = await dbOperations.getUnsyncedCashCollections();
    
    const memberCollections = unsyncedCollections.filter(
      collection => collection.memberId === memberId
    );
    
    let totalSavings = 0;
    let totalLoanRepayment = 0;
    let totalAdvanceRepayment = 0;
    
    memberCollections.forEach(collection => {
      collection.allocations.forEach(allocation => {
        if (allocation.type === 'savings') {
          totalSavings += allocation.amount;
        } else if (allocation.type === 'loan') {
          totalLoanRepayment += allocation.amount;
        } else if (allocation.type === 'amount_for_advance_payment') {
          totalAdvanceRepayment += allocation.amount;
        }
      });
    });
    
    return {
      savings: totalSavings,
      loan_repayment: totalLoanRepayment,
      advance_repayment: totalAdvanceRepayment
    };
  } catch (error) {
    console.error('Error calculating pending contributions:', error);
    return { savings: 0, loan_repayment: 0, advance_repayment: 0 };
  }
}

/**
 * Check if member has unsynced loan applications
 */
async function hasUnsyncedLoanApplication(memberId: string): Promise<boolean> {
  try {
    const unsyncedLoans = await dbOperations.getUnsyncedLoanApplications();
    return unsyncedLoans.some(loan => loan.memberId === memberId);
  } catch (error) {
    console.error('Error checking unsynced loans:', error);
    return false;
  }
}

/**
 * Check if member has unsynced advance loan applications
 */
async function hasUnsyncedAdvanceLoan(memberId: string): Promise<boolean> {
  try {
    const unsyncedAdvances = await dbOperations.getUnsyncedAdvanceLoans();
    return unsyncedAdvances.some(advance => advance.memberId === memberId);
  } catch (error) {
    console.error('Error checking unsynced advance loans:', error);
    return false;
  }
}

/**
 * Calculate long-term loan qualification with pending contributions
 */
function calculateLongtermLoanQualification(
  baseSavingsBalance: number,
  baseLoanBalance: number,
  pendingSavings: number,
  pendingLoanPayments: number,
  hasPendingLoan: boolean,
  hasUnsyncedLoan: boolean
): LoanQualification {
  // Calculate adjusted balances including pending contributions
  const adjustedSavings = baseSavingsBalance + pendingSavings;
  const adjustedLoanBalance = Math.max(0, baseLoanBalance - pendingLoanPayments);
  
  // Check for pending/unsynced loan applications
  if (hasPendingLoan || hasUnsyncedLoan) {
    return {
      qualifies: false,
      max_amount: 0,
      reason: hasUnsyncedLoan 
        ? 'Has unsynced loan application pending' 
        : 'Has pending or approved loan application',
      calculation: {
        savings_balance: adjustedSavings,
        loan_balance: adjustedLoanBalance,
        pending_contributions: {
          savings_from_pending: pendingSavings,
          loan_payments_from_pending: pendingLoanPayments,
          advance_payments_from_pending: 0
        }
      }
    };
  }
  
  // Check for existing loan balance
  if (adjustedLoanBalance > 0) {
    return {
      qualifies: false,
      max_amount: 0,
      reason: 'Has outstanding loan balance',
      calculation: {
        savings_balance: adjustedSavings,
        loan_balance: adjustedLoanBalance,
        requirement: 'Loan balance must be 0',
        pending_contributions: {
          savings_from_pending: pendingSavings,
          loan_payments_from_pending: pendingLoanPayments,
          advance_payments_from_pending: 0
        },
        note: pendingLoanPayments > 0 
          ? `Including KES ${pendingLoanPayments.toFixed(2)} from pending payments` 
          : undefined
      }
    };
  }
  
  // Check savings
  if (adjustedSavings <= 0) {
    return {
      qualifies: false,
      max_amount: 0,
      reason: 'Insufficient savings balance',
      calculation: {
        savings_balance: adjustedSavings,
        requirement: 'Savings must be greater than 0',
        pending_contributions: {
          savings_from_pending: pendingSavings,
          loan_payments_from_pending: pendingLoanPayments,
          advance_payments_from_pending: 0
        }
      }
    };
  }
  
  // Calculate 3x savings and round down
  const maxLoan = adjustedSavings * 3;
  const maxLoanRounded = roundDownToHundreds(maxLoan);
  
  return {
    qualifies: true,
    max_amount: maxLoanRounded,
    reason: 'Eligible for long-term loan',
    calculation: {
      savings_balance: adjustedSavings,
      loan_balance: adjustedLoanBalance,
      multiplier: 3,
      max_before_rounding: maxLoan,
      max_after_rounding: maxLoanRounded,
      formula: `3 × ${adjustedSavings.toFixed(2)} = ${maxLoan.toFixed(2)} → ${maxLoanRounded}`,
      pending_contributions: {
        savings_from_pending: pendingSavings,
        loan_payments_from_pending: pendingLoanPayments,
        advance_payments_from_pending: 0
      },
      note: pendingSavings > 0 
        ? `Including KES ${pendingSavings.toFixed(2)} from pending savings` 
        : undefined
    }
  };
}

/**
 * Calculate advance loan qualification with pending contributions
 */
function calculateAdvanceLoanQualification(
  baseAdvanceBalance: number,
  baseLoanBalance: number,
  pendingAdvancePayments: number,
  pendingLoanPayments: number,
  originalLoanRepayment: number | undefined,
  hasUnsyncedAdvance: boolean
): LoanQualification {
  const MAX_ADVANCE = 20000;
  
  // Calculate adjusted balances including pending contributions
  const adjustedAdvanceBalance = Math.max(0, baseAdvanceBalance - pendingAdvancePayments);
  const adjustedLoanBalance = Math.max(0, baseLoanBalance - pendingLoanPayments);
  
  // Rule 1: Cannot qualify if has existing advance balance (even after pending payments)
  if (adjustedAdvanceBalance > 0) {
    return {
      qualifies: false,
      max_amount: 0,
      reason: 'Has outstanding advance loan balance',
      calculation: {
        advance_balance: adjustedAdvanceBalance,
        loan_balance: adjustedLoanBalance,
        requirement: 'Advance balance must be 0',
        pending_contributions: {
          savings_from_pending: 0,
          loan_payments_from_pending: pendingLoanPayments,
          advance_payments_from_pending: pendingAdvancePayments
        },
        note: pendingAdvancePayments > 0 
          ? `Including KES ${pendingAdvancePayments.toFixed(2)} from pending advance payments` 
          : undefined
      }
    };
  }
  
  // Check for unsynced advance loan application
  if (hasUnsyncedAdvance) {
    return {
      qualifies: false,
      max_amount: 0,
      reason: 'Has unsynced advance loan application pending',
      calculation: {
        advance_balance: adjustedAdvanceBalance,
        loan_balance: adjustedLoanBalance,
        pending_contributions: {
          savings_from_pending: 0,
          loan_payments_from_pending: pendingLoanPayments,
          advance_payments_from_pending: pendingAdvancePayments
        }
      }
    };
  }
  
  // Rule 2: Automatically qualifies if NO loan balance (after pending payments)
  if (adjustedLoanBalance <= 0) {
    return {
      qualifies: true,
      max_amount: MAX_ADVANCE,
      reason: 'Eligible for advance loan (no active loan)',
      calculation: {
        advance_balance: adjustedAdvanceBalance,
        loan_balance: adjustedLoanBalance,
        max_advance_amount: MAX_ADVANCE,
        note: 'No loan balance - automatically qualifies',
        pending_contributions: {
          savings_from_pending: 0,
          loan_payments_from_pending: pendingLoanPayments,
          advance_payments_from_pending: pendingAdvancePayments
        }
      }
    };
  }
  
  // Rule 3: If has loan balance, check if paid more than 50%
  if (originalLoanRepayment && originalLoanRepayment > 0) {
    const fiftyPercent = originalLoanRepayment / 2;
    const amountPaid = originalLoanRepayment - adjustedLoanBalance;
    const percentagePaid = (amountPaid / originalLoanRepayment) * 100;
    
    if (adjustedLoanBalance <= fiftyPercent) {
      // Has paid more than 50% - qualifies
      return {
        qualifies: true,
        max_amount: MAX_ADVANCE,
        reason: 'Eligible for advance loan (paid > 50% of loan)',
        calculation: {
          advance_balance: adjustedAdvanceBalance,
          loan_balance: adjustedLoanBalance,
          original_repayment: originalLoanRepayment,
          fifty_percent_threshold: fiftyPercent,
          amount_paid: amountPaid,
          percentage_paid: percentagePaid,
          max_advance_amount: MAX_ADVANCE,
          note: `Paid ${percentagePaid.toFixed(1)}% of loan - qualifies`,
          pending_contributions: {
            savings_from_pending: 0,
            loan_payments_from_pending: pendingLoanPayments,
            advance_payments_from_pending: pendingAdvancePayments
          }
        }
      };
    } else {
      // Has NOT paid more than 50% - does not qualify
      return {
        qualifies: false,
        max_amount: 0,
        reason: 'Must pay more than 50% of loan first',
        calculation: {
          advance_balance: adjustedAdvanceBalance,
          loan_balance: adjustedLoanBalance,
          original_repayment: originalLoanRepayment,
          fifty_percent_threshold: fiftyPercent,
          amount_paid: amountPaid,
          percentage_paid: percentagePaid,
          requirement: 'Must pay > 50% of original loan amount',
          pending_contributions: {
            savings_from_pending: 0,
            loan_payments_from_pending: pendingLoanPayments,
            advance_payments_from_pending: pendingAdvancePayments
          },
          note: pendingLoanPayments > 0 
            ? `Including KES ${pendingLoanPayments.toFixed(2)} from pending loan payments` 
            : undefined
        }
      };
    }
  }
  
  // Fallback: Has loan but no original repayment data
  return {
    qualifies: true,
    max_amount: MAX_ADVANCE,
    reason: 'Eligible for advance loan (has active loan)',
    calculation: {
      advance_balance: adjustedAdvanceBalance,
      loan_balance: adjustedLoanBalance,
      max_advance_amount: MAX_ADVANCE,
      note: 'Has loan balance - original repayment data not available',
      pending_contributions: {
        savings_from_pending: 0,
        loan_payments_from_pending: pendingLoanPayments,
        advance_payments_from_pending: pendingAdvancePayments
      }
    }
  };
}

/**
 * Get comprehensive loan qualifications for a member including pending contributions
 */
export async function getMemberLoanQualifications(
  member: MemberBalance,
  includePendingRecords: boolean = true
): Promise<MemberQualifications> {
  // Get pending contributions if requested
  let pendingContributions = { savings: 0, loan_repayment: 0, advance_repayment: 0 };
  let hasUnsyncedLoan = false;
  let hasUnsyncedAdvance = false;
  
  if (includePendingRecords) {
    [pendingContributions, hasUnsyncedLoan, hasUnsyncedAdvance] = await Promise.all([
      getPendingContributions(member.member_id),
      hasUnsyncedLoanApplication(member.member_id),
      hasUnsyncedAdvanceLoan(member.member_id)
    ]);
  }
  
  // Extract base values from member
  const baseSavings = member.balances.savings_balance;
  const baseLoanBalance = member.balances.loan_balance;
  const baseAdvanceBalance = member.balances.advance_loan_balance;
  
  // Get original loan repayment from member data if available
  // This should come from the backend sync data
  const originalLoanRepayment = (member as any).qualification_inputs?.original_loan_repayment;
  
  // Check for backend pending loan status
  const hasPendingLoanFromBackend = (member as any).qualification_inputs?.has_pending_loan || false;
  
  // Calculate qualifications with pending contributions
  const longtermQual = calculateLongtermLoanQualification(
    baseSavings,
    baseLoanBalance,
    pendingContributions.savings,
    pendingContributions.loan_repayment,
    hasPendingLoanFromBackend,
    hasUnsyncedLoan
  );
  
  const advanceQual = calculateAdvanceLoanQualification(
    baseAdvanceBalance,
    baseLoanBalance,
    pendingContributions.advance_repayment,
    pendingContributions.loan_repayment,
    originalLoanRepayment,
    hasUnsyncedAdvance
  );
  
  const totalPendingRecords = (pendingContributions.savings > 0 ? 1 : 0) +
                              (pendingContributions.loan_repayment > 0 ? 1 : 0) +
                              (pendingContributions.advance_repayment > 0 ? 1 : 0);
  
  return {
    member_id: member.member_id,
    member_name: member.name,
    longterm_loan: longtermQual,
    advance_loan: advanceQual,
    qualification_inputs: {
      savings_balance: baseSavings + pendingContributions.savings,
      loan_balance: Math.max(0, baseLoanBalance - pendingContributions.loan_repayment),
      advance_balance: Math.max(0, baseAdvanceBalance - pendingContributions.advance_repayment),
      has_pending_loan: hasPendingLoanFromBackend || hasUnsyncedLoan,
      original_loan_repayment: originalLoanRepayment
    },
    includes_pending_records: includePendingRecords && totalPendingRecords > 0,
    pending_records_summary: includePendingRecords ? {
      total_pending_savings: pendingContributions.savings,
      total_pending_loan_payments: pendingContributions.loan_repayment,
      total_pending_advance_payments: pendingContributions.advance_repayment,
      pending_records_count: totalPendingRecords
    } : undefined
  };
}

/**
 * Batch calculate qualifications for multiple members
 */
export async function getBulkMemberQualifications(
  members: MemberBalance[],
  includePendingRecords: boolean = true
): Promise<Map<string, MemberQualifications>> {
  const qualificationsMap = new Map<string, MemberQualifications>();
  
  // Calculate qualifications for all members in parallel
  const qualificationPromises = members.map(member => 
    getMemberLoanQualifications(member, includePendingRecords)
  );
  
  const qualifications = await Promise.all(qualificationPromises);
  
  // Build map
  qualifications.forEach(qual => {
    qualificationsMap.set(qual.member_id, qual);
  });
  
  return qualificationsMap;
}

/**
 * Update member qualifications after a payment/allocation
 * Use this when processing new contributions to see real-time qualification changes
 */
export async function updateMemberQualificationsAfterPayment(
  memberId: string,
  paymentType: 'savings' | 'loan' | 'advance',
  amount: number
): Promise<MemberQualifications | null> {
  try {
    // Get current member data
    const member = await dbOperations.getMemberById(memberId);
    if (!member) {
      console.error(`Member ${memberId} not found`);
      return null;
    }
    
    // Recalculate with pending records (which now includes the new payment)
    const qualifications = await getMemberLoanQualifications(member, true);
    
    return qualifications;
  } catch (error) {
    console.error('Error updating member qualifications:', error);
    return null;
  }
}

/**
 * Get qualification summary for all members
 */
export async function getQualificationSummary(includePendingRecords: boolean = true): Promise<{
  total_members: number;
  longterm_qualified_count: number;
  advance_qualified_count: number;
  total_longterm_capacity: number;
  total_advance_capacity: number;
  members_with_pending_contributions: number;
}> {
  try {
    const members = await dbOperations.getAllMembers();
    const qualifications = await getBulkMemberQualifications(members, includePendingRecords);
    
    let longtermQualified = 0;
    let advanceQualified = 0;
    let totalLongtermCapacity = 0;
    let totalAdvanceCapacity = 0;
    let membersWithPending = 0;
    
    qualifications.forEach(qual => {
      if (qual.longterm_loan.qualifies) {
        longtermQualified++;
        totalLongtermCapacity += qual.longterm_loan.max_amount;
      }
      
      if (qual.advance_loan.qualifies) {
        advanceQualified++;
        totalAdvanceCapacity += qual.advance_loan.max_amount;
      }
      
      if (qual.includes_pending_records) {
        membersWithPending++;
      }
    });
    
    return {
      total_members: members.length,
      longterm_qualified_count: longtermQualified,
      advance_qualified_count: advanceQualified,
      total_longterm_capacity: totalLongtermCapacity,
      total_advance_capacity: totalAdvanceCapacity,
      members_with_pending_contributions: membersWithPending
    };
  } catch (error) {
    console.error('Error getting qualification summary:', error);
    return {
      total_members: 0,
      longterm_qualified_count: 0,
      advance_qualified_count: 0,
      total_longterm_capacity: 0,
      total_advance_capacity: 0,
      members_with_pending_contributions: 0
    };
  }
}
// Example: How to use the qualification system in your loan application flow

import { memberDataService } from './memberDataService';
import { getMemberLoanQualifications, updateMemberQualificationsAfterPayment } from './qualificationCalculator';
import { dbOperations } from './database';

/**
 * SCENARIO 1: Initial sync - Get all members with qualifications
 */
async function initialSync() {
  console.log('=== INITIAL SYNC ===');
  
  const result = await memberDataService.syncMemberData();
  
  if (result.success) {
    console.log(`✅ Synced ${result.totalMembers} members`);
    console.log(`📊 Qualifications:`);
    console.log(`   - ${result.qualificationsSummary?.longterm_qualified} qualify for long-term loans`);
    console.log(`   - ${result.qualificationsSummary?.advance_qualified} qualify for advance loans`);
    console.log(`   - ${result.qualificationsSummary?.members_with_pending_contributions} have pending contributions`);
  }
}

/**
 * SCENARIO 2: Officer takes contributions from a member
 * Check qualifications BEFORE taking money to show member what they could qualify for
 */
async function beforeTakingContributions() {
  console.log('\n=== BEFORE TAKING CONTRIBUTIONS ===');
  
  const memberId = 'MEM/2024/0001';
  
  // Get current qualifications
  const result = await memberDataService.getMemberWithQualifications(memberId);
  
  if (result.member && result.qualifications) {
    const member = result.member;
    const qual = result.qualifications;
    
    console.log(`\nMember: ${member.name}`);
    console.log(`Current Savings: KES ${member.balances.savings_balance.toLocaleString()}`);
    console.log(`Current Loan Balance: KES ${member.balances.loan_balance.toLocaleString()}`);
    
    console.log(`\n📋 Long-term Loan Qualification:`);
    if (qual.longterm_loan.qualifies) {
      console.log(`   ✅ QUALIFIES - Max: KES ${qual.longterm_loan.max_amount.toLocaleString()}`);
      
      if (qual.pending_records_summary && qual.pending_records_summary.total_pending_savings > 0) {
        console.log(`   💡 Including KES ${qual.pending_records_summary.total_pending_savings.toLocaleString()} from pending savings`);
      }
    } else {
      console.log(`   ❌ NOT QUALIFIED - ${qual.longterm_loan.reason}`);
    }
    
    console.log(`\n📋 Advance Loan Qualification:`);
    if (qual.advance_loan.qualifies) {
      console.log(`   ✅ QUALIFIES - Max: KES ${qual.advance_loan.max_amount.toLocaleString()}`);
      
      if (qual.advance_loan.calculation.percentage_paid) {
        console.log(`   📊 Loan Progress: ${qual.advance_loan.calculation.percentage_paid.toFixed(1)}% paid`);
      }
    } else {
      console.log(`   ❌ NOT QUALIFIED - ${qual.advance_loan.reason}`);
      
      if (qual.advance_loan.calculation.percentage_paid) {
        console.log(`   📊 Current Progress: ${qual.advance_loan.calculation.percentage_paid.toFixed(1)}% paid`);
        console.log(`   📊 Need: > 50% paid`);
      }
    }
  }
}

/**
 * SCENARIO 3: Officer collects cash contribution
 * The contribution is saved locally and qualifications are recalculated
 */
async function afterTakingContributions() {
  console.log('\n=== AFTER TAKING CONTRIBUTIONS ===');
  
  const memberId = 'MEM/2024/0001';
  
  // Simulate officer collecting KES 10,000 in savings
  await dbOperations.addCashCollection({
    memberId: memberId,
    memberName: 'John Doe',
    totalAmount: 10000,
    cashAmount: 10000,
    mpesaAmount: 0,
    allocations: [
      {
        memberId: memberId,
        type: 'savings',
        amount: 10000
      }
    ],
    timestamp: new Date(),
  });
  
  console.log('💰 Recorded KES 10,000 savings contribution (unsynced)');
  
  // Get updated qualifications
  const result = await memberDataService.getMemberWithQualifications(memberId);
  
  if (result.member && result.qualifications) {
    const qual = result.qualifications;
    
    console.log(`\n📋 UPDATED Long-term Loan Qualification:`);
    if (qual.longterm_loan.qualifies) {
      console.log(`   ✅ QUALIFIES - Max: KES ${qual.longterm_loan.max_amount.toLocaleString()}`);
      console.log(`   💡 Base Savings: KES ${result.member.balances.savings_balance.toLocaleString()}`);
      console.log(`   💡 Pending Savings: KES ${qual.pending_records_summary?.total_pending_savings.toLocaleString()}`);
      console.log(`   💡 Total Effective Savings: KES ${qual.qualification_inputs.savings_balance.toLocaleString()}`);
    }
  }
}

/**
 * SCENARIO 4: Member wants to apply for loan
 * Show them real-time qualification including today's contributions
 */
async function loanApplicationFlow() {
  console.log('\n=== LOAN APPLICATION FLOW ===');
  
  const memberId = 'MEM/2024/0001';
  
  // Get member with latest qualifications
  const result = await memberDataService.getMemberWithQualifications(memberId);
  
  if (!result.member || !result.qualifications) {
    console.log('❌ Member not found');
    return;
  }
  
  const member = result.member;
  const qual = result.qualifications;
  
  console.log(`\n👤 Member: ${member.name}`);
  console.log(`📱 Phone: ${member.phone}`);
  
  // Show current balances
  console.log(`\n💰 Current Balances:`);
  console.log(`   Savings: KES ${member.balances.savings_balance.toLocaleString()}`);
  console.log(`   Loan Balance: KES ${member.balances.loan_balance.toLocaleString()}`);
  console.log(`   Advance Balance: KES ${member.balances.advance_loan_balance.toLocaleString()}`);
  
  // Show pending contributions if any
  if (qual.includes_pending_records) {
    console.log(`\n⏳ Pending Contributions (not yet synced):`);
    if (qual.pending_records_summary!.total_pending_savings > 0) {
      console.log(`   Savings: +KES ${qual.pending_records_summary!.total_pending_savings.toLocaleString()}`);
    }
    if (qual.pending_records_summary!.total_pending_loan_payments > 0) {
      console.log(`   Loan Payments: -KES ${qual.pending_records_summary!.total_pending_loan_payments.toLocaleString()}`);
    }
    if (qual.pending_records_summary!.total_pending_advance_payments > 0) {
      console.log(`   Advance Payments: -KES ${qual.pending_records_summary!.total_pending_advance_payments.toLocaleString()}`);
    }
  }
  
  // Long-term loan eligibility
  console.log(`\n🏦 LONG-TERM LOAN ELIGIBILITY:`);
  if (qual.longterm_loan.qualifies) {
    console.log(`   ✅ STATUS: ELIGIBLE`);
    console.log(`   💵 Maximum Amount: KES ${qual.longterm_loan.max_amount.toLocaleString()}`);
    console.log(`   📝 Calculation: ${qual.longterm_loan.calculation.formula}`);
    
    if (qual.longterm_loan.calculation.note) {
      console.log(`   💡 Note: ${qual.longterm_loan.calculation.note}`);
    }
  } else {
    console.log(`   ❌ STATUS: NOT ELIGIBLE`);
    console.log(`   ⚠️  Reason: ${qual.longterm_loan.reason}`);
    console.log(`   📋 Requirement: ${qual.longterm_loan.calculation.requirement}`);
  }
  
  // Advance loan eligibility
  console.log(`\n💸 ADVANCE LOAN ELIGIBILITY:`);
  if (qual.advance_loan.qualifies) {
    console.log(`   ✅ STATUS: ELIGIBLE`);
    console.log(`   💵 Maximum Amount: KES ${qual.advance_loan.max_amount.toLocaleString()}`);
    
    if (qual.advance_loan.calculation.percentage_paid) {
      console.log(`   📊 Loan Progress: ${qual.advance_loan.calculation.percentage_paid.toFixed(1)}% paid`);
    }
    
    if (qual.advance_loan.calculation.note) {
      console.log(`   💡 Note: ${qual.advance_loan.calculation.note}`);
    }
  } else {
    console.log(`   ❌ STATUS: NOT ELIGIBLE`);
    console.log(`   ⚠️  Reason: ${qual.advance_loan.reason}`);
    
    if (qual.advance_loan.calculation.percentage_paid !== undefined) {
      console.log(`   📊 Current Progress: ${qual.advance_loan.calculation.percentage_paid.toFixed(1)}% paid`);
      console.log(`   📋 Requirement: ${qual.advance_loan.calculation.requirement}`);
    }
  }
}

/**
 * SCENARIO 5: Real-time qualification update as payments are made
 */
async function realTimeQualificationUpdate() {
  console.log('\n=== REAL-TIME QUALIFICATION UPDATES ===');
  
  const memberId = 'MEM/2024/0002';
  
  // Scenario: Member has loan balance of 80,000 (out of 120,000 original)
  // They need to pay down to 60,000 to qualify for advance
  
  console.log('Member makes loan payment of KES 25,000...');
  
  // Save the payment
  await dbOperations.addCashCollection({
    memberId: memberId,
    memberName: 'Jane Smith',
    totalAmount: 25000,
    cashAmount: 25000,
    mpesaAmount: 0,
    allocations: [
      {
        memberId: memberId,
        type: 'loan',
        amount: 25000
      }
    ],
    timestamp: new Date(),
  });
  
  // Get updated qualifications
  const updatedQual = await updateMemberQualificationsAfterPayment(memberId, 'loan', 25000);
  
  if (updatedQual) {
    console.log('\n📊 UPDATED QUALIFICATION STATUS:');
    
    if (updatedQual.advance_loan.qualifies) {
      console.log('   🎉 BREAKTHROUGH! Member now qualifies for advance loan!');
      console.log(`   💵 Can borrow up to: KES ${updatedQual.advance_loan.max_amount.toLocaleString()}`);
    } else {
      console.log('   📈 Progress made but not yet qualified');
      if (updatedQual.advance_loan.calculation.percentage_paid) {
        console.log(`   Current: ${updatedQual.advance_loan.calculation.percentage_paid.toFixed(1)}% paid`);
        console.log(`   Need: > 50% paid`);
      }
    }
  }
}

/**
 * SCENARIO 6: Display qualification badge in UI
 */
function displayQualificationBadge(qualifications: any) {
  // This would be used in your React/Vue component
  
  const badges = [];
  
  if (qualifications.longterm_loan.qualifies) {
    badges.push({
      type: 'longterm',
      color: 'green',
      text: `Loan: KES ${qualifications.longterm_loan.max_amount.toLocaleString()}`,
      tooltip: qualifications.longterm_loan.reason
    });
  }
  
  if (qualifications.advance_loan.qualifies) {
    badges.push({
      type: 'advance',
      color: 'blue',
      text: `Advance: KES ${qualifications.advance_loan.max_amount.toLocaleString()}`,
      tooltip: qualifications.advance_loan.reason
    });
  }
  
  // Show pending contributions indicator
  if (qualifications.includes_pending_records) {
    badges.push({
      type: 'pending',
      color: 'orange',
      text: '⏳ Includes pending contributions',
      tooltip: `${qualifications.pending_records_summary.pending_records_count} unsynced record(s)`
    });
  }
  
  return badges;
}

// Run examples
export async function runExamples() {
  await initialSync();
  await beforeTakingContributions();
  await afterTakingContributions();
  await loanApplicationFlow();
  await realTimeQualificationUpdate();
}
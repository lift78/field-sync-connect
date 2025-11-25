import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { dbOperations, MemberBalance } from "@/lib/database";
import { useToast } from "@/hooks/use-toast";
import { AdvanceCalculatorDialog } from "./AdvanceCalculator";
import { Calculator } from "lucide-react";
import { Plus, Trash2, Save, User, Phone, Users, Banknote, Smartphone, AlertCircle, DollarSign } from "lucide-react";
// import { Keyboard } from "@capacitor/keyboard";


// Mock member data - fallback when no real data exists
const mockMembers = Array.from({ length: 9999 }, (_, i) => ({
  id: String(i + 1).padStart(4, '0'),
  name: `Member ${i + 1}`,
}));

interface Allocation {
  type: 'savings' | 'loan' | 'amount_for_advance_payment' | 'other';
  amount: number;
  reason?: string;
}

const allocationReasons = [
  'Lateness Fine',
  'Advance fine(kes 10)',
  'Loan Processing Fees',
  'Advocate Fees',
  'Insurance Risk Fund',
  'Contribution for Deceased',
  'Registration Fee',
  'Meeting Absence Fine',
  'Administrative Fees',
  'Fines and Penalties',
  'Custom (Other)'
];

// Helper function to handle precise decimal calculations
const toPreciseNumber = (value: string | number): number => {
  if (typeof value === 'string') {
    if (value === '') return 0;
    const num = parseFloat(value);
    if (isNaN(num)) return 0;
    // Round to 2 decimal places to avoid floating point precision issues
    return Math.round(num * 100) / 100;
  }
  return Math.round(value * 100) / 100;
};

// Helper function to extract member ID from member_id field (e.g., "MEM/2025/0007" -> "0007")
const extractMemberId = (memberIdField: string): string => {
  const parts = memberIdField.split('/');
  return parts[parts.length - 1] || memberIdField;
};

interface CashCollectionFormProps {
  onShowGroupSummary?: () => void;
}

export function CashCollectionForm({ onShowGroupSummary }: CashCollectionFormProps = {}) {
  const [memberId, setMemberId] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [realMembers, setRealMembers] = useState<MemberBalance[]>([]);
  const [selectedRealMember, setSelectedRealMember] = useState<MemberBalance | null>(null);
  const [showMismatchWarning, setShowMismatchWarning] = useState(false);
  const { toast } = useToast();


  // Mobile keyboard handling will be added later when Capacitor is properly configured

  // Load real member data on component mount
  useEffect(() => {
    const loadRealMembers = async () => {
      try {
        const members = await dbOperations.getAllMembers();
        setRealMembers(members);
        console.log(`Loaded ${members.length} real members from database`);
      } catch (error) {
        console.error('Error loading real members:', error);
        setRealMembers([]);
      }
    };

    loadRealMembers();
  }, []);


  // Search and filter members based on query
  const filteredMembers = useMemo(() => {
    if (!memberQuery) return [];
    
    const query = memberQuery.trim().toLowerCase();
    const results: Array<{
      id: string;
      name: string;
      phone?: string;
      group?: string;
      isReal: boolean;
      memberData?: MemberBalance;
    }> = [];

    // First, search in real member data
    if (realMembers.length > 0) {
      const realMatches = realMembers.filter(member => {
        const memberId = extractMemberId(member.member_id);
        return (
          memberId.toLowerCase().includes(query) ||
          member.name.toLowerCase().includes(query) ||
          member.phone.includes(memberQuery.trim()) ||
          member.member_id.toLowerCase().includes(query)
        );
      }).slice(0, 10);

      // Add real members to results
      realMatches.forEach(member => {
        const memberId = extractMemberId(member.member_id);
        results.push({
          id: memberId,
          name: member.name,
          phone: member.phone,
          group: member.group_name,
          isReal: true,
          memberData: member
        });
      });
    }

    // If no real members found or query looks like numeric ID, also search mock data
    if (results.length === 0 || /^\d+$/.test(query)) {
      const mockQuery = memberQuery.trim();
      
      // If input is numeric, handle ID searching in mock data
      if (/^\d+$/.test(mockQuery)) {
        // 1. Try exact padded match first (e.g., "345" -> "0345")
        const paddedId = mockQuery.padStart(4, '0');
        
        // Skip if we already have this ID from real data
        const alreadyHasThisId = results.some(r => r.id === paddedId);
        
        if (!alreadyHasThisId) {
          const exactMatch = mockMembers.find(member => member.id === paddedId);
          if (exactMatch) {
            results.push({
              id: exactMatch.id,
              name: exactMatch.name,
              isReal: false
            });
          }
          
          // 2. If no exact match and query is shorter than 4 digits, search for IDs that start with the query
          if (!exactMatch && mockQuery.length < 4) {
            const startMatches = mockMembers.filter(member => 
              member.id.startsWith(mockQuery.padStart(mockQuery.length, '0')) &&
              !results.some(r => r.id === member.id) // Avoid duplicates
            ).slice(0, 5);
            startMatches.forEach(member => {
              results.push({
                id: member.id,
                name: member.name,
                isReal: false
              });
            });
          }
          
          // 3. If query is 4+ digits and no exact match, search for partial matches
          if (!exactMatch && mockQuery.length >= 4) {
            const partialMatches = mockMembers.filter(member => 
              (member.id.includes(mockQuery) || member.id === mockQuery) &&
              !results.some(r => r.id === member.id) // Avoid duplicates
            ).slice(0, 5);
            partialMatches.forEach(member => {
              results.push({
                id: member.id,
                name: member.name,
                isReal: false
              });
            });
          }
        }
      }
    }

    return results.slice(0, 10); // Limit total results
  }, [memberQuery, realMembers]);

  // Find selected member (real or mock)
  const selectedMember = useMemo(() => {
    if (selectedRealMember) {
      return {
        id: extractMemberId(selectedRealMember.member_id),
        name: selectedRealMember.name,
        phone: selectedRealMember.phone,
        group: selectedRealMember.group_name,
        isReal: true,
        memberData: selectedRealMember
      };
    }
    
    if (memberId) {
      const mockMember = mockMembers.find(m => m.id === memberId);
      if (mockMember) {
        return {
          id: mockMember.id,
          name: mockMember.name,
          isReal: false
        };
      }
    }
    
    return null;
  }, [memberId, selectedRealMember]);

  // Use precise calculations to avoid floating point issues
  const cashAmountNum = toPreciseNumber(cashAmount);
  const mpesaAmountNum = toPreciseNumber(mpesaAmount);
  const totalCollected = toPreciseNumber(cashAmountNum + mpesaAmountNum);
  const totalAllocated = toPreciseNumber(
    allocations.reduce((sum, alloc) => sum + alloc.amount, 0)
  );
  const remainingAmount = toPreciseNumber(totalCollected - totalAllocated);

  // Check if form has meaningful data for save button
  const hasValidData = memberId && (totalCollected > 0 || totalAllocated > 0);

  // Get current balances if real member is selected
  const currentBalances = selectedRealMember ? selectedRealMember.balances : null;

  // Calculate carry forward balances
  const savingsAllocation = allocations.find(a => a.type === 'savings')?.amount || 0;
  const loanAllocation = allocations.find(a => a.type === 'loan')?.amount || 0;
  const advanceAllocation = allocations.find(a => a.type === 'amount_for_advance_payment')?.amount || 0;

  // Calculate advance payment split to get the correct principal amount
  const advancePaymentSplit = useMemo(() => {
    if (currentBalances && advanceAllocation > 0) {
      // Use the same logic from AdvanceCalculator to split the payment
      const currentAdvanceBalance = currentBalances.advance_loan_balance;
      
      if (currentAdvanceBalance <= 0) {
        return { pay_advance: 0, pay_advance_interest: 0 };
      }
      
      if (advanceAllocation >= currentAdvanceBalance) {
        // Full payment - no interest required
        return {
          pay_advance: currentAdvanceBalance,
          pay_advance_interest: 0
        };
      }
      
      // Partial payment - calculate split using simultaneous equations
      const ADVANCE_INTEREST_RATE = 0.1; // 10%
      const ADVANCE_FIXED_FINE = 10; // 10 KES
      
      const interestComponent = currentAdvanceBalance * ADVANCE_INTEREST_RATE / (1 + ADVANCE_INTEREST_RATE);
      let payAdvance = (advanceAllocation - interestComponent - ADVANCE_FIXED_FINE) * (1 + ADVANCE_INTEREST_RATE) / 1;
      
      // Ensure pay_advance doesn't exceed current_balance or go negative
      payAdvance = Math.max(0, Math.min(payAdvance, currentAdvanceBalance));
      
      let payAdvanceInterest;
      
      if (payAdvance >= currentAdvanceBalance) {
        payAdvance = currentAdvanceBalance;
        payAdvanceInterest = 0;
      } else {
        // Calculate interest for remaining balance
        const remainingBalance = currentAdvanceBalance - payAdvance;
        const currentPrincipal = remainingBalance / (1 + ADVANCE_INTEREST_RATE);
        payAdvanceInterest = currentPrincipal * ADVANCE_INTEREST_RATE + ADVANCE_FIXED_FINE;
        payAdvanceInterest = Math.round(payAdvanceInterest);
      }
      
      return {
        pay_advance: Math.round(payAdvance * 100) / 100,
        pay_advance_interest: payAdvanceInterest
      };
    }
    return { pay_advance: 0, pay_advance_interest: 0 };
  }, [currentBalances, advanceAllocation]);

  const savingsCarryForward = currentBalances ? 
    toPreciseNumber(currentBalances.savings_balance + savingsAllocation) : 0;
  const loanCarryForward = currentBalances ? 
    toPreciseNumber(currentBalances.loan_balance - loanAllocation) : 0;
  // Use only the principal portion (pay_advance) to calculate advance carry forward
  const advanceCarryForward = currentBalances ? 
    toPreciseNumber(currentBalances.advance_loan_balance - advancePaymentSplit.pay_advance) : 0;

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const addAllocation = (type: Allocation['type']) => {
    const newAllocation: Allocation = {
      type,
      amount: 0,
      reason: type === 'other' ? allocationReasons[0] : undefined,
    };
    setAllocations([...allocations, newAllocation]);
  };

  const updateAllocation = (index: number, updates: Partial<Allocation>) => {
    setAllocations(allocations.map((alloc, i) => 
      i === index ? { 
        ...alloc, 
        ...updates,
        // Ensure amount precision
        amount: updates.amount !== undefined ? toPreciseNumber(updates.amount) : alloc.amount
      } : alloc
    ));
  };

  const removeAllocation = (index: number) => {
    setAllocations(allocations.filter((_, i) => i !== index));
  };

  const handleMemberSelect = (memberOption: any) => {
    setMemberId(memberOption.id);
    setMemberQuery('');
    
    if (memberOption.isReal && memberOption.memberData) {
      setSelectedRealMember(memberOption.memberData);
    } else {
      setSelectedRealMember(null);
    }
  };

  const handleSave = async () => {
    try {
      if (!selectedMember) {
        toast({
          title: "âŒ Member Required",
          description: "Please select a member first",
          variant: "destructive"
        });
        return;
      }

      // Validate that we have either collection amounts or allocations
      if (totalCollected === 0 && totalAllocated === 0) {
        toast({
          title: "âŒ No Data to Save",
          description: "Please enter collection amounts or allocations",
          variant: "destructive"
        });
        return;
      }

      // Check if total collected matches total allocated
      if (Math.abs(totalCollected - totalAllocated) > 0.01) {
        setShowMismatchWarning(true);
        return;
      }

      // Check for existing pending records for this member
      const existingRecords = await dbOperations.getPendingRecords();
      const hasPendingRecord = existingRecords.some(
        record => record.type === 'cash' && record.memberId === memberId
      );

      if (hasPendingRecord) {
        toast({
          title: "âŒ Duplicate Record",
          description: "You have already done a cash collection record for this member. Please edit the existing record or delete it first.",
          variant: "destructive"
        });
        return;
      }

      // Prepare allocations without individual IDs
      const formattedAllocations = allocations
        .filter(allocation => allocation.amount > 0) // Only save allocations with amounts
        .map(allocation => ({
          memberId: memberId,
          type: allocation.type,
          amount: allocation.amount,
          reason: allocation.reason
        }));

      await dbOperations.addCashCollection({
        memberId,
        memberName: selectedMember.name,
        totalAmount: totalCollected,
        cashAmount: cashAmountNum,
        mpesaAmount: mpesaAmountNum,
        allocations: formattedAllocations,
        timestamp: new Date()
      });
      
      toast({
        title: "Cash Collection Saved",
        description: `${formatAmount(totalCollected)} saved for ${selectedMember.name}${
          cashAmountNum > 0 ? ' (Cash reference generated)' : ''
        }`,
      });
      
      // Reset form
      setMemberId('');
      setCashAmount('');
      setMpesaAmount('');
      setAllocations([]);
      setMemberQuery('');
      setSelectedRealMember(null);
    } catch (error) {
      toast({
        title: "âŒ Save Failed",
        description: "Failed to save cash collection",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Member Selection */}
      <Card className="shadow-card bg-gradient-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">Member Identification</CardTitle>
            <Button 
              variant="default" 
              size="sm"
              onClick={onShowGroupSummary}
              className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white"
            >
              Group Summary
            </Button>
          </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="member-search">Search Member ID, Name, or Phone</Label>
            <Input
              id="member-search"
              placeholder="Type member ID, name, or phone..."
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
            />
          </div>
          
          {memberQuery && filteredMembers.length > 0 && (
            <div className="space-y-2">
              <Label>Select Member</Label>
              <div className="grid gap-2 max-h-48 overflow-y-auto">
                {filteredMembers.map((member, index) => (
                  <Button
                    key={`${member.id}-${index}`}
                    variant={memberId === member.id ? "default" : "outline"}
                    onClick={() => handleMemberSelect(member)}
                    className="justify-start p-3 h-auto text-left"
                  >
                    <div className="flex flex-col items-start w-full">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{member.id} - {member.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {member.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span>{member.phone}</span>
                          </div>
                        )}
                        {member.group && (
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>{member.group}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {selectedMember && (
            <div className="p-3 bg-success/10 rounded-lg border border-success/20">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-success">Selected Member:</p>
                    {selectedMember.isReal && (
                      <Badge variant="secondary" className="text-xs">
                        REAL DATA
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm mb-2">{selectedMember.id} - {selectedMember.name}</p>
                  {selectedMember.isReal && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      {selectedMember.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          <span>{selectedMember.phone}</span>
                        </div>
                      )}
                      {selectedMember.group && (
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>{selectedMember.group}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMemberId('');
                    setMemberQuery('');
                    setSelectedRealMember(null);
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  X
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Cash Collection */}
      <Card className="shadow-card bg-gradient-card">
        <CardHeader>
          <CardTitle className="text-lg">Cash Collection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Enhanced Cash Field */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-2 bg-green-900/20 rounded-lg border border-green-500/30">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Banknote className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <Label htmlFor="cash-amount" className="text-base font-semibold text-green-300">
                    💵 CASH Amount (KES)
                  </Label>
                  <p className="text-xs text-green-400/80">Physical money received</p>
                </div>
              </div>
              <Input
                id="cash-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                className="text-lg p-3 border-2 border-success/30 focus:border-success bg-success/5"
              />
              {cashAmountNum > 0 && (
                <div className="flex items-center gap-2 text-sm text-success bg-success/10 p-2 rounded">
                  <span>📄 Cash reference will be generated automatically</span>
                </div>
              )}
            </div>
            
            {/* Enhanced M-Pesa Field */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg border border-primary/20">
                <Smartphone className="h-5 w-5 text-primary" />
                <div>
                  <Label htmlFor="mpesa-amount" className="text-base font-semibold text-primary">
                  📱 M-PESA Amount (KES)
                  </Label>
                  <p className="text-xs text-primary/80">Mobile money received</p>
                </div>
              </div>
              <Input
                id="mpesa-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={mpesaAmount}
                onChange={(e) => setMpesaAmount(e.target.value)}
                className="text-lg p-3 border-2 border-primary/30 focus:border-primary bg-primary/5"
              />
              {mpesaAmountNum > 0 && (
                <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 p-2 rounded">
                  <span>📱 M-Pesa transaction recorded</span>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Total Summary */}
          <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
            <div className="flex justify-between items-center">
              <span className="font-medium">Amount to Allocate:</span>
              <span className="text-xl font-bold text-primary">
                {formatAmount(totalCollected)}
              </span>
            </div>
            {/* Show breakdown if both amounts exist */}
            {cashAmountNum > 0 && mpesaAmountNum > 0 && (
              <div className="mt-2 pt-2 border-t border-primary/20 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span className="flex items-center gap-1">
                    <Banknote className="h-3 w-3 text-success" />
                    Cash: {formatAmount(cashAmountNum)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Smartphone className="h-3 w-3 text-primary" />
                    M-Pesa: {formatAmount(mpesaAmountNum)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>


      {/* Allocations */}
      <Card className="shadow-card bg-gradient-card">
        <CardHeader>
          <CardTitle className="text-lg">Member Allocations</CardTitle>
          <p className="text-sm text-muted-foreground">
            All allocations will be saved under one allocation ID
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Core Allocation Fields - Always Visible */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="savings-amount">Allocate to Savings (KES)</Label>
              <Input
                id="savings-amount"
                type="number"
                step="0.01"
                placeholder="0"
                value={allocations.find(a => a.type === 'savings')?.amount || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  const amount = toPreciseNumber(value);
                  const existingIndex = allocations.findIndex(a => a.type === 'savings');
                  if (existingIndex >= 0) {
                    updateAllocation(existingIndex, { amount });
                  } else if (amount > 0) {
                    setAllocations(prev => [...prev, { type: 'savings', amount }]);
                  }
                }}
              />
              {currentBalances && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-muted/30 rounded border border-muted/50">
                    <div className="text-muted-foreground">Current Savings</div>
                    <div className="font-medium text-blue-400">
                      {formatAmount(currentBalances.savings_balance)}
                    </div>
                  </div>
                  <div className="p-2 bg-green-500/10 rounded border border-green-500/20">
                    <div className="text-muted-foreground">Savings CF</div>
                    <div className="font-medium text-green-400">
                      {formatAmount(savingsCarryForward)}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Label htmlFor="loan-amount">Pay Loan (KES)</Label>
              <Badge variant="destructive" className="text-xs font-bold animate-pulse shadow-lg border-2 border-red-600">
                Min: {formatAmount(selectedRealMember?.inst || 0)}
              </Badge>
            </div>
              <Input
                id="loan-amount"
                type="number"
                step="0.01"
                placeholder="0"
                value={allocations.find(a => a.type === 'loan')?.amount || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  const amount = toPreciseNumber(value);
                  const existingIndex = allocations.findIndex(a => a.type === 'loan');
                  if (existingIndex >= 0) {
                    updateAllocation(existingIndex, { amount });
                  } else if (amount > 0) {
                    setAllocations(prev => [...prev, { type: 'loan', amount }]);
                  }
                }}
              />
              {currentBalances && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-muted/30 rounded border border-muted/50">
                    <div className="text-muted-foreground">Current Balance</div>
                    <div className="font-medium text-red-400">
                      {formatAmount(currentBalances.loan_balance)}
                    </div>
                  </div>
                  <div className="p-2 bg-green-500/10 rounded border border-green-500/20">
                    <div className="text-muted-foreground">Loan CF</div>
                    <div className="font-medium text-green-400">
                      {formatAmount(Math.max(0, loanCarryForward))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="advance-payment-amount">Advance Payments (KES)</Label>
              <div className="relative">
                <Input
                  id="advance-payment-amount"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={allocations.find(a => a.type === 'amount_for_advance_payment')?.amount || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    const amount = toPreciseNumber(value);
                    const existingIndex = allocations.findIndex(a => a.type === 'amount_for_advance_payment');
                    if (existingIndex >= 0) {
                      updateAllocation(existingIndex, { amount });
                    } else if (amount > 0) {
                      setAllocations(prev => [...prev, { type: 'amount_for_advance_payment', amount }]);
                    }
                  }}
                  className="pr-12"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <AdvanceCalculatorDialog
                    currentAmount={allocations.find(a => a.type === 'amount_for_advance_payment')?.amount || 0}
                    onAmountSelect={(amount) => {
                      const preciseAmount = toPreciseNumber(amount);
                      const existingIndex = allocations.findIndex(a => a.type === 'amount_for_advance_payment');
                      if (existingIndex >= 0) {
                        updateAllocation(existingIndex, { amount: preciseAmount });
                      } else {
                        setAllocations(prev => [...prev, { type: 'amount_for_advance_payment', amount: preciseAmount }]);
                      }
                    }}
                    trigger={
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-accent"
                        type="button"
                      >
                        <Calculator className="h-4 w-4" />
                      </Button>
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calculator className="h-3 w-3" />
                Click calculator to preview payment split
              </p>
              {currentBalances && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-muted/30 rounded border border-muted/50">
                    <div className="text-muted-foreground">Current Balance</div>
                    <div className="font-medium text-red-400">
                      {formatAmount(currentBalances.advance_loan_balance)}
                    </div>
                  </div>
                  <div className="p-2 bg-green-500/10 rounded border border-green-500/20">
                    <div className="text-muted-foreground">Advance CF</div>
                    <div className="font-medium text-green-400">
                      {formatAmount(Math.max(0, advanceCarryForward))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Other Allocations - Add as needed */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Other Allocations</Label>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => addAllocation('other')}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Other
              </Button>
            </div>

            <div className="space-y-3">
              {allocations.filter(a => a.type === 'other').map((allocation, index) => {
                const otherIndex = allocations.findIndex(a => a.type === 'other' && a === allocation);
                return (
                  <div key={index} className="p-3 border rounded-lg bg-background/50">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary">
                        OTHER ALLOCATION
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAllocation(otherIndex)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Amount (KES)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          value={allocation.amount || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            updateAllocation(otherIndex, {
                              amount: toPreciseNumber(value)
                            });
                          }}
                        />
                      </div>
                      
                      <div>
                        <Label className="text-xs">Reason</Label>
                        <Select
                          value={allocation.reason}
                          onValueChange={(value) => updateAllocation(otherIndex, { reason: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {allocationReasons.map((reason) => (
                              <SelectItem key={reason} value={reason}>
                                {reason}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <Separator />
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Total Collected:</span>
              <span className="font-medium">{formatAmount(totalCollected)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Allocated:</span>
              <span className="font-medium">{formatAmount(totalAllocated)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Remaining:</span>
              <span className={remainingAmount < 0 ? 'text-destructive' : 'text-success'}>
                {formatAmount(remainingAmount)}
              </span>
            </div>
          </div>

          <Button 
          variant="mobile" 
          size="mobile" 
          onClick={handleSave}
          disabled={!hasValidData}
          className="w-full"
        >
          <Save className="h-5 w-5 mr-2" />
          Save Record
        </Button>
        </CardContent>
      </Card>

      {/* Mismatch Warning Dialog */}
      <AlertDialog open={showMismatchWarning} onOpenChange={setShowMismatchWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Collection Mismatch
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                The total amount collected does not match the total amount allocated.
              </p>
              <div className="space-y-1 text-sm font-medium">
                <p>Total Collected: <span className="text-blue-600">{formatAmount(totalCollected)}</span></p>
                <p>Total Allocated: <span className="text-emerald-600">{formatAmount(totalAllocated)}</span></p>
                <p>Difference: <span className="text-amber-600">{formatAmount(Math.abs(totalCollected - totalAllocated))}</span></p>
              </div>
              <p className="text-destructive">
                Please adjust your amounts so that collected equals allocated before saving.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowMismatchWarning(false)}>
              OK, I'll Fix It
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
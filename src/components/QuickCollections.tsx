import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { dbOperations, MemberBalance } from "@/lib/database";
import { useToast } from "@/hooks/use-toast";
import { AdvanceCalculatorDialog } from "./AdvanceCalculator";
import { 
  Users, 
  User, 
  Phone, 
  ChevronRight, 
  Save, 
  Plus, 
  Trash2, 
  Banknote, 
  Smartphone,
  ArrowLeft,
  Calculator,
  ChevronLeft,
  SkipForward,
  AlertCircle
} from "lucide-react";

interface Group {
  id: string;
  name: string;
  memberCount: number;
}

interface QuickCollectionsProps {
  onBack: () => void;
}

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
    return Math.round(num * 100) / 100;
  }
  return Math.round(value * 100) / 100;
};

function GroupSelection({ onGroupSelect, onBack }: { onGroupSelect: (group: Group, members: MemberBalance[]) => void; onBack: () => void }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<MemberBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Define color options for group cards
  const groupColors = [
    'from-blue-500 to-blue-600',
    'from-purple-500 to-purple-600',
    'from-green-500 to-green-600',
    'from-orange-500 to-orange-600',
    'from-pink-500 to-pink-600',
    'from-cyan-500 to-cyan-600',
    'from-red-500 to-red-600',
    'from-indigo-500 to-indigo-600',
  ];

  useEffect(() => {
    loadGroupsAndMembers();
  }, []);

  const loadGroupsAndMembers = async () => {
    try {
      const allMembers = await dbOperations.getAllMembers();
      setMembers(allMembers);
      
      // Extract unique groups with member count
      const groupsMap = new Map<string, { name: string; count: number }>();
      allMembers.forEach(member => {
        if (member.group_name) {
          const existing = groupsMap.get(member.group_name);
          groupsMap.set(member.group_name, {
            name: member.group_name,
            count: (existing?.count || 0) + 1
          });
        }
      });
      
      const groupsList = Array.from(groupsMap.entries()).map(([name, data]) => ({
        id: name,
        name,
        memberCount: data.count
      }));
      
      setGroups(groupsList);
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGroupSelect = (group: Group) => {
    // Get members for this group sorted by member ID
    const groupMembers = members
      .filter(member => member.group_name === group.name)
      .sort((a, b) => {
        // Extract numeric part from member_id for sorting
        const getNumericId = (memberId: string) => {
          const parts = memberId.split('/');
          const numericPart = parts[parts.length - 1];
          return parseInt(numericPart) || 0;
        };
        return getNumericId(a.member_id) - getNumericId(b.member_id);
      });
    
    onGroupSelect(group, groupMembers);
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Loading groups...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 sm:px-6 py-3 sm:py-4 rounded-lg shadow-lg">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onBack} 
            className="hover:bg-white/20 text-white flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-bold text-white">Quick Collections</h1>
            <p className="text-xs sm:text-sm text-white/90">Select a group to start collecting from members</p>
          </div>
        </div>
      </div>

      {/* Groups List */}
      <div className="space-y-3">
        {groups.map((group, index) => {
          const colorClass = groupColors[index % groupColors.length];
          return (
            <Card 
  key={group.id} 
  className="cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.01] border-l-4 hover:border-blue-400 dark:hover:border-blue-500" 
  style={{ borderLeftColor: `hsl(var(--primary))` }}
  onClick={() => handleGroupSelect(group)}
>
  <CardHeader className="pb-2 sm:pb-3">
    <CardTitle className="flex items-center justify-between text-base sm:text-lg">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <div className={`p-1.5 sm:p-2 rounded-lg bg-gradient-to-r ${colorClass} flex-shrink-0`}>
          <Users className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
        </div>
        <span className="font-bold truncate">{group.name}</span>
      </div>
      <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0 ml-2" />
    </CardTitle>
  </CardHeader>
  <CardContent className="pt-0 pb-3">
    <Badge variant="secondary" className="text-xs sm:text-sm">
      {group.memberCount} members
    </Badge>
  </CardContent>
</Card>
          );
        })}
      </div>

      {groups.length === 0 && (
        <Card>
          <CardContent className="p-8 sm:p-12 text-center">
            <Users className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold mb-2">No Groups Found</h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              No member groups are available for quick collections.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CollectionForm({ 
  selectedGroup, 
  groupMembers, 
  onBack 
}: { 
  selectedGroup: Group; 
  groupMembers: MemberBalance[]; 
  onBack: () => void;
}) {
  const [currentMemberIndex, setCurrentMemberIndex] = useState(0);
  const [cashAmount, setCashAmount] = useState('');
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showMismatchWarning, setShowMismatchWarning] = useState(false);
  const { toast } = useToast();
  
  // Ref for member card to scroll to
  const memberCardRef = useRef<HTMLDivElement>(null);

  const currentMember = groupMembers[currentMemberIndex];

  const resetForm = () => {
    setCashAmount('');
    setMpesaAmount('');
    setAllocations([]);
  };

  // Use precise calculations to avoid floating point issues
  const cashAmountNum = toPreciseNumber(cashAmount);
  const mpesaAmountNum = toPreciseNumber(mpesaAmount);
  const totalCollected = toPreciseNumber(cashAmountNum + mpesaAmountNum);
  const totalAllocated = toPreciseNumber(
    allocations.reduce((sum, alloc) => sum + alloc.amount, 0)
  );
  const remainingAmount = toPreciseNumber(totalCollected - totalAllocated);

  // Get current balances if member is selected
  const currentBalances = currentMember ? currentMember.balances : null;

  // Calculate carry forward balances
  const savingsAllocation = allocations.find(a => a.type === 'savings')?.amount || 0;
  const loanAllocation = allocations.find(a => a.type === 'loan')?.amount || 0;
  const advanceAllocation = allocations.find(a => a.type === 'amount_for_advance_payment')?.amount || 0;

  // Calculate advance payment split
  const advancePaymentSplit = useMemo(() => {
    if (currentBalances && advanceAllocation > 0) {
      const currentAdvanceBalance = currentBalances.advance_loan_balance;
      
      if (currentAdvanceBalance <= 0) {
        return { pay_advance: 0, pay_advance_interest: 0 };
      }
      
      if (advanceAllocation >= currentAdvanceBalance) {
        return {
          pay_advance: currentAdvanceBalance,
          pay_advance_interest: 0
        };
      }
      
      const ADVANCE_INTEREST_RATE = 0.1; // 10%
      const ADVANCE_FIXED_FINE = 10; // 10 KES
      
      const interestComponent = currentAdvanceBalance * ADVANCE_INTEREST_RATE / (1 + ADVANCE_INTEREST_RATE);
      let payAdvance = (advanceAllocation - interestComponent - ADVANCE_FIXED_FINE) * (1 + ADVANCE_INTEREST_RATE) / 1;
      
      payAdvance = Math.max(0, Math.min(payAdvance, currentAdvanceBalance));
      
      let payAdvanceInterest;
      
      if (payAdvance >= currentAdvanceBalance) {
        payAdvance = currentAdvanceBalance;
        payAdvanceInterest = 0;
      } else {
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
        amount: updates.amount !== undefined ? toPreciseNumber(updates.amount) : alloc.amount
      } : alloc
    ));
  };

  const removeAllocation = (index: number) => {
    setAllocations(allocations.filter((_, i) => i !== index));
  };

  const scrollToMemberCard = () => {
    setTimeout(() => {
      memberCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleSave = async () => {
    if (!currentMember) return;
    
    if (totalCollected === 0 && totalAllocated === 0) {
      toast({
        title: "No Data to Save",
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

    setIsLoading(true);
    
    try {
      // Extract member ID from member_id field
      const extractMemberId = (memberIdField: string): string => {
        const parts = memberIdField.split('/');
        return parts[parts.length - 1] || memberIdField;
      };

      const memberId = extractMemberId(currentMember.member_id);

      // Check for duplicate records on the same day
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const existingRecords = await dbOperations.getCashCollections();
      const todayRecords = existingRecords.filter(record => {
        const recordDate = new Date(record.timestamp);
        return recordDate >= today && recordDate < tomorrow && record.memberId === memberId;
      });

      if (todayRecords.length > 0) {
        const confirmDuplicate = confirm(
          `⚠️ A record for member ${currentMember.name} (ID: ${memberId}) already exists for today.\n\nAre you sure you want to create a second record?`
        );
        
        if (!confirmDuplicate) {
          setIsLoading(false);
          return;
        }
      }

      // Prepare allocations without individual IDs
      const formattedAllocations = allocations
        .filter(allocation => allocation.amount > 0)
        .map(allocation => ({
          memberId: memberId,
          type: allocation.type,
          amount: allocation.amount,
          reason: allocation.reason
        }));

      await dbOperations.addCashCollection({
        memberId,
        memberName: currentMember.name,
        totalAmount: totalCollected,
        cashAmount: cashAmountNum,
        mpesaAmount: mpesaAmountNum,
        allocations: formattedAllocations,
        timestamp: new Date()
      });
      
      toast({
        title: "✅ Collection Saved",
        description: `${formatAmount(totalCollected)} saved for ${currentMember.name}${
          cashAmountNum > 0 ? ' (Cash reference generated)' : ''
        }`,
      });

      // Move to next member or finish
      if (currentMemberIndex < groupMembers.length - 1) {
        setCurrentMemberIndex(currentMemberIndex + 1);
        resetForm();
        scrollToMemberCard();
      } else {
        toast({
          title: "🎉 Group Complete",
          description: `All collections for ${selectedGroup.name} completed!`,
        });
        onBack();
      }
    } catch (error) {
      console.error('Error saving collection:', error);
      toast({
        title: "❌ Error",
        description: "Failed to save collection. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevious = () => {
    if (currentMemberIndex > 0) {
      setCurrentMemberIndex(currentMemberIndex - 1);
      resetForm();
      scrollToMemberCard();
    }
  };

  const handleSkip = () => {
    if (currentMemberIndex < groupMembers.length - 1) {
      setCurrentMemberIndex(currentMemberIndex + 1);
      resetForm();
      scrollToMemberCard();
    }
  };

  const hasValidData = totalCollected > 0 || totalAllocated > 0;

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back to Groups</span>
          <span className="sm:hidden">Back</span>
        </Button>
        <Badge variant="outline" className="text-xs sm:text-sm">
          {currentMemberIndex + 1} of {groupMembers.length}
        </Badge>
      </div>

      {/* Enhanced Member Info Card with Bold Colors */}
      <div ref={memberCardRef}>
        <Card className="shadow-lg bg-gradient-to-r from-blue-500 to-purple-600 border-2 border-blue-400 mx-1 sm:mx-0">
          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="flex items-center gap-2 min-w-0 bg-white/20 backdrop-blur-sm p-3 rounded-lg">
                <User className="h-4 w-4 sm:h-5 sm:w-5 text-white flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white/80 font-medium">Member Name</p>
                  <p className="font-bold text-sm sm:text-base text-white truncate">{currentMember.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 min-w-0 bg-white/20 backdrop-blur-sm p-3 rounded-lg">
                <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-white flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white/80 font-medium">Phone Number</p>
                  <p className="font-bold text-sm sm:text-base text-white truncate">{currentMember.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 min-w-0 bg-white/20 backdrop-blur-sm p-3 rounded-lg">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-white flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white/80 font-medium">Group</p>
                  <p className="font-bold text-sm sm:text-base text-white truncate">{selectedGroup.name}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cash Collection */}
      <Card className="shadow-card bg-gradient-card mx-1 sm:mx-0">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="text-base sm:text-lg">Cash Collection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Enhanced Cash Field */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-2 bg-success/10 rounded-lg border border-success/20">
                <Banknote className="h-4 w-4 sm:h-5 sm:w-5 text-success flex-shrink-0" />
                <div className="min-w-0">
                  <Label htmlFor="cash-amount" className="text-sm sm:text-base font-semibold text-success">
                    💵 CASH Amount (KES)
                  </Label>
                  <p className="text-xs text-success/80">Physical money received</p>
                </div>
              </div>
              <Input
                id="cash-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                className="text-base sm:text-lg p-3 border-2 border-success/30 focus:border-success bg-success/5"
              />
              {cashAmountNum > 0 && (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-success bg-success/10 p-2 rounded">
                  <span>📄 Cash reference will be generated automatically</span>
                </div>
              )}
            </div>
            
            {/* Enhanced M-Pesa Field */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg border border-primary/20">
                <Smartphone className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <Label htmlFor="mpesa-amount" className="text-sm sm:text-base font-semibold text-primary">
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
                className="text-base sm:text-lg p-3 border-2 border-primary/30 focus:border-primary bg-primary/5"
              />
              {mpesaAmountNum > 0 && (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-primary bg-primary/10 p-2 rounded">
                  <span>📱 M-Pesa transaction recorded</span>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Total Summary with Breakdown */}
          {totalCollected > 0 && (
            <div className="p-3 sm:p-4 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-sm sm:text-base">Amount to Allocate:</span>
                <span className="text-lg sm:text-xl font-bold text-primary">
                  {formatAmount(totalCollected)}
                </span>
              </div>
              {/* Show breakdown */}
              <div className="pt-2 border-t border-primary/20 text-xs sm:text-sm">
                <div className="flex justify-between mb-1">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Banknote className="h-3 w-3 text-success" />
                    Cash:
                  </span>
                  <span className="font-medium">{formatAmount(cashAmountNum)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Smartphone className="h-3 w-3 text-primary" />
                    M-Pesa:
                  </span>
                  <span className="font-medium">{formatAmount(mpesaAmountNum)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Allocations */}
      <Card className="shadow-card bg-gradient-card mx-1 sm:mx-0">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="text-base sm:text-lg">Member Allocations</CardTitle>
          <p className="text-xs sm:text-sm text-muted-foreground">
            All allocations will be saved under one allocation ID
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Core Allocation Fields - Always Visible */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Savings Allocation - Green Border */}
            <div className="space-y-2 border-2 border-dashed border-green-500/50 rounded-lg p-3 bg-green-500/5">
              <Label htmlFor="savings-amount" className="text-sm font-semibold text-green-600 dark:text-green-400">
                💰 Allocate to Savings (KES)
              </Label>
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
                className="text-sm"
              />
              {currentBalances && (
                <div className="grid grid-cols-2 gap-1 sm:gap-2 text-xs">
                  <div className="p-1.5 sm:p-2 bg-muted/30 rounded border border-muted/50">
                    <div className="text-muted-foreground text-xs">Current Savings</div>
                    <div className="font-medium text-blue-400 text-xs">
                      {formatAmount(currentBalances.savings_balance)}
                    </div>
                  </div>
                  <div className="p-1.5 sm:p-2 bg-green-500/10 rounded border border-green-500/20">
                    <div className="text-muted-foreground text-xs">Savings CF</div>
                    <div className="font-medium text-green-400 text-xs">
                      {formatAmount(savingsCarryForward)}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Loan Payment - Red/Orange Border */}
              <div className="space-y-2 border-2 border-dashed border-red-500/50 rounded-lg p-3 bg-red-500/5">
                <div className="flex items-center gap-2 mb-1">
                  <Label htmlFor="loan-amount" className="font-semibold text-red-600 dark:text-red-400">
                    🏦 Pay Loan (KES)
                  </Label>
                <Badge variant="destructive" className="text-xs font-bold animate-pulse shadow-lg border-2 border-red-600">
                  Min: {formatAmount(currentMember?.inst || 0)}
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
                className="text-sm"
              />
              {currentBalances && (
                <div className="grid grid-cols-2 gap-1 sm:gap-2 text-xs">
                  <div className="p-1.5 sm:p-2 bg-muted/30 rounded border border-muted/50">
                    <div className="text-muted-foreground text-xs">Current Balance</div>
                    <div className="font-medium text-red-400 text-xs">
                      {formatAmount(currentBalances.loan_balance)}
                    </div>
                  </div>
                  <div className="p-1.5 sm:p-2 bg-green-500/10 rounded border border-green-500/20">
                    <div className="text-muted-foreground text-xs">Loan CF</div>
                    <div className="font-medium text-green-400 text-xs">
                      {formatAmount(Math.max(0, loanCarryForward))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Advance Payment - Blue Border */}
            <div className="space-y-2 border-2 border-dashed border-blue-500/50 rounded-lg p-3 bg-blue-500/5">
              <Label htmlFor="advance-payment-amount" className="font-semibold text-blue-600 dark:text-blue-400">
                ⚡ Advance Payments (KES)
              </Label>
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
                  className="pr-10 text-sm"
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
                        className="h-6 w-6 hover:bg-accent"
                        type="button"
                      >
                        <Calculator className="h-3 w-3" />
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
                <div className="grid grid-cols-2 gap-1 sm:gap-2 text-xs">
                  <div className="p-1.5 sm:p-2 bg-muted/30 rounded border border-muted/50">
                    <div className="text-muted-foreground text-xs">Current Balance</div>
                    <div className="font-medium text-red-400 text-xs">
                      {formatAmount(currentBalances.advance_loan_balance)}
                    </div>
                  </div>
                  <div className="p-1.5 sm:p-2 bg-green-500/10 rounded border border-green-500/20">
                    <div className="text-muted-foreground text-xs">Advance CF</div>
                    <div className="font-medium text-green-400 text-xs">
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
                className="text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Other
              </Button>
            </div>

            <div className="space-y-3">
              {allocations.filter(a => a.type === 'other').map((allocation, index) => {
                const otherIndex = allocations.findIndex(a => a.type === 'other' && a === allocation);
                return (
                  <div key={index} className="p-3 border rounded-lg bg-background/50">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary" className="text-xs">
                        OTHER ALLOCATION
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAllocation(otherIndex)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                          className="text-sm"
                        />
                      </div>
                      
                      <div>
                        <Label className="text-xs">Reason</Label>
                        <Select
                          value={allocation.reason}
                          onValueChange={(value) => updateAllocation(otherIndex, { reason: value })}
                        >
                          <SelectTrigger className="text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {allocationReasons.map((reason) => (
                              <SelectItem key={reason} value={reason} className="text-sm">
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
          <div className="space-y-2 text-sm">
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
        </CardContent>
      </Card>

      {/* Fixed Action Buttons */}
      <div className="fixed bottom-4 left-4 right-4 sm:relative sm:bottom-auto sm:left-auto sm:right-auto flex gap-2 justify-between bg-background/80 backdrop-blur-sm p-2 rounded-lg border sm:bg-transparent sm:backdrop-blur-none sm:p-0 sm:border-0 mobile-fixed-nav">
        <div className="flex gap-2">
          {currentMemberIndex > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePrevious}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="h-3 w-3" />
              <span className="hidden sm:inline">Previous</span>
            </Button>
          )}
          {currentMemberIndex < groupMembers.length - 1 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSkip}
              className="flex items-center gap-1"
            >
              <SkipForward className="h-3 w-3" />
              <span className="hidden sm:inline">Skip</span>
            </Button>
          )}
        </div>
        <Button 
          variant="default" 
          size="sm" 
          onClick={handleSave} 
          disabled={isLoading || !hasValidData}
          className="flex items-center gap-2 min-w-[120px] justify-center"
        >
          <Save className="h-3 w-3 sm:h-4 sm:w-4" />
          {isLoading ? 'Saving...' : 'Save & Next'}
        </Button>
      </div>

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

export function QuickCollections({ onBack }: QuickCollectionsProps) {
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<MemberBalance[]>([]);

  const handleGroupSelect = (group: Group, members: MemberBalance[]) => {
    setSelectedGroup(group);
    setGroupMembers(members);
  };

  const handleBackToGroups = () => {
    setSelectedGroup(null);
    setGroupMembers([]);
  };

  return (
    <div className="p-2 sm:p-6 max-w-6xl mx-auto">
      {!selectedGroup ? (
        <GroupSelection onGroupSelect={handleGroupSelect} onBack={onBack} />
      ) : (
        <div className="max-h-screen overflow-y-auto">
          <CollectionForm 
            selectedGroup={selectedGroup} 
            groupMembers={groupMembers} 
            onBack={handleBackToGroups} 
          />
        </div>
      )}
    </div>
  );
}
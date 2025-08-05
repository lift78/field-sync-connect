import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Save } from 'lucide-react';
import { dbOperations, MemberBalance } from '@/lib/database';
import { useToast } from '@/hooks/use-toast';
import { MemberSearch } from './MemberSearch';
import { BalanceDisplay } from './BalanceDisplay';

interface Allocation {
  type: 'savings' | 'loan' | 'amount_for_advance_payment' | 'other';
  amount: number;
  reason?: string;
}

const allocationReasons = [
  'Lateness Fine',
  'Loan Processing Fees', 
  'Advocate Fees',
  'Insurance Risk Fund',
  'Contribution for Deceased',
  'Registration Fee',
  'Meeting Absence Fine',
  'Administrative Fees',
  'Custom (Other)'
];

const toPreciseNumber = (value: string | number): number => {
  if (typeof value === 'string') {
    if (value === '') return 0;
    const num = parseFloat(value);
    if (isNaN(num)) return 0;
    return Math.round(num * 100) / 100;
  }
  return Math.round(value * 100) / 100;
};

export function CashCollectionForm() {
  const [selectedMember, setSelectedMember] = useState<MemberBalance | null>(null);
  const [cashAmount, setCashAmount] = useState('');
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const { toast } = useToast();

  const cashAmountNum = toPreciseNumber(cashAmount);
  const mpesaAmountNum = toPreciseNumber(mpesaAmount);
  const totalCollected = toPreciseNumber(cashAmountNum + mpesaAmountNum);
  const totalAllocated = toPreciseNumber(
    allocations.reduce((sum, alloc) => sum + alloc.amount, 0)
  );
  const remainingAmount = toPreciseNumber(totalCollected - totalAllocated);

  const hasValidData = selectedMember && (totalCollected > 0 || totalAllocated > 0);

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getSavingsAllocation = () => allocations.find(a => a.type === 'savings')?.amount || 0;
  const getLoanAllocation = () => allocations.find(a => a.type === 'loan')?.amount || 0;
  const getAdvanceAllocation = () => allocations.find(a => a.type === 'amount_for_advance_payment')?.amount || 0;

  const handleSave = async () => {
    try {
      if (!selectedMember) {
        toast({
          title: "❌ Member Required",
          description: "Please select a member first",
          variant: "destructive"
        });
        return;
      }

      const formattedAllocations = allocations
        .filter(allocation => allocation.amount > 0)
        .map(allocation => ({
          memberId: selectedMember.member_id,
          type: allocation.type,
          amount: allocation.amount,
          reason: allocation.reason
        }));

      await dbOperations.addCashCollection({
        memberId: selectedMember.member_id,
        memberName: selectedMember.name,
        totalAmount: totalCollected,
        cashAmount: cashAmountNum,
        mpesaAmount: mpesaAmountNum,
        allocations: formattedAllocations,
        timestamp: new Date()
      });
      
      toast({
        title: "✅ Cash Collection Saved",
        description: `${formatAmount(totalCollected)} saved for ${selectedMember.name}`,
      });
      
      // Reset form
      setSelectedMember(null);
      setCashAmount('');
      setMpesaAmount('');
      setAllocations([]);
    } catch (error) {
      toast({
        title: "❌ Save Failed",
        description: "Failed to save cash collection",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Member Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Member Identification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <MemberSearch
            onMemberSelect={setSelectedMember}
            selectedMember={selectedMember}
          />
          
          {selectedMember && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <BalanceDisplay
                label="Savings"
                currentBalance={selectedMember.balances.savings_balance}
                newAmount={getSavingsAllocation()}
                type="savings"
              />
              <BalanceDisplay
                label="Loan Balance" 
                currentBalance={selectedMember.balances.loan_balance}
                newAmount={getLoanAllocation()}
                type="loan"
              />
              <BalanceDisplay
                label="Advance Balance"
                currentBalance={selectedMember.balances.advance_loan_balance}
                newAmount={getAdvanceAllocation()}
                type="advance"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cash Collection */}
      <Card>
        <CardHeader>
          <CardTitle>Cash Collection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cash-amount">Cash Amount (KES)</Label>
              <Input
                id="cash-amount"
                type="number"
                step="0.01"
                placeholder="0"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="mpesa-amount">M-Pesa Amount (KES)</Label>
              <Input
                id="mpesa-amount"
                type="number"
                step="0.01"
                placeholder="0"
                value={mpesaAmount}
                onChange={(e) => setMpesaAmount(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button 
        variant="default" 
        onClick={handleSave}
        disabled={!hasValidData}
        className="w-full"
      >
        <Save className="h-5 w-5 mr-2" />
        Save Record
      </Button>
    </div>
  );
}
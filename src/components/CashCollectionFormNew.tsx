import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Save, Calculator } from 'lucide-react';
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

      if (totalCollected === 0 && totalAllocated === 0) {
        toast({
          title: "❌ No Data to Save", 
          description: "Please enter collection amounts or allocations",
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
        description: `${formatAmount(totalCollected)} saved for ${selectedMember.name}${
          cashAmountNum > 0 ? ' (Cash reference generated)' : ''
        }`,
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

  const getSavingsAllocation = () => allocations.find(a => a.type === 'savings')?.amount || 0;
  const getLoanAllocation = () => allocations.find(a => a.type === 'loan')?.amount || 0;
  const getAdvanceAllocation = () => allocations.find(a => a.type === 'amount_for_advance_payment')?.amount || 0;

  return (
    <div className="space-y-6">
      {/* Member Selection */}
      <Card className="shadow-card bg-gradient-card">
        <CardHeader>
          <CardTitle className="text-lg">Member Identification</CardTitle>
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
      <Card className="shadow-card bg-gradient-card">
        <CardHeader>
          <CardTitle className="text-lg">Cash Collection</CardTitle>
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
              {cashAmountNum > 0 && (
                <p className="text-xs text-muted-foreground">
                  📄 Cash reference will be generated automatically
                </p>
              )}
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

          <div className="p-4 bg-primary/10 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium">Amount to Allocate:</span>
              <span className="text-xl font-bold text-primary">
                {formatAmount(totalCollected)}
              </span>
            </div>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="savings-amount">Allocate to Savings (KES)</Label>
              <Input
                id="savings-amount"
                type="number"
                step="0.01"
                placeholder="0"
                value={getSavingsAllocation() || ''}
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
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="loan-amount">Pay Loan Installments (KES)</Label>
              <Input
                id="loan-amount"
                type="number"
                step="0.01"
                placeholder="0"
                value={getLoanAllocation() || ''}
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
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="advance-payment-amount">Advance Payments (KES)</Label>
              <Input
                id="advance-payment-amount"
                type="number"
                step="0.01"
                placeholder="0"
                value={getAdvanceAllocation() || ''}
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
              />
            </div>
          </div>

          {/* Other Allocations */}
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
                      <Badge variant="secondary">OTHER ALLOCATION</Badge>
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
            variant="default" 
            size="default" 
            onClick={handleSave}
            disabled={!hasValidData}
            className="w-full"
          >
            <Save className="h-5 w-5 mr-2" />
            Save Record
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

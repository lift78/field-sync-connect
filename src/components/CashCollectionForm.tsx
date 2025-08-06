import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Save, UserPlus } from 'lucide-react';
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
  const [manualEntry, setManualEntry] = useState(false);
  const [manualMemberData, setManualMemberData] = useState({
    memberId: '',
    memberName: '',
    phone: ''
  });
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

  const hasValidData = (selectedMember || (manualEntry && manualMemberData.memberId && manualMemberData.memberName)) && (totalCollected > 0 || totalAllocated > 0);

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
      const memberData = selectedMember || {
        member_id: manualMemberData.memberId,
        name: manualMemberData.memberName,
        phone: manualMemberData.phone
      };

      if (!memberData.member_id || !memberData.name) {
        toast({
          title: "❌ Member Information Required",
          description: "Please select a member or enter member details",
          variant: "destructive"
        });
        return;
      }

      const formattedAllocations = allocations
        .filter(allocation => allocation.amount > 0)
        .map(allocation => ({
          memberId: memberData.member_id,
          type: allocation.type,
          amount: allocation.amount,
          reason: allocation.reason
        }));

      await dbOperations.addCashCollection({
        memberId: memberData.member_id,
        memberName: memberData.name,
        totalAmount: totalCollected,
        cashAmount: cashAmountNum,
        mpesaAmount: mpesaAmountNum,
        allocations: formattedAllocations,
        timestamp: new Date()
      });
      
      toast({
        title: "✅ Cash Collection Saved",
        description: `${formatAmount(totalCollected)} saved for ${memberData.name}`,
      });
      
      // Reset form
      setSelectedMember(null);
      setManualEntry(false);
      setManualMemberData({ memberId: '', memberName: '', phone: '' });
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
          <div className="flex items-center justify-between">
            <CardTitle>Member Identification</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setManualEntry(!manualEntry);
                setSelectedMember(null);
                setManualMemberData({ memberId: '', memberName: '', phone: '' });
              }}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {manualEntry ? 'Search Members' : 'Manual Entry'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!manualEntry ? (
            <>
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
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="member-id">Member ID</Label>
                <Input
                  id="member-id"
                  placeholder="e.g., MEM/2024/0001"
                  value={manualMemberData.memberId}
                  onChange={(e) => setManualMemberData(prev => ({ ...prev, memberId: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-name">Member Name</Label>
                <Input
                  id="member-name"
                  placeholder="Full name"
                  value={manualMemberData.memberName}
                  onChange={(e) => setManualMemberData(prev => ({ ...prev, memberName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-phone">Phone Number</Label>
                <Input
                  id="member-phone"
                  placeholder="+254..."
                  value={manualMemberData.phone}
                  onChange={(e) => setManualMemberData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
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

          {totalCollected > 0 && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="font-medium">Total Collected:</span>
              <span className="font-bold text-lg">{formatAmount(totalCollected)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Allocations */}
      {totalCollected > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Fund Allocation</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAllocations([...allocations, { type: 'savings', amount: 0 }]);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Allocation
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {allocations.map((allocation, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-3 border rounded-lg">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={allocation.type}
                    onValueChange={(value) => {
                      const newAllocations = [...allocations];
                      newAllocations[index].type = value as Allocation['type'];
                      setAllocations(newAllocations);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="savings">Savings</SelectItem>
                      <SelectItem value="loan">Loan Payment</SelectItem>
                      <SelectItem value="amount_for_advance_payment">Advance Payment</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Amount (KES)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={allocation.amount || ''}
                    onChange={(e) => {
                      const newAllocations = [...allocations];
                      newAllocations[index].amount = toPreciseNumber(e.target.value);
                      setAllocations(newAllocations);
                    }}
                  />
                </div>

                {allocation.type === 'other' && (
                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Select
                      value={allocation.reason || ''}
                      onValueChange={(value) => {
                        const newAllocations = [...allocations];
                        newAllocations[index].reason = value;
                        setAllocations(newAllocations);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select reason" />
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
                )}

                <div className="flex items-end">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setAllocations(allocations.filter((_, i) => i !== index));
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {allocations.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span>Total Allocated:</span>
                  <span className="font-medium">{formatAmount(totalAllocated)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Remaining Amount:</span>
                  <span className={`font-medium ${remainingAmount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatAmount(remainingAmount)}
                  </span>
                </div>
                {remainingAmount < 0 && (
                  <div className="text-sm text-red-600">
                    ⚠️ Allocation exceeds collected amount
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save } from "lucide-react";
import { dbOperations } from "@/lib/database";
import { useToast } from "@/hooks/use-toast";
import { AdvanceCalculatorDialog } from "./AdvanceCalculator";
import { Calculator } from "lucide-react";

// Mock member data - replace with actual member data from your system
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
  'Loan Processing Fees',
  'Advocate Fees',
  'Insurance Risk Fund',
  'Contribution for Deceased',
  'Registration Fee',
  'Meeting Absence Fine',
  'Administrative Fees',
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

export function CashCollectionForm() {
  const [memberId, setMemberId] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
  const { toast } = useToast();

  // Filter members based on search query
  const filteredMembers = useMemo(() => {
    if (!memberQuery) return [];
    
    const query = memberQuery.trim();
    
    // If input is numeric, handle ID searching
    if (/^\d+$/.test(query)) {
      const results = [];
      
      // 1. Try exact padded match first (e.g., "345" -> "0345")
      const paddedId = query.padStart(4, '0');
      const exactMatch = mockMembers.find(member => member.id === paddedId);
      if (exactMatch) {
        results.push(exactMatch);
      }
      
      // 2. If no exact match and query is shorter than 4 digits, 
      //    also search for IDs that start with the query
      if (!exactMatch && query.length < 4) {
        const startMatches = mockMembers.filter(member => 
          member.id.startsWith(query.padStart(query.length, '0'))
        ).slice(0, 5);
        results.push(...startMatches);
      }
      
      // 3. If query is 4+ digits and no exact match, search for partial matches
      if (!exactMatch && query.length >= 4) {
        const partialMatches = mockMembers.filter(member => 
          member.id.includes(query) || member.id === query
        ).slice(0, 5);
        results.push(...partialMatches);
      }
      
      return results;
    }
    
    // If input contains letters, search by name
    return mockMembers.filter(member => 
      member.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);
  }, [memberQuery]);

  const selectedMember = mockMembers.find(m => m.id === memberId);

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

  const handleSave = async () => {
    try {
      const selectedMemberData = mockMembers.find(m => m.id === memberId);
      if (!selectedMemberData) {
        toast({
          title: "❌ Member Required",
          description: "Please select a member first",
          variant: "destructive"
        });
        return;
      }

      // Validate that we have either collection amounts or allocations
      if (totalCollected === 0 && totalAllocated === 0) {
        toast({
          title: "❌ No Data to Save",
          description: "Please enter collection amounts or allocations",
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
        memberName: selectedMemberData.name,
        totalAmount: totalCollected,
        cashAmount: cashAmountNum,
        mpesaAmount: mpesaAmountNum,
        allocations: formattedAllocations,
        timestamp: new Date()
      });
      
      toast({
        title: "✅ Cash Collection Saved",
        description: `${formatAmount(totalCollected)} saved for ${selectedMemberData.name}${
          cashAmountNum > 0 ? ' (Cash reference generated)' : ''
        }`,
      });
      
      // Reset form
      setMemberId('');
      setCashAmount('');
      setMpesaAmount('');
      setAllocations([]);
      setMemberQuery('');
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
      <Card className="shadow-card bg-gradient-card">
        <CardHeader>
          <CardTitle className="text-lg">Member Identification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="member-search">Search Member ID or Name</Label>
            <Input
              id="member-search"
              placeholder="Type member ID or name..."
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
            />
          </div>
          
          {memberQuery && (
            <div className="space-y-2">
              <Label>Select Member</Label>
              <div className="grid gap-2 max-h-48 overflow-y-auto">
                {filteredMembers.map((member) => (
                  <Button
                    key={member.id}
                    variant={memberId === member.id ? "default" : "outline"}
                    onClick={() => {
                      setMemberId(member.id);
                      setMemberQuery('');
                    }}
                    className="justify-start"
                  >
                    {member.id} - {member.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {selectedMember && (
            <div className="p-3 bg-success/10 rounded-lg border border-success/20">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-success">Selected Member:</p>
                  <p className="text-sm">{selectedMember.id} - {selectedMember.name}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMemberId('');
                    setMemberQuery('');
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  ×
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
          {/* Core Allocation Fields - Always Visible */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="loan-amount">Pay Loan Installments (KES)</Label>
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
                  className="pr-12" // Add padding for the calculator button
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
    </div>
  );
}  
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

// Mock member data - replace with actual member data from your system
const mockMembers = Array.from({ length: 50 }, (_, i) => ({
  id: String(i + 1).padStart(4, '0'),
  name: `Member ${i + 1}`,
}));

interface Allocation {
  id: string;
  type: 'savings' | 'loan' | 'advance' | 'advance-interest' | 'other';
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

export function CashCollectionForm() {
  const [memberId, setMemberId] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
  const { toast } = useToast();

  // Filter members based on search query
  const filteredMembers = useMemo(() => {
    if (!memberQuery) return mockMembers.slice(0, 10);
    return mockMembers.filter(member => 
      member.id.includes(memberQuery) || 
      member.name.toLowerCase().includes(memberQuery.toLowerCase())
    ).slice(0, 10);
  }, [memberQuery]);

  const selectedMember = mockMembers.find(m => m.id === memberId);

  const totalCollected = (parseFloat(cashAmount) || 0) + (parseFloat(mpesaAmount) || 0);
  const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
  const remainingAmount = totalCollected - totalAllocated;

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const addAllocation = (type: Allocation['type']) => {
    const newAllocation: Allocation = {
      id: Date.now().toString(),
      type,
      amount: 0,
      reason: type === 'other' ? allocationReasons[0] : undefined,
    };
    setAllocations([...allocations, newAllocation]);
  };

  const updateAllocation = (id: string, updates: Partial<Allocation>) => {
    setAllocations(allocations.map(alloc => 
      alloc.id === id ? { ...alloc, ...updates } : alloc
    ));
  };

  const removeAllocation = (id: string) => {
    setAllocations(allocations.filter(alloc => alloc.id !== id));
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

      await dbOperations.addCashCollection({
        memberId,
        memberName: selectedMemberData.name,
        amount: totalCollected,
        timestamp: new Date()
      });
      
      toast({
        title: "✅ Cash Collection Saved",
        description: `${formatAmount(totalCollected)} saved for ${selectedMemberData.name}`,
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
              <p className="font-medium text-success">Selected Member:</p>
              <p className="text-sm">{selectedMember.id} - {selectedMember.name}</p>
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
                placeholder="0"
                value={mpesaAmount}
                onChange={(e) => setMpesaAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="p-4 bg-primary/10 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Amount to Allocate:</span>
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
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Core Allocation Fields - Always Visible */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="savings-amount">Allocate to Savings (KES)</Label>
              <Input
                id="savings-amount"
                type="number"
                placeholder="0"
                value={allocations.find(a => a.type === 'savings')?.amount || ''}
                 onChange={(e) => {
                   const value = e.target.value;
                   const amount = value === '' ? 0 : parseFloat(value);
                   const existing = allocations.find(a => a.type === 'savings');
                   if (existing) {
                     updateAllocation(existing.id, { amount });
                   } else if (amount > 0) {
                     const newAllocation: Allocation = {
                       id: Date.now().toString(),
                       type: 'savings',
                       amount
                     };
                     setAllocations(prev => [...prev, newAllocation]);
                   }
                 }}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="loan-amount">Pay Loan Installments (KES)</Label>
              <Input
                id="loan-amount"
                type="number"
                placeholder="0"
                value={allocations.find(a => a.type === 'loan')?.amount || ''}
                 onChange={(e) => {
                   const value = e.target.value;
                   const amount = value === '' ? 0 : parseFloat(value);
                   const existing = allocations.find(a => a.type === 'loan');
                   if (existing) {
                     updateAllocation(existing.id, { amount });
                   } else if (amount > 0) {
                     const newAllocation: Allocation = {
                       id: Date.now().toString(),
                       type: 'loan',
                       amount
                     };
                     setAllocations(prev => [...prev, newAllocation]);
                   }
                 }}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="advance-amount">Pay Advance (KES)</Label>
              <Input
                id="advance-amount"
                type="number"
                placeholder="0"
                value={allocations.find(a => a.type === 'advance')?.amount || ''}
                 onChange={(e) => {
                   const value = e.target.value;
                   const amount = value === '' ? 0 : parseFloat(value);
                   const existing = allocations.find(a => a.type === 'advance');
                   if (existing) {
                     updateAllocation(existing.id, { amount });
                   } else if (amount > 0) {
                     const newAllocation: Allocation = {
                       id: Date.now().toString(),
                       type: 'advance',
                       amount
                     };
                     setAllocations(prev => [...prev, newAllocation]);
                   }
                 }}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="advance-interest-amount">Pay Advance Interest (KES)</Label>
              <Input
                id="advance-interest-amount"
                type="number"
                placeholder="0"
                value={allocations.find(a => a.type === 'advance-interest')?.amount || ''}
                 onChange={(e) => {
                   const value = e.target.value;
                   const amount = value === '' ? 0 : parseFloat(value);
                   const existing = allocations.find(a => a.type === 'advance-interest');
                   if (existing) {
                     updateAllocation(existing.id, { amount });
                   } else if (amount > 0) {
                     const newAllocation: Allocation = {
                       id: Date.now().toString(),
                       type: 'advance-interest',
                       amount
                     };
                     setAllocations(prev => [...prev, newAllocation]);
                   }
                 }}
              />
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
            {allocations.filter(a => a.type === 'other').map((allocation) => (
              <div key={allocation.id} className="p-3 border rounded-lg bg-background/50">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="secondary">
                    {allocation.type.replace('-', ' ').toUpperCase()}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAllocation(allocation.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Amount (KES)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={allocation.amount || ''}
                       onChange={(e) => {
                         const value = e.target.value;
                         updateAllocation(allocation.id, {
                           amount: value === '' ? 0 : parseFloat(value)
                         });
                       }}
                    />
                  </div>
                  
                  {allocation.type === 'other' && (
                    <div>
                      <Label className="text-xs">Reason</Label>
                      <Select
                        value={allocation.reason}
                        onValueChange={(value) => updateAllocation(allocation.id, { reason: value })}
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
                  )}
                </div>
              </div>
            ))}
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
            disabled={!memberId || totalCollected === 0}
            className="w-full"
          >
            <Save className="h-5 w-5 mr-2" />
            Save Transaction
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
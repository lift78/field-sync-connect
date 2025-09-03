import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { dbOperations, MemberBalance, Allocation } from "@/lib/database";
import { useToast } from "@/hooks/use-toast";
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
  ArrowLeft
} from "lucide-react";

interface Group {
  id: string;
  name: string;
  memberCount: number;
}

interface QuickCollectionsProps {
  onBack: () => void;
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
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Loading groups...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Quick Collections</h1>
          <p className="text-muted-foreground">Select a group to start collecting from members</p>
        </div>
      </div>

      {/* Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((group) => (
          <Card key={group.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleGroupSelect(group)}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  {group.name}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {group.memberCount} members
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {groups.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Groups Found</h3>
            <p className="text-muted-foreground">
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
  const { toast } = useToast();

  const currentMember = groupMembers[currentMemberIndex];

  const resetForm = () => {
    setCashAmount('');
    setMpesaAmount('');
    setAllocations([]);
  };

  const totalCollected = toPreciseNumber(cashAmount) + toPreciseNumber(mpesaAmount);
  const totalAllocated = allocations.reduce((sum, allocation) => sum + toPreciseNumber(allocation.amount), 0);
  const remainingAmount = toPreciseNumber(totalCollected - totalAllocated);

  const addAllocation = () => {
    setAllocations([...allocations, { type: 'savings', amount: 0, memberId: currentMember?.member_id || '' }]);
  };

  const updateAllocation = (index: number, field: keyof Allocation, value: any) => {
    const updated = allocations.map((allocation, i) => 
      i === index ? { ...allocation, [field]: value } : allocation
    );
    setAllocations(updated);
  };

  const removeAllocation = (index: number) => {
    setAllocations(allocations.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!currentMember) return;
    
    if (totalCollected <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid collection amount",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const collectionData = {
        memberId: currentMember.member_id,
        memberName: currentMember.name,
        totalAmount: totalCollected,
        cashAmount: toPreciseNumber(cashAmount),
        mpesaAmount: toPreciseNumber(mpesaAmount),
        allocationId: `ALLOC-${Date.now()}-${currentMember.member_id}`,
        allocations: allocations.map(allocation => ({
          ...allocation,
          amount: toPreciseNumber(allocation.amount),
          memberId: currentMember.member_id
        })),
        timestamp: new Date(),
        synced: false,
        syncStatus: 'pending' as const
      };

      await dbOperations.addCashCollection(collectionData);
      
      toast({
        title: "Collection Saved",
        description: `Collection for ${currentMember.name} saved successfully`,
      });

      // Move to next member or finish
      if (currentMemberIndex < groupMembers.length - 1) {
        setCurrentMemberIndex(currentMemberIndex + 1);
        resetForm();
      } else {
        toast({
          title: "Group Complete",
          description: `All collections for ${selectedGroup.name} completed!`,
        });
        onBack();
      }
    } catch (error) {
      console.error('Error saving collection:', error);
      toast({
        title: "Error",
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
    }
  };

  const handleSkip = () => {
    if (currentMemberIndex < groupMembers.length - 1) {
      setCurrentMemberIndex(currentMemberIndex + 1);
      resetForm();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Groups
        </Button>
        <Badge variant="outline">
          {currentMemberIndex + 1} of {groupMembers.length}
        </Badge>
      </div>

      {/* Member Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Member Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{currentMember.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{currentMember.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Group</p>
                <p className="font-medium">{selectedGroup.name}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Collection Input */}
      <Card>
        <CardHeader>
          <CardTitle>Collection Amount</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cash" className="flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Cash Amount (KES)
              </Label>
              <Input
                id="cash"
                type="number"
                step="0.01"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mpesa" className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                M-Pesa Amount (KES)
              </Label>
              <Input
                id="mpesa"
                type="number"
                step="0.01"
                value={mpesaAmount}
                onChange={(e) => setMpesaAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="text-lg font-semibold">
            Total Collected: KES {totalCollected.toLocaleString()}
          </div>
        </CardContent>
      </Card>

      {/* Allocations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Member Allocations
            <Button onClick={addAllocation} size="sm" className="flex items-center gap-1">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {allocations.map((allocation, index) => (
            <div key={index} className="flex gap-2 items-end">
              <div className="flex-1">
                <Label>Type</Label>
                <Select
                  value={allocation.type}
                  onValueChange={(value: any) => updateAllocation(index, 'type', value)}
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
              <div className="flex-1">
                <Label>Amount (KES)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={allocation.amount}
                  onChange={(e) => updateAllocation(index, 'amount', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              {allocation.type === 'other' && (
                <div className="flex-1">
                  <Label>Reason</Label>
                  <Select
                    value={allocation.reason || ''}
                    onValueChange={(value) => updateAllocation(index, 'reason', value)}
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeAllocation(index)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Collected</p>
              <p className="text-lg font-semibold text-green-600">
                KES {totalCollected.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Allocated</p>
              <p className="text-lg font-semibold text-blue-600">
                KES {totalAllocated.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Remaining</p>
              <p className={`text-lg font-semibold ${remainingAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                KES {remainingAmount.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-2 justify-between">
        <div className="flex gap-2">
          {currentMemberIndex > 0 && (
            <Button variant="outline" onClick={handlePrevious}>
              Previous Member
            </Button>
          )}
          {currentMemberIndex < groupMembers.length - 1 && (
            <Button variant="outline" onClick={handleSkip}>
              Skip Member
            </Button>
          )}
        </div>
        <Button 
          onClick={handleSave} 
          disabled={isLoading || totalCollected <= 0}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {isLoading ? 'Saving...' : 'Save & Next'}
        </Button>
      </div>
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
    <div className="p-6 max-w-6xl mx-auto">
      {!selectedGroup ? (
        <GroupSelection onGroupSelect={handleGroupSelect} onBack={onBack} />
      ) : (
        <CollectionForm 
          selectedGroup={selectedGroup} 
          groupMembers={groupMembers} 
          onBack={handleBackToGroups} 
        />
      )}
    </div>
  );
}
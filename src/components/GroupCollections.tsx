import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, Users, AlertTriangle, Banknote, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { dbOperations, MemberBalance } from "@/lib/database";

interface GroupCollectionsProps {
  realMembers: MemberBalance[];
  onSuccess?: () => void;
}

export function GroupCollections({ realMembers, onSuccess }: GroupCollectionsProps) {
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedGroupName, setSelectedGroupName] = useState('');
  const [groupQuery, setGroupQuery] = useState('');
  const [cashCollectedAmount, setCashCollectedAmount] = useState('');
  const [finesCollectedAmount, setFinesCollectedAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Get unique groups from real members data
  const availableGroups = useMemo(() => {
    if (!realMembers.length) return [];
    
    const groupsMap = new Map();
    realMembers.forEach(member => {
      if (member.group_name && member.group_id && !groupsMap.has(member.group_name)) {
        groupsMap.set(member.group_name, {
          name: member.group_name,
          id: member.group_id.toString()
        });
      }
    });
    
    return Array.from(groupsMap.values());
  }, [realMembers]);

  // Show all groups or filter based on search query
  const filteredGroups = useMemo(() => {
    if (!groupQuery) return availableGroups; // Show all groups initially
    
    const query = groupQuery.trim().toLowerCase();
    return availableGroups.filter(group => 
      group.name.toLowerCase().includes(query)
    );
  }, [groupQuery, availableGroups]);

  const handleGroupSelect = (group: any) => {
    setSelectedGroupId(group.id);
    setSelectedGroupName(group.name);
    setGroupQuery(group.name);
  };

  const clearGroupSelection = () => {
    setSelectedGroupId('');
    setSelectedGroupName('');
    setGroupQuery('');
  };

  const handleSave = async () => {
    try {
      if (!selectedGroupId || !selectedGroupName) {
        toast({
          title: "Group Required",
          description: "Please select a group first",
          variant: "destructive"
        });
        return;
      }

      const cashAmount = parseFloat(cashCollectedAmount) || 0;
      const finesAmount = parseFloat(finesCollectedAmount) || 0;

      if (cashAmount <= 0 && finesAmount <= 0) {
        toast({
          title: "Amount Required",
          description: "Please enter at least one collection amount",
          variant: "destructive"
        });
        return;
      }

      setIsSubmitting(true);

      // Save to group collections
      await dbOperations.addGroupCollection({
        groupId: selectedGroupId,
        groupName: selectedGroupName,
        cashCollected: cashAmount,
        finesCollected: finesAmount,
        timestamp: new Date()
      });

      toast({
        title: "Collections Recorded",
        description: `Collections saved for ${selectedGroupName}`,
      });

      // Reset form
      setSelectedGroupId('');
      setSelectedGroupName('');
      setGroupQuery('');
      setCashCollectedAmount('');
      setFinesCollectedAmount('');
      
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save group collections",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const totalAmount = (parseFloat(cashCollectedAmount) || 0) + (parseFloat(finesCollectedAmount) || 0);

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Group Collections</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Record cash and fines collected from the group
        </p>
      </div>

      {/* Group Selection */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Select Group
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selectedGroupId ? (
            <>
              <Input
                placeholder="Search groups (optional)..."
                value={groupQuery}
                onChange={(e) => setGroupQuery(e.target.value)}
                className="w-full"
              />
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {filteredGroups.length > 0 ? (
                  filteredGroups.map((group, index) => (
                    <Button
                      key={`${group.id}-${index}`}
                      variant="outline"
                      onClick={() => handleGroupSelect(group)}
                      className="w-full justify-start p-3 h-auto text-left hover:border-primary"
                    >
                      <div className="flex flex-col items-start w-full">
                        <span className="font-medium">{group.name}</span>
                        <span className="text-xs text-muted-foreground">ID: {group.id}</span>
                      </div>
                    </Button>
                  ))
                ) : (
                  <div className="text-center py-3 text-muted-foreground text-sm">
                    No groups found matching "{groupQuery}"
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{selectedGroupName}</span>
                  <div className="text-xs text-muted-foreground">ID: {selectedGroupId}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearGroupSelection}
                  className="text-muted-foreground hover:text-destructive"
                >
                  Change
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Collection Amounts */}
      {selectedGroupId && (
        <div className="space-y-4">
          {/* Cash Collection */}
          <Card className="shadow-sm border-l-4 border-l-green-500">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Banknote className="h-4 w-4 text-green-600" />
                <Label className="text-sm font-medium">Cash Collected</Label>
              </div>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={cashCollectedAmount}
                onChange={(e) => setCashCollectedAmount(e.target.value)}
                className="mb-2"
              />
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded border">
                <AlertCircle className="h-3 w-3 inline mr-1" />
                Requires chairperson validation
              </div>
            </CardContent>
          </Card>

          {/* Fines Collection */}
          <Card className="shadow-sm border-l-4 border-l-orange-500">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <Label className="text-sm font-medium">Fines & Penalties</Label>
              </div>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={finesCollectedAmount}
                onChange={(e) => setFinesCollectedAmount(e.target.value)}
                className="mb-2"
              />
              <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded border">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                Don't include M-Pesa fines
              </div>
            </CardContent>
          </Card>

          {/* Summary & Save */}
          {totalAmount > 0 && (
            <Card className="shadow-sm bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Collections:</span>
                    <span className="text-xl font-bold text-primary">
                      {formatAmount(totalAmount)}
                    </span>
                  </div>
                  
                  {(parseFloat(cashCollectedAmount) || 0) > 0 && (parseFloat(finesCollectedAmount) || 0) > 0 && (
                    <div className="pt-2 border-t border-primary/20 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Cash:</span>
                        <span>{formatAmount(parseFloat(cashCollectedAmount) || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fines:</span>
                        <span>{formatAmount(parseFloat(finesCollectedAmount) || 0)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Save Button */}
          <Button 
            onClick={handleSave}
            disabled={!selectedGroupId || totalAmount <= 0 || isSubmitting}
            className="w-full h-12 text-lg font-medium"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" />
                Record Collections
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
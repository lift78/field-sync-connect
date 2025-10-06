import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, Banknote, AlertTriangle, ArrowLeft, TrendingUp, Coins, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { dbOperations } from "@/lib/database";
import { useEffect } from "react";
import { GroupMemberRecords } from "./GroupMemberRecords";

interface GroupSummaryData {
  groupId: string;
  groupName: string;
  totalCash: number;
  totalMpesa: number;
  totalAdvances: number;
  totalLoans: number;
  totalFines: number;
  netCashRemitted: number;
}

export function GroupSummary({ onBack, onEditRecord }: { onBack?: () => void; onEditRecord?: (record: any) => void }) {
  const [groupsSummary, setGroupsSummary] = useState<GroupSummaryData[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupSummaryData | null>(null);
  const [finesAmount, setFinesAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFinesInput, setShowFinesInput] = useState(false);
  const [showMemberRecords, setShowMemberRecords] = useState(false);
  const [groupsWithExistingRecords, setGroupsWithExistingRecords] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const loadGroupsSummary = async () => {
    try {
      // Get all unsynced records
      const cashCollections = await dbOperations.getUnsyncedCashCollections();
      const advanceLoans = await dbOperations.getUnsyncedAdvanceLoans();
      const loanDisbursements = await dbOperations.getUnsyncedLoanDisbursements();
      const groupCollections = await dbOperations.getUnsyncedGroupCollections();
      
      // Track which groups already have existing records
      const existingRecordsSet = new Set<string>();
      groupCollections.forEach(collection => {
        existingRecordsSet.add(collection.groupId);
      });
      setGroupsWithExistingRecords(existingRecordsSet);
      
      // Get member balances to map members to groups
      const members = await dbOperations.getAllMembers();
      
      // Create a map of member_id to group info
      const memberGroupMap = new Map();
      members.forEach(member => {
        // Extract the numeric ID from formats like "MEM/2025/1182"
        const parts = member.member_id.split('/');
        const memberId = parts[parts.length - 1] || member.member_id;
        memberGroupMap.set(memberId, {
          groupId: member.group_id.toString(),
          groupName: member.group_name
        });
      });
      
      // Group data by group
      const groupsMap = new Map<string, GroupSummaryData>();
      
      // Process cash collections
      cashCollections.forEach(collection => {
        const groupInfo = memberGroupMap.get(collection.memberId);
        if (!groupInfo) return;
        
        if (!groupsMap.has(groupInfo.groupId)) {
          groupsMap.set(groupInfo.groupId, {
            groupId: groupInfo.groupId,
            groupName: groupInfo.groupName,
            totalCash: 0,
            totalMpesa: 0,
            totalAdvances: 0,
            totalLoans: 0,
            totalFines: 0,
            netCashRemitted: 0
          });
        }
        
        const group = groupsMap.get(groupInfo.groupId)!;
        group.totalCash += collection.cashAmount || 0;
        group.totalMpesa += collection.mpesaAmount || 0;
      });
      
      // Process advance loans
      advanceLoans.forEach(advance => {
        const groupInfo = memberGroupMap.get(advance.memberId);
        if (!groupInfo) return;
        
        if (!groupsMap.has(groupInfo.groupId)) {
          groupsMap.set(groupInfo.groupId, {
            groupId: groupInfo.groupId,
            groupName: groupInfo.groupName,
            totalCash: 0,
            totalMpesa: 0,
            totalAdvances: 0,
            totalLoans: 0,
            totalFines: 0,
            netCashRemitted: 0
          });
        }
        
        const group = groupsMap.get(groupInfo.groupId)!;
        group.totalAdvances += advance.amount || 0;
      });
      
      // Process loan disbursements
      const loans = await dbOperations.getAllLoans();
      loanDisbursements.forEach(disbursement => {
        const loan = loans.find(l => l.loan_id === disbursement.loan_id);
        if (!loan) return;
        
        const groupId = loan.group.id.toString();
        
        if (!groupsMap.has(groupId)) {
          groupsMap.set(groupId, {
            groupId: groupId,
            groupName: loan.group.name,
            totalCash: 0,
            totalMpesa: 0,
            totalAdvances: 0,
            totalLoans: 0,
            totalFines: 0,
            netCashRemitted: 0
          });
        }
        
        const group = groupsMap.get(groupId)!;
        group.totalLoans += loan.principalAmount || 0;
      });
      
      // Process group collections (fines)
      groupCollections.forEach(collection => {
        if (!groupsMap.has(collection.groupId)) {
          groupsMap.set(collection.groupId, {
            groupId: collection.groupId,
            groupName: collection.groupName,
            totalCash: 0,
            totalMpesa: 0,
            totalAdvances: 0,
            totalLoans: 0,
            totalFines: 0,
            netCashRemitted: 0
          });
        }
        
        const group = groupsMap.get(collection.groupId)!;
        group.totalFines += collection.finesCollected || 0;
      });
      
      // Calculate net cash remitted for each group
      groupsMap.forEach(group => {
        group.netCashRemitted = (group.totalCash + group.totalFines) - group.totalAdvances;
      });
      
      setGroupsSummary(Array.from(groupsMap.values()));
    } catch (error) {
      console.error('Error loading groups summary:', error);
      toast({
        title: "Error",
        description: "Failed to load groups summary",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    loadGroupsSummary();
  }, []);

  const handleAddFines = async () => {
    if (!selectedGroup) return;
    
    const finesAmountNum = parseFloat(finesAmount) || 0;
    
    if (finesAmountNum <= 0) {
      toast({
        title: "Amount Required",
        description: "Please enter a valid fines amount",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await dbOperations.addGroupCollection({
        groupId: selectedGroup.groupId,
        groupName: selectedGroup.groupName,
        cashCollected: 0,
        finesCollected: finesAmountNum,
        timestamp: new Date()
      });
      
      toast({
        title: "Fines Recorded",
        description: `Fines of KES ${finesAmountNum.toFixed(2)} recorded for ${selectedGroup.groupName}`,
      });
      
      setFinesAmount('');
      setShowFinesInput(false);
      setSelectedGroup(null);
      loadGroupsSummary();
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save fines",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewRecords = (group: GroupSummaryData) => {
    setSelectedGroup(group);
    setShowMemberRecords(true);
  };

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Show member records view
  if (selectedGroup && showMemberRecords) {
    return (
      <GroupMemberRecords
        groupId={selectedGroup.groupId}
        groupName={selectedGroup.groupName}
        onBack={() => {
          setShowMemberRecords(false);
          setSelectedGroup(null);
        }}
        onEditRecord={onEditRecord}
      />
    );
  }

  if (selectedGroup && showFinesInput) {
    return (
      <div className="space-y-6 p-1">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              setShowFinesInput(false);
              setSelectedGroup(null);
              setFinesAmount('');
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        <Card className="shadow-sm border-l-4 border-l-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Add Fines & Penalties
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {selectedGroup.groupName}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="fines-amount">Fines & Penalties Amount (KES)</Label>
              <Input
                id="fines-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={finesAmount}
                onChange={(e) => setFinesAmount(e.target.value)}
                className="mt-2"
              />
            </div>
            
            <Button 
              onClick={handleAddFines}
              disabled={isSubmitting || !finesAmount || parseFloat(finesAmount) <= 0}
              className="w-full"
            >
              {isSubmitting ? 'Saving...' : 'Save Fines'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <Card className="shadow-sm bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
        <CardContent className="py-4">
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-bold tracking-tight">Group Summary</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Summary of unsynced data by group
            </p>
          </div>
        </CardContent>
      </Card>

      {groupsSummary.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-6 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No unsynced data available</p>
            <p className="text-sm mt-1">Record collections, advances, or loans to see summaries</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupsSummary.map((group) => (
            <Card key={group.groupId} className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{group.groupName}</CardTitle>
                    <p className="text-xs text-muted-foreground">ID: {group.groupId}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedGroup(group);
                      setShowFinesInput(true);
                    }}
                    disabled={groupsWithExistingRecords.has(group.groupId)}
                    className="flex items-center gap-1"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {groupsWithExistingRecords.has(group.groupId) ? 'Record Exists' : 'Add Fines'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-success/10 rounded-lg border border-success/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Banknote className="h-4 w-4 text-success" />
                      <span className="text-xs text-muted-foreground">Cash</span>
                    </div>
                    <p className="font-semibold text-success">{formatAmount(group.totalCash)}</p>
                  </div>
                  
                  <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Banknote className="h-4 w-4 text-primary" />
                      <span className="text-xs text-muted-foreground">M-Pesa</span>
                    </div>
                    <p className="font-semibold text-primary">{formatAmount(group.totalMpesa)}</p>
                  </div>
                  
                  <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      <span className="text-xs text-muted-foreground">Advances</span>
                    </div>
                    <p className="font-semibold text-blue-500">{formatAmount(group.totalAdvances)}</p>
                  </div>
                  
                  <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Coins className="h-4 w-4 text-purple-500" />
                      <span className="text-xs text-muted-foreground">Loans</span>
                    </div>
                    <p className="font-semibold text-purple-500">{formatAmount(group.totalLoans)}</p>
                  </div>
                  
                  {group.totalFines > 0 && (
                    <div className="col-span-2 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        <span className="text-xs text-muted-foreground">Fines & Penalties</span>
                      </div>
                      <p className="font-semibold text-orange-500">{formatAmount(group.totalFines)}</p>
                    </div>
                  )}
                  
                  <div className="col-span-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Banknote className="h-4 w-4 text-green-600" />
                      <span className="text-xs text-muted-foreground">Net Cash Remitted</span>
                    </div>
                    <p className="font-semibold text-green-600">{formatAmount(group.netCashRemitted)}</p>
                  </div>
                </div>
                
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewRecords(group)}
                    className="flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    View Records
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {onBack && (
        <Button variant="outline" onClick={onBack} className="w-full">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      )}
    </div>
  );
}
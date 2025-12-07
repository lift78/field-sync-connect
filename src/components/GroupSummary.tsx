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
  cashFromOffice: number;
  netCashRemitted: number;
  groupCollectionId?: number;
}

export function GroupSummary({ onBack, onEditRecord }: { onBack?: () => void; onEditRecord?: (recordData: any, type: 'cash' | 'loan' | 'advance' | 'group') => void }) {
  const [groupsSummary, setGroupsSummary] = useState<GroupSummaryData[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupSummaryData | null>(null);
  const [finesAmount, setFinesAmount] = useState('');
  const [cashFromOfficeAmount, setCashFromOfficeAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFinesInput, setShowFinesInput] = useState(false);
  const [showCashFromOfficeInput, setShowCashFromOfficeInput] = useState(false);
  const [showMemberRecords, setShowMemberRecords] = useState(false);
  const [groupsWithExistingRecords, setGroupsWithExistingRecords] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const loadGroupsSummary = async () => {
    try {
      const cashCollections = await dbOperations.getUnsyncedCashCollections();
      const advanceLoans = await dbOperations.getUnsyncedAdvanceLoans();
      const loanDisbursements = await dbOperations.getUnsyncedLoanDisbursements();
      const groupCollections = await dbOperations.getUnsyncedGroupCollections();
      
      const existingRecordsSet = new Set<string>();
      groupCollections.forEach(collection => {
        existingRecordsSet.add(collection.groupId);
      });
      setGroupsWithExistingRecords(existingRecordsSet);
      
      const members = await dbOperations.getAllMembers();
      
      const memberGroupMap = new Map();
      members.forEach(member => {
        const parts = member.member_id.split('/');
        const memberId = parts[parts.length - 1] || member.member_id;
        memberGroupMap.set(memberId, {
          groupId: member.group_id.toString(),
          groupName: member.group_name
        });
      });
      
      const groupsMap = new Map<string, GroupSummaryData>();
      
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
            cashFromOffice: 0,
            netCashRemitted: 0
          });
        }
        
        const group = groupsMap.get(groupInfo.groupId)!;
        group.totalCash += collection.cashAmount || 0;
        group.totalMpesa += collection.mpesaAmount || 0;
      });
      
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
            cashFromOffice: 0,
            netCashRemitted: 0
          });
        }
        
        const group = groupsMap.get(groupInfo.groupId)!;
        group.totalAdvances += advance.amount || 0;
      });
      
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
            cashFromOffice: 0,
            netCashRemitted: 0
          });
        }
        
        const group = groupsMap.get(groupId)!;
        group.totalLoans += loan.principalAmount || 0;
      });
      
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
            cashFromOffice: 0,
            netCashRemitted: 0,
            groupCollectionId: collection.id
          });
        }
        
        const group = groupsMap.get(collection.groupId)!;
        group.totalFines += collection.finesCollected || 0;
        group.groupCollectionId = collection.id;
      });
      
      for (const [groupId, group] of groupsMap.entries()) {
        const officeCash = await dbOperations.getOfficeCash(groupId);
        group.cashFromOffice = officeCash;
      }
      
      groupsMap.forEach(group => {
        group.netCashRemitted = (group.totalCash + group.totalFines + group.cashFromOffice) - group.totalAdvances;
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
    
    // Set up an interval to refresh data periodically for faster updates
    const refreshInterval = setInterval(() => {
      loadGroupsSummary();
    }, 2000); // Refresh every 2 seconds
    
    return () => clearInterval(refreshInterval);
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

  const handleAddCashFromOffice = async () => {
    if (!selectedGroup) return;
    
    const cashAmount = parseFloat(cashFromOfficeAmount) || 0;
    
    if (cashAmount <= 0) {
      toast({
        title: "Amount Required",
        description: "Please enter a valid cash amount",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await dbOperations.setOfficeCash(selectedGroup.groupId, cashAmount);
      
      toast({
        title: "Cash Added",
        description: `Cash from office of KES ${cashAmount.toFixed(2)} added for ${selectedGroup.groupName}`,
      });
      
      setCashFromOfficeAmount('');
      setShowCashFromOfficeInput(false);
      setSelectedGroup(null);
      loadGroupsSummary();
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save cash from office",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveCashFromOffice = async (group: GroupSummaryData) => {
    try {
      await dbOperations.removeOfficeCash(group.groupId);
      
      toast({
        title: "Cash Removed",
        description: "Cash from office has been removed",
      });
      
      loadGroupsSummary();
    } catch (error) {
      toast({
        title: "Remove Failed",
        description: "Failed to remove cash from office",
        variant: "destructive"
      });
    }
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
          loadGroupsSummary();
        }}
      />
    );
  }

  // Show cash from office input view
  if (selectedGroup && showCashFromOfficeInput) {
    return (
      <div className="space-y-3 px-0.5 py-3 pb-20 overflow-x-hidden">
        <Card className="shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="p-3">
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => {
                  setShowCashFromOfficeInput(false);
                  setSelectedGroup(null);
                  setCashFromOfficeAmount('');
                }}
                className="h-9 w-9 rounded-full border-2 hover:bg-accent flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Banknote className="h-4 w-4 text-blue-600" />
                  Add Funds from Office
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {selectedGroup.groupName}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-3">
            <div>
              <Label htmlFor="cash-from-office-amount" className="text-xs">Amount from Office (KES)</Label>
              <Input
                id="cash-from-office-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={cashFromOfficeAmount}
                onChange={(e) => setCashFromOfficeAmount(e.target.value)}
                className="mt-1.5 h-9 text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1.5">
                This amount will be added to the net cash remitted calculation
              </p>
            </div>
            
            <Button 
              onClick={handleAddCashFromOffice}
              disabled={isSubmitting || !cashFromOfficeAmount || parseFloat(cashFromOfficeAmount) <= 0}
              className="w-full h-9 text-sm"
            >
              {isSubmitting ? 'Saving...' : 'Add Funds'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (selectedGroup && showFinesInput) {
    return (
      <div className="space-y-3 px-0.5 py-3 pb-20 overflow-x-hidden">
        <Card className="shadow-sm border-l-4 border-l-orange-500">
          <CardHeader className="p-3">
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => {
                  setShowFinesInput(false);
                  setSelectedGroup(null);
                  setFinesAmount('');
                }}
                className="h-9 w-9 rounded-full border-2 hover:bg-accent flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  Add Fines & Penalties
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {selectedGroup.groupName}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-3">
            <div>
              <Label htmlFor="fines-amount" className="text-xs">Fines & Penalties Amount (KES)</Label>
              <Input
                id="fines-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={finesAmount}
                onChange={(e) => setFinesAmount(e.target.value)}
                className="mt-1.5 h-9 text-sm"
              />
            </div>
            
            <Button 
              onClick={handleAddFines}
              disabled={isSubmitting || !finesAmount || parseFloat(finesAmount) <= 0}
              className="w-full h-9 text-sm"
            >
              {isSubmitting ? 'Saving...' : 'Save Fines'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-0.5 py-3 pb-20 overflow-x-hidden">
      {/* Header */}
      <Card className="shadow-sm bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            {onBack && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onBack}
                className="h-9 w-9 rounded-full border-2 hover:bg-accent flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center gap-2 flex-1">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-base font-bold tracking-tight">Group Summary</h2>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Summary of unsynced data by group
          </p>
        </CardContent>
      </Card>

      {groupsSummary.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-6 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No unsynced data available</p>
            <p className="text-xs mt-1">Record collections, advances, or loans to see summaries</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groupsSummary.map((group) => (
            <Card key={group.groupId} className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 p-3">
                <div>
                  <CardTitle className="text-sm">{group.groupName}</CardTitle>
                  <p className="text-[10px] text-muted-foreground mt-0.5">ID: {group.groupId}</p>
                </div>
                
                {group.cashFromOffice > 0 && (
                  <div className="mt-2">
                    <Badge 
                      variant="secondary" 
                      className="bg-blue-500/10 text-blue-600 border border-blue-500/30 hover:bg-blue-500/20 text-xs"
                    >
                      <Banknote className="h-3 w-3 mr-1" />
                      Office Funds: {formatAmount(group.cashFromOffice)}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveCashFromOffice(group);
                        }}
                        className="ml-2 hover:text-destructive"
                      >
                        Ã—
                      </button>
                    </Badge>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-3 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-success/10 rounded-lg border border-success/20">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Banknote className="h-3.5 w-3.5 text-success" />
                      <span className="text-[10px] text-muted-foreground">Cash</span>
                    </div>
                    <p className="font-semibold text-success text-xs">{formatAmount(group.totalCash)}</p>
                  </div>
                  
                  <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Banknote className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] text-muted-foreground">M-Pesa</span>
                    </div>
                    <p className="font-semibold text-primary text-xs">{formatAmount(group.totalMpesa)}</p>
                  </div>
                  
                  <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-[10px] text-muted-foreground">Advances</span>
                    </div>
                    <p className="font-semibold text-blue-500 text-xs">{formatAmount(group.totalAdvances)}</p>
                  </div>
                  
                  <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Coins className="h-3.5 w-3.5 text-purple-500" />
                      <span className="text-[10px] text-muted-foreground">Loans</span>
                    </div>
                    <p className="font-semibold text-purple-500 text-xs">{formatAmount(group.totalLoans)}</p>
                  </div>
                  
                  {group.totalFines > 0 && (
                    <div className="col-span-2 p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                        <span className="text-[10px] text-muted-foreground">Fines & Penalties</span>
                      </div>
                      <p className="font-semibold text-orange-500 text-xs">{formatAmount(group.totalFines)}</p>
                    </div>
                  )}
                  
                  <div className="col-span-2 p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Banknote className="h-3.5 w-3.5 text-green-600" />
                      <span className="text-[10px] text-muted-foreground">Net Cash Remitted</span>
                    </div>
                    <p className="font-semibold text-green-600 text-xs">{formatAmount(group.netCashRemitted)}</p>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedGroup(group);
                      setShowCashFromOfficeInput(true);
                    }}
                    className="flex items-center justify-center gap-1.5 h-8 text-xs"
                  >
                    <Banknote className="h-3.5 w-3.5" />
                    Add Funds
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewRecords(group)}
                    className="flex items-center justify-center gap-1.5 h-8 text-xs"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    View Records
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedGroup(group);
                      setShowFinesInput(true);
                    }}
                    disabled={groupsWithExistingRecords.has(group.groupId)}
                    className="col-span-2 flex items-center justify-center gap-1.5 h-8 text-xs"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {groupsWithExistingRecords.has(group.groupId) ? 'Fines Already Recorded' : 'Add Fines & Penalties'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
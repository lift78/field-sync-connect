import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Edit, User, Banknote, CreditCard, TrendingUp, Coins, DollarSign, Loader2, AlertTriangle } from "lucide-react";
import { dbOperations, CashCollection } from "@/lib/database";
import { useToast } from "@/hooks/use-toast";

interface MemberRecord {
  memberId: string;
  memberName: string;
  totalAmount: number;
  cashAmount: number;
  mpesaAmount: number;
  allocations: {
    savings: number;
    loan: number;
    advance: number;
    others: Array<{ type: string; amount: number }>;
  };
  recordIds: number[];
}

interface GroupCollectionRecord {
  groupName: string;
  finesCollected: number;
  cashFromOffice: number;
  recordId?: number;
}

interface GroupMemberRecordsProps {
  groupId: string;
  groupName: string;
  onBack: () => void;
  onEditMember?: (memberId: string, records: CashCollection[]) => void;
  onEditRecord?: (record: any, type: 'cash') => void;
}

export function GroupMemberRecords({ groupId, groupName, onBack, onEditMember, onEditRecord }: GroupMemberRecordsProps) {
  const [memberRecords, setMemberRecords] = useState<MemberRecord[]>([]);
  const [groupCollection, setGroupCollection] = useState<GroupCollectionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadMemberRecords();
  }, [groupId]);

  const loadMemberRecords = async () => {
    try {
      setLoading(true);
      
      // Get all unsynced cash collections
      const cashCollections = await dbOperations.getUnsyncedCashCollections();
      
      // Get group collections for this group
      const groupCollections = await dbOperations.getUnsyncedGroupCollections();
      const thisGroupCollection = groupCollections.find(gc => gc.groupId === groupId);
      
      if (thisGroupCollection) {
        const officeCash = await dbOperations.getOfficeCash(groupId);
        setGroupCollection({
          groupName: thisGroupCollection.groupName,
          finesCollected: thisGroupCollection.finesCollected || 0,
          cashFromOffice: officeCash,
          recordId: thisGroupCollection.id
        });
      }
      
      // Get all members to map member IDs to group IDs
      const members = await dbOperations.getAllMembers();
      
      // Create a map of member_id to group info
      const memberGroupMap = new Map();
      members.forEach(member => {
        const parts = member.member_id.split('/');
        const memberId = parts[parts.length - 1] || member.member_id;
        memberGroupMap.set(memberId, {
          groupId: member.group_id.toString(),
          groupName: member.group_name
        });
      });
      
      // Filter collections for this specific group and aggregate by member
      const memberRecordsMap = new Map<string, MemberRecord>();
      
      cashCollections.forEach(collection => {
        const groupInfo = memberGroupMap.get(collection.memberId);
        if (!groupInfo || groupInfo.groupId !== groupId) return;
        
        if (!memberRecordsMap.has(collection.memberId)) {
          memberRecordsMap.set(collection.memberId, {
            memberId: collection.memberId,
            memberName: collection.memberName,
            totalAmount: 0,
            cashAmount: 0,
            mpesaAmount: 0,
            allocations: {
              savings: 0,
              loan: 0,
              advance: 0,
              others: []
            },
            recordIds: []
          });
        }
        
        const memberRecord = memberRecordsMap.get(collection.memberId)!;
        
        // Add amounts
        memberRecord.totalAmount += collection.totalAmount || 0;
        memberRecord.cashAmount += collection.cashAmount || 0;
        memberRecord.mpesaAmount += collection.mpesaAmount || 0;
        memberRecord.recordIds.push(collection.id!);
        
        // Process allocations
        if (collection.allocations && Array.isArray(collection.allocations)) {
          collection.allocations.forEach(allocation => {
            const amount = allocation.amount || 0;
            const allocationType = allocation.type as string;
            
            if (allocationType === 'savings') {
              memberRecord.allocations.savings += amount;
            } else if (allocationType === 'loan') {
              memberRecord.allocations.loan += amount;
            } else if (allocationType === 'amount_for_advance_payment' || allocationType === 'amount_for_advance_payments') {
              memberRecord.allocations.advance += amount;
            } else if (allocationType === 'other' && allocation.reason) {
              // Find or create other allocation
              const existingOther = memberRecord.allocations.others.find(o => o.type === allocation.reason);
              if (existingOther) {
                existingOther.amount += amount;
              } else {
                memberRecord.allocations.others.push({
                  type: allocation.reason,
                  amount: amount
                });
              }
            }
          });
        }
      });
      
      setMemberRecords(Array.from(memberRecordsMap.values()));
    } catch (error) {
      console.error('Error loading member records:', error);
      toast({
        title: "Error",
        description: "Failed to load member records",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleEditMember = async (memberId: string, recordIds: number[]) => {
    if (onEditRecord && recordIds.length > 0) {
      // Get the first record for this member to edit
      const allCollections = await dbOperations.getUnsyncedCashCollections();
      const firstRecord = allCollections.find(c => recordIds.includes(c.id!));
      
      if (firstRecord) {
        const record = {
          id: firstRecord.id!.toString(),
          memberId: firstRecord.memberId,
          amount: firstRecord.totalAmount,
          status: 'pending' as const,
          lastUpdated: firstRecord.timestamp.toISOString(),
          data: firstRecord
        };
        onEditRecord(record, 'cash');
      }
    } else {
      toast({
        title: "Edit Member",
        description: `Editing records for member ${memberId}`,
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-1">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        
        <Card className="shadow-sm">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading member records...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <Card className="shadow-sm bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
        <CardContent className="py-4">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold tracking-tight">{groupName}</h2>
            <p className="text-sm text-muted-foreground">
              Member Collection Records ({memberRecords.length} members)
            </p>
          </div>
        </CardContent>
      </Card>

      {memberRecords.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-6 text-center text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No member records found for this group</p>
            <p className="text-sm mt-1">Cash collections will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Member Records */}
          {memberRecords.map((member) => (
            <Card key={member.memberId} className="shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-primary bg-card">
              <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-full border border-primary/20">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">{member.memberName}</CardTitle>
                      <p className="text-xs text-muted-foreground">ID: {member.memberId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total Amount</p>
                    <p className="text-lg font-bold text-primary">{formatAmount(member.totalAmount)}</p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4 pt-4">
                {/* Payment Methods */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-lg border border-green-500/30">
                    <Banknote className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Cash</p>
                      <p className="text-sm font-semibold text-green-500 truncate">{formatAmount(member.cashAmount)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 p-2 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <CreditCard className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">M-Pesa</p>
                      <p className="text-sm font-semibold text-blue-500 truncate">{formatAmount(member.mpesaAmount)}</p>
                    </div>
                  </div>
                </div>

                {/* Allocations */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Allocations</p>
                  
                  <div className="space-y-2">
                    {member.allocations.savings > 0 && (
                      <div className="flex items-center justify-between p-2 bg-purple-500/10 rounded border border-purple-500/30">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-purple-500" />
                          <span className="text-sm font-medium">Savings</span>
                        </div>
                        <span className="text-sm font-semibold text-purple-500">{formatAmount(member.allocations.savings)}</span>
                      </div>
                    )}
                    
                    {member.allocations.loan > 0 && (
                      <div className="flex items-center justify-between p-2 bg-orange-500/10 rounded border border-orange-500/30">
                        <div className="flex items-center gap-2">
                          <Coins className="h-4 w-4 text-orange-500" />
                          <span className="text-sm font-medium">Loan Repayment</span>
                        </div>
                        <span className="text-sm font-semibold text-orange-500">{formatAmount(member.allocations.loan)}</span>
                      </div>
                    )}
                    
                    {member.allocations.advance > 0 && (
                      <div className="flex items-center justify-between p-2 bg-cyan-500/10 rounded border border-cyan-500/30">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-cyan-500" />
                          <span className="text-sm font-medium">Advance Payment</span>
                        </div>
                        <span className="text-sm font-semibold text-cyan-500">{formatAmount(member.allocations.advance)}</span>
                      </div>
                    )}
                    
                    {member.allocations.others.map((other, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-slate-500/10 rounded border border-slate-500/30">
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full bg-slate-500/30 flex items-center justify-center border border-slate-500/50">
                            <span className="text-[10px] text-slate-500 font-bold">•</span>
                          </div>
                          <span className="text-sm font-medium">{other.type}</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-500">{formatAmount(other.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Edit Button */}
                <div className="flex justify-center pt-2 border-t border-border">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleEditMember(member.memberId, member.recordIds)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {/* Group Collection Record (Fines) */}
          {groupCollection && (groupCollection.finesCollected > 0 || groupCollection.cashFromOffice > 0) && (
            <Card className="shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-amber-500 bg-amber-500/5">
              <CardHeader className="pb-3 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-amber-500/10 rounded-full border border-amber-500/20">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold text-amber-900">Group Collection</CardTitle>
                      <p className="text-xs text-muted-foreground">{groupName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total Amount</p>
                    <p className="text-lg font-bold text-amber-600">
                      {formatAmount((groupCollection.finesCollected || 0) + (groupCollection.cashFromOffice || 0))}
                    </p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4 pt-4">
                {/* Breakdown */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Breakdown</p>
                  
                  <div className="space-y-2">
                    {groupCollection.finesCollected > 0 && (
                      <div className="flex items-center justify-between p-2 bg-orange-500/10 rounded border border-orange-500/30">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                          <span className="text-sm font-medium">Fines & Penalties</span>
                        </div>
                        <span className="text-sm font-semibold text-orange-500">{formatAmount(groupCollection.finesCollected)}</span>
                      </div>
                    )}
                    
                    {groupCollection.cashFromOffice > 0 && (
                      <div className="flex items-center justify-between p-2 bg-blue-500/10 rounded border border-blue-500/30">
                        <div className="flex items-center gap-2">
                          <Banknote className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium">Cash from Office</span>
                        </div>
                        <span className="text-sm font-semibold text-blue-500">{formatAmount(groupCollection.cashFromOffice)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
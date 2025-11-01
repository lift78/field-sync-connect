import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Edit, User, Banknote, CreditCard, TrendingUp, Coins, DollarSign, Loader2, AlertTriangle } from "lucide-react";
import { dbOperations, CashCollection, GroupCollection } from "@/lib/database";
import { useToast } from "@/hooks/use-toast";
import { RecordDetailView } from "@/components/RecordDetailView";

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
}

export function GroupMemberRecords({ groupId, groupName, onBack }: GroupMemberRecordsProps) {
  const [memberRecords, setMemberRecords] = useState<MemberRecord[]>([]);
  const [groupCollection, setGroupCollection] = useState<GroupCollectionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editType, setEditType] = useState<'cash' | 'group'>('cash');
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
    try {
      if (recordIds.length === 0) {
        toast({
          title: "No Records",
          description: "No records found for this member",
          variant: "destructive"
        });
        return;
      }

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
        setEditType('cash');
        setEditingRecord(record);
      } else {
        toast({
          title: "Record Not Found",
          description: "Could not find the record to edit",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error loading record for edit:', error);
      toast({
        title: "Error",
        description: "Failed to load record for editing",
        variant: "destructive"
      });
    }
  };

  const handleEditGroupCollection = async () => {
    try {
      if (!groupCollection?.recordId) {
        toast({
          title: "No Record",
          description: "No group collection record found",
          variant: "destructive"
        });
        return;
      }

      // Get the group collection record
      const groupCollections = await dbOperations.getUnsyncedGroupCollections();
      const groupRecord = groupCollections.find(gc => gc.id === groupCollection.recordId);
      
      if (groupRecord) {
        const record = {
          id: groupRecord.id!.toString(),
          memberId: groupRecord.groupId,
          amount: (groupRecord.finesCollected || 0) + (groupRecord.cashCollected || 0),
          status: 'pending' as const,
          lastUpdated: groupRecord.timestamp.toISOString(),
          data: groupRecord
        };
        setEditType('group');
        setEditingRecord(record);
      } else {
        toast({
          title: "Record Not Found",
          description: "Could not find the group collection record",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error loading group collection for edit:', error);
      toast({
        title: "Error",
        description: "Failed to load group collection for editing",
        variant: "destructive"
      });
    }
  };

  // Show edit view if a record is being edited
  if (editingRecord) {
    return (
      <RecordDetailView
        record={editingRecord}
        type={editType}
        onBack={() => {
          setEditingRecord(null);
          setEditType('cash');
          loadMemberRecords();
        }}
        onSaved={() => {
          setEditingRecord(null);
          setEditType('cash');
          loadMemberRecords();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-3 px-0.5 py-3 pb-20 overflow-x-hidden">
        <Card className="shadow-sm bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 rounded-full border-2 hover:bg-accent flex-shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold tracking-tight truncate">{groupName}</h2>
                <p className="text-xs text-muted-foreground truncate">Loading...</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground text-sm">Loading member records...</p>
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
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 rounded-full border-2 hover:bg-accent flex-shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold tracking-tight truncate">{groupName}</h2>
              <p className="text-xs text-muted-foreground truncate">
                Member Collection Records ({memberRecords.length} members)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {memberRecords.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-6 text-center text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No member records found for this group</p>
            <p className="text-xs mt-1">Cash collections will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Member Records */}
          {memberRecords.map((member) => (
            <Card key={member.memberId} className="shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-primary bg-card">
              <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent border-b border-border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-9 h-9 bg-primary/10 rounded-full border border-primary/20">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold truncate">{member.memberName}</CardTitle>
                      <p className="text-[10px] text-muted-foreground truncate">ID: {member.memberId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">Total</p>
                    <p className="text-sm font-bold text-primary">{formatAmount(member.totalAmount)}</p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3 pt-3 p-3">
                {/* Payment Methods */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-lg border border-green-500/30">
                    <Banknote className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground">Cash</p>
                      <p className="text-xs font-semibold text-green-500 truncate">{formatAmount(member.cashAmount)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 p-2 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <CreditCard className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground">M-Pesa</p>
                      <p className="text-xs font-semibold text-blue-500 truncate">{formatAmount(member.mpesaAmount)}</p>
                    </div>
                  </div>
                </div>

                {/* Allocations */}
                <div className="space-y-2">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Allocations</p>
                  
                  <div className="space-y-1.5">
                    {member.allocations.savings > 0 && (
                      <div className="flex items-center justify-between p-2 bg-purple-500/10 rounded border border-purple-500/30">
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="h-3.5 w-3.5 text-purple-500" />
                          <span className="text-xs font-medium">Savings</span>
                        </div>
                        <span className="text-xs font-semibold text-purple-500">{formatAmount(member.allocations.savings)}</span>
                      </div>
                    )}
                    
                    {member.allocations.loan > 0 && (
                      <div className="flex items-center justify-between p-2 bg-orange-500/10 rounded border border-orange-500/30">
                        <div className="flex items-center gap-1.5">
                          <Coins className="h-3.5 w-3.5 text-orange-500" />
                          <span className="text-xs font-medium">Loan Repayment</span>
                        </div>
                        <span className="text-xs font-semibold text-orange-500">{formatAmount(member.allocations.loan)}</span>
                      </div>
                    )}
                    
                    {member.allocations.advance > 0 && (
                      <div className="flex items-center justify-between p-2 bg-cyan-500/10 rounded border border-cyan-500/30">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="h-3.5 w-3.5 text-cyan-500" />
                          <span className="text-xs font-medium">Advance Payment</span>
                        </div>
                        <span className="text-xs font-semibold text-cyan-500">{formatAmount(member.allocations.advance)}</span>
                      </div>
                    )}
                    
                    {member.allocations.others.map((other, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-slate-500/10 rounded border border-slate-500/30">
                        <div className="flex items-center gap-1.5">
                          <div className="h-3.5 w-3.5 rounded-full bg-slate-500/30 flex items-center justify-center border border-slate-500/50">
                            <span className="text-[8px] text-slate-500 font-bold">â€¢</span>
                          </div>
                          <span className="text-xs font-medium">{other.type}</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-500">{formatAmount(other.amount)}</span>
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
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 h-8 text-xs"
                  >
                    <Edit className="h-3.5 w-3.5 mr-1.5" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {/* Group Collection Record (Fines) */}
          {groupCollection && (groupCollection.finesCollected > 0 || groupCollection.cashFromOffice > 0) && (
            <Card className="shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-amber-500 bg-amber-500/5">
              <CardHeader className="pb-3 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-9 h-9 bg-amber-500/10 rounded-full border border-amber-500/20">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold text-amber-900">Group Collection</CardTitle>
                      <p className="text-[10px] text-muted-foreground truncate">{groupName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">Total</p>
                    <p className="text-sm font-bold text-amber-600">
                      {formatAmount((groupCollection.finesCollected || 0) + (groupCollection.cashFromOffice || 0))}
                    </p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3 pt-3 p-3">
                {/* Breakdown */}
                <div className="space-y-2">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Breakdown</p>
                  
                  <div className="space-y-1.5">
                    {groupCollection.finesCollected > 0 && (
                      <div className="flex items-center justify-between p-2 bg-orange-500/10 rounded border border-orange-500/30">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                          <span className="text-xs font-medium">Fines & Penalties</span>
                        </div>
                        <span className="text-xs font-semibold text-orange-500">{formatAmount(groupCollection.finesCollected)}</span>
                      </div>
                    )}
                    
                    {groupCollection.cashFromOffice > 0 && (
                      <div className="flex items-center justify-between p-2 bg-blue-500/10 rounded border border-blue-500/30">
                        <div className="flex items-center gap-1.5">
                          <Banknote className="h-3.5 w-3.5 text-blue-500" />
                          <span className="text-xs font-medium">Cash from Office</span>
                        </div>
                        <span className="text-xs font-semibold text-blue-500">{formatAmount(groupCollection.cashFromOffice)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Edit Button for Group Collection */}
                {groupCollection.recordId && (
                  <div className="flex justify-center pt-2 border-t border-border">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleEditGroupCollection}
                      className="bg-amber-600 hover:bg-amber-700 text-white px-6 h-8 text-xs"
                    >
                      <Edit className="h-3.5 w-3.5 mr-1.5" />
                      Edit
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
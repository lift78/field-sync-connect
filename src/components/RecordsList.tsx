import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, 
  Edit3, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  User,
  Loader2,
  AlertCircle,
  RotateCcw,
  Trash2,
  Search,
  Filter,
  X
} from "lucide-react";
import { dbOperations, CashCollection, LoanApplication, AdvanceLoan, LoanDisbursement, GroupCollection, NewMember } from "@/lib/database";
import { EditableDisbursementPreview } from "@/components/EditableDisbursementPreview";
import { NewMemberDetailView } from "@/components/NewMemberDetailView";

interface Record {
  id: string;
  memberId?: string;
  loanId?: string;
  amount?: number;
  status: 'synced' | 'pending' | 'failed';
  syncError?: string;
  lastUpdated: string;
  data: any;
}

interface RecordsListProps {
  type: 'cash' | 'loan' | 'advance' | 'disbursement' | 'group' | 'newmember';
  onBack: () => void;
  onEditRecord: (recordData: any, type: 'cash' | 'loan' | 'advance' | 'group', readOnly?: boolean) => void;
}

export function RecordsList({ type, onBack, onEditRecord }: RecordsListProps) {
  const [records, setRecords] = useState<Record[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingRecords, setResolvingRecords] = useState<Set<string>>(new Set());
  const [deletingRecords, setDeletingRecords] = useState<Set<string>>(new Set());
  const [editingDisbursement, setEditingDisbursement] = useState<LoanDisbursement | null>(null);
  const [editingNewMember, setEditingNewMember] = useState<{
    id: string;
    memberId: string;
    status: 'synced' | 'pending' | 'failed';
    syncError?: string;
    lastUpdated: string;
    data: NewMember;
  } | null>(null);
  
  // Filter and search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'synced' | 'pending' | 'failed'>('all');

  useEffect(() => {
    loadRecords();
  }, [type]);

  const loadRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let data: (CashCollection | LoanApplication | AdvanceLoan | LoanDisbursement | GroupCollection | NewMember)[] = [];
      
      switch (type) {
        case 'cash':
          data = await dbOperations.getCashCollections();
          break;
        case 'loan':
          data = await dbOperations.getLoanApplications();
          break;
        case 'advance':
          data = await dbOperations.getAdvanceLoans();
          break;
        case 'disbursement':
          data = await dbOperations.getLoanDisbursements();
          break;
        case 'group':
          data = await dbOperations.getGroupCollections();
          break;
        case 'newmember':
          data = await dbOperations.getNewMembers();
          break;
      }

      const formattedRecords: Record[] = data.map((item) => {
        let status: 'synced' | 'pending' | 'failed' = 'pending';
        if (item.syncStatus) {
          status = item.syncStatus as 'synced' | 'pending' | 'failed';
        } else if (item.synced) {
          status = 'synced';
        }

        let amount: number = 0;
        if ('amount' in item && typeof item.amount === 'number') {
          amount = item.amount;
        } else if ('loanAmount' in item && typeof item.loanAmount === 'number') {
          amount = item.loanAmount;
        } else if ('principalAmount' in item && typeof item.principalAmount === 'number') {
          amount = item.principalAmount;
        } else if ('totalAmount' in item && typeof item.totalAmount === 'number') {
          amount = item.totalAmount;
        } else if ('cashCollected' in item && typeof item.cashCollected === 'number') {
          const finesCollected = ('finesCollected' in item && typeof item.finesCollected === 'number') ? item.finesCollected : 0;
          amount = item.cashCollected + finesCollected;
        }

        return {
          id: item.id?.toString() || '',
          memberId: 'memberId' in item ? (item.memberId as string) : 
                    'groupId' in item ? (item.groupId as string) : 
                    'id_number' in item ? (item.id_number as string) : undefined,
          loanId: 'loan_id' in item ? (item.loan_id as string) : undefined,
          amount,
          status,
          syncError: item.syncError || '',
          lastUpdated: item.timestamp.toISOString(),
          data: item
        };
      });

      setRecords(formattedRecords);
      setFilteredRecords(formattedRecords);
    } catch (err) {
      console.error('Failed to load records:', err);
      setError('Failed to load records from database');
    } finally {
      setLoading(false);
    }
  };

  // Apply filters and search
  useEffect(() => {
    let filtered = [...records];

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(record => record.status === statusFilter);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(record => {
        const displayName = getRecordDisplayName(record).toLowerCase();
        const memberId = record.memberId?.toLowerCase() || '';
        const loanId = record.loanId?.toLowerCase() || '';
        
        return displayName.includes(query) || 
               memberId.includes(query) || 
               loanId.includes(query);
      });
    }

    setFilteredRecords(filtered);
  }, [searchQuery, statusFilter, records]);

  const handleRecordClick = (record: Record, readOnly: boolean = false) => {
    if (type === 'disbursement' && !record.data.synced) {
      setEditingDisbursement(record.data as LoanDisbursement);
    } else if (type === 'newmember') {
      // Open new member detail view
      setEditingNewMember({
        id: record.id,
        memberId: record.memberId || '',
        status: record.status,
        syncError: record.syncError,
        lastUpdated: record.lastUpdated,
        data: record.data as NewMember
      });
    } else {
      // Pass the full database record data, the type, and read-only flag
      onEditRecord(record.data, type as 'cash' | 'loan' | 'advance' | 'group', readOnly);
    }
  };

  const handleDisbursementSaved = () => {
    setEditingDisbursement(null);
    loadRecords();
  };

  const handleNewMemberSaved = () => {
    setEditingNewMember(null);
    loadRecords();
  };

  const getTypeTitle = () => {
    switch (type) {
      case 'cash':
        return 'Collections & Allocations';
      case 'loan':
        return 'Loan Applications';
      case 'advance':
        return 'Advance Loans';
      case 'disbursement':
        return 'Loan Disbursements';
      case 'group':
        return 'Group Collections';
      case 'newmember':
        return 'New Members';
      default:
        return 'Records';
    }
  };

  const getStatusIcon = (status: Record['status']) => {
    switch (status) {
      case 'synced':
        return <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />;
      case 'pending':
        return <Clock className="h-3.5 w-3.5 text-amber-600" />;
      case 'failed':
        return <AlertTriangle className="h-3.5 w-3.5 text-red-600" />;
    }
  };

  const getStatusBadge = (status: Record['status']) => {
    switch (status) {
      case 'synced':
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs px-2 py-0.5">Synced</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs px-2 py-0.5">Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs px-2 py-0.5">Failed</Badge>;
    }
  };

  const formatDateTime = (isoString: string) => {
    return new Intl.DateTimeFormat('en-KE', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoString));
  };

  const formatAmount = (amount?: number) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getRecordDisplayName = (record: Record) => {
    const fullData = record.data as any;
    
    if (type === 'disbursement') {
      return `Loan ID: ${record.loanId || fullData?.loanId || 'Unknown'}`;
    } else if (type === 'group') {
      return `${fullData?.groupName || 'Unknown Group'} (${record.memberId})`;
    } else if (type === 'newmember') {
      // For new members, show name directly from the NewMember data
      return fullData?.name || 'New Member';
    } else {
      if (fullData?.memberName) {
        return `${fullData.memberName} (${record.memberId})`;
      }
      return `Member ${record.memberId}`;
    }
  };

  const getRecordSubtitle = (record: Record) => {
    const fullData = record.data as any;
    
    if (type === 'disbursement') {
      if (fullData?.amountType === 'custom' && fullData?.customAmount) {
        return `Custom: ${formatAmount(fullData.customAmount)}`;
      } else if (fullData?.amountType === 'all') {
        return 'Full Loan Amount';
      }
      return 'Disbursement';
    } else if (type === 'group') {
      const cashCollected = fullData?.cashCollected || 0;
      const finesCollected = fullData?.finesCollected || 0;
      return `Cash: ${formatAmount(cashCollected)} | Fines: ${formatAmount(finesCollected)}`;
    } else if (type === 'newmember') {
      // For new members, show phone and group
      return `${fullData?.phone || 'No phone'} | Group ${fullData?.group || 'N/A'}`;
    } else {
      if (record.amount) {
        return formatAmount(record.amount);
      }
      return '';
    }
  };

  const handleResolveRecord = async (recordId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    setResolvingRecords(prev => new Set([...prev, recordId]));
    
    try {
      const record = records.find(r => r.id === recordId);
      if (!record) return;

      let updateResult;
      switch (type) {
        case 'cash':
          updateResult = await dbOperations.updateCashCollectionStatus(recordId, 'pending');
          break;
        case 'loan':
          updateResult = await dbOperations.updateLoanApplicationStatus(recordId, 'pending');
          break;
        case 'advance':
          updateResult = await dbOperations.updateAdvanceLoanStatus(recordId, 'pending');
          break;
        case 'disbursement':
          updateResult = await dbOperations.updateLoanDisbursementStatus(recordId, 'pending');
          break;
        case 'group':
          updateResult = await dbOperations.updateGroupCollectionStatus(recordId, 'pending');
          break;
        case 'newmember':
          updateResult = await dbOperations.updateNewMemberStatus(recordId, 'pending');
          break;
      }

      if (updateResult) {
        setRecords(prev => prev.map(r => 
          r.id === recordId 
            ? { ...r, status: 'pending' as const, syncError: undefined }
            : r
        ));
      }
    } catch (err) {
      console.error('Failed to resolve record:', err);
    } finally {
      setResolvingRecords(prev => {
        const newSet = new Set([...prev]);
        newSet.delete(recordId);
        return newSet;
      });
    }
  };

  const handleDeleteRecord = async (recordId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
      return;
    }
    
    setDeletingRecords(prev => new Set([...prev, recordId]));
    
    try {
      let deleteResult;
      switch (type) {
        case 'cash':
          deleteResult = await dbOperations.deleteCashCollection(recordId);
          break;
        case 'loan':
          deleteResult = await dbOperations.deleteLoanApplication(recordId);
          break;
        case 'advance':
          deleteResult = await dbOperations.deleteAdvanceLoan(recordId);
          break;
        case 'disbursement':
          deleteResult = await dbOperations.deleteLoanDisbursement(recordId);
          break;
        case 'group':
          deleteResult = await dbOperations.deleteGroupCollection(recordId);
          break;
        case 'newmember':
          deleteResult = await dbOperations.deleteNewMember(recordId);
          break;
      }

      if (deleteResult !== undefined) {
        setRecords(prev => prev.filter(r => r.id !== recordId));
      }
    } catch (err) {
      console.error('Failed to delete record:', err);
      alert('Failed to delete record. Please try again.');
    } finally {
      setDeletingRecords(prev => {
        const newSet = new Set([...prev]);
        newSet.delete(recordId);
        return newSet;
      });
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-0.5 py-3">
        <div className="w-full space-y-3">
          <Card className="shadow-sm">
            <CardContent className="p-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
              <p className="text-muted-foreground text-sm">Loading records...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background px-0.5 py-3">
        <div className="w-full space-y-3">
          <Card className="shadow-sm">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-destructive" />
              <p className="text-muted-foreground mb-3 text-sm">{error}</p>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
                className="text-sm h-9"
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // If editing new member, show the detail view
  if (editingNewMember) {
    return (
      <NewMemberDetailView
        record={editingNewMember}
        onBack={() => setEditingNewMember(null)}
        onSaved={handleNewMemberSaved}
        readOnly={editingNewMember.status === 'synced'}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="w-full space-y-3 px-0.5 py-3 pb-20">
        {/* Combined Header with Search */}
        <Card className="shadow-sm">
          <CardContent className="p-3 space-y-3">
            {/* Title Row */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={onBack}
                className="h-9 w-9 rounded-full border-2 hover:bg-accent flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold truncate">{getTypeTitle()}</h1>
                <p className="text-xs text-muted-foreground truncate">
                  {records.length} {records.length === 1 ? 'record' : 'records'} total
                </p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, member ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-9 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter and Clear */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                  <SelectTrigger className="w-full h-9 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Filter className="h-3.5 w-3.5" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-sm">All Status</SelectItem>
                    <SelectItem value="synced" className="text-sm">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                        Synced
                      </div>
                    </SelectItem>
                    <SelectItem value="pending" className="text-sm">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                        Pending
                      </div>
                    </SelectItem>
                    <SelectItem value="failed" className="text-sm">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                        Failed
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {(searchQuery || statusFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="flex-shrink-0 h-9 text-xs px-2"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            {/* Active Filters Info */}
            {(searchQuery || statusFilter !== 'all') && (
              <div className="text-xs text-muted-foreground">
                Showing {filteredRecords.length} of {records.length} records
              </div>
            )}
          </CardContent>
        </Card>

        {/* Records List */}
        <div className="space-y-2.5">
          {filteredRecords.map((record) => (
            <Card 
              key={record.id} 
              className={`shadow-sm transition-all ${
                record.status === 'failed' ? 'border-l-4 border-l-red-500' : ''
              }`}
            >
              <CardContent className="p-3">
                <div className="space-y-2.5">
                  {/* Top Row - Name and Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <div className="flex items-center justify-center w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-full flex-shrink-0">
                        <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="font-semibold truncate text-sm">{getRecordDisplayName(record)}</p>
                          {getStatusIcon(record.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(record.lastUpdated)}
                        </p>
                        {getRecordSubtitle(record) && (
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-0.5 truncate">
                            {getRecordSubtitle(record)}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {getStatusBadge(record.status)}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDeleteRecord(record.id, e)}
                        disabled={deletingRecords.has(record.id)}
                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        {deletingRecords.has(record.id) ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Edit/View Button */}
                  {record.status === 'synced' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRecordClick(record, true)}
                      className="w-full h-8 border-2 hover:border-emerald-500 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-sm"
                    >
                      <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                      View Record
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRecordClick(record, false)}
                      className="w-full h-8 border-2 hover:border-blue-500 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-sm"
                    >
                      <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                      Edit Record
                    </Button>
                  )}

                  {/* Error Message */}
                  {record.status === 'failed' && record.syncError && (
                    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-2.5">
                      <div className="flex items-start gap-1.5 mb-2">
                        <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-semibold text-red-700 dark:text-red-300 mb-0.5">Sync Failed</p>
                          <p className="text-[10px] text-red-600 dark:text-red-400 break-words">
                            {record.syncError}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResolveRecord(record.id, e);
                        }}
                        disabled={resolvingRecords.has(record.id)}
                        className="h-7 text-xs w-full"
                      >
                        {resolvingRecords.has(record.id) ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <RotateCcw className="h-3 w-3 mr-1" />
                        )}
                        Retry Sync
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredRecords.length === 0 && !loading && (
          <Card className="shadow-sm">
            <CardContent className="p-8 text-center">
              <div className="flex flex-col items-center">
                {searchQuery || statusFilter !== 'all' ? (
                  <>
                    <Search className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium text-foreground mb-1">No matching records</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Try adjusting your search or filter
                    </p>
                    <Button variant="outline" onClick={clearFilters} className="text-sm h-9">
                      <X className="h-3.5 w-3.5 mr-1.5" />
                      Clear Filters
                    </Button>
                  </>
                ) : (
                  <>
                    <User className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium text-foreground mb-1">No records yet</p>
                    <p className="text-xs text-muted-foreground">
                      Records you create will appear here
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Stats */}
        {records.length > 0 && (
          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-xl font-bold">{records.filter(r => r.status === 'synced').length}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Synced</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-xl font-bold">{records.filter(r => r.status === 'pending').length}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Pending</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                    <span className="text-xl font-bold">{records.filter(r => r.status === 'failed').length}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Editable Disbursement Preview Modal */}
        {editingDisbursement && (
          <EditableDisbursementPreview
            disbursement={editingDisbursement}
            onClose={() => setEditingDisbursement(null)}
            onSaved={handleDisbursementSaved}
          />
        )}
      </div>
    </div>
  );
}
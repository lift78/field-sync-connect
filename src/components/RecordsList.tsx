import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Trash2
} from "lucide-react";
import { dbOperations, CashCollection, LoanApplication, AdvanceLoan, LoanDisbursement, GroupCollection } from "@/lib/database";
import { EditableDisbursementPreview } from "@/components/EditableDisbursementPreview";

interface Record {
  id: string;
  memberId?: string; // Made optional for disbursements
  loanId?: string; // Added for disbursements
  amount?: number;
  status: 'synced' | 'pending' | 'failed';
  syncError?: string; // Added to show sync errors
  lastUpdated: string;
  data: any; // Full form data for editing
}

interface RecordsListProps {
  type: 'cash' | 'loan' | 'advance' | 'disbursement' | 'group';
  onBack: () => void;
  onEditRecord: (record: Record) => void;
}

export function RecordsList({ type, onBack, onEditRecord }: RecordsListProps) {
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingRecords, setResolvingRecords] = useState<Set<string>>(new Set());
  const [deletingRecords, setDeletingRecords] = useState<Set<string>>(new Set());
  const [editingDisbursement, setEditingDisbursement] = useState<LoanDisbursement | null>(null);

  useEffect(() => {
    const loadRecords = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let data: (CashCollection | LoanApplication | AdvanceLoan | LoanDisbursement | GroupCollection)[] = [];
        
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
        }

        // Convert database records to Record interface with proper status mapping
        const formattedRecords: Record[] = data.map((item) => {
          // Determine status from syncStatus field first, then fallback to synced boolean
          let status: 'synced' | 'pending' | 'failed' = 'pending';
          if (item.syncStatus) {
            status = item.syncStatus as 'synced' | 'pending' | 'failed';
          } else if (item.synced) {
            status = 'synced';
          }

          // Safely extract amount with proper type assertions
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
            memberId: 'memberId' in item ? (item.memberId as string) : 'groupId' in item ? (item.groupId as string) : undefined,
            loanId: 'loan_id' in item ? (item.loan_id as string) : undefined,
            amount,
            status,
            syncError: item.syncError || '',
            lastUpdated: item.timestamp.toISOString(),
            data: item
          };
        });

        setRecords(formattedRecords);
      } catch (err) {
        console.error('Failed to load records:', err);
        setError('Failed to load records from database');
      } finally {
        setLoading(false);
      }
    };

    loadRecords();
  }, [type]);

  const handleRecordClick = (record: Record) => {
    if (type === 'disbursement' && !record.data.synced) {
      // Show editable preview for unsynced disbursements
      setEditingDisbursement(record.data as LoanDisbursement);
    } else {
      // Use regular edit for other types or synced disbursements
      onEditRecord(record);
    }
  };

  const handleDisbursementSaved = () => {
    setEditingDisbursement(null);
    // Reload records to reflect changes
    const loadRecords = async () => {
      try {
        setLoading(true);
        let data: (CashCollection | LoanApplication | AdvanceLoan | LoanDisbursement | GroupCollection)[] = [];
        
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
            memberId: 'memberId' in item ? (item.memberId as string) : 'groupId' in item ? (item.groupId as string) : undefined,
            loanId: 'loan_id' in item ? (item.loan_id as string) : undefined,
            amount,
            status,
            syncError: item.syncError || '',
            lastUpdated: item.timestamp.toISOString(),
            data: item
          };
        });

        setRecords(formattedRecords);
      } catch (err) {
        console.error('Failed to reload records:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadRecords();
  };

  const getTypeTitle = () => {
    switch (type) {
      case 'cash':
        return 'Cash Collection Records';
      case 'loan':
        return 'Loan Application Records';
      case 'advance':
        return 'Advance Loan Records';
      case 'disbursement':
        return 'Loan Disbursement Records';
      case 'group':
        return 'Group Collection Records';
      default:
        return 'Records';
    }
  };

  const getStatusIcon = (status: Record['status']) => {
    switch (status) {
      case 'synced':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusBadge = (status: Record['status']) => {
    switch (status) {
      case 'synced':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">Synced</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">Failed</Badge>;
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

  // Updated to handle disbursements and group collections
  const getRecordDisplayName = (record: Record) => {
    const fullData = record.data as any;
    
    if (type === 'disbursement') {
      return `Loan ID: ${record.loanId || fullData?.loanId || 'Unknown'}`;
    } else if (type === 'group') {
      return `${fullData?.groupName || 'Unknown Group'} (${record.memberId})`;
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
        return `Custom Amount: ${formatAmount(fullData.customAmount)}`;
      } else if (fullData?.amountType === 'all') {
        return 'Full Loan Amount';
      }
      return 'Disbursement';
    } else if (type === 'group') {
      const cashCollected = fullData?.cashCollected || 0;
      const finesCollected = fullData?.finesCollected || 0;
      return `Cash: ${formatAmount(cashCollected)} | Fines: ${formatAmount(finesCollected)}`;
    } else {
      if (record.amount) {
        return formatAmount(record.amount);
      }
      return '';
    }
  };

  // Helper function to truncate error messages for display
  const truncateError = (error?: string, maxLength: number = 50) => {
    if (!error) return '';
    return error.length > maxLength ? `${error.substring(0, maxLength)}...` : error;
  };

  // Function to resolve failed record back to pending
  const handleResolveRecord = async (recordId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering the card click
    
    setResolvingRecords(prev => new Set([...prev, recordId]));
    
    try {
      const record = records.find(r => r.id === recordId);
      if (!record) return;

      // Update the record status back to pending in the database
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
      }

      if (updateResult) {
        // Update local state
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

  // Function to delete a record
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
      }

      if (deleteResult !== undefined) {
        // Remove from local state
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

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <Card className="shadow-card bg-gradient-card">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="h-8 w-8 cursor-pointer hover:bg-accent/50"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-lg">{getTypeTitle()}</CardTitle>
            </div>
          </CardHeader>
        </Card>

        {/* Loading State */}
        <Card className="shadow-card">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading records...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <Card className="shadow-card bg-gradient-card">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="h-8 w-8 cursor-pointer hover:bg-accent/50"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-lg">{getTypeTitle()}</CardTitle>
            </div>
          </CardHeader>
        </Card>

        {/* Error State */}
        <Card className="shadow-card">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-4 text-destructive" />
            <p className="text-muted-foreground">{error}</p>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()} 
              className="mt-4"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="shadow-card bg-gradient-card">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8 cursor-pointer hover:bg-accent/50"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-lg">{getTypeTitle()}</CardTitle>
          </div>
        </CardHeader>
      </Card>

      {/* Records List */}
      <div className="space-y-3">
        {records.map((record) => (
          <Card 
            key={record.id} 
            className={`shadow-card cursor-pointer hover:shadow-lg transition-shadow ${
              record.status === 'failed' ? 'border-l-4 border-l-red-500' : ''
            }`}
            onClick={() => handleRecordClick(record)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-full">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <p className="font-semibold">{getRecordDisplayName(record)}</p>
                      {getStatusIcon(record.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(record.lastUpdated)}
                    </p>
                    {getRecordSubtitle(record) && (
                      <p className="text-sm font-medium text-primary">
                        {getRecordSubtitle(record)}
                      </p>
                    )}
                    
                    {/* Error Message Display */}
                    {record.status === 'failed' && record.syncError && (
                      <div className="mt-2 flex items-start space-x-2">
                        <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs text-red-600 font-medium">Sync Failed:</p>
                          <p className="text-xs text-red-500" title={record.syncError}>
                            {truncateError(record.syncError, 80)}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-muted-foreground italic">
                              Click to edit and retry sync
                            </p>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => handleResolveRecord(record.id, e)}
                                disabled={resolvingRecords.has(record.id)}
                                className="h-6 px-2 text-xs"
                              >
                                {resolvingRecords.has(record.id) ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Resolve
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => handleDeleteRecord(record.id, e)}
                                disabled={deletingRecords.has(record.id)}
                                className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                {deletingRecords.has(record.id) ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Delete
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {getStatusBadge(record.status)}
                  <Edit3 className="h-4 w-4 text-muted-foreground" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDeleteRecord(record.id, e)}
                    disabled={deletingRecords.has(record.id)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {deletingRecords.has(record.id) ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {records.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No {type} records found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Records you create will appear here
            </p>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {records.length > 0 && (
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="text-center mb-2">
              <p className="text-sm font-medium text-muted-foreground">
                {(() => {
                  const syncedCount = records.filter(r => r.status === 'synced').length;
                  const pendingCount = records.filter(r => r.status === 'pending').length;
                  const failedCount = records.filter(r => r.status === 'failed').length;
                  
                  if (syncedCount === records.length) {
                    return "All synced";
                  }
                  
                  const parts = [];
                  if (pendingCount > 0) parts.push(`${pendingCount} unsynced`);
                  if (failedCount > 0) parts.push(`${failedCount} failed`);
                  
                  return parts.join(', ');
                })()}
              </p>
            </div>
            <div className="flex justify-center space-x-6 text-sm">
              <div className="text-center">
                <div className="flex items-center space-x-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="font-medium">{records.filter(r => r.status === 'synced').length}</span>
                </div>
                <p className="text-muted-foreground">Synced</p>
              </div>
              <div className="text-center">
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <span className="font-medium">{records.filter(r => r.status === 'pending').length}</span>
                </div>
                <p className="text-muted-foreground">Unsynced</p>
              </div>
              <div className="text-center">
                <div className="flex items-center space-x-1">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="font-medium">{records.filter(r => r.status === 'failed').length}</span>
                </div>
                <p className="text-muted-foreground">Failed</p>
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
  );
}
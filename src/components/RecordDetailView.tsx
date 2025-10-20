import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

import { 
  ArrowLeft, 
  Edit3, 
  Save, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  User,
  Plus,
  Trash2,
  Loader2,
  X,
  Check,
  Calendar,
  DollarSign,
  Users,
  FileText
} from "lucide-react";
import { dbOperations, CashCollection, LoanApplication, AdvanceLoan, GroupCollection } from "@/lib/database";

interface RecordDetailViewProps {
  record: {
    id: string;
    memberId: string;
    amount?: number;
    status: 'synced' | 'pending' | 'failed';
    lastUpdated: string;
    data: CashCollection | LoanApplication | AdvanceLoan | GroupCollection;
  };
  type: 'cash' | 'loan' | 'advance' | 'group';
  onBack: () => void;
  onSaved?: () => void;
}

export function RecordDetailView({ record, type, onBack, onSaved }: RecordDetailViewProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const allocationTypes = ['savings', 'loan', 'advance', 'other'];
  const allocationReasons = [
    'Monthly Contribution',
    'Advance fine(kes 10)',
    'Loan Repayment',
    'Interest Payment',
    'Penalty Fee',
    'Registration Fee',
    'Loan Processing Fee',
    'Lateness Fee',
    'Meeting Absence Fee',
    'Share Purchase',
    'Insurance Premium',
    'Emergency Fund',
    'Development Fund',
    'Welfare Fund',
    'Other'
  ];

  const getDisplayName = (allocationType: string): string => {
    switch (allocationType) {
      case 'amount_for_advance_payment':
      case 'amount_for_advance_payments':
        return 'Advance';
      case 'savings':
        return 'Savings';
      case 'loan':
        return 'Loan';
      case 'other':
        return 'Other';
      default:
        return allocationType.charAt(0).toUpperCase() + allocationType.slice(1).replace(/_/g, ' ');
    }
  };

  const getAvailableAllocationTypes = () => {
    const data = record.data as CashCollection;
    const currentAllocations = editValues.allocations || data.allocations || [];
    
    const usedTypes = currentAllocations
      .map((a: any) => a.type)
      .filter((t: string) => t !== 'other');
    
    return allocationTypes.filter(type => 
      type === 'other' || !usedTypes.includes(type)
    );
  };

  const getAvailableReasons = () => {
    const data = record.data as CashCollection;
    const currentAllocations = editValues.allocations || data.allocations || [];
    
    const usedReasons = currentAllocations
      .filter((a: any) => a.type === 'other' && a.reason)
      .map((a: any) => a.reason);
    
    return allocationReasons.filter(reason => !usedReasons.includes(reason));
  };

  const getTypeTitle = () => {
    switch (type) {
      case 'cash':
        return 'Collections & Allocations';
      case 'loan':
        return 'Loan Application';
      case 'advance':
        return 'Advance Loan';
      case 'group':
        return 'Group Collection';
      default:
        return 'Record Details';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'synced':
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 px-2 py-0.5 text-xs">Synced</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200 px-2 py-0.5 text-xs">Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700 border-red-200 px-2 py-0.5 text-xs">Failed</Badge>;
    }
  };

  const formatAmount = (amount?: number) => {
    if (!amount) return 'KES 0';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return new Intl.DateTimeFormat('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch (error) {
      console.error('Error formatting date:', error, 'Input:', isoString);
      return 'Invalid date';
    }
  };

  const getMemberDisplayName = () => {
    if (!record.data) {
      return `Member ${record.memberId}`;
    }
    
    if (type === 'group') {
      const groupData = record.data as GroupCollection;
      return `${groupData.groupName || 'Unknown Group'} (${record.memberId})`;
    } else {
      const memberName = (record.data as any)?.memberName;
      if (memberName) {
        return `${memberName} (${record.memberId})`;
      }
      return `Member ${record.memberId}`;
    }
  };

  const handleEdit = (fieldName: string, currentValue: any) => {
    setEditingField(fieldName);
    setEditValues({ ...editValues, [fieldName]: currentValue });
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValues({});
  };

  const handleFieldSave = (fieldName: string) => {
    setEditingField(null);
  };

  const handleSaveChanges = async () => {
    try {
      setIsSaving(true);
      
      let updatedData = { ...record.data, ...editValues };
      
      // For cash collections, recalculate totalAmount and validate allocations
      if (type === 'cash') {
        const cashAmount = editValues.cashAmount !== undefined ? editValues.cashAmount : (record.data as CashCollection).cashAmount || 0;
        const mpesaAmount = editValues.mpesaAmount !== undefined ? editValues.mpesaAmount : (record.data as CashCollection).mpesaAmount || 0;
        const calculatedTotal = cashAmount + mpesaAmount;
        updatedData.totalAmount = calculatedTotal;
        
        // Validate allocations match collected amount
        const currentAllocations = editValues.allocations || (record.data as CashCollection).allocations || [];
        const totalAllocations = currentAllocations.reduce((sum: number, allocation: any) => sum + (allocation.amount || 0), 0);
        
        if (Math.abs(calculatedTotal - totalAllocations) > 0.01) {
          toast({
            title: "Allocation Mismatch",
            description: `Total collected (${formatAmount(calculatedTotal)}) must match total allocated (${formatAmount(totalAllocations)})`,
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }
      }
      
      switch (type) {
        case 'cash':
          await dbOperations.updateCashCollection(record.id, updatedData as CashCollection);
          break;
        case 'loan':
          await dbOperations.updateLoanApplication(record.id, updatedData as LoanApplication);
          break;
        case 'advance':
          await dbOperations.updateAdvanceLoan(record.id, updatedData as AdvanceLoan);
          break;
        case 'group':
          await dbOperations.updateGroupCollection(record.id, updatedData as GroupCollection);
          break;
      }

      toast({
        title: "Success",
        description: "Record updated successfully",
      });

      setEditValues({});
      
      if (onSaved) {
        onSaved();
      }
      
    } catch (error) {
      console.error('Failed to update record:', error);
      toast({
        title: "Error",
        description: "Failed to update record",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (!confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(true);
      
      switch (type) {
        case 'cash':
          await dbOperations.deleteCashCollection(record.id);
          break;
        case 'loan':
          await dbOperations.deleteLoanApplication(record.id);
          break;
        case 'advance':
          await dbOperations.deleteAdvanceLoan(record.id);
          break;
        case 'group':
          await dbOperations.deleteGroupCollection(record.id);
          break;
        default:
          toast({
            title: "Not Implemented",
            description: `Delete functionality for ${type} records is not yet implemented`,
            variant: "destructive",
          });
          return;
      }

      toast({
        title: "Success",
        description: "Record deleted successfully",
      });

      onBack();
      
    } catch (error) {
      console.error('Failed to delete record:', error);
      toast({
        title: "Error",
        description: "Failed to delete record",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const renderEditableField = (
    label: string,
    fieldName: string,
    value: any,
    fieldType: 'text' | 'number' = 'text',
    icon?: React.ReactNode
  ) => {
    const currentValue = editValues[fieldName] !== undefined ? editValues[fieldName] : value;
    const isEditing = editingField === fieldName;

    return (
      <div className="group relative">
        <Label className="text-sm font-semibold mb-2 flex items-center gap-2">
          {icon}
          {label}
        </Label>
        <div className="relative">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type={fieldType}
                  value={currentValue}
                  onChange={(e) => setEditValues({
                    ...editValues,
                    [fieldName]: fieldType === 'number' ? Number(e.target.value) : e.target.value
                  })}
                  className="pr-10 border-2 border-blue-500 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all text-base h-11"
                  autoFocus
                />
                {fieldType === 'number' && (
                  <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <Button
                size="sm"
                onClick={() => handleFieldSave(fieldName)}
                className="bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white px-2.5 h-11 w-11"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancelEdit}
                className="px-2.5 h-11 w-11"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div 
              className="relative flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border hover:border-blue-500 dark:hover:border-blue-600 transition-all cursor-pointer group-hover:shadow-sm"
              onClick={() => handleEdit(fieldName, value)}
            >
              <div className="flex items-center gap-3">
                {fieldType === 'number' && (
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                    <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                )}
                <span className="font-medium text-base">
                  {fieldType === 'number' && typeof currentValue === 'number' 
                    ? formatAmount(currentValue)
                    : currentValue || 'N/A'
                  }
                </span>
              </div>
              <Edit3 className="h-4 w-4 text-blue-500 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderReadOnlyField = (label: string, value: any, icon?: React.ReactNode) => (
    <div>
      <Label className="text-sm font-semibold mb-2 flex items-center gap-2">
        {icon}
        {label}
      </Label>
      <div className="p-3 bg-muted/50 rounded-lg border border-border">
        <span className="font-medium text-base">{value || 'N/A'}</span>
      </div>
    </div>
  );

  const addNewAllocation = () => {
    const data = record.data as CashCollection;
    const currentAllocations = editValues.allocations || data.allocations || [];
    const newAllocation = {
      type: '',
      amount: 0,
      reason: ''
    };
    
    setEditValues({
      ...editValues,
      allocations: [...currentAllocations, newAllocation]
    });
  };

  const removeAllocation = (index: number) => {
    const data = record.data as CashCollection;
    const currentAllocations = editValues.allocations || data.allocations || [];
    const updatedAllocations = currentAllocations.filter((_: any, i: number) => i !== index);
    
    setEditValues({
      ...editValues,
      allocations: updatedAllocations
    });
  };

  const updateAllocation = (index: number, field: string, value: any) => {
    const data = record.data as CashCollection;
    const currentAllocations = editValues.allocations || data.allocations || [];
    const updatedAllocations = [...currentAllocations];
    updatedAllocations[index] = {
      ...updatedAllocations[index],
      [field]: value
    };
    
    setEditValues({
      ...editValues,
      allocations: updatedAllocations
    });
  };

  const renderCashCollectionDetails = () => {
    const data = record.data as CashCollection;
    if (!data) {
      return <p className="text-muted-foreground text-sm">No data available</p>;
    }

    const currentAllocations = editValues.allocations || data.allocations || [];
    const currentCashAmount = editValues.cashAmount !== undefined ? editValues.cashAmount : (data.cashAmount || 0);
    const currentMpesaAmount = editValues.mpesaAmount !== undefined ? editValues.mpesaAmount : (data.mpesaAmount || 0);
    const calculatedTotal = currentCashAmount + currentMpesaAmount;
    const totalAllocations = currentAllocations.reduce((sum: number, allocation: any) => sum + (allocation.amount || 0), 0);
    
    return (
      <>
        <Card className="shadow-card bg-card">
          <CardHeader className="border-b bg-muted/30 p-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Transaction Amounts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {renderEditableField('Cash Amount', 'cashAmount', data.cashAmount || 0, 'number')}
            {renderEditableField('M-Pesa Amount', 'mpesaAmount', data.mpesaAmount || 0, 'number')}
            
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase mb-1">Collected</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{formatAmount(calculatedTotal)}</p>
              </div>
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900">
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase mb-1">Allocated</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{formatAmount(totalAllocations)}</p>
              </div>
            </div>
            
            {Math.abs(calculatedTotal - totalAllocations) > 0.01 && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm text-amber-900 dark:text-amber-100">Mismatch</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Difference: {formatAmount(Math.abs(calculatedTotal - totalAllocations))}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card bg-card">
          <CardHeader className="border-b bg-muted/30 p-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              Member Allocations
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {currentAllocations.length > 0 ? (
                <>
                  {currentAllocations.map((allocation: any, index: number) => (
                    <Card key={index} className="border-2 hover:border-blue-500 dark:hover:border-blue-600 transition-all shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-4">
                          <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg flex-1 mr-3">
                            <Label className="text-sm font-bold block">
                              Allocation {index + 1} {allocation.type ? `- ${getDisplayName(allocation.type)}` : ''}
                            </Label>
                            {allocation.type === 'other' && allocation.reason && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {allocation.reason}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeAllocation(index)}
                            className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg flex-shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-sm font-semibold mb-2 block">Type</Label>
                            <Select
                              value={allocation.type}
                              onValueChange={(value) => updateAllocation(index, 'type', value)}
                            >
                              <SelectTrigger className="border-2 hover:border-blue-500 dark:hover:border-blue-600 transition-colors h-11 text-base">
                                <SelectValue placeholder="Select type">
                                  {allocation.type ? getDisplayName(allocation.type) : 'Select type'}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {getAvailableAllocationTypes().map((type) => (
                                  <SelectItem key={type} value={type} className="text-base">
                                    {getDisplayName(type)}
                                  </SelectItem>
                                ))}
                                {allocation.type && !getAvailableAllocationTypes().includes(allocation.type) && (
                                  <SelectItem value={allocation.type} className="text-base">
                                    {getDisplayName(allocation.type)}
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label className="text-sm font-semibold mb-2 block">Amount</Label>
                            <div className="relative">
                              <Input
                                type="number"
                                value={allocation.amount}
                                onChange={(e) => updateAllocation(index, 'amount', Number(e.target.value))}
                                min="0"
                                className="pr-10 border-2 hover:border-blue-500 dark:hover:border-blue-600 transition-colors h-11 text-base"
                              />
                              <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </div>
                        
                        {allocation.type === 'other' && (
                          <div className="mt-4">
                            <Label className="text-sm font-semibold mb-2 block">Reason</Label>
                            <Select
                              value={allocation.reason || ''}
                              onValueChange={(value) => updateAllocation(index, 'reason', value)}
                            >
                              <SelectTrigger className="border-2 hover:border-blue-500 dark:hover:border-blue-600 transition-colors h-11 text-base">
                                <SelectValue placeholder="Select reason">
                                  {allocation.reason || 'Select reason'}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {getAvailableReasons().map((reason) => (
                                  <SelectItem key={reason} value={reason} className="text-base">
                                    {reason}
                                  </SelectItem>
                                ))}
                                {allocation.reason && !getAvailableReasons().includes(allocation.reason) && (
                                  <SelectItem value={allocation.reason} className="text-base">
                                    {allocation.reason}
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={addNewAllocation}
                    className="w-full border-2 border-dashed hover:border-blue-500 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 h-12 text-base"
                    disabled={getAvailableAllocationTypes().length === 0}
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add Allocation
                  </Button>
                </>
              ) : (
                <div className="text-center py-12 bg-muted/30 rounded-xl border-2 border-dashed">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-foreground font-medium text-base mb-2">No allocations</p>
                  <p className="text-sm text-muted-foreground mb-4">Add your first allocation</p>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={addNewAllocation}
                    className="border-2 hover:border-blue-500 dark:hover:border-blue-600"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add Allocation
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </>
    );
  };

  const renderLoanApplicationDetails = () => {
    const data = record.data as LoanApplication;
    if (!data) {
      return <p className="text-muted-foreground text-sm">No data available</p>;
    }
    
    return (
      <div className="space-y-4">
        {renderEditableField('Loan Amount', 'loanAmount', data.loanAmount || 0, 'number', <DollarSign className="h-4 w-4 text-blue-600" />)}
        {renderEditableField('Purpose', 'purpose', data.purpose || '', 'text', <FileText className="h-4 w-4 text-purple-600" />)}
        {renderEditableField('Tenure (Months)', 'tenure', data.tenure || 0, 'number', <Calendar className="h-4 w-4 text-emerald-600" />)}
        {renderReadOnlyField('Interest Rate', `${data.interestRate || 0}%`)}
        {renderReadOnlyField('Monthly Installment', formatAmount(data.installments || 0))}
        {renderReadOnlyField('Guarantors', data.guarantors?.join(', ') || 'None', <Users className="h-4 w-4 text-blue-600" />)}
      </div>
    );
  };

  const renderAdvanceLoanDetails = () => {
    const data = record.data as AdvanceLoan;
    if (!data) {
      return <p className="text-muted-foreground text-sm">No data available</p>;
    }
    
    return (
      <div className="space-y-4">
        {renderEditableField('Amount', 'amount', data.amount || 0, 'number', <DollarSign className="h-4 w-4 text-blue-600" />)}
        {renderEditableField('Reason', 'reason', data.reason || '', 'text', <FileText className="h-4 w-4 text-purple-600" />)}
        {renderEditableField('Repayment Date', 'repaymentDate', data.repaymentDate || '', 'text', <Calendar className="h-4 w-4 text-emerald-600" />)}
      </div>
    );
  };

  const renderGroupCollectionDetails = () => {
    const data = record.data as GroupCollection;
    if (!data) {
      return <p className="text-muted-foreground text-sm">No data available</p>;
    }
    
    return (
      <div className="space-y-4">
        {renderEditableField('Group Name', 'groupName', data.groupName || '', 'text', <Users className="h-4 w-4 text-purple-600" />)}
        {renderEditableField('Cash Collected', 'cashCollected', data.cashCollected || 0, 'number', <DollarSign className="h-4 w-4 text-blue-600" />)}
        {renderEditableField('Fines Collected', 'finesCollected', data.finesCollected || 0, 'number', <DollarSign className="h-4 w-4 text-red-600" />)}
        {renderReadOnlyField('Total Collection', formatAmount((data.cashCollected || 0) + (data.finesCollected || 0)))}
      </div>
    );
  };

  const renderDetailsByType = () => {
    switch (type) {
      case 'cash':
        return renderCashCollectionDetails();
      case 'loan':
        return renderLoanApplicationDetails();
      case 'advance':
        return renderAdvanceLoanDetails();
      case 'group':
        return renderGroupCollectionDetails();
      default:
        return null;
    }
  };

  const hasChanges = Object.keys(editValues).length > 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="w-full space-y-3 px-1 py-3">
        <Card className="shadow-card bg-card">
          <CardHeader className="p-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onBack();
                }}
                className="h-10 w-10 rounded-full border-2 hover:bg-accent flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base font-bold truncate">{getTypeTitle()}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">Review and edit transaction</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="shadow-card bg-card overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex items-center justify-center w-14 h-14 bg-white/20 backdrop-blur rounded-full border-2 border-white/40 flex-shrink-0">
                  <User className="h-7 w-7 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-base text-white truncate">
                      {getMemberDisplayName()}
                    </h3>
                    {getStatusIcon(record.status)}
                  </div>
                  <p className="text-xs text-blue-100 dark:text-blue-200 truncate">Record ID: {record.id}</p>
                  <p className="text-xs text-blue-100 dark:text-blue-200 flex items-center gap-1 mt-1">
                    <Calendar className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{formatDateTime(record.lastUpdated)}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 items-end flex-shrink-0">
                {getStatusBadge(record.status)}
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/20 border-white/40 text-white hover:bg-white/30 backdrop-blur h-8 text-xs px-3"
                  onClick={handleDeleteRecord}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {type !== 'cash' && (
          <Card className="shadow-card bg-card">
            <CardHeader className="border-b bg-muted/30 p-4">
              <CardTitle className="text-base font-bold">Transaction Details</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {renderDetailsByType()}
            </CardContent>
          </Card>
        )}

        {type === 'cash' && renderDetailsByType()}

        {hasChanges && (
          <div className="fixed bottom-3 left-1 right-1 z-50">
            <Card className="shadow-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 border-0">
              <CardContent className="p-3">
                <Button 
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="w-full bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 hover:bg-gray-50 dark:hover:bg-slate-800 font-bold text-base h-12 shadow-lg"
                  size="lg"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-5 w-5" />
                      Save Changes
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
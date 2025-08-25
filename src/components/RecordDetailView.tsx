import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
// import { Keyboard } from "@capacitor/keyboard";

import { 
  ArrowLeft, 
  Edit3, 
  Save, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  User,
  Banknote,
  CreditCard,
  Plus,
  Trash2
} from "lucide-react";
import { dbOperations, CashCollection, LoanApplication, AdvanceLoan } from "@/lib/database";

interface RecordDetailViewProps {
  record: {
    id: string;
    memberId: string;
    amount?: number;
    status: 'synced' | 'pending' | 'failed';
    lastUpdated: string;
    data: CashCollection | LoanApplication | AdvanceLoan;
  };
  type: 'cash' | 'loan' | 'advance';
  onBack: () => void;
}

export function RecordDetailView({ record, type, onBack }: RecordDetailViewProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Available allocation types and reasons
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

  // Mobile keyboard handling will be added later when Capacitor is properly configured

  // Helper function to get display name for allocation type
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
        // Fallback: capitalize first letter and replace underscores with spaces
        return allocationType.charAt(0).toUpperCase() + allocationType.slice(1).replace(/_/g, ' ');
    }
  };

  // Get original cash amount for validation
  const getOriginalCashAmount = () => {
    if (type === 'cash') {
      const data = record.data as CashCollection;
      return data.cashAmount || 0;
    }
    return 0;
  };

  const getTypeTitle = () => {
    switch (type) {
      case 'cash':
        return 'Cash Collection Details';
      case 'loan':
        return 'Loan Application Details';
      case 'advance':
        return 'Advance Loan Details';
      default:
        return 'Record Details';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'synced':
        return <Badge variant="default" className="bg-success text-success-foreground">Synced</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-warning text-warning-foreground">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
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
        month: 'long',
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
    
    const memberName = record.data?.memberName;
    if (memberName) {
      return `${memberName} (${record.memberId})`;
    }
    return `Member ${record.memberId}`;
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
      
      const updatedData = { ...record.data, ...editValues };
      
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
      }

      toast({
        title: "Success",
        description: "Record updated successfully",
      });

      setEditValues({});
      
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

  const renderEditableField = (
    label: string,
    fieldName: string,
    value: any,
    fieldType: 'text' | 'number' = 'text',
    minValue?: number
  ) => {
    const currentValue = editValues[fieldName] !== undefined ? editValues[fieldName] : value;
    const isEditing = editingField === fieldName;

    // Validation for cash amount - cannot be decreased
    const isValidValue = () => {
      if (fieldName === 'cashAmount' && fieldType === 'number' && minValue !== undefined) {
        return currentValue >= minValue;
      }
      return true;
    };

    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Input
                type={fieldType}
                value={currentValue}
                min={minValue}
                onChange={(e) => setEditValues({
                  ...editValues,
                  [fieldName]: fieldType === 'number' ? Number(e.target.value) : e.target.value
                })}
                className={`flex-1 ${!isValidValue() ? 'border-destructive' : ''}`}
              />
              <Button
                size="sm"
                onClick={() => handleFieldSave(fieldName)}
                disabled={!isValidValue()}
                className="px-3"
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancelEdit}
                className="px-3"
              >
                ×
              </Button>
            </>
          ) : (
            <>
              <div className="flex-1 p-2 bg-muted/30 rounded border">
                {fieldType === 'number' && typeof currentValue === 'number' 
                  ? formatAmount(currentValue)
                  : currentValue || 'N/A'
                }
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleEdit(fieldName, value)}
                className="px-3"
              >
                <Edit3 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
        {fieldName === 'cashAmount' && minValue !== undefined && (
          <p className="text-xs text-muted-foreground">
            Cash amount can only be increased (minimum: {formatAmount(minValue)})
          </p>
        )}
      </div>
    );
  };

  const renderReadOnlyField = (label: string, value: any) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="p-2 bg-muted/50 rounded border text-muted-foreground">
        {value || 'N/A'}
      </div>
    </div>
  );

  const addNewAllocation = () => {
    const data = record.data as CashCollection;
    const currentAllocations = editValues.allocations || data.allocations || [];
    const newAllocation = {
      type: 'savings',
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
    const updatedAllocations = currentAllocations.filter((_, i) => i !== index);
    
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
      return <p className="text-muted-foreground">No data available</p>;
    }

    const originalCashAmount = getOriginalCashAmount();
    const currentAllocations = editValues.allocations || data.allocations || [];
    
    // Calculate current values
    const currentCashAmount = editValues.cashAmount !== undefined ? editValues.cashAmount : (data.cashAmount || 0);
    const currentMpesaAmount = editValues.mpesaAmount !== undefined ? editValues.mpesaAmount : (data.mpesaAmount || 0);
    const calculatedTotal = currentCashAmount + currentMpesaAmount;
    
    // Calculate total allocations
    const totalAllocations = currentAllocations.reduce((sum, allocation) => sum + (allocation.amount || 0), 0);
    
    return (
      <>
        {/* Transaction amounts */}
        {renderEditableField('Cash Amount', 'cashAmount', data.cashAmount || 0, 'number', originalCashAmount)}
        {renderEditableField('M-Pesa Amount', 'mpesaAmount', data.mpesaAmount || 0, 'number')}
        {renderReadOnlyField('Total Amount (Cash + M-Pesa)', formatAmount(calculatedTotal))}
        {renderReadOnlyField('Total Allocations', formatAmount(totalAllocations))}
        
        {/* Member Allocations */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Member Allocations</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={addNewAllocation}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Allocation
            </Button>
          </div>
          
          <div className="space-y-2">
            {currentAllocations.length > 0 ? (
              currentAllocations.map((allocation, index) => (
                <Card key={index} className="p-3">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Allocation {index + 1}</Label>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeAllocation(index)}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-sm">Type</Label>
                        <Select
                          value={allocation.type}
                          onValueChange={(value) => updateAllocation(index, 'type', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type">
                              {allocation.type ? getDisplayName(allocation.type) : 'Select type'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {allocationTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {getDisplayName(type)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm">Amount</Label>
                        <Input
                          type="number"
                          value={allocation.amount}
                          onChange={(e) => updateAllocation(index, 'amount', Number(e.target.value))}
                          min="0"
                        />
                      </div>
                    </div>
                    
                    {allocation.type === 'other' && (
                      <div className="space-y-2">
                        <Label className="text-sm">Reason</Label>
                        <Select
                          value={allocation.reason || ''}
                          onValueChange={(value) => updateAllocation(index, 'reason', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select reason">
                              {allocation.reason || 'Select reason'}
                            </SelectValue>
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
                </Card>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No allocations recorded</p>
            )}
          </div>
        </div>
      </>
    );
  };

  const renderLoanApplicationDetails = () => {
    const data = record.data as LoanApplication;
    if (!data) {
      return <p className="text-muted-foreground">No data available</p>;
    }
    
    return (
      <>
        {/* Loan details */}
        {renderEditableField('Loan Amount', 'loanAmount', data.loanAmount || 0, 'number')}
        {renderEditableField('Purpose', 'purpose', data.purpose || '')}
        {renderEditableField('Tenure (Months)', 'tenure', data.tenure || 0, 'number')}
        {renderReadOnlyField('Interest Rate', `${data.interestRate || 0}%`)}
        {renderReadOnlyField('Monthly Installment', formatAmount(data.installments || 0))}
        {renderReadOnlyField('Guarantors', data.guarantors?.join(', ') || 'None')}
      </>
    );
  };

  const renderAdvanceLoanDetails = () => {
    const data = record.data as AdvanceLoan;
    if (!data) {
      return <p className="text-muted-foreground">No data available</p>;
    }
    
    return (
      <>
        {/* Advance loan details */}
        {renderEditableField('Amount', 'amount', data.amount || 0, 'number')}
        {renderEditableField('Reason', 'reason', data.reason || '')}
        {renderEditableField('Repayment Date', 'repaymentDate', data.repaymentDate || '')}
      </>
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
      default:
        return null;
    }
  };

  const hasChanges = Object.keys(editValues).length > 0;

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

      {/* Member Info Card - Shows member info only once */}
      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-lg">
                    {getMemberDisplayName()}
                  </h3>
                  {getStatusIcon(record.status)}
                </div>
                <p className="text-sm text-muted-foreground">
                  Record ID: {record.id}
                </p>
                <p className="text-sm text-muted-foreground">
                  Last updated: {formatDateTime(record.lastUpdated)}
                </p>
              </div>
            </div>
            {getStatusBadge(record.status)}
          </div>
        </CardContent>
      </Card>

      {/* Transaction Details - Only shows transaction-specific fields */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Transaction Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderDetailsByType()}
        </CardContent>
      </Card>

      {/* Save Changes Button */}
      {hasChanges && (
        <Card className="shadow-card">
          <CardContent className="p-4">
            <Button 
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="w-full"
              size="lg"
            >
              {isSaving ? (
                <>
                  <Save className="mr-2 h-4 w-4 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
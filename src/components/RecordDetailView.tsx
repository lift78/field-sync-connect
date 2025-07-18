import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Edit3, 
  Save, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  User,
  Banknote,
  CreditCard
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
    return new Intl.DateTimeFormat('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoString));
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
    // The field value is already in editValues, we'll save all changes when Save Changes is clicked
  };

  const handleSaveChanges = async () => {
    try {
      setIsSaving(true);
      
      // Create updated record with changes
      const updatedData = { ...record.data, ...editValues };
      
      // Update in database based on type
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

      // Clear edit values
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
    type: 'text' | 'number' = 'text'
  ) => {
    const currentValue = editValues[fieldName] !== undefined ? editValues[fieldName] : value;
    const isEditing = editingField === fieldName;

    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Input
                type={type}
                value={currentValue}
                onChange={(e) => setEditValues({
                  ...editValues,
                  [fieldName]: type === 'number' ? Number(e.target.value) : e.target.value
                })}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={() => handleFieldSave(fieldName)}
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
                {type === 'number' && typeof currentValue === 'number' 
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

  const renderCashCollectionDetails = () => {
    const data = record.data as CashCollection;
    return (
      <>
        {renderEditableField('Cash Amount', 'amount', data.amount, 'number')}
        {renderEditableField('M-Pesa Amount', 'mpesaAmount', data.mpesaAmount, 'number')}
        
        {/* Member Allocations */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Member Allocations</Label>
          <div className="space-y-2">
            {data.allocations?.map((allocation, index) => (
              <Card key={index} className="p-3">
                <div className="grid grid-cols-2 gap-3">
                  {renderReadOnlyField('Member ID', allocation.memberId)}
                  {renderEditableField(
                    'Amount', 
                    `allocations.${index}.amount`, 
                    allocation.amount, 
                    'number'
                  )}
                </div>
              </Card>
            )) || <p className="text-muted-foreground text-sm">No allocations recorded</p>}
          </div>
        </div>
      </>
    );
  };

  const renderLoanApplicationDetails = () => {
    const data = record.data as LoanApplication;
    return (
      <>
        {renderEditableField('Loan Amount', 'loanAmount', data.loanAmount, 'number')}
        {renderEditableField('Purpose', 'purpose', data.purpose)}
        {renderEditableField('Tenure (Months)', 'tenure', data.tenure, 'number')}
        {renderReadOnlyField('Interest Rate', `${data.interestRate}%`)}
      </>
    );
  };

  const renderAdvanceLoanDetails = () => {
    const data = record.data as AdvanceLoan;
    return (
      <>
        {renderEditableField('Amount', 'amount', data.amount, 'number')}
        {renderEditableField('Reason', 'reason', data.reason)}
        {renderEditableField('Repayment Date', 'repaymentDate', data.repaymentDate)}
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

      {/* Record Status and Info */}
      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-full">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <p className="font-semibold">
                    {(record.data as any).memberName ? 
                      `${(record.data as any).memberName} (${record.memberId})` : 
                      `Member ${record.memberId}`
                    }
                  </p>
                  {getStatusIcon(record.status)}
                </div>
                <p className="text-sm text-muted-foreground">
                  Last updated: {formatDateTime(record.lastUpdated)}
                </p>
              </div>
            </div>
            {getStatusBadge(record.status)}
          </div>
        </CardContent>
      </Card>

      {/* Record Details */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Record Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Non-editable fields */}
          {renderReadOnlyField('Member ID', record.memberId)}
          {renderReadOnlyField('Record ID', record.id)}
          
          {/* Editable fields by type */}
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
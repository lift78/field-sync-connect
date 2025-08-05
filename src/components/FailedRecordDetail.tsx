import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Edit, X } from 'lucide-react';
import { CashCollection, LoanApplication, LoanDisbursement, AdvanceLoan } from '@/lib/database';

interface FailedRecordDetailProps {
  record: CashCollection | LoanApplication | LoanDisbursement | AdvanceLoan | null;
  recordType: 'cashCollections' | 'loanApplications' | 'loanDisbursements' | 'advanceLoans' | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (record: any, type: string) => void;
}

export function FailedRecordDetail({ 
  record, 
  recordType, 
  isOpen, 
  onClose, 
  onEdit 
}: FailedRecordDetailProps) {
  if (!record || !recordType) return null;

  const getRecordTitle = () => {
    switch (recordType) {
      case 'cashCollections':
        const cashRecord = record as CashCollection;
        return `Cash Collection - ${cashRecord.memberName}`;
      case 'loanApplications':
        const loanRecord = record as LoanApplication;
        return `Loan Application - ${loanRecord.memberName}`;
      case 'loanDisbursements':
        const disbursementRecord = record as LoanDisbursement;
        return `Loan Disbursement - ${disbursementRecord.loanId}`;
      case 'advanceLoans':
        const advanceRecord = record as AdvanceLoan;
        return `Advance Loan - ${advanceRecord.memberName}`;
      default:
        return 'Failed Record';
    }
  };

  const getRecordSummary = () => {
    switch (recordType) {
      case 'cashCollections':
        const cashRecord = record as CashCollection;
        return (
          <div className="space-y-2">
            <p><strong>Member:</strong> {cashRecord.memberName} ({cashRecord.memberId})</p>
            <p><strong>Total Amount:</strong> KSH {cashRecord.totalAmount.toLocaleString()}</p>
            <p><strong>Cash:</strong> KSH {cashRecord.cashAmount.toLocaleString()}</p>
            <p><strong>M-Pesa:</strong> KSH {cashRecord.mpesaAmount.toLocaleString()}</p>
            <p><strong>Date:</strong> {new Date(cashRecord.timestamp).toLocaleDateString()}</p>
          </div>
        );
      case 'loanApplications':
        const loanRecord = record as LoanApplication;
        return (
          <div className="space-y-2">
            <p><strong>Member:</strong> {loanRecord.memberName} ({loanRecord.memberId})</p>
            <p><strong>Amount:</strong> KSH {loanRecord.loanAmount.toLocaleString()}</p>
            <p><strong>Installments:</strong> {loanRecord.installments}</p>
            <p><strong>Purpose:</strong> {loanRecord.purpose || 'Not specified'}</p>
            <p><strong>Date:</strong> {new Date(loanRecord.timestamp).toLocaleDateString()}</p>
          </div>
        );
      case 'loanDisbursements':
        const disbursementRecord = record as LoanDisbursement;
        return (
          <div className="space-y-2">
            <p><strong>Loan ID:</strong> {disbursementRecord.loanId}</p>
            <p><strong>Type:</strong> {disbursementRecord.amountType === 'all' ? 'Full Amount' : 'Custom Amount'}</p>
            {disbursementRecord.customAmount && (
              <p><strong>Custom Amount:</strong> KSH {disbursementRecord.customAmount.toLocaleString()}</p>
            )}
            <p><strong>Date:</strong> {new Date(disbursementRecord.timestamp).toLocaleDateString()}</p>
          </div>
        );
      case 'advanceLoans':
        const advanceRecord = record as AdvanceLoan;
        return (
          <div className="space-y-2">
            <p><strong>Member:</strong> {advanceRecord.memberName} ({advanceRecord.memberId})</p>
            <p><strong>Amount:</strong> KSH {advanceRecord.amount.toLocaleString()}</p>
            <p><strong>Reason:</strong> {advanceRecord.reason || 'Not specified'}</p>
            <p><strong>Date:</strong> {new Date(advanceRecord.timestamp).toLocaleDateString()}</p>
          </div>
        );
      default:
        return null;
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(record, recordType);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {getRecordTitle()}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Record Details</h4>
            {getRecordSummary()}
          </div>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Sync Error:</strong><br />
              {record.syncError || 'Unknown error occurred during sync'}
            </AlertDescription>
          </Alert>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
            {onEdit && (
              <Button onClick={handleEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Record
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
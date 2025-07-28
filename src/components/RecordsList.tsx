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
  Loader2
} from "lucide-react";
import { dbOperations, CashCollection, LoanApplication, AdvanceLoan } from "@/lib/database";

interface Record {
  id: string;
  memberId: string;
  amount?: number;
  status: 'synced' | 'pending' | 'failed';
  lastUpdated: string;
  data: any; // Full form data for editing
}

interface RecordsListProps {
  type: 'cash' | 'loan' | 'advance';
  onBack: () => void;
  onEditRecord: (record: Record) => void;
}

export function RecordsList({ type, onBack, onEditRecord }: RecordsListProps) {
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRecords = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let data: (CashCollection | LoanApplication | AdvanceLoan)[] = [];
        
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
        }

        // Convert database records to Record interface
        const formattedRecords: Record[] = data.map((item) => ({
          id: item.id?.toString() || '',
          memberId: item.memberId,
          amount: 'amount' in item ? item.amount : 
                 'loanAmount' in item ? item.loanAmount : undefined,
          status: item.synced ? 'synced' : 'pending',
          lastUpdated: item.timestamp.toISOString(),
          data: item // Store full record for editing
        }));

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

  const getTypeTitle = () => {
    switch (type) {
      case 'cash':
        return 'Cash Collection Records';
      case 'loan':
        return 'Loan Application Records';
      case 'advance':
        return 'Advance Loan Records';
      default:
        return 'Records';
    }
  };

  const getStatusIcon = (status: Record['status']) => {
    switch (status) {
      case 'synced':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusBadge = (status: Record['status']) => {
    switch (status) {
      case 'synced':
        return <Badge variant="default" className="bg-success text-success-foreground">Synced</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-warning text-warning-foreground">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
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

  const getMemberDisplayName = (record: Record) => {
    // Try to get member name from the full data
    const fullData = record.data as any;
    if (fullData?.memberName) {
      return `${fullData.memberName} (${record.memberId})`;
    }
    return `Member ${record.memberId}`;
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
            className="shadow-card cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => onEditRecord(record)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-full">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className="font-semibold">{getMemberDisplayName(record)}</p>
                      {getStatusIcon(record.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(record.lastUpdated)}
                    </p>
                    {record.amount && (
                      <p className="text-sm font-medium text-primary">
                        {formatAmount(record.amount)}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {getStatusBadge(record.status)}
                  <Edit3 className="h-4 w-4 text-muted-foreground" />
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
    </div>
  );
}
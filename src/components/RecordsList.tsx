import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Edit3, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  User
} from "lucide-react";

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
  // Mock data - in real app this would come from IndexedDB
  const mockRecords: Record[] = [
    {
      id: '1',
      memberId: '0001',
      amount: 15000,
      status: 'pending',
      lastUpdated: '2024-01-15T10:30:00Z',
      data: { /* full form data */ }
    },
    {
      id: '2',
      memberId: '0023',
      amount: 8500,
      status: 'synced',
      lastUpdated: '2024-01-15T09:15:00Z',
      data: { /* full form data */ }
    },
    {
      id: '3',
      memberId: '0156',
      amount: 12000,
      status: 'failed',
      lastUpdated: '2024-01-15T08:45:00Z',
      data: { /* full form data */ }
    },
  ];

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
        {mockRecords.map((record) => (
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
                      <p className="font-semibold">Member {record.memberId}</p>
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

      {mockRecords.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No records found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
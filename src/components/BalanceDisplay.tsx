import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Equal } from 'lucide-react';

interface BalanceDisplayProps {
  label: string;
  currentBalance: number;
  newAmount: number;
  type: 'savings' | 'loan' | 'advance';
}

export function BalanceDisplay({ label, currentBalance, newAmount, type }: BalanceDisplayProps) {
  const carriedForward = type === 'savings' 
    ? currentBalance + newAmount 
    : currentBalance - newAmount;
  
  const difference = carriedForward - currentBalance;
  const isIncrease = difference > 0;
  const isDecrease = difference < 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getBalanceColor = (balance: number, type: string) => {
    if (type === 'savings') return balance >= 0 ? 'text-green-600' : 'text-red-600';
    if (type === 'loan' || type === 'advance') return balance > 0 ? 'text-orange-600' : 'text-green-600';
    return 'text-foreground';
  };

  const getChangeIcon = () => {
    if (isIncrease) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (isDecrease) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Equal className="h-3 w-3 text-muted-foreground" />;
  };

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {newAmount > 0 && (
          <Badge variant="outline" className="text-xs">
            +{formatCurrency(newAmount)}
          </Badge>
        )}
      </div>
      
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Current:</span>
          <span className={getBalanceColor(currentBalance, type)}>
            {formatCurrency(currentBalance)}
          </span>
        </div>
        
        {newAmount > 0 && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Carried Forward:</span>
              {getChangeIcon()}
            </div>
            <span className={`font-medium ${getBalanceColor(carriedForward, type)}`}>
              {formatCurrency(carriedForward)}
            </span>
          </div>
        )}
      </div>

      {Math.abs(difference) > 0 && newAmount > 0 && (
        <div className="text-xs text-muted-foreground pt-1 border-t">
          {isIncrease ? 'Increase' : 'Decrease'} of {formatCurrency(Math.abs(difference))}
        </div>
      )}
    </Card>
  );
}
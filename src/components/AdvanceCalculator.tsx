import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calculator, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Configuration constants
const ADVANCE_INTEREST_RATE = 0.1; // 10% interest rate
const ADVANCE_FIXED_FINE = 10; // 10 KES fixed fine

interface AdvanceCalculatorProps {
  onAmountSelect?: (amount: number) => void;
  currentAmount?: number;
  currentBalance?: number;
}

interface CalculatorDialogProps extends AdvanceCalculatorProps {
  trigger?: React.ReactNode;
}

interface PaymentSplit {
  current_balance: number;
  pay_advance: number;
  pay_advance_interest: number;
  remaining_balance: number;
  is_valid: boolean;
  message: string;
  has_penalty: boolean;
  penalty_amount: number;
  minimum_required_amount: number;
}

/**
 * Split the advance payment amount into principal (pay_advance) and interest (pay_advance_interest)
 * using simultaneous equations - matches Python backend logic exactly.
 */
function splitAdvancePayment(currentBalance: number, amountForAdvancePayment: number): Omit<PaymentSplit, 'current_balance' | 'is_valid' | 'message' | 'has_penalty' | 'penalty_amount' | 'minimum_required_amount'> {
  // Handle case where no advance balance exists
  if (currentBalance <= 0) {
    return {
      pay_advance: 0,
      pay_advance_interest: 0,
      remaining_balance: 0
    };
  }
  
  // Handle case where payment amount is 0
  if (amountForAdvancePayment <= 0) {
    return {
      pay_advance: 0,
      pay_advance_interest: 0,
      remaining_balance: currentBalance
    };
  }
  
  // Case 1: Full payment - no interest required
  if (amountForAdvancePayment >= currentBalance) {
    return {
      pay_advance: currentBalance,
      pay_advance_interest: 0,
      remaining_balance: 0
    };
  }
  
  // Case 2: Partial payment - solve simultaneous equations
  const interestComponent = currentBalance * ADVANCE_INTEREST_RATE / (1 + ADVANCE_INTEREST_RATE);
  
  let payAdvance = (amountForAdvancePayment - interestComponent - ADVANCE_FIXED_FINE) * (1 + ADVANCE_INTEREST_RATE) / 1;
  
  // Ensure pay_advance doesn't exceed current_balance or go negative
  payAdvance = Math.max(0, Math.min(payAdvance, currentBalance));
  
  let payAdvanceInterest;
  
  if (payAdvance >= currentBalance) {
    // Full payment case
    payAdvance = currentBalance;
    payAdvanceInterest = 0;
  } else {
    // Calculate interest for remaining balance
    const remainingBalance = currentBalance - payAdvance;
    const currentPrincipal = remainingBalance / (1 + ADVANCE_INTEREST_RATE);
    payAdvanceInterest = currentPrincipal * ADVANCE_INTEREST_RATE + ADVANCE_FIXED_FINE;
    
    // Round to nearest KES
    payAdvanceInterest = Math.round(payAdvanceInterest);
  }
  
  return {
    pay_advance: Math.round(payAdvance * 100) / 100, // Round to 2 decimal places
    pay_advance_interest: payAdvanceInterest,
    remaining_balance: currentBalance - payAdvance
  };
}

/**
 * Calculate advance payment split for preview with validation
 */
function calculateAdvancePaymentSplit(currentBalance: number, amountForAdvancePayment: number): PaymentSplit {
  if (currentBalance <= 0) {
    return {
      current_balance: 0,
      pay_advance: 0,
      pay_advance_interest: 0,
      remaining_balance: 0,
      is_valid: true,
      message: 'No outstanding advance loan balance',
      has_penalty: false,
      penalty_amount: 0,
      minimum_required_amount: 0
    };
  }
  
  // Check if payment exceeds balance
  if (amountForAdvancePayment > currentBalance) {
    return {
      current_balance: currentBalance,
      pay_advance: currentBalance,
      pay_advance_interest: 0,
      remaining_balance: 0,
      is_valid: false,
      message: `Payment amount (${amountForAdvancePayment.toLocaleString()}) exceeds current balance (${currentBalance.toLocaleString()})`,
      has_penalty: false,
      penalty_amount: 0,
      minimum_required_amount: 0
    };
  }
  
  // Calculate minimum required for no penalty: (current_balance / 1.1 * 0.1 + 10)
  const minimumRequiredAmount = (currentBalance / 1.1) * 0.1 + ADVANCE_FIXED_FINE;
  const hasPenalty = amountForAdvancePayment > 0 && amountForAdvancePayment < minimumRequiredAmount;
  const penaltyAmount = hasPenalty ? (minimumRequiredAmount - amountForAdvancePayment) : 0;
  
  // Split the payment
  const split = splitAdvancePayment(currentBalance, amountForAdvancePayment);
  
  return {
    current_balance: currentBalance,
    pay_advance: split.pay_advance,
    pay_advance_interest: split.pay_advance_interest,
    remaining_balance: split.remaining_balance,
    is_valid: true,
    message: 'Payment split calculated successfully',
    has_penalty: hasPenalty,
    penalty_amount: Math.round(penaltyAmount * 100) / 100,
    minimum_required_amount: Math.round(minimumRequiredAmount * 100) / 100
  };
}

function CalculatorContent({ onAmountSelect, currentAmount, currentBalance }: AdvanceCalculatorProps) {
  // Pre-fill current balance if provided
  const [currentBalanceState, setCurrentBalanceState] = useState<string>(
    currentBalance && currentBalance > 0 ? currentBalance.toString() : ''
  );
  const [paymentAmount, setPaymentAmount] = useState<string>(currentAmount?.toString() || '');

  // Update current balance when prop changes
  useEffect(() => {
    if (currentBalance && currentBalance > 0 && !currentBalanceState) {
      setCurrentBalanceState(currentBalance.toString());
    }
  }, [currentBalance, currentBalanceState]);

  const currentBalanceNum = parseFloat(currentBalanceState) || 0;
  const paymentAmountNum = parseFloat(paymentAmount) || 0;

  // Calculate the split using the local utility function
  const calculation = useMemo(() => {
    if (currentBalanceNum <= 0) {
      return null;
    }
    return calculateAdvancePaymentSplit(currentBalanceNum, paymentAmountNum);
  }, [currentBalanceNum, paymentAmountNum]);

  const handleUseAmount = () => {
    if (paymentAmountNum > 0 && onAmountSelect) {
      onAmountSelect(paymentAmountNum);
    }
  };

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6 w-full max-w-2xl mx-auto">
      {/* Input Section */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Advance Payment Calculator
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Calculate how your advance payment will be split between principal and interest
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="current-balance">Current Advance Balance (KES)</Label>
              <Input
                id="current-balance"
                type="number"
                placeholder="Enter current balance..."
                value={currentBalanceState}
                onChange={(e) => setCurrentBalanceState(e.target.value)}
                className="text-lg"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Payment Amount (KES)</Label>
              <Input
                id="payment-amount"
                type="number"
                placeholder="Enter payment amount..."
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="text-lg"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Section */}
      {calculation && currentBalanceNum > 0 && (
        <div className="space-y-4">
          {/* Payment Status Alert */}
          {calculation.has_penalty && paymentAmountNum > 0 && (
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <strong>Below Minimum Payment:</strong> This payment is below the minimum required amount of {formatAmount(calculation.minimum_required_amount || 0)}.
                Additional penalty of {formatAmount(calculation.penalty_amount || 0)} may apply.
              </AlertDescription>
            </Alert>
          )}

          {paymentAmountNum >= currentBalanceNum && (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <strong>Full Payment:</strong> This amount will fully clear the advance loan with no interest charges.
              </AlertDescription>
            </Alert>
          )}

          {/* Payment Breakdown */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Payment Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                      Current Balance
                    </p>
                    <p className="text-lg font-bold text-blue-900 dark:text-blue-100 mt-1">
                      {formatAmount(calculation.current_balance)}
                    </p>
                  </div>

                  <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">
                      Principal Payment
                    </p>
                    <p className="text-lg font-bold text-green-900 dark:text-green-100 mt-1">
                      {formatAmount(calculation.pay_advance)}
                    </p>
                  </div>

                  <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <p className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                      Interest Payment
                    </p>
                    <p className="text-lg font-bold text-orange-900 dark:text-orange-100 mt-1">
                      {formatAmount(calculation.pay_advance_interest)}
                    </p>
                  </div>

                  <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                      Remaining Balance
                    </p>
                    <p className="text-lg font-bold text-purple-900 dark:text-purple-100 mt-1">
                      {formatAmount(calculation.remaining_balance)}
                    </p>
                  </div>
                </div>

                {/* Detailed Breakdown */}
                <div className="space-y-3 pt-4 border-t border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Payment Amount:</span>
                    <Badge variant="outline" className="font-mono">
                      {formatAmount(paymentAmountNum)}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">→ Principal (pay_advance):</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {formatAmount(calculation.pay_advance)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">→ Interest (pay_advance_interest):</span>
                    <span className="font-medium text-orange-600 dark:text-orange-400">
                      {formatAmount(calculation.pay_advance_interest)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="font-medium">Total Split:</span>
                    <span className="font-bold">
                      {formatAmount(calculation.pay_advance + calculation.pay_advance_interest)}
                    </span>
                  </div>

                  {calculation.minimum_required_amount > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Minimum Required:</span>
                      <span className="text-muted-foreground">
                        {formatAmount(calculation.minimum_required_amount)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Interest Rate Information */}
                <div className="pt-4 border-t border-border">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Interest Rate: {(ADVANCE_INTEREST_RATE * 100)}% + KES {ADVANCE_FIXED_FINE} fixed fine</p>
                    <p>• Calculations based on simultaneous equation method</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Button */}
          {onAmountSelect && paymentAmountNum > 0 && (
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <Button 
                  onClick={handleUseAmount}
                  className="w-full"
                  size="lg"
                >
                  Use This Amount ({formatAmount(paymentAmountNum)})
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Help Information */}
      {currentBalanceNum === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Enter the current advance loan balance to see payment calculations. This calculator helps you understand how your payment will be split between principal(adva paid) and interest(int paid) using the same logic as the backend system.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export function AdvanceCalculator({ onAmountSelect, currentAmount, currentBalance }: AdvanceCalculatorProps) {
  return <CalculatorContent onAmountSelect={onAmountSelect} currentAmount={currentAmount} currentBalance={currentBalance} />;
}

export function AdvanceCalculatorDialog({ trigger, onAmountSelect, currentAmount, currentBalance }: CalculatorDialogProps) {
  const [open, setOpen] = useState(false);

  const handleAmountSelect = (amount: number) => {
    if (onAmountSelect) {
      onAmountSelect(amount);
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Calculator className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Advance Payment Calculator</DialogTitle>
        </DialogHeader>
        <CalculatorContent 
          onAmountSelect={handleAmountSelect} 
          currentAmount={currentAmount}
          currentBalance={currentBalance}
        />
      </DialogContent>
    </Dialog>
  );
}
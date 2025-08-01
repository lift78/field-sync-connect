import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Banknote, Plus, Trash2, Save } from "lucide-react";
import { dbOperations } from "@/lib/database"; // Import database operations
import { useToast } from "@/hooks/use-toast"; // Fix import

interface DisbursementRecord {
  id: string;
  loanId: string;
  amountType: 'all' | 'custom';
  customAmount?: number;
  timestamp: Date;
}

export function LoanDisbursementForm() {
  const [disbursements, setDisbursements] = useState<DisbursementRecord[]>([]);
  const [loanId, setLoanId] = useState("");
  const [amountType, setAmountType] = useState<'all' | 'custom'>('all');
  const [customAmount, setCustomAmount] = useState("");
  const { toast } = useToast(); // Fix toast usage

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount).replace('KES', 'Ksh');
  };

  const addDisbursement = () => {
    if (!loanId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a loan ID",
        variant: "destructive",
      });
      return;
    }

    if (amountType === 'custom' && (!customAmount || Number(customAmount) <= 0)) {
      toast({
        title: "Error", 
        description: "Please enter a valid custom amount",
        variant: "destructive",
      });
      return;
    }

    const newDisbursement: DisbursementRecord = {
      id: Date.now().toString(),
      loanId: loanId.trim(),
      amountType,
      customAmount: amountType === 'custom' ? Number(customAmount) : undefined,
      timestamp: new Date(),
    };

    setDisbursements([...disbursements, newDisbursement]);
    
    // Reset form
    setLoanId("");
    setAmountType('all');
    setCustomAmount("");

    toast({
      title: "Success",
      description: "Disbursement record added",
    });
  };

  const removeDisbursement = (id: string) => {
    setDisbursements(disbursements.filter(d => d.id !== id));
    toast({
      title: "Removed",
      description: "Disbursement record removed",
    });
  };

  // FIX: Actually save to database instead of just logging
  const handleSave = async () => {
    if (disbursements.length === 0) {
      toast({
        title: "No Records",
        description: "Add disbursement records before saving",
        variant: "destructive",
      });
      return;
    }

    try {
      // Save each disbursement to the database
      for (const disbursement of disbursements) {
        await dbOperations.addLoanDisbursement({
          loanId: disbursement.loanId,
          amountType: disbursement.amountType,
          customAmount: disbursement.customAmount,
          timestamp: disbursement.timestamp
        });
      }

      toast({
        title: "✅ Disbursements Saved",
        description: `${disbursements.length} disbursement(s) saved successfully`,
      });
      
      // Reset after successful save
      setDisbursements([]);
    } catch (error) {
      console.error('Failed to save disbursements:', error);
      toast({
        title: "❌ Save Failed",
        description: "Failed to save loan disbursements",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Add Disbursement Form */}
      <Card className="shadow-card bg-gradient-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Loan Disbursement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="loanId">Loan ID</Label>
            <Input
              id="loanId"
              placeholder="Enter loan ID"
              value={loanId}
              onChange={(e) => setLoanId(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <Label>Disbursement Amount</Label>
            <RadioGroup
              value={amountType}
              onValueChange={(value: 'all' | 'custom') => setAmountType(value)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all">Full loan amount</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom">Custom amount</Label>
              </div>
            </RadioGroup>

            {amountType === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="customAmount">Custom Amount (Ksh)</Label>
                <Input
                  id="customAmount"
                  type="number"
                  placeholder="Enter amount"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                />
              </div>
            )}
          </div>

          <Button onClick={addDisbursement} className="w-full" variant="mobile">
            <Plus className="h-4 w-4 mr-2" />
            Add Disbursement
          </Button>
        </CardContent>
      </Card>

      {/* Disbursement Records */}
      {disbursements.length > 0 && (
        <Card className="shadow-card bg-gradient-card">
          <CardHeader>
            <CardTitle>Disbursement Records ({disbursements.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {disbursements.map((disbursement) => (
                <div
                  key={disbursement.id}
                  className="flex items-center justify-between p-3 bg-background/50 rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Loan ID: {disbursement.loanId}</span>
                      <Badge variant="outline">
                        {disbursement.amountType === 'all' 
                          ? 'Full Amount' 
                          : formatAmount(disbursement.customAmount!)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {disbursement.timestamp.toLocaleDateString()} at{' '}
                      {disbursement.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => removeDisbursement(disbursement.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      {disbursements.length > 0 && (
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  {disbursements.length} disbursement{disbursements.length !== 1 ? 's' : ''} ready to save
                </p>
              </div>
              
              <Button 
                variant="success" 
                size="mobile" 
                onClick={handleSave}
                className="w-full"
              >
                <Save className="h-5 w-5 mr-2" />
                Save All Disbursements
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {disbursements.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="text-center py-12">
            <Banknote className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No disbursement records yet. Add your first disbursement above.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
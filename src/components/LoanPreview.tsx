import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, Copy, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { dbOperations, Loan } from "@/lib/database";

interface CustomDeduction {
  description: string;
  amount: number;
}

interface LoanPreviewProps {
  loan: Loan;
  onClose: () => void;
  onDisbursed: () => void;
}

export function LoanPreview({ loan, onClose, onDisbursed }: LoanPreviewProps) {
  const { toast } = useToast();
  const [includeProcessingFee, setIncludeProcessingFee] = useState(true);
  const [includeAdvocateFee, setIncludeAdvocateFee] = useState(true);
  const [includeAdvanceDeduction, setIncludeAdvanceDeduction] = useState(true);
  const [customDeductions, setCustomDeductions] = useState<CustomDeduction[]>([]);
  const [newDeduction, setNewDeduction] = useState({ description: "", amount: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate deductions
  const processingFee = loan.principalAmount * 0.015; // 1.5%
  const advocateFee = loan.principalAmount > 25000 ? 300 : 0;
  const advanceDeduction = loan.member.advance_balance / 1.1;

  const totalMandatoryDeductions = 
    (includeProcessingFee ? processingFee : 0) +
    (includeAdvocateFee ? advocateFee : 0) +
    (includeAdvanceDeduction ? advanceDeduction : 0);

  const totalCustomDeductions = customDeductions.reduce((sum, deduction) => sum + deduction.amount, 0);
  const totalDeductions = totalMandatoryDeductions + totalCustomDeductions;
  const netAmount = loan.principalAmount - totalDeductions;

  const addCustomDeduction = () => {
    if (newDeduction.description.trim() && newDeduction.amount > 0) {
      setCustomDeductions([...customDeductions, { ...newDeduction }]);
      setNewDeduction({ description: "", amount: 0 });
    }
  };

  const removeCustomDeduction = (index: number) => {
    setCustomDeductions(customDeductions.filter((_, i) => i !== index));
  };

  const generateCopyMessage = () => {
    let deductionsText = "";
    if (includeAdvanceDeduction && advanceDeduction > 0) {
      deductionsText += `Advance: ${advanceDeduction.toLocaleString()}\n`;
    }
    if (includeProcessingFee) {
      deductionsText += `Processing fee: ${processingFee.toLocaleString()}\n`;
    }
    if (includeAdvocateFee && advocateFee > 0) {
      deductionsText += `Advocate: ${advocateFee.toLocaleString()}\n`;
    }
    customDeductions.forEach(deduction => {
      deductionsText += `${deduction.description}: ${deduction.amount.toLocaleString()}\n`;
    });

    return `Group: ${loan.group.name}
Name: ${loan.member.name}
Gross loan amount: ${loan.principalAmount.toLocaleString()} (principal)
Deductions
${deductionsText}
Total deductions: ${totalDeductions.toLocaleString()}

Net Loan to be disbursed: ${netAmount.toLocaleString()}
Phone number: ${loan.member.phone}`;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateCopyMessage());
      toast({
        title: "✅ Copied to Clipboard",
        description: "Disbursement details copied successfully",
      });
    } catch (error) {
      toast({
        title: "⚠ Copy Failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleDisbursement = async () => {
    setIsProcessing(true);
    try {
      // Validate loan data
      if (!loan?.id) {
        throw new Error(`Loan ID is missing. Loan object: ${JSON.stringify(loan)}`);
      }

      // Check for existing disbursement
      const existingDisbursement = await dbOperations.getLoanDisbursementByLoanId(String(loan.id));
      if (existingDisbursement) {
        toast({
          title: "⚠ Duplicate Disbursement",
          description: "This loan has already been disbursed. Check your records.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // Save disbursement record
      await dbOperations.addLoanDisbursement({
        loan_id: String(loan.id),
        database_id: loan.database_id,
        include_processing_fee: includeProcessingFee,
        include_advocate_fee: includeAdvocateFee,
        include_advance_deduction: includeAdvanceDeduction,
        custom_deductions: customDeductions,
        timestamp: new Date(),
      });

      // Mark loan as disbursed
      await dbOperations.markLoanAsDisbursed(String(loan.id));

      toast({
        title: "✅ Loan Disbursed",
        description: `Disbursement record saved for ${loan.member.name}`,
      });

      onDisbursed();
    } catch (error) {
      console.error("Error disbursing loan:", error);
      toast({
        title: "⚠ Disbursement Failed",
        description: "Could not save disbursement record",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{loan.member.name}</h2>
              <p className="text-sm text-muted-foreground">Loan ID: {loan.id}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              ✕
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Loan Info */}
          <div className="bg-muted p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Group: {loan.group.name}</div>
              <div>Principal: KES {loan.principalAmount.toLocaleString()}</div>
            </div>
          </div>

          {/* Deductions */}
          <div className="space-y-4">
            <h3 className="font-semibold">Deductions</h3>
            
            {/* Processing Fee */}
            <div className="flex items-center justify-between p-3 border rounded bg-background">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  checked={includeProcessingFee}
                  onCheckedChange={(checked) => setIncludeProcessingFee(checked === true)}
                />
                <Label>Processing Fee (1.5%)</Label>
              </div>
              <span className="font-medium">KES {processingFee.toLocaleString()}</span>
            </div>

            {/* Advocate Fee */}
            {advocateFee > 0 && (
              <div className="flex items-center justify-between p-3 border rounded bg-background">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    checked={includeAdvocateFee}
                    onCheckedChange={(checked) => setIncludeAdvocateFee(checked === true)}
                  />
                  <Label>Advocate Fee (Fixed)</Label>
                </div>
                <span className="font-medium">KES {advocateFee.toLocaleString()}</span>
              </div>
            )}

            {/* Advance Deduction */}
            {advanceDeduction > 0 && (
              <div className="flex items-center justify-between p-3 border rounded bg-background">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    checked={includeAdvanceDeduction}
                    onCheckedChange={(checked) => setIncludeAdvanceDeduction(checked === true)}
                  />
                  <Label>Advance Deduction</Label>
                </div>
                <span className="font-medium">KES {advanceDeduction.toLocaleString()}</span>
              </div>
            )}

            {/* Custom Deductions */}
            <div className="space-y-3">
              <Label>Custom Deductions</Label>
              {customDeductions.map((deduction, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded bg-background">
                  <span>{deduction.description}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">KES {deduction.amount.toLocaleString()}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCustomDeduction(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {/* Mobile-optimized custom deduction input */}
              <div className="space-y-2">
                <Input
                  placeholder="Deduction description"
                  value={newDeduction.description}
                  onChange={(e) => setNewDeduction({...newDeduction, description: e.target.value})}
                />
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={newDeduction.amount || ""}
                    onChange={(e) => setNewDeduction({...newDeduction, amount: parseFloat(e.target.value) || 0})}
                    className="flex-1"
                  />
                  <Button onClick={addCustomDeduction} size="icon" className="shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-primary/10 p-4 rounded-lg">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Gross Loan Amount:</span>
                <span className="font-medium">KES {loan.principalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Deductions:</span>
                <span className="font-medium text-red-600">-KES {totalDeductions.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Net Amount to Disburse:</span>
                <span className="text-green-600">KES {netAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons - Mobile optimized */}
          <div className="space-y-3 sm:space-y-0 sm:flex sm:gap-2">
            <Button
              variant="outline"
              onClick={copyToClipboard}
              className="w-full sm:flex-1 order-1"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Details
            </Button>
            <Button
              onClick={handleDisbursement}
              disabled={isProcessing}
              className="w-full sm:flex-1 order-2"
            >
              {isProcessing ? (
                "Processing..."
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm & Disburse
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
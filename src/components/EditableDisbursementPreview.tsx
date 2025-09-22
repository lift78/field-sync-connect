import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { dbOperations, LoanDisbursement, Loan } from "@/lib/database";

interface CustomDeduction {
  description: string;
  amount: number;
}

interface EditableDisbursementPreviewProps {
  disbursement: LoanDisbursement;
  onClose: () => void;
  onSaved: () => void;
}

export function EditableDisbursementPreview({ 
  disbursement, 
  onClose, 
  onSaved 
}: EditableDisbursementPreviewProps) {
  const { toast } = useToast();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Editable state
  const [includeProcessingFee, setIncludeProcessingFee] = useState(disbursement.include_processing_fee);
  const [includeAdvocateFee, setIncludeAdvocateFee] = useState(disbursement.include_advocate_fee);
  const [includeAdvanceDeduction, setIncludeAdvanceDeduction] = useState(disbursement.include_advance_deduction);
  const [customDeductions, setCustomDeductions] = useState<CustomDeduction[]>(
    disbursement.custom_deductions || []
  );
  const [newDeduction, setNewDeduction] = useState({ description: "", amount: 0 });

  useEffect(() => {
    const loadLoanData = async () => {
      try {
        const loanData = await dbOperations.getLoanById(disbursement.loan_id);
        setLoan(loanData || null);
      } catch (error) {
        console.error("Error loading loan data:", error);
        toast({
          title: "⚠ Error",
          description: "Could not load loan details",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadLoanData();
  }, [disbursement.loan_id, toast]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p>Loading loan details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8 text-center">
            <p className="text-destructive mb-4">Loan not found</p>
            <Button onClick={onClose}>Close</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedDisbursement: LoanDisbursement = {
        ...disbursement,
        include_processing_fee: includeProcessingFee,
        include_advocate_fee: includeAdvocateFee,
        include_advance_deduction: includeAdvanceDeduction,
        custom_deductions: customDeductions,
        timestamp: new Date(),
      };

      await dbOperations.updateLoanDisbursement(String(disbursement.id), updatedDisbursement);

      toast({
        title: "✅ Disbursement Updated",
        description: "Changes saved successfully",
      });

      onSaved();
    } catch (error) {
      console.error("Error updating disbursement:", error);
      toast({
        title: "⚠ Update Failed",
        description: "Could not save changes",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Edit Disbursement</h2>
              <p className="text-sm text-muted-foreground">
                {loan.member.name} - Loan ID: {loan.id}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
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

          {/* Status Warning for Synced Records */}
          {disbursement.synced && (
            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
              <p className="text-sm text-yellow-800 font-medium">
                ⚠ This disbursement has already been synced. Changes will require re-sync.
              </p>
            </div>
          )}

          {/* Deductions */}
          <div className="space-y-4">
            <h3 className="font-semibold">Edit Deductions</h3>
            
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
              
              {/* Custom deduction input */}
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

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1"
            >
              {saving ? (
                "Saving..."
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
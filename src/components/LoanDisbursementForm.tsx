import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { dbOperations, Loan } from "@/lib/database";
import { LoanPreview } from "./LoanPreview";

export function LoanDisbursementForm() {
  const { toast } = useToast();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [groups, setGroups] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [filteredLoans, setFilteredLoans] = useState<Loan[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLoansAndGroups();
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      const groupId = parseInt(selectedGroup);
      setFilteredLoans(loans.filter(loan => loan.group.id === groupId && loan.status === 'approved' && !loan.disbursed));
    } else {
      setFilteredLoans(loans.filter(loan => loan.status === 'approved' && !loan.disbursed));
    }
  }, [selectedGroup, loans]);

  const loadLoansAndGroups = async () => {
    try {
      setIsLoading(true);
      const [loansData, groupsData] = await Promise.all([
        dbOperations.getAllLoans(),
        dbOperations.getUniqueGroups()
      ]);
      
      setLoans(loansData);
      setGroups(groupsData);
    } catch (error) {
      console.error("Error loading loans:", error);
      toast({
        title: "❌ Error",
        description: "Failed to load loan data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = (loan: Loan) => {
    setSelectedLoan(loan);
  };

  const handleDisbursed = () => {
    setSelectedLoan(null);
    loadLoansAndGroups(); // Refresh data
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p>Loading loans...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Loan Disbursement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Group Filter */}
          <div>
            <label className="text-sm font-medium mb-2 block">Filter by Group</label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger>
                <SelectValue placeholder="All Groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Groups</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id.toString()}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Loans List */}
          <div className="space-y-3">
            {filteredLoans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {selectedGroup ? "No approved loans found for selected group" : "No approved loans available for disbursement"}
              </div>
            ) : (
              filteredLoans.map((loan) => (
                <Card key={loan.loan_id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{loan.loan_id}</span>
                        <Badge variant="secondary">{loan.status}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <div><strong>Member:</strong> {loan.member.name}</div>
                        <div><strong>Group:</strong> {loan.group.name}</div>
                        <div><strong>Principal:</strong> KES {loan.principalAmount.toLocaleString()}</div>
                        <div><strong>Repayment:</strong> KES {loan.repaymentAmount.toLocaleString()}</div>
                        <div><strong>Monthly:</strong> KES {loan.monthlyRepayment.toLocaleString()} × {loan.installments} months</div>
                      </div>
                    </div>
                    <Button
                      onClick={() => handlePreview(loan)}
                      className="flex items-center gap-2"
                    >
                      {loan.disbursed ? (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Disbursed
                        </>
                      ) : (
                        "Preview"
                      )}
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview Modal */}
      {selectedLoan && (
        <LoanPreview
          loan={selectedLoan}
          onClose={() => setSelectedLoan(null)}
          onDisbursed={handleDisbursed}
        />
      )}
    </>
  );
}
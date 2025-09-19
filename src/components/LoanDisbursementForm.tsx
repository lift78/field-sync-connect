import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { dbOperations, Loan } from "@/lib/database";
import { LoanPreview } from "./LoanPreview";

export function LoanDisbursementForm() {
  const { toast } = useToast();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [groups, setGroups] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [filteredLoans, setFilteredLoans] = useState<Loan[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLoansAndGroups();
  }, []);

  useEffect(() => {
    if (selectedGroup && selectedGroup !== "all") {
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
        title: "⚠ Error",
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
      {/* Sticky Group Filter */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <label className="text-sm font-medium mb-2 block">Filter by Group</label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger>
                <SelectValue placeholder="All Groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id.toString()}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Loans Grid */}
      <div className="space-y-4">
        {filteredLoans.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-muted-foreground">
              {selectedGroup !== "all" ? "No approved loans found for selected group" : "No approved loans available for disbursement"}
            </CardContent>
          </Card>
        ) : (
          filteredLoans.map((loan) => (
            <Card key={loan.loan_id} className="p-0 overflow-hidden hover:shadow-lg transition-all duration-200 border border-border/50">
              {/* Header with gradient background */}
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{loan.loan_id}</span>
                    <Badge variant="outline" className="text-xs border-primary/30">
                      {loan.status}
                    </Badge>
                  </div>
                  {loan.disbursed && (
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 border-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Disbursed
                    </Badge>
                  )}
                </div>
              </div>

              {/* Content */}
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Member:</span>
                      <span className="text-sm font-medium">{loan.member.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Group:</span>
                      <span className="text-sm font-medium">{loan.group.name}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Principal:</span>
                      <span className="text-sm font-semibold text-green-600">
                        KES {loan.principalAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Total Repayment:</span>
                      <span className="text-sm font-medium text-orange-600">
                        KES {loan.repaymentAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Monthly Payment:</span>
                    <span className="text-sm font-bold">
                      KES {loan.monthlyRepayment.toLocaleString()} × {loan.installments} months
                    </span>
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-2">
                  <Button
                    onClick={() => handlePreview(loan)}
                    disabled={loan.disbursed}
                    className="w-full"
                    variant={loan.disbursed ? "outline" : "default"}
                  >
                    {loan.disbursed ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Already Disbursed
                      </>
                    ) : (
                      "Preview Disbursement"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

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
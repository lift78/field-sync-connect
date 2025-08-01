import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, User } from "lucide-react";
import { dbOperations } from "@/lib/database";
import { useToast } from "@/hooks/use-toast";

// Helper function to generate member data on demand
const getMember = (id: string) => ({
  id: id.padStart(4, '0'),
  name: `Member ${parseInt(id)}`,
});

// Helper function to check if member ID exists (1-9999)
const isValidMemberId = (id: string): boolean => {
  const num = parseInt(id);
  return num >= 1 && num <= 9999;
};

interface LoanApplication {
  id: string;
  memberId: string;
  memberName: string;
  loanAmount: number;
  installments: number;
  guarantors: string[];
}

export function LoanApplicationForm() {
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const { toast } = useToast();

  // Filter members based on search query - efficient search without pre-generating all members
  const filteredMembers = useMemo(() => {
    if (!memberQuery) return [];
    
    const query = memberQuery.trim();
    const results = [];
    
    // If input is numeric, handle ID searching
    if (/^\d+$/.test(query)) {
      // 1. Try exact padded match first (e.g., "345" -> "0345")
      const paddedId = query.padStart(4, '0');
      if (isValidMemberId(paddedId)) {
        results.push(getMember(paddedId));
      }
      
      // 2. If query is shorter than 4 digits, find IDs that start with the query
      if (query.length < 4) {
        const baseNum = parseInt(query);
        const multiplier = Math.pow(10, 4 - query.length);
        
        // Generate up to 5 matching IDs
        for (let i = 0; i < Math.min(5, multiplier); i++) {
          const candidateNum = baseNum * multiplier + i;
          if (candidateNum >= 1 && candidateNum <= 9999) {
            const candidateId = candidateNum.toString().padStart(4, '0');
            if (candidateId.startsWith(query.padStart(query.length, '0')) && 
                !results.some(r => r.id === candidateId)) {
              results.push(getMember(candidateNum.toString()));
            }
          }
        }
      }
    } else {
      // If input contains letters, search by name pattern
      const lowerQuery = query.toLowerCase();
      if (lowerQuery.includes('member')) {
        // Extract number from "member X" pattern
        const match = lowerQuery.match(/member\s*(\d+)/);
        if (match) {
          const num = parseInt(match[1]);
          if (num >= 1 && num <= 9999) {
            results.push(getMember(num.toString()));
          }
        }
      }
      
      // Also try to find members by partial number in the name
      const numberMatch = query.match(/\d+/);
      if (numberMatch) {
        const num = parseInt(numberMatch[0]);
        if (num >= 1 && num <= 9999) {
          results.push(getMember(num.toString()));
        }
      }
    }
    
    return results.slice(0, 5); // Limit to 5 results
  }, [memberQuery]);

  // Generate available guarantors on demand (excluding selected member and existing applicants)
  const getAvailableGuarantors = (searchTerm: string = '') => {
    const results = [];
    const excludedIds = new Set([
      selectedMemberId,
      ...applications.map(app => app.memberId)
    ]);
    
    if (!searchTerm) return [];
    
    // Similar search logic but excluding already used members
    if (/^\d+$/.test(searchTerm.trim())) {
      const query = searchTerm.trim();
      const paddedId = query.padStart(4, '0');
      
      if (isValidMemberId(paddedId) && !excludedIds.has(paddedId)) {
        results.push(getMember(paddedId));
      }
      
      // For shorter queries, generate some matching options
      if (query.length < 4) {
        const baseNum = parseInt(query);
        const multiplier = Math.pow(10, 4 - query.length);
        
        for (let i = 0; i < Math.min(10, multiplier); i++) {
          const candidateNum = baseNum * multiplier + i;
          if (candidateNum >= 1 && candidateNum <= 9999) {
            const candidateId = candidateNum.toString().padStart(4, '0');
            if (!excludedIds.has(candidateId) && 
                candidateId.startsWith(query.padStart(query.length, '0'))) {
              results.push(getMember(candidateNum.toString()));
            }
          }
        }
      }
    }
    
    return results.slice(0, 20); // More options for guarantor selection
  };

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const addMember = () => {
    if (!selectedMemberId || !isValidMemberId(selectedMemberId)) return;
    
    const selectedMember = getMember(selectedMemberId);
    const newApplication: LoanApplication = {
      id: Date.now().toString(),
      memberId: selectedMember.id,
      memberName: selectedMember.name,
      loanAmount: 0,
      installments: 0,
      guarantors: [],
    };

    setApplications([...applications, newApplication]);
    setSelectedMemberId('');
    setMemberQuery('');
  };

  const updateApplication = (id: string, updates: Partial<LoanApplication>) => {
    setApplications(applications.map(app => 
      app.id === id ? { ...app, ...updates } : app
    ));
  };

  const removeApplication = (id: string) => {
    setApplications(applications.filter(app => app.id !== id));
  };

  const addGuarantor = (applicationId: string, guarantorId: string) => {
    const application = applications.find(app => app.id === applicationId);
    if (application && !application.guarantors.includes(guarantorId)) {
      updateApplication(applicationId, {
        guarantors: [...application.guarantors, guarantorId]
      });
    }
  };

  const removeGuarantor = (applicationId: string, guarantorId: string) => {
    const application = applications.find(app => app.id === applicationId);
    if (application) {
      updateApplication(applicationId, {
        guarantors: application.guarantors.filter(id => id !== guarantorId)
      });
    }
  };

  const handleSave = async () => {
    try {
      for (const application of applications) {
        await dbOperations.addLoanApplication({
          memberId: application.memberId,
          memberName: application.memberName,
          loanAmount: application.loanAmount,
          installments: application.installments,
          guarantors: application.guarantors,
          timestamp: new Date()
        });
      }
      
      toast({
        title: "✅ Loan Applications Saved",
        description: `${applications.length} application(s) saved successfully`,
      });
      
      // Reset form
      setApplications([]);
      setMemberQuery('');
      setSelectedMemberId('');
    } catch (error) {
      toast({
        title: "❌ Save Failed",
        description: "Failed to save loan applications",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Add Member Section */}
      <Card className="shadow-card bg-gradient-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <User className="h-5 w-5 mr-2" />
            Add Loan Applicant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="member-search">Search Member ID or Name</Label>
            <Input
              id="member-search"
              placeholder="Type member ID or name..."
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
            />
          </div>
          
          {memberQuery && (
            <div className="space-y-2">
              <Label>Select Member</Label>
              <div className="grid gap-2 max-h-48 overflow-y-auto">
                {filteredMembers
                  .filter(member => !applications.some(app => app.memberId === member.id))
                  .map((member) => (
                  <Button
                    key={member.id}
                    variant={selectedMemberId === member.id ? "default" : "outline"}
                    onClick={() => {
                      setSelectedMemberId(member.id);
                      setMemberQuery('');
                    }}
                    className="justify-start"
                  >
                    {member.id} - {member.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {selectedMemberId && (
            <div className="p-3 bg-success/10 rounded-lg border border-success/20 mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-success">Selected Member:</p>
                  <p className="text-sm">{getMember(selectedMemberId)?.id} - {getMember(selectedMemberId)?.name}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedMemberId('');
                    setMemberQuery('');
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  ×
                </Button>
              </div>
            </div>
          )}

          <Button 
            onClick={addMember}
            disabled={!selectedMemberId}
            className="w-full"
            variant="mobile"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        </CardContent>
      </Card>

      {/* Loan Applications List */}
      <div className="space-y-4">
        {applications.map((application) => (
          <Card key={application.id} className="shadow-card bg-gradient-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {application.memberName}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    ID: {application.memberId}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeApplication(application.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Loan Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Loan Amount (KES)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={application.loanAmount || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      updateApplication(application.id, {
                        loanAmount: value === '' ? 0 : parseFloat(value)
                      });
                    }}
                  />
                  {application.loanAmount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {formatAmount(application.loanAmount)}
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>Number of Installments</Label>
                  <Input
                    type="number"
                    min="1"
                    max="60"
                    value={application.installments}
                    onChange={(e) => updateApplication(application.id, {
                      installments: parseInt(e.target.value) || 1
                    })}
                    placeholder="Enter number of installments"
                  />
                </div>
              </div>

              {/* Monthly Payment Display */}
              {application.loanAmount > 0 && (
                <div className="p-3 bg-primary/10 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Monthly Payment:</span>
                    <span className="font-bold text-primary">
                    {formatAmount(
                        (application.loanAmount * (1 + 0.015 * application.installments)) / application.installments
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Guarantors Section */}
              <div className="space-y-3">
                <Label>Guarantors</Label>
                
                {/* Current Guarantors */}
                {application.guarantors.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {application.guarantors.map((guarantorId) => {
                      const guarantor = getMember(guarantorId);
                      return (
                        <Badge key={guarantorId} variant="secondary" className="flex items-center gap-1">
                          {guarantor?.name}
                          <button
                            onClick={() => removeGuarantor(application.id, guarantorId)}
                            className="ml-1 hover:text-destructive"
                          >
                            ×
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}

                {/* Add Guarantor - Simple Input */}
                <div className="space-y-2">
                  <Label>Add Guarantor by ID</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter member ID (1-9999)"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const input = e.currentTarget;
                          const value = input.value.trim();
                          if (value) {
                            const paddedId = value.padStart(4, '0');
                            if (isValidMemberId(paddedId) && 
                                !application.guarantors.includes(paddedId) &&
                                paddedId !== application.memberId) {
                              addGuarantor(application.id, paddedId);
                              input.value = '';
                            }
                          }
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        const value = input.value.trim();
                        if (value) {
                          const paddedId = value.padStart(4, '0');
                          if (isValidMemberId(paddedId) && 
                              !application.guarantors.includes(paddedId) &&
                              paddedId !== application.memberId) {
                            addGuarantor(application.id, paddedId);
                            input.value = '';
                          }
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Press Enter or click Add to add guarantor by ID
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Save Button */}
      {applications.length > 0 && (
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  {applications.length} loan application{applications.length !== 1 ? 's' : ''} ready to save
                </p>
                <div className="text-lg font-bold">
                  Total Loan Amount: {formatAmount(
                    applications.reduce((sum, app) => sum + app.loanAmount, 0)
                  )}
                </div>
              </div>
              
              <Button 
                variant="success" 
                size="mobile" 
                onClick={handleSave}
                className="w-full"
              >
                <Save className="h-5 w-5 mr-2" />
                Save All Applications
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {applications.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="text-center py-12">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No loan applications yet. Add members to get started.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
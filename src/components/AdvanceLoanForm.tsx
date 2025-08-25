import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Zap, Banknote, Smartphone } from "lucide-react";
import { dbOperations, MemberBalance } from "@/lib/database";
import { useToast } from "@/hooks/use-toast";
// import { Keyboard } from "@capacitor/keyboard";


// Mock member data - fallback when no real data exists
const mockMembers = Array.from({ length: 9999 }, (_, i) => ({
  id: String(i + 1).padStart(4, '0'),
  name: `Member ${i + 1}`,
}));

// Helper function to extract member ID from member_id field (e.g., "MEM/2025/0007" -> "0007")
const extractMemberId = (memberIdField: string): string => {
  const parts = memberIdField.split('/');
  return parts[parts.length - 1] || memberIdField;
};

interface AdvanceLoanApplication {
  id: string;
  memberId: string;
  memberName: string;
  advanceAmount: number;
  feePaymentType?: 'cash' | 'mpesa' | null;
  feeCollectionId?: string;
}

export function AdvanceLoanForm() {
  const [applications, setApplications] = useState<AdvanceLoanApplication[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedMemberName, setSelectedMemberName] = useState('');
  const [realMembers, setRealMembers] = useState<MemberBalance[]>([]);
  const { toast } = useToast();

  // Load real member data on component mount
  useEffect(() => {
    const loadRealMembers = async () => {
      try {
        const members = await dbOperations.getAllMembers();
        setRealMembers(members);
        console.log(`Loaded ${members.length} real members for advance loans`);
      } catch (error) {
        console.error('Error loading real members:', error);
        setRealMembers([]);
      }
    };

    loadRealMembers();
  }, []);


  // Mobile keyboard handling will be added later when Capacitor is properly configured

  // Search and filter members based on query
  const filteredMembers = useMemo(() => {
    if (!memberQuery) return [];
    
    const query = memberQuery.trim().toLowerCase();
    const results: Array<{
      id: string;
      name: string;
      isReal: boolean;
    }> = [];

    // First, search in real member data
    if (realMembers.length > 0) {
      const realMatches = realMembers.filter(member => {
        const memberId = extractMemberId(member.member_id);
        return (
          memberId.toLowerCase().includes(query) ||
          member.name.toLowerCase().includes(query) ||
          member.phone.includes(memberQuery.trim()) ||
          member.member_id.toLowerCase().includes(query)
        );
      }).slice(0, 10);

      // Add real members to results
      realMatches.forEach(member => {
        const memberId = extractMemberId(member.member_id);
        results.push({
          id: memberId,
          name: member.name,
          isReal: true
        });
      });
    }

    // If no real members found or query looks like numeric ID, also search mock data
    if (results.length === 0 || /^\d+$/.test(query)) {
      const mockQuery = memberQuery.trim();
      
      // If input is numeric, handle ID searching in mock data
      if (/^\d+$/.test(mockQuery)) {
        // 1. Try exact padded match first (e.g., "345" -> "0345")
        const paddedId = mockQuery.padStart(4, '0');
        
        // Skip if we already have this ID from real data
        const alreadyHasThisId = results.some(r => r.id === paddedId);
        
        if (!alreadyHasThisId) {
          const exactMatch = mockMembers.find(member => member.id === paddedId);
          if (exactMatch) {
            results.push({
              id: exactMatch.id,
              name: exactMatch.name,
              isReal: false
            });
          }
          
          // 2. If no exact match and query is shorter than 4 digits, search for IDs that start with the query
          if (!exactMatch && mockQuery.length < 4) {
            const startMatches = mockMembers.filter(member => 
              member.id.startsWith(mockQuery.padStart(mockQuery.length, '0')) &&
              !results.some(r => r.id === member.id) // Avoid duplicates
            ).slice(0, 5);
            startMatches.forEach(member => {
              results.push({
                id: member.id,
                name: member.name,
                isReal: false
              });
            });
          }
          
          // 3. If query is 4+ digits and no exact match, search for partial matches
          if (!exactMatch && mockQuery.length >= 4) {
            const partialMatches = mockMembers.filter(member => 
              (member.id.includes(mockQuery) || member.id === mockQuery) &&
              !results.some(r => r.id === member.id) // Avoid duplicates
            ).slice(0, 5);
            partialMatches.forEach(member => {
              results.push({
                id: member.id,
                name: member.name,
                isReal: false
              });
            });
          }
        }
      }
    }

    return results.slice(0, 10); // Limit total results
  }, [memberQuery, realMembers]);

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const addMember = () => {
    if (!selectedMemberId || !selectedMemberName) return;

    const newApplication: AdvanceLoanApplication = {
      id: Date.now().toString(),
      memberId: selectedMemberId,
      memberName: selectedMemberName,
      advanceAmount: 0,
    };

    setApplications([...applications, newApplication]);
    setSelectedMemberId('');
    setSelectedMemberName('');
    setMemberQuery('');
  };

  const updateApplication = (id: string, updates: Partial<AdvanceLoanApplication>) => {
    setApplications(applications.map(app => 
      app.id === id ? { ...app, ...updates } : app
    ));
  };

  const removeApplication = async (id: string) => {
    const application = applications.find(app => app.id === id);
    
    // If there's a fee collection record, delete it first
    if (application?.feeCollectionId) {
      try {
        await dbOperations.deleteCashCollection(application.feeCollectionId);
      } catch (error) {
        console.error('Error deleting fee collection:', error);
      }
    }
    
    setApplications(applications.filter(app => app.id !== id));
  };

  const handleMemberSelect = (member: { id: string; name: string; isReal: boolean }) => {
    setSelectedMemberId(member.id);
    setSelectedMemberName(member.name);
    setMemberQuery('');
  };

  const handleFeePayment = async (applicationId: string, paymentType: 'cash' | 'mpesa') => {
    const application = applications.find(app => app.id === applicationId);
    if (!application) return;

    try {
      // Create cash collection record for the fee
      const feeCollection = {
        memberId: application.memberId,
        memberName: application.memberName,
        totalAmount: 10,
        cashAmount: paymentType === 'cash' ? 10 : 0,
        mpesaAmount: paymentType === 'mpesa' ? 10 : 0,
        allocations: [{
          memberId: application.memberId,
          type: 'other' as const,
          amount: 10,
          reason: 'Advance fine(kes 10)'
        }],
        timestamp: new Date()
      };

      const feeCollectionId = await dbOperations.addCashCollection(feeCollection);
      
      // Update application with fee payment info
      updateApplication(applicationId, {
        feePaymentType: paymentType,
        feeCollectionId: feeCollectionId
      });

      toast({
        title: "✅ Fee Collected",
        description: `10 KES advance fee collected via ${paymentType.toUpperCase()}`,
      });
    } catch (error) {
      console.error('Error collecting fee:', error);
      toast({
        title: "❌ Fee Collection Failed",
        description: "Failed to record advance fee payment",
        variant: "destructive"
      });
    }
  };

  const handleSave = async () => {
    // Check if all applications have fee payment type selected
    const applicationsWithoutFee = applications.filter(app => 
      app.advanceAmount > 0 && !app.feePaymentType
    );

    if (applicationsWithoutFee.length > 0) {
      toast({
        title: "❌ Fee Payment Required",
        description: "Please collect the 10 KES advance fee for all members before saving",
        variant: "destructive"
      });
      return;
    }

    try {
      for (const application of applications) {
        await dbOperations.addAdvanceLoan({
          memberId: application.memberId,
          memberName: application.memberName,
          amount: application.advanceAmount,
          timestamp: new Date()
        });
      }
      
      toast({
        title: "✅ Advance Loans Saved",
        description: `${applications.length} application(s) saved successfully`,
      });
      
      // Reset form
      setApplications([]);
      setMemberQuery('');
      setSelectedMemberId('');
      setSelectedMemberName('');
    } catch (error) {
      toast({
        title: "❌ Save Failed",
        description: "Failed to save advance loan applications",
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
            <Zap className="h-5 w-5 mr-2" />
            Add Advance Loan Applicant
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Advance loans are short-term loans with quick approval process
          </p>
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
                  .map((member, index) => (
                  <Button
                    key={`${member.id}-${index}`}
                    variant={selectedMemberId === member.id ? "default" : "outline"}
                    onClick={() => handleMemberSelect(member)}
                    className="justify-start p-3 h-auto text-left"
                  >
                    <div className="flex flex-col items-start w-full">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{member.id} - {member.name}</span>
                        {member.isReal && (
                          <Badge variant="secondary" className="text-xs">
                            REAL DATA
                          </Badge>
                        )}
                      </div>
                    </div>
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
                  <p className="text-sm">{selectedMemberId} - {selectedMemberName}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedMemberId('');
                    setSelectedMemberName('');
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

      {/* Advance Loan Applications List */}
      <div className="space-y-4">
        {applications.map((application) => (
          <Card key={application.id} className="shadow-card bg-gradient-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center">
                    <Zap className="h-4 w-4 mr-2 text-accent" />
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
              {/* Advance Amount */}
              <div className="space-y-2">
                <Label>Advance Amount (KES)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={application.advanceAmount || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    updateApplication(application.id, {
                      advanceAmount: value === '' ? 0 : parseFloat(value)
                    });
                  }}
                />
                {application.advanceAmount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {formatAmount(application.advanceAmount)}
                  </p>
                )}
              </div>

              {/* Quick Amount Buttons */}
              <div className="space-y-2">
                <Label className="text-sm">Quick Select</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[2000, 5000, 8000, 10000, 15000, 20000].map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      size="sm"
                      onClick={() => updateApplication(application.id, {
                        advanceAmount: amount
                      })}
                      className={application.advanceAmount === amount ? 'bg-accent text-accent-foreground' : ''}
                    >
                      {formatAmount(amount).replace('KES', '').trim()}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Advance Fee Collection */}
              {application.advanceAmount > 0 && (
                <div className="space-y-3">
                  <div className="p-3 bg-warning/10 rounded-lg border border-warning/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-warning">Advance Fee Required:</span>
                      <span className="font-bold">KES 10</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Member must pay an additional 10 KES fee for advance loan processing
                    </p>
                    
                    {!application.feePaymentType ? (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFeePayment(application.id, 'cash')}
                          className="flex items-center gap-2"
                        >
                          <Banknote className="h-4 w-4" />
                          Cash
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFeePayment(application.id, 'mpesa')}
                          className="flex items-center gap-2"
                        >
                          <Smartphone className="h-4 w-4" />
                          M-Pesa
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-2 bg-success/10 rounded border border-success/20">
                        <span className="text-sm text-success font-medium">
                          ✅ Fee collected via {application.feePaymentType.toUpperCase()}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          KES 10
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Advance Info */}
                  <div className="p-3 bg-accent/10 rounded-lg border border-accent/20">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Advance Amount:</span>
                        <span className="font-bold text-accent">
                          {formatAmount(application.advanceAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Zero Processing Fee:</span>
                        <span className="text-sm font-medium">
                          {formatAmount(application.advanceAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2">
                        <span className="text-sm font-medium">Net Amount:</span>
                        <span className="font-bold text-success">
                          {formatAmount(application.advanceAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                  {applications.length} advance loan application{applications.length !== 1 ? 's' : ''} ready to save
                </p>
                <div className="space-y-1">
                  <div className="text-lg font-bold">
                    Total Advance Amount: {formatAmount(
                      applications.reduce((sum, app) => sum + app.advanceAmount, 0)
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Processing Fees: {formatAmount(
                      applications.reduce((sum, app) => sum + (app.advanceAmount), 0)
                    )}
                  </div>
                  <div className="text-base font-semibold text-success">
                    Net Disbursement: {formatAmount(
                      applications.reduce((sum, app) => sum + (app.advanceAmount), 0)
                    )}
                  </div>
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
            <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No advance loan applications yet. Add members to get started.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Advance loans are processed quickly with no processing fee
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Zap } from "lucide-react";
import { dbOperations } from "@/lib/database";
import { useToast } from "@/hooks/use-toast";

// Mock member data - replace with actual member data from your system
const mockMembers = Array.from({ length: 50 }, (_, i) => ({
  id: String(i + 1).padStart(4, '0'),
  name: `Member ${i + 1}`,
}));

interface AdvanceLoanApplication {
  id: string;
  memberId: string;
  memberName: string;
  advanceAmount: number;
}

export function AdvanceLoanForm() {
  const [applications, setApplications] = useState<AdvanceLoanApplication[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const { toast } = useToast();

  // Filter members based on search query - exact padded match only
  const filteredMembers = useMemo(() => {
    if (!memberQuery) return [];
    
    // If input is numeric, pad with zeros and find exact match
    if (/^\d+$/.test(memberQuery.trim())) {
      const paddedId = memberQuery.trim().padStart(4, '0');
      const exactMatch = mockMembers.find(member => member.id === paddedId);
      return exactMatch ? [exactMatch] : [];
    }
    
    // If input contains letters, search by name
    return mockMembers.filter(member => 
      member.name.toLowerCase().includes(memberQuery.toLowerCase())
    ).slice(0, 5);
  }, [memberQuery]);

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const addMember = () => {
    const selectedMember = mockMembers.find(m => m.id === selectedMemberId);
    if (!selectedMember) return;

    const newApplication: AdvanceLoanApplication = {
      id: Date.now().toString(),
      memberId: selectedMember.id,
      memberName: selectedMember.name,
      advanceAmount: 0,
    };

    setApplications([...applications, newApplication]);
    setSelectedMemberId('');
    setMemberQuery('');
  };

  const updateApplication = (id: string, updates: Partial<AdvanceLoanApplication>) => {
    setApplications(applications.map(app => 
      app.id === id ? { ...app, ...updates } : app
    ));
  };

  const removeApplication = (id: string) => {
    setApplications(applications.filter(app => app.id !== id));
  };

  const handleSave = async () => {
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
            <Label htmlFor="member-search">Search Member</Label>
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
                  <p className="text-sm">{mockMembers.find(m => m.id === selectedMemberId)?.id} - {mockMembers.find(m => m.id === selectedMemberId)?.name}</p>
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
                  {[5000, 10000, 15000, 20000, 25000, 30000].map((amount) => (
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

              {/* Advance Info */}
              {application.advanceAmount > 0 && (
                <div className="p-3 bg-accent/10 rounded-lg border border-accent/20">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Advance Amount:</span>
                      <span className="font-bold text-accent">
                        {formatAmount(application.advanceAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Processing Fee (5%):</span>
                      <span className="text-sm font-medium">
                        {formatAmount(application.advanceAmount * 0.05)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t pt-2">
                      <span className="text-sm font-medium">Net Amount:</span>
                      <span className="font-bold text-success">
                        {formatAmount(application.advanceAmount * 0.95)}
                      </span>
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
                      applications.reduce((sum, app) => sum + (app.advanceAmount * 0.05), 0)
                    )}
                  </div>
                  <div className="text-base font-semibold text-success">
                    Net Disbursement: {formatAmount(
                      applications.reduce((sum, app) => sum + (app.advanceAmount * 0.95), 0)
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
              Advance loans are processed quickly with a 5% processing fee
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Plus, 
  Trash2, 
  Save, 
  User, 
  Users, 
  Search, 
  X, 
  CheckCircle2,
  ArrowLeft,
  Phone,
  CreditCard,
  Shield,
  TrendingUp,
  Sparkles,
  AlertTriangle
} from "lucide-react";
import { dbOperations, MemberBalance } from "@/lib/database";
import { useToast } from "@/hooks/use-toast";
import { getMemberLoanQualifications } from "@/lib/qualificationCalculator";

// Helper functions
const extractMemberId = (memberIdField: string): string => {
  const parts = memberIdField.split('/');
  return parts[parts.length - 1] || memberIdField;
};

const getMember = (id: string) => ({
  id: id.padStart(4, '0'),
  name: `Member ${parseInt(id)}`,
});

const isValidMemberId = (id: string): boolean => {
  const num = parseInt(id);
  return num >= 1 && num <= 9999;
};

const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amount);
};

// This will be replaced by qualificationCalculator
const calculateQualifiedAmount = (memberId: string, realMembers: MemberBalance[]): number => {
  const member = realMembers.find(m => extractMemberId(m.member_id) === memberId);
  if (member) {
    return member.balances.savings_balance * 3; // 3x savings balance
  }
  return 50000; // Default qualification for mock members
};

interface SecurityItem {
  id: string;
  description: string;
}

interface GuarantorSelectionProps {
  currentMemberId: string;
  currentGuarantors: string[];
  realMembers: MemberBalance[];
  onAdd: (guarantorId: string) => void;
  onRemove: (guarantorId: string) => void;
}

function GuarantorSelection({ 
  currentMemberId, 
  currentGuarantors, 
  realMembers,
  onAdd,
  onRemove 
}: GuarantorSelectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'group' | 'search' | 'quick'>('group');
  const [quickId, setQuickId] = useState('');

  // Get same group members
  const groupMembers = useMemo(() => {
    const applicant = realMembers.find(m => extractMemberId(m.member_id) === currentMemberId);
    if (!applicant) return [];
    
    return realMembers
      .filter(m => {
        const mId = extractMemberId(m.member_id);
        return m.group_name === applicant.group_name && 
               mId !== currentMemberId &&
               !currentGuarantors.includes(mId);
      })
      .map(m => ({
        id: extractMemberId(m.member_id),
        name: m.name,
        phone: m.phone,
        isReal: true
      }));
  }, [currentMemberId, currentGuarantors, realMembers]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.trim().toLowerCase();
    const results: Array<{ id: string; name: string; phone?: string; isReal: boolean }> = [];
    
    // Search real members
    const realMatches = realMembers
      .filter(m => {
        const mId = extractMemberId(m.member_id);
        return mId !== currentMemberId &&
               !currentGuarantors.includes(mId) &&
               (mId.includes(query) || m.name.toLowerCase().includes(query) || m.phone.includes(query));
      })
      .slice(0, 8)
      .map(m => ({
        id: extractMemberId(m.member_id),
        name: m.name,
        phone: m.phone,
        isReal: true
      }));
    
    results.push(...realMatches);
    
    // Add mock results for numeric queries
    if (/^\d+$/.test(query)) {
      const paddedId = query.padStart(4, '0');
      if (isValidMemberId(paddedId) && 
          paddedId !== currentMemberId &&
          !currentGuarantors.includes(paddedId) &&
          !results.some(r => r.id === paddedId)) {
        const mock = getMember(paddedId);
        results.push({ ...mock, isReal: false });
      }
    }
    
    return results.slice(0, 10);
  }, [searchQuery, currentMemberId, currentGuarantors, realMembers]);

  const handleQuickAdd = () => {
    const paddedId = quickId.trim().padStart(4, '0');
    if (isValidMemberId(paddedId) && 
        paddedId !== currentMemberId &&
        !currentGuarantors.includes(paddedId)) {
      onAdd(paddedId);
      setQuickId('');
    }
  };

  const getGuarantorName = (id: string) => {
    const member = realMembers.find(m => extractMemberId(m.member_id) === id);
    return member ? member.name : `Member ${parseInt(id)}`;
  };

  return (
    <div className="space-y-4">
      {/* Current Guarantors */}
      {currentGuarantors.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Selected Guarantors ({currentGuarantors.length})
          </Label>
          <div className="flex flex-wrap gap-2">
            {currentGuarantors.map(gId => (
              <Badge key={gId} variant="secondary" className="pl-3 pr-2 py-1.5">
                <span className="mr-2">{gId} - {getGuarantorName(gId)}</span>
                <button
                  onClick={() => onRemove(gId)}
                  className="hover:text-destructive ml-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('group')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'group'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="h-4 w-4 inline mr-1" />
          Same Group {groupMembers.length > 0 && `(${groupMembers.length})`}
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'search'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Search className="h-4 w-4 inline mr-1" />
          Search
        </button>
        <button
          onClick={() => setActiveTab('quick')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'quick'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="h-4 w-4 inline mr-1" />
          Quick Add
        </button>
      </div>

      {/* Tab Content */}
      <div className="min-h-[200px] max-h-[300px] overflow-y-auto">
        {activeTab === 'group' && (
          <div className="space-y-2">
            {groupMembers.length > 0 ? (
              groupMembers.map(member => (
                <button
                  key={member.id}
                  onClick={() => onAdd(member.id)}
                  className="w-full p-3 text-left border rounded-lg bg-accent/30 hover:bg-accent/50 hover:border-primary transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">ID: {member.id} • {member.phone}</p>
                    </div>
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No group members available</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'search' && (
          <div className="space-y-3">
            <Input
              placeholder="Search by ID, name, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
            <div className="space-y-2">
              {searchResults.length > 0 ? (
                searchResults.map(member => (
                  <button
                    key={member.id}
                    onClick={() => {
                      onAdd(member.id);
                      setSearchQuery('');
                    }}
                    className="w-full p-3 text-left border rounded-lg bg-accent/30 hover:bg-accent/50 hover:border-primary transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{member.name}</p>
                          {member.isReal && (
                            <Badge variant="outline" className="text-xs">Real Data</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          ID: {member.id}
                          {member.phone && ` • ${member.phone}`}
                        </p>
                      </div>
                      <Plus className="h-5 w-5 text-primary" />
                    </div>
                  </button>
                ))
              ) : searchQuery ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No results found</p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Type to search members</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'quick' && (
          <div className="space-y-3 pt-2">
            <Label>Enter Member ID (1-9999)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., 1234"
                value={quickId}
                onChange={(e) => setQuickId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
              />
              <Button onClick={handleQuickAdd} disabled={!quickId.trim()}>
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Type the member ID and press Enter or click Add
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function LoanApplicationForm() {
  const [step, setStep] = useState<'select' | 'form'>('select');
  const [memberQuery, setMemberQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<{
    id: string;
    name: string;
    phone?: string;
    isReal: boolean;
  } | null>(null);
  const [realMembers, setRealMembers] = useState<MemberBalance[]>([]);
  const [qualificationWarning, setQualificationWarning] = useState<{
    show: boolean;
    memberName: string;
    reason: string;
    maxAmount: number;
  }>({ show: false, memberName: '', reason: '', maxAmount: 0 });
  const [maxQualifiedAmount, setMaxQualifiedAmount] = useState<number>(0);
  
  // Form fields
  const [loanAmount, setLoanAmount] = useState<number>(0);
  const [installments, setInstallments] = useState<number>(0);
  const [guarantors, setGuarantors] = useState<string[]>([]);
  const [securityItems, setSecurityItems] = useState<SecurityItem[]>([]);
  const [newSecurityItem, setNewSecurityItem] = useState('');
  
  const { toast } = useToast();

  // Load real members
  useEffect(() => {
    const loadRealMembers = async () => {
      try {
        const members = await dbOperations.getAllMembers();
        setRealMembers(members);
      } catch (error) {
        console.error('Error loading members:', error);
        setRealMembers([]);
      }
    };
    loadRealMembers();
  }, []);

  // Search members
  const filteredMembers = useMemo(() => {
    if (!memberQuery) return [];
    
    const query = memberQuery.trim().toLowerCase();
    const results: Array<{ id: string; name: string; phone?: string; isReal: boolean }> = [];

    // Real members
    const realMatches = realMembers
      .filter(m => {
        const mId = extractMemberId(m.member_id);
        return mId.includes(query) || 
               m.name.toLowerCase().includes(query) || 
               m.phone.includes(query);
      })
      .slice(0, 8)
      .map(m => ({
        id: extractMemberId(m.member_id),
        name: m.name,
        phone: m.phone,
        isReal: true
      }));
    
    results.push(...realMatches);

    // Mock members for numeric queries
    if (/^\d+$/.test(query)) {
      const paddedId = query.padStart(4, '0');
      if (isValidMemberId(paddedId) && !results.some(r => r.id === paddedId)) {
        const mock = getMember(paddedId);
        results.push({ ...mock, isReal: false });
      }
    }
    
    return results.slice(0, 10);
  }, [memberQuery, realMembers]);

  const handleMemberSelect = async (member: { id: string; name: string; phone?: string; isReal: boolean }) => {
    // Check qualification for real members
    if (member.isReal) {
      const memberData = realMembers.find(m => extractMemberId(m.member_id) === member.id);
      if (memberData) {
        const qualifications = await getMemberLoanQualifications(memberData, true);
        setMaxQualifiedAmount(qualifications.longterm_loan.max_amount);
        
        if (!qualifications.longterm_loan.qualifies) {
          setQualificationWarning({
            show: true,
            memberName: member.name,
            reason: qualifications.longterm_loan.reason,
            maxAmount: qualifications.longterm_loan.max_amount
          });
          setSelectedMember(member);
          setMemberQuery('');
          return;
        }
      }
    } else {
      // Mock member - use default calculation
      setMaxQualifiedAmount(50000);
    }
    
    setSelectedMember(member);
    setStep('form');
    setMemberQuery('');
  };

  const addSecurityItem = () => {
    if (newSecurityItem.trim() && securityItems.length < 3) {
      setSecurityItems([...securityItems, {
        id: Date.now().toString(),
        description: newSecurityItem.trim()
      }]);
      setNewSecurityItem('');
    }
  };

  const removeSecurityItem = (id: string) => {
    setSecurityItems(securityItems.filter(item => item.id !== id));
  };

  const handleSave = async () => {
    if (!selectedMember) return;

    try {
      // Check for duplicates
      const existingRecords = await dbOperations.getPendingRecords();
      const hasPending = existingRecords.some(
        record => record.type === 'loan' && record.memberId === selectedMember.id
      );

      if (hasPending) {
        toast({
          title: "⚠ Duplicate Record",
          description: `${selectedMember.name} already has a pending loan application.`,
          variant: "destructive"
        });
        return;
      }

      await dbOperations.addLoanApplication({
        memberId: selectedMember.id,
        memberName: selectedMember.name,
        loanAmount: loanAmount,
        installments: installments,
        guarantors: guarantors,
        securityItems: securityItems.map(item => item.description),
        timestamp: new Date()
      });

      toast({
        title: "✅ Application Saved",
        description: `Loan application for ${selectedMember.name} saved successfully`,
      });

      // Reset for next application
      resetForm();
    } catch (error) {
      toast({
        title: "❌ Save Failed",
        description: "Failed to save loan application",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setSelectedMember(null);
    setLoanAmount(0);
    setInstallments(0);
    setGuarantors([]);
    setSecurityItems([]);
    setNewSecurityItem('');
    setStep('select');
  };

  const qualifiedAmount = maxQualifiedAmount;

  const monthlyPayment = loanAmount > 0 && installments > 0
    ? (loanAmount * (1 + 0.015 * installments)) / installments
    : 0;

  // Member Selection Step
  if (step === 'select') {
    return (
      <>
        {/* Qualification Warning Dialog */}
        <AlertDialog open={qualificationWarning.show} onOpenChange={(open) => {
          if (!open) {
            setQualificationWarning({ show: false, memberName: '', reason: '', maxAmount: 0 });
            setSelectedMember(null);
          }
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                {qualificationWarning.memberName} - Does Not Qualify
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p className="text-base">{qualificationWarning.reason}</p>
                {qualificationWarning.maxAmount > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Maximum qualified amount: {formatAmount(qualificationWarning.maxAmount)}
                  </p>
                )}
                <p className="text-sm font-medium text-foreground">
                  Do you want to proceed with the application anyway?
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                setQualificationWarning({ show: false, memberName: '', reason: '', maxAmount: 0 });
                setStep('form');
              }}>
                Proceed Anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="space-y-4 max-w-2xl mx-auto">
          <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Select Member for Loan Application
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Search Member</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID, name, or phone..."
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {memberQuery && (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredMembers.map(member => (
                  <button
                    key={member.id}
                    onClick={() => handleMemberSelect(member)}
                    className="w-full p-4 text-left border rounded-lg hover:bg-accent hover:border-primary transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{member.name}</p>
                          {member.isReal && (
                            <Badge variant="secondary" className="text-xs">Verified</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          ID: {member.id}
                          {member.phone && ` • ${member.phone}`}
                        </p>
                      </div>
                      <div className="text-primary">
                        <User className="h-5 w-5" />
                      </div>
                    </div>
                  </button>
                ))}
                {filteredMembers.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>No members found</p>
                  </div>
                )}
              </div>
            )}

            {!memberQuery && (
              <div className="text-center py-12 text-muted-foreground">
                <User className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium mb-2">Start a New Application</p>
                <p className="text-sm">Search for a member to begin</p>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </>
    );
  }

  // Loan Application Form
  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-3 p-4 bg-card rounded-lg border">
        <Button variant="ghost" size="icon" onClick={resetForm}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-bold">Loan Application Form</h2>
      </div>

      {/* Member Info Card */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Member Name</p>
                  <p className="font-bold text-lg">{selectedMember?.name}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Member ID</p>
                  <p className="font-semibold">{selectedMember?.id}</p>
                </div>
              </div>

              {selectedMember?.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone Number</p>
                    <p className="font-semibold">{selectedMember.phone}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-background rounded-lg p-4 border-2 border-primary text-center">
              <TrendingUp className="h-6 w-6 text-primary mx-auto mb-1" />
              <p className="text-xs text-muted-foreground mb-1">Qualified Amount</p>
              <p className="text-xl font-bold text-primary">{formatAmount(qualifiedAmount)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loan Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Loan Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Loan Amount (KES)</Label>
              <Input
                type="number"
                placeholder="0"
                value={loanAmount || ''}
                onChange={(e) => setLoanAmount(parseFloat(e.target.value) || 0)}
              />
              {loanAmount > 0 && (
                <p className="text-xs text-muted-foreground">{formatAmount(loanAmount)}</p>
              )}
              {loanAmount > qualifiedAmount && (
                <p className="text-xs text-destructive">⚠️ Exceeds qualified amount</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Number of Installments</Label>
              <Input
                type="number"
                min="1"
                max="60"
                placeholder="0"
                value={installments || ''}
                onChange={(e) => setInstallments(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          {monthlyPayment > 0 && (
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex justify-between items-center">
                <span className="font-medium">Monthly Payment:</span>
                <span className="text-xl font-bold text-primary">
                  {formatAmount(monthlyPayment)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Items
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {securityItems.map((item, index) => (
            <div key={item.id} className="flex items-start gap-2 p-3 bg-accent/50 rounded-lg border">
              <div className="flex-1">
                <p className="text-sm font-medium">Item {index + 1}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeSecurityItem(item.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}

          <div className="space-y-2">
            <Label>Add Security Item</Label>
            <div className="flex gap-2">
              <Textarea
                placeholder="Describe the security item"
                value={newSecurityItem}
                onChange={(e) => setNewSecurityItem(e.target.value)}
                rows={2}
                className="flex-1"
              />
              <Button
                onClick={addSecurityItem}
                disabled={!newSecurityItem.trim()}
                size="sm"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {securityItems.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No security items added yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Guarantors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5" />
            Guarantors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GuarantorSelection
            currentMemberId={selectedMember?.id || ''}
            currentGuarantors={guarantors}
            realMembers={realMembers}
            onAdd={(id) => setGuarantors([...guarantors, id])}
            onRemove={(id) => setGuarantors(guarantors.filter(g => g !== id))}
          />
        </CardContent>
      </Card>

      {/* Save Button */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Loan Amount:</span>
              <span className="font-bold text-lg">{formatAmount(loanAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Repayment:</span>
              <span className="font-bold text-lg text-primary">
                {formatAmount(loanAmount * (1 + 0.015 * installments))}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Monthly Payment:</span>
              <span className="font-bold text-lg">
                {formatAmount(monthlyPayment)} × {installments} months
              </span>
            </div>
          </div>

          <Button
            onClick={handleSave}
            className="w-full"
            size="lg"
            disabled={loanAmount === 0 || installments === 0}
          >
            <Save className="h-5 w-5 mr-2" />
            Save Application
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Application will be saved and you can proceed with another one
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
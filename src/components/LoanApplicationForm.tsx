import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, User, Users, Search } from "lucide-react";
import { dbOperations, MemberBalance } from "@/lib/database";
import { useToast } from "@/hooks/use-toast";
import { Keyboard } from "@capacitor/keyboard";


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

// Helper function to generate member data on demand (for mock data)
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

// Guarantor Search Component
function GuarantorSearch({ 
  applicationId, 
  currentMemberId, 
  currentGuarantors, 
  onAddGuarantor, 
  realMembers
}: {
  applicationId: string;
  currentMemberId: string;
  currentGuarantors: string[];
  onAddGuarantor: (applicationId: string, guarantorId: string) => void;
  realMembers: MemberBalance[];
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);

  // Get available guarantors based on search
  const availableGuarantors = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const results: Array<{
      id: string;
      name: string;
      isReal: boolean;
    }> = [];
    
    const excludedIds = new Set([
      currentMemberId,
      ...currentGuarantors
    ]);
    
    const query = searchQuery.trim().toLowerCase();

    // First, search in real member data
    if (realMembers.length > 0) {
      const realMatches = realMembers.filter(member => {
        const memberId = extractMemberId(member.member_id);
        return !excludedIds.has(memberId) && (
          memberId.toLowerCase().includes(query) ||
          member.name.toLowerCase().includes(query) ||
          member.phone.includes(searchQuery.trim()) ||
          member.member_id.toLowerCase().includes(query)
        );
      }).slice(0, 10);

      realMatches.forEach(member => {
        const memberId = extractMemberId(member.member_id);
        results.push({
          id: memberId,
          name: member.name,
          isReal: true
        });
      });
    }

    // Also search mock data if numeric query
    if (/^\d+$/.test(searchQuery.trim())) {
      const mockQuery = searchQuery.trim();
      const paddedId = mockQuery.padStart(4, '0');
      
      if (isValidMemberId(paddedId) && !excludedIds.has(paddedId) && 
          !results.some(r => r.id === paddedId)) {
        const mockMember = getMember(paddedId);
        results.push({
          id: mockMember.id,
          name: mockMember.name,
          isReal: false
        });
      }
      
      // For shorter queries, generate matching options
      if (mockQuery.length < 4) {
        const baseNum = parseInt(mockQuery);
        const multiplier = Math.pow(10, 4 - mockQuery.length);
        
        for (let i = 0; i < Math.min(5, multiplier); i++) {
          const candidateNum = baseNum * multiplier + i;
          if (candidateNum >= 1 && candidateNum <= 9999) {
            const candidateId = candidateNum.toString().padStart(4, '0');
            if (!excludedIds.has(candidateId) && 
                candidateId.startsWith(mockQuery.padStart(mockQuery.length, '0')) &&
                !results.some(r => r.id === candidateId)) {
              const mockMember = getMember(candidateNum.toString());
              results.push({
                id: mockMember.id,
                name: mockMember.name,
                isReal: false
              });
            }
          }
        }
      }
    }
    
    return results.slice(0, 15);
  }, [searchQuery, currentMemberId, currentGuarantors, realMembers]);

  const handleAddGuarantor = (guarantorId: string) => {
    if (!currentGuarantors.includes(guarantorId) && guarantorId !== currentMemberId) {
      onAddGuarantor(applicationId, guarantorId);
      setSearchQuery('');
      setShowResults(false);
    }
  };

  useEffect(() => {
    const handleKeyboardShow = () => {
      const navbar = document.querySelector('nav[class*="fixed bottom-0"]');
      if (navbar) {
        (navbar as HTMLElement).style.transform = 'translateY(100%)';
        (navbar as HTMLElement).style.transition = 'transform 0.3s ease-in-out';
      }
    };
  
    const handleKeyboardHide = () => {
      const navbar = document.querySelector('nav[class*="fixed bottom-0"]');
      if (navbar) {
        (navbar as HTMLElement).style.transform = 'translateY(0)';
      }
    };
  
    Keyboard.addListener('keyboardDidShow', handleKeyboardShow);
    Keyboard.addListener('keyboardDidHide', handleKeyboardHide);
  
    return () => {
      Keyboard.removeAllListeners();
    };
  }, []);
  

  return (
    <div className="space-y-2 relative">
      <Label className="flex items-center gap-2">
        <Search className="h-4 w-4" />
        Search & Add Guarantor
      </Label>
      <Input
        placeholder="Type member ID or name to search..."
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setShowResults(e.target.value.length > 0);
        }}
        onFocus={() => searchQuery && setShowResults(true)}
        onBlur={() => {
          setTimeout(() => setShowResults(false), 200);
        }}
      />
      
      {showResults && availableGuarantors.length > 0 && (
        <div className="absolute z-10 w-full bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {availableGuarantors.map((guarantor) => (
            <Button
              key={`${guarantor.id}-${guarantor.isReal ? 'real' : 'mock'}`}
              variant="ghost"
              onClick={() => handleAddGuarantor(guarantor.id)}
              className="w-full justify-start p-3 h-auto text-left hover:bg-accent"
            >
              <div className="flex flex-col items-start w-full">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{guarantor.id} - {guarantor.name}</span>
                  {guarantor.isReal && (
                    <Badge variant="secondary" className="text-xs">
                      REAL DATA
                    </Badge>
                  )}
                </div>
              </div>
            </Button>
          ))}
        </div>
      )}
      
      {searchQuery && showResults && availableGuarantors.length === 0 && (
        <div className="absolute z-10 w-full bg-background border rounded-lg shadow-lg p-3">
          <p className="text-sm text-muted-foreground">No members found matching "{searchQuery}"</p>
        </div>
      )}
    </div>
  );
}

export function LoanApplicationForm() {
  const [applications, setApplications] = useState<LoanApplication[]>([]);
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
        console.log(`Loaded ${members.length} real members for loan applications`);
      } catch (error) {
        console.error('Error loading real members:', error);
        setRealMembers([]);
      }
    };

    loadRealMembers();
  }, []);

  // Search and filter members based on query (hybrid approach)
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
      
      if (/^\d+$/.test(mockQuery)) {
        const paddedId = mockQuery.padStart(4, '0');
        
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
          
          if (!exactMatch && mockQuery.length < 4) {
            const startMatches = mockMembers.filter(member => 
              member.id.startsWith(mockQuery.padStart(mockQuery.length, '0')) &&
              !results.some(r => r.id === member.id)
            ).slice(0, 5);
            startMatches.forEach(member => {
              results.push({
                id: member.id,
                name: member.name,
                isReal: false
              });
            });
          }
          
          if (!exactMatch && mockQuery.length >= 4) {
            const partialMatches = mockMembers.filter(member => 
              (member.id.includes(mockQuery) || member.id === mockQuery) &&
              !results.some(r => r.id === member.id)
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

    return results.slice(0, 10);
  }, [memberQuery, realMembers]);

  // Get members from the same group as the loan applicant
  const getMembersFromSameGroup = (memberId: string) => {
    const applicantMember = realMembers.find(member => 
      extractMemberId(member.member_id) === memberId
    );
    
    if (!applicantMember) return [];
    
    const excludedIds = new Set([
      memberId,
      ...applications.map(app => app.memberId)
    ]);
    
    const groupMembers = realMembers.filter(member => {
      const memberIdExtracted = extractMemberId(member.member_id);
      return member.group_name === applicantMember.group_name && 
             !excludedIds.has(memberIdExtracted);
    });
    
    return groupMembers.map(member => ({
      id: extractMemberId(member.member_id),
      name: member.name,
      isReal: true
    }));
  };

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const addMember = () => {
    if (!selectedMemberId || !selectedMemberName) return;

    const newApplication: LoanApplication = {
      id: Date.now().toString(),
      memberId: selectedMemberId,
      memberName: selectedMemberName,
      loanAmount: 0,
      installments: 0,
      guarantors: [],
    };

    setApplications([...applications, newApplication]);
    setSelectedMemberId('');
    setSelectedMemberName('');
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

  const handleMemberSelect = (member: { id: string; name: string; isReal: boolean }) => {
    setSelectedMemberId(member.id);
    setSelectedMemberName(member.name);
    setMemberQuery('');
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
      setSelectedMemberName('');
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
                    min="0"
                    max="60"
                    value={application.installments}
                    onChange={(e) => updateApplication(application.id, {
                      installments: parseInt(e.target.value) || 0
                    })}
                    placeholder="Enter number of installments"
                  />
                </div>
              </div>

              {/* Monthly Payment Display */}
              {application.loanAmount > 0 && application.installments > 0 && (
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
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Guarantors ({application.guarantors.length})
                </Label>
                
                {/* Current Guarantors */}
                {application.guarantors.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {application.guarantors.map((guarantorId) => {
                      let guarantorName = `Member ${parseInt(guarantorId)}`;
                      const realGuarantor = realMembers.find(member => 
                        extractMemberId(member.member_id) === guarantorId
                      );
                      if (realGuarantor) {
                        guarantorName = realGuarantor.name;
                      }
                      
                      return (
                        <Badge key={guarantorId} variant="secondary" className="flex items-center gap-1">
                          <span className="text-xs">{guarantorId}</span>
                          <span>{guarantorName}</span>
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

                {/* Same Group Members Quick Add */}
                {(() => {
                  const groupMembers = getMembersFromSameGroup(application.memberId);
                  return groupMembers.length > 0 && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm">
                        <Users className="h-3 w-3" />
                        Quick Add from Same Group
                      </Label>
                      <div className="grid gap-2 max-h-32 overflow-y-auto border rounded-lg p-2 bg-accent/5">
                        {groupMembers
                          .filter(member => !application.guarantors.includes(member.id))
                          .slice(0, 8) // Limit to prevent overwhelming UI
                          .map((member) => (
                          <Button
                            key={member.id}
                            variant="outline"
                            size="sm"
                            onClick={() => addGuarantor(application.id, member.id)}
                            className="justify-start text-left h-auto p-2 text-xs"
                          >
                            <div className="flex items-center justify-between w-full">
                              <span>{member.id} - {member.name}</span>
                              <Badge variant="secondary" className="text-xs ml-2">
                                SAME GROUP
                              </Badge>
                            </div>
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Members from the same group as {application.memberName}
                      </p>
                    </div>
                  );
                })()}

                {/* Search and Add Guarantor */}
                <GuarantorSearch 
                  applicationId={application.id}
                  currentMemberId={application.memberId}
                  currentGuarantors={application.guarantors}
                  onAddGuarantor={addGuarantor}
                  realMembers={realMembers}
                />

                {/* Manual ID Entry (Backup method) */}
                <div className="space-y-2">
                  <Label className="text-sm">Quick Add by ID</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Member ID (1-9999)"
                      className="text-sm"
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
                    Press Enter or click Add
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
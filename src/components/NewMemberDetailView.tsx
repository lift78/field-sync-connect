import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { dbOperations, NewMember } from "@/lib/database";

import { 
  ArrowLeft, 
  Save, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  User,
  Phone,
  Users,
  MapPin,
  CreditCard,
  Mail,
  Briefcase,
  FileText,
  Loader2,
  Trash2,
  Calendar
} from "lucide-react";

interface NewMemberDetailViewProps {
  record: {
    id: string;
    memberId: string;
    status: 'synced' | 'pending' | 'failed';
    syncError?: string;
    lastUpdated: string;
    data: NewMember;
  };
  onBack: () => void;
  onSaved?: () => void;
  readOnly?: boolean;
}

export function NewMemberDetailView({ record, onBack, onSaved, readOnly = false }: NewMemberDetailViewProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // Editable fields
  const [name, setName] = useState(record.data.name || "");
  const [phone, setPhone] = useState(record.data.phone || "");
  const [selectedGroup, setSelectedGroup] = useState(record.data.group?.toString() || "");
  const [location, setLocation] = useState(record.data.location || "");
  const [idNumber, setIdNumber] = useState(record.data.id_number || "");
  const [email, setEmail] = useState(record.data.email || "");
  const [occupation, setOccupation] = useState(record.data.occupation || "");
  const [notes, setNotes] = useState(record.data.notes || "");

  // Track if any changes were made
  const [hasChanges, setHasChanges] = useState(false);

  // Load groups on mount
  useEffect(() => {
    const loadGroups = async () => {
      try {
        setLoadingGroups(true);
        const groupsData = await dbOperations.getAllGroups();
        setGroups(groupsData);
      } catch (error) {
        console.error('Error loading groups:', error);
      } finally {
        setLoadingGroups(false);
      }
    };
    loadGroups();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'synced':
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 px-2 py-0.5 text-xs">Synced</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200 px-2 py-0.5 text-xs">Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700 border-red-200 px-2 py-0.5 text-xs">Failed</Badge>;
    }
  };

  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return new Intl.DateTimeFormat('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch (error) {
      console.error('Error formatting date:', error, 'Input:', isoString);
      return 'Invalid date';
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setHasChanges(true);
    switch (field) {
      case 'name':
        setName(value);
        break;
      case 'phone':
        setPhone(value);
        break;
      case 'group':
        setSelectedGroup(value);
        break;
      case 'location':
        setLocation(value);
        break;
      case 'idNumber':
        setIdNumber(value);
        break;
      case 'email':
        setEmail(value);
        break;
      case 'occupation':
        setOccupation(value);
        break;
      case 'notes':
        setNotes(value);
        break;
    }
  };

  const validateForm = () => {
    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Member name is required",
        variant: "destructive"
      });
      return false;
    }

    if (!phone.trim()) {
      toast({
        title: "Validation Error",
        description: "Phone number is required",
        variant: "destructive"
      });
      return false;
    }

    if (!selectedGroup) {
      toast({
        title: "Validation Error",
        description: "Please select a group",
        variant: "destructive"
      });
      return false;
    }

    if (!location.trim()) {
      toast({
        title: "Validation Error",
        description: "Location is required",
        variant: "destructive"
      });
      return false;
    }

    if (!idNumber.trim()) {
      toast({
        title: "Validation Error",
        description: "ID number is required",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleSaveChanges = async () => {
    if (!validateForm()) return;

    setIsSaving(true);

    try {
      const oldIdNumber = record.data.id_number;
      const newIdNumber = idNumber.trim();
      const idNumberChanged = oldIdNumber !== newIdNumber;

      const updatedData: Partial<NewMember> = {
        name: name.trim(),
        phone: phone.trim(),
        group: parseInt(selectedGroup),
        location: location.trim(),
        id_number: newIdNumber,
        email: email.trim() || undefined,
        occupation: occupation.trim() || undefined,
        notes: notes.trim() || undefined,
        timestamp: record.data.timestamp,
        synced: false,
        syncStatus: 'pending'
      };

      // Update the new member record
      await dbOperations.updateNewMember(record.id, updatedData);

      // If ID number changed, update all related records
      if (idNumberChanged) {
        // Update associated cash collections (initial allocations)
        const cashCollections = await dbOperations.getCashCollections();
        const relatedCashCollections = cashCollections.filter(cc => cc.memberId === oldIdNumber);
        
        for (const cc of relatedCashCollections) {
          await dbOperations.updateCashCollection(cc.id!.toString(), {
            ...cc,
            memberId: newIdNumber,
            memberName: name.trim()
          });
        }

        // Update loan applications
        const loanApplications = await dbOperations.getLoanApplications();
        const relatedLoanApps = loanApplications.filter(la => la.memberId === oldIdNumber);
        
        for (const la of relatedLoanApps) {
          await dbOperations.updateLoanApplication(la.id!.toString(), {
            ...la,
            memberId: newIdNumber,
            memberName: name.trim()
          });
        }

        // Update advance loans
        const advanceLoans = await dbOperations.getAdvanceLoans();
        const relatedAdvanceLoans = advanceLoans.filter(al => al.memberId === oldIdNumber);
        
        for (const al of relatedAdvanceLoans) {
          await dbOperations.updateAdvanceLoan(al.id!.toString(), {
            ...al,
            memberId: newIdNumber,
            memberName: name.trim()
          });
        }

        // Update member balance record
        const memberBalance = await dbOperations.getMemberById(oldIdNumber);
        if (memberBalance) {
          await dbOperations.updateMemberBalance(oldIdNumber, {
            member_id: newIdNumber,
            name: name.trim(),
            phone: phone.trim(),
            group_id: parseInt(selectedGroup),
            group_name: memberBalance.group_name
          });
        }
      } else {
        // Even if ID didn't change, update name in related records
        const cashCollections = await dbOperations.getCashCollections();
        const relatedCashCollections = cashCollections.filter(cc => cc.memberId === newIdNumber);
        
        for (const cc of relatedCashCollections) {
          await dbOperations.updateCashCollection(cc.id!.toString(), {
            ...cc,
            memberName: name.trim()
          });
        }

        // Update loan applications
        const loanApplications = await dbOperations.getLoanApplications();
        const relatedLoanApps = loanApplications.filter(la => la.memberId === newIdNumber);
        
        for (const la of relatedLoanApps) {
          await dbOperations.updateLoanApplication(la.id!.toString(), {
            ...la,
            memberName: name.trim()
          });
        }

        // Update advance loans
        const advanceLoans = await dbOperations.getAdvanceLoans();
        const relatedAdvanceLoans = advanceLoans.filter(al => al.memberId === newIdNumber);
        
        for (const al of relatedAdvanceLoans) {
          await dbOperations.updateAdvanceLoan(al.id!.toString(), {
            ...al,
            memberName: name.trim()
          });
        }

        // Update member balance with new info
        const memberBalance = await dbOperations.getMemberById(newIdNumber);
        if (memberBalance) {
          await dbOperations.updateMemberBalance(newIdNumber, {
            name: name.trim(),
            phone: phone.trim(),
            group_id: parseInt(selectedGroup)
          });
        }
      }

      toast({
        title: "✅ Member Updated",
        description: `Member information has been updated successfully${idNumberChanged ? ' (including all related records)' : ''}!`,
      });

      setHasChanges(false);
      
      if (onSaved) {
        onSaved();
      }
      
    } catch (error: any) {
      console.error('Error updating member:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update member. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (!confirm('Are you sure you want to delete this member registration? This action cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(true);
      
      await dbOperations.deleteNewMember(record.id);

      toast({
        title: "Success",
        description: "Member registration deleted successfully",
      });

      onBack();
      
    } catch (error) {
      console.error('Failed to delete record:', error);
      toast({
        title: "Error",
        description: "Failed to delete record",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const renderEditableField = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    fieldType: 'text' | 'email' | 'textarea' = 'text',
    icon?: React.ReactNode,
    optional: boolean = false
  ) => {
    if (readOnly) {
      return (
        <div>
          <Label className="text-sm font-semibold mb-2 flex items-center gap-2">
            {icon}
            {label}
            {optional && <span className="text-[10px] text-muted-foreground">(optional)</span>}
          </Label>
          <div className="p-3 bg-muted/50 rounded-lg border border-border">
            <span className="font-medium text-base">{value || 'N/A'}</span>
          </div>
        </div>
      );
    }

    return (
      <div>
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          {icon}
          {label}
          {optional && <span className="text-[10px] text-muted-foreground">(optional)</span>}
        </Label>
        {fieldType === 'textarea' ? (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1.5 min-h-20 text-sm"
            disabled={readOnly}
          />
        ) : (
          <Input
            type={fieldType}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1.5 h-9 text-sm"
            disabled={readOnly}
          />
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24 overflow-x-hidden">
      <div className="w-full space-y-3 px-1 py-3">
        {/* Header */}
        <Card className="shadow-card bg-card">
          <CardHeader className="p-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={onBack}
                className="h-10 w-10 rounded-full border-2 hover:bg-accent flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base font-bold truncate">Member Registration</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {readOnly ? 'View member details' : 'Review and edit registration'}
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Member Info Header */}
        <Card className="shadow-card bg-card overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex items-center justify-center w-14 h-14 bg-white/20 backdrop-blur rounded-full border-2 border-white/40 flex-shrink-0">
                  <User className="h-7 w-7 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-base text-white truncate">
                      {record.data.name || 'New Member'}
                    </h3>
                    {getStatusIcon(record.status)}
                  </div>
                  <p className="text-xs text-green-100 dark:text-green-200 truncate">ID: {record.data.id_number}</p>
                  <p className="text-xs text-green-100 dark:text-green-200 flex items-center gap-1 mt-1">
                    <Calendar className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{formatDateTime(record.lastUpdated)}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 items-end flex-shrink-0">
                {getStatusBadge(record.status)}
                {!readOnly && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/20 border-white/40 text-white hover:bg-white/30 backdrop-blur h-8 text-xs px-3"
                    onClick={handleDeleteRecord}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-1" />
                    )}
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Error Message */}
        {record.status === 'failed' && record.syncError && (
          <Card className="shadow-sm bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900">
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Sync Failed</p>
                  <p className="text-xs text-red-600 dark:text-red-400 break-words">
                    {record.syncError}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Member Information Form */}
        <Card className="shadow-sm">
          <CardHeader className="p-3 border-b bg-muted/30">
            <CardTitle className="text-sm font-bold">Member Information</CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-3">
            {/* Full Name */}
            {renderEditableField(
              'Full Name *',
              name,
              (value) => handleFieldChange('name', value),
              'text',
              <User className="h-3.5 w-3.5" />
            )}

            {/* Phone Number */}
            {renderEditableField(
              'Phone Number *',
              phone,
              (value) => handleFieldChange('phone', value),
              'text',
              <Phone className="h-3.5 w-3.5" />
            )}

            {/* Group */}
            <div>
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Group *
              </Label>
              {loadingGroups ? (
                <div className="mt-1.5 h-9 flex items-center justify-center border rounded-md">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : readOnly ? (
                <div className="mt-1.5 p-3 bg-muted/50 rounded-lg border border-border h-9 flex items-center">
                  <span className="font-medium text-base">
                    {groups.find(g => g.id === parseInt(selectedGroup))?.name || 'Unknown Group'}
                  </span>
                </div>
              ) : (
                <Select 
                  value={selectedGroup} 
                  onValueChange={(value) => handleFieldChange('group', value)}
                  disabled={readOnly}
                >
                  <SelectTrigger className="mt-1.5 h-9 text-sm">
                    <SelectValue placeholder="Select a group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id.toString()} className="text-sm">
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Location */}
            {renderEditableField(
              'Location *',
              location,
              (value) => handleFieldChange('location', value),
              'text',
              <MapPin className="h-3.5 w-3.5" />
            )}

            {/* ID Number */}
            {renderEditableField(
              'ID Number *',
              idNumber,
              (value) => handleFieldChange('idNumber', value),
              'text',
              <CreditCard className="h-3.5 w-3.5" />
            )}

            {/* Email (Optional) */}
            {renderEditableField(
              'Email',
              email,
              (value) => handleFieldChange('email', value),
              'email',
              <Mail className="h-3.5 w-3.5" />,
              true
            )}

            {/* Occupation (Optional) */}
            {renderEditableField(
              'Occupation',
              occupation,
              (value) => handleFieldChange('occupation', value),
              'text',
              <Briefcase className="h-3.5 w-3.5" />,
              true
            )}

            {/* Notes (Optional) */}
            {renderEditableField(
              'Notes',
              notes,
              (value) => handleFieldChange('notes', value),
              'textarea',
              <FileText className="h-3.5 w-3.5" />,
              true
            )}
          </CardContent>
        </Card>

        {/* Save Button - Fixed at bottom */}
        {!readOnly && hasChanges && (
          <div className="fixed bottom-3 left-1 right-1 z-50">
            <Card className="shadow-2xl bg-gradient-to-r from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 border-0">
              <CardContent className="p-2.5">
                <Button 
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="w-full bg-white dark:bg-slate-900 text-green-600 dark:text-green-400 hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold text-sm h-9 shadow-lg"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
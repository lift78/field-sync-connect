import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { dbOperations } from "@/lib/database";
import { 
  ArrowLeft, 
  User, 
  Phone, 
  Users, 
  MapPin, 
  CreditCard, 
  Mail, 
  Briefcase,
  FileText,
  DollarSign,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Wallet
} from "lucide-react";

interface CustomItem {
  description: string;
  amount: number;
  isCustom: boolean;
}

interface AddMemberFormProps {
  onBack: () => void;
}

export function AddMemberForm({ onBack }: AddMemberFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // Member details
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [location, setLocation] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [email, setEmail] = useState("");
  const [occupation, setOccupation] = useState("");
  const [notes, setNotes] = useState("");

  // Collections
  const [mpesaAmount, setMpesaAmount] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  
  // Allocations
  const [savings, setSavings] = useState("");
  const [customItems, setCustomItems] = useState<CustomItem[]>([
    { description: "Registration Fee", amount: 0, isCustom: true }
  ]);

  // Load groups
  useEffect(() => {
    const loadGroups = async () => {
      try {
        setLoadingGroups(true);
        const groupsData = await dbOperations.getAllGroups();
        setGroups(groupsData);
      } catch (error) {
        console.error('Error loading groups:', error);
        toast({
          title: "Error",
          description: "Failed to load groups",
          variant: "destructive"
        });
      } finally {
        setLoadingGroups(false);
      }
    };

    loadGroups();
  }, []);

  const addCustomItem = () => {
    setCustomItems([...customItems, { description: "", amount: 0, isCustom: true }]);
  };

  const removeCustomItem = (index: number) => {
    setCustomItems(customItems.filter((_, i) => i !== index));
  };

  const updateCustomItem = (index: number, field: 'description' | 'amount', value: string | number) => {
    const updated = [...customItems];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setCustomItems(updated);
  };

  const calculateTotalInput = () => {
    const mpesa = parseFloat(mpesaAmount) || 0;
    const cash = parseFloat(cashAmount) || 0;
    return mpesa + cash;
  };

  const calculateTotalAllocated = () => {
    const savingsAmount = parseFloat(savings) || 0;
    const customTotal = customItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    return savingsAmount + customTotal;
  };

  const isBalanced = () => {
    const totalInput = calculateTotalInput();
    const totalAllocated = calculateTotalAllocated();
    // Allow submission if no amounts, or if they balance
    if (totalInput === 0 && totalAllocated === 0) return true;
    return totalInput === totalAllocated;
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
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

    // id_number is required as it's used as the identifier
    if (!idNumber.trim()) {
      toast({
        title: "Validation Error",
        description: "ID number is required (used as member identifier)",
        variant: "destructive"
      });
      return false;
    }

    // Validate allocation balance
    if (!isBalanced()) {
      const totalInput = calculateTotalInput();
      const totalAllocated = calculateTotalAllocated();
      toast({
        title: "Allocation Mismatch",
        description: `Total input (${formatAmount(totalInput)}) must equal total allocated (${formatAmount(totalAllocated)})`,
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const totalAmount = calculateTotalInput();
      const mpesaNum = parseFloat(mpesaAmount) || 0;
      const cashNum = parseFloat(cashAmount) || 0;
      const savingsNum = parseFloat(savings) || 0;

      // Step 1: Create new member record
      const memberData = {
        name: name.trim(),
        phone: phone.trim(),
        group: parseInt(selectedGroup),
        location: location.trim(),
        id_number: idNumber.trim(),
        email: email.trim() || undefined,
        occupation: occupation.trim() || undefined,
        notes: notes.trim() || undefined,
        timestamp: new Date()
      };

      const memberId = await dbOperations.addNewMember(memberData);
      console.log('New member saved to Dexie with ID:', memberId);

      // Step 2: Create cash collection record for initial allocations if any amounts are provided
      if (totalAmount > 0) {
        const allocations: any[] = [];
        
        if (savingsNum > 0) {
          allocations.push({
            memberId: idNumber,
            type: 'savings',
            amount: savingsNum
          });
        }

        // Add custom items to allocations
        customItems.forEach(item => {
          if (item.description && item.amount > 0) {
            allocations.push({
              memberId: idNumber,
              type: 'other',
              amount: item.amount,
              reason: item.description
            });
          }
        });

        const cashCollectionData = {
          memberId: idNumber,
          memberName: name.trim(),
          totalAmount,
          cashAmount: cashNum,
          mpesaAmount: mpesaNum,
          allocations,
          timestamp: new Date()
        };

        const cashCollectionId = await dbOperations.addCashCollection(cashCollectionData);
        
        // Link cash collection to new member
        await dbOperations.updateNewMemberStatus(memberId.toString(), 'pending');
        
        console.log('Initial allocations saved as cash collection:', cashCollectionId);
      }

      // Step 3: Add the new member to memberBalances so they appear in selections
      // IMPORTANT: Use addMemberBalance to ADD a single member without clearing all existing members
      const selectedGroupData = groups.find(g => g.id === parseInt(selectedGroup));
      await dbOperations.addMemberBalance({
        member_id: idNumber,
        name: name.trim(),
        phone: phone.trim(),
        group_id: parseInt(selectedGroup),
        group_name: selectedGroupData?.name || 'Unknown Group',
        meeting_date: new Date().toISOString().split('T')[0],
        balances: {
          savings_balance: savingsNum,
          loan_balance: 0,
          advance_loan_balance: 0,
          unallocated_funds: 0,
          total_outstanding: 0
        },
        last_updated: new Date().toISOString()
      });

      toast({
        title: "✅ Member Registered",
        description: `${name} has been registered successfully${totalAmount > 0 ? ` with ${formatAmount(totalAmount)} initial allocation` : ''}!`,
      });

      // Reset form
      setName("");
      setPhone("");
      setSelectedGroup("");
      setLocation("");
      setIdNumber("");
      setEmail("");
      setOccupation("");
      setNotes("");
      setMpesaAmount("");
      setCashAmount("");
      setSavings("");
      setCustomItems([{ description: "Registration Fee", amount: 0, isCustom: true }]);

    } catch (error: any) {
      console.error('Error registering member:', error);
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register member. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 overflow-x-hidden">
      <div className="space-y-3 px-0.5 py-3">
        {/* Header */}
        <Card className="shadow-sm bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent border-green-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onBack}
                className="h-9 w-9 rounded-full border-2 hover:bg-accent flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
                  <User className="h-4 w-4 text-green-600" />
                  Add New Member
                </h2>
                <p className="text-xs text-muted-foreground">Register a new member to the system</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Member Information */}
        <Card className="shadow-sm">
          <CardHeader className="p-3 border-b bg-muted/30">
            <CardTitle className="text-sm font-bold">Member Information</CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-3">
            {/* Full Name */}
            <div>
              <Label htmlFor="name" className="text-xs font-semibold flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Full Name *
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="mt-1.5 h-9 text-sm"
              />
            </div>

            {/* Phone Number */}
            <div>
              <Label htmlFor="phone" className="text-xs font-semibold flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                Phone Number *
              </Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="254712345678"
                className="mt-1.5 h-9 text-sm"
              />
            </div>

            {/* Group */}
            <div>
              <Label htmlFor="group" className="text-xs font-semibold flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Group *
              </Label>
              {loadingGroups ? (
                <div className="mt-1.5 h-9 flex items-center justify-center border rounded-md">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
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
            <div>
              <Label htmlFor="location" className="text-xs font-semibold flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Location *
              </Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Nairobi"
                className="mt-1.5 h-9 text-sm"
              />
            </div>

            {/* ID Number */}
            <div>
              <Label htmlFor="idNumber" className="text-xs font-semibold flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" />
                ID Number *
              </Label>
              <Input
                id="idNumber"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                placeholder="12345678"
                className="mt-1.5 h-9 text-sm"
              />
            </div>

            {/* Email (Optional) */}
            <div>
              <Label htmlFor="email" className="text-xs font-semibold flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                Email
                <span className="text-[10px] text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="mt-1.5 h-9 text-sm"
              />
            </div>

            {/* Occupation (Optional) */}
            <div>
              <Label htmlFor="occupation" className="text-xs font-semibold flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" />
                Occupation
                <span className="text-[10px] text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="occupation"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="Teacher"
                className="mt-1.5 h-9 text-sm"
              />
            </div>

            {/* Notes (Optional) */}
            <div>
              <Label htmlFor="notes" className="text-xs font-semibold flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Notes
                <span className="text-[10px] text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about the member..."
                className="mt-1.5 min-h-20 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Cash Collection */}
        <Card className="shadow-sm border-green-200 dark:border-green-900">
          <CardHeader className="p-3 border-b bg-green-50 dark:bg-green-950/30">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Wallet className="h-4 w-4 text-green-600" />
              Cash Collection
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Money received from member</p>
          </CardHeader>
          <CardContent className="p-3 space-y-3">
            {/* Cash Amount */}
            <div>
              <Label htmlFor="cashAmount" className="text-xs font-semibold flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-orange-600" />
                💵 Cash Amount (KES)
              </Label>
              <Input
                id="cashAmount"
                type="number"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                placeholder="0"
                className="mt-1.5 h-9 text-sm"
              />
            </div>

            {/* MPESA Amount */}
            <div>
              <Label htmlFor="mpesaAmount" className="text-xs font-semibold flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-green-600" />
                📱 MPESA Amount (KES)
              </Label>
              <Input
                id="mpesaAmount"
                type="number"
                value={mpesaAmount}
                onChange={(e) => setMpesaAmount(e.target.value)}
                placeholder="0"
                className="mt-1.5 h-9 text-sm"
              />
            </div>

            {/* Collection Total */}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between p-2.5 bg-green-100 dark:bg-green-950/50 rounded-lg border border-green-300 dark:border-green-800">
                <span className="text-xs font-semibold text-green-700 dark:text-green-300">Total Collected</span>
                <span className="text-base font-bold text-green-600 dark:text-green-400">
                  KES {calculateTotalInput().toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Allocations */}
        <Card className="shadow-sm border-blue-200 dark:border-blue-900">
          <CardHeader className="p-3 border-b bg-blue-50 dark:bg-blue-950/30">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              Allocations
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">How the collected money is allocated</p>
          </CardHeader>
          <CardContent className="p-3 space-y-3">
            {/* Savings */}
            <div>
              <Label htmlFor="savings" className="text-xs font-semibold flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-blue-600" />
                💰 Savings (KES)
              </Label>
              <Input
                id="savings"
                type="number"
                value={savings}
                onChange={(e) => setSavings(e.target.value)}
                placeholder="0"
                className="mt-1.5 h-9 text-sm"
              />
            </div>

            {/* Custom Items (Other) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Other Items</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addCustomItem}
                  className="h-7 text-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Item
                </Button>
              </div>

              {customItems.map((item, index) => (
                <Card key={index} className="border-2">
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-2">
                          <div>
                            <Label className="text-xs">Description</Label>
                            <Select
                              value={item.description}
                              onValueChange={(value) => updateCustomItem(index, 'description', value)}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Select reason..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Lateness Fine">Lateness Fine</SelectItem>
                                <SelectItem value="Advance fine(kes 10)">Advance fine(kes 10)</SelectItem>
                                <SelectItem value="Loan Processing Fees">Loan Processing Fees</SelectItem>
                                <SelectItem value="Advocate Fees">Advocate Fees</SelectItem>
                                <SelectItem value="Insurance Risk Fund">Insurance Risk Fund</SelectItem>
                                <SelectItem value="Contribution for Deceased">Contribution for Deceased</SelectItem>
                                <SelectItem value="Registration Fee">Registration Fee</SelectItem>
                                <SelectItem value="Meeting Absence Fine">Meeting Absence Fine</SelectItem>
                                <SelectItem value="Administrative Fees">Administrative Fees</SelectItem>
                                <SelectItem value="Fines and Penalties">Fines and Penalties</SelectItem>
                                <SelectItem value="Custom (Other)">Custom (Other)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Amount (KES)</Label>
                            <Input
                              type="number"
                              placeholder="0"
                              value={item.amount || ''}
                              onChange={(e) => updateCustomItem(index, 'amount', parseFloat(e.target.value) || 0)}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeCustomItem(index)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 mt-5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {customItems.length === 0 && (
                <div className="text-center py-4 bg-muted/30 rounded-lg border-2 border-dashed">
                  <p className="text-xs text-muted-foreground">No custom items added</p>
                </div>
              )}
            </div>

            {/* Allocation Total */}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between p-2.5 bg-blue-100 dark:bg-blue-950/50 rounded-lg border border-blue-300 dark:border-blue-800">
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Total Allocated</span>
                <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                  KES {calculateTotalAllocated().toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Balance Summary */}
        <Card className={`shadow-sm ${!isBalanced() && (calculateTotalInput() > 0 || calculateTotalAllocated() > 0) ? 'border-red-200 dark:border-red-900' : 'border-green-200 dark:border-green-900'}`}>
          <CardContent className="p-3">
            <div className="space-y-2">
              {!isBalanced() && (calculateTotalInput() > 0 || calculateTotalAllocated() > 0) ? (
                <div className="flex items-center gap-2 p-2.5 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-xs font-semibold text-red-700 dark:text-red-300 block">
                      Amounts must match!
                    </span>
                    <span className="text-xs text-red-600 dark:text-red-400">
                      Difference: KES {Math.abs(calculateTotalInput() - calculateTotalAllocated()).toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2.5 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
                  <div className="h-4 w-4 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <span className="text-xs font-semibold text-green-700 dark:text-green-300">
                    {calculateTotalInput() === 0 ? 'Ready to register (no initial payments)' : 'Collection and allocations balanced'}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Info Alert */}
        <Card className="shadow-sm bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-200">
                Member registration will be saved locally and synced when online. 
                Ensure all required fields (*) are filled correctly.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full h-11 text-sm font-bold bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Registering Member...
            </>
          ) : (
            <>
              <User className="mr-2 h-4 w-4" />
              Register Member
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
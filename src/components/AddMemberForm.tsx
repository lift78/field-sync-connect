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
  Calendar,
  FileText,
  DollarSign,
  Plus,
  Trash2,
  Loader2,
  AlertCircle
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
  const [registrationDate, setRegistrationDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState("");

  // Allocations
  const [registrationFee, setRegistrationFee] = useState("500");
  const [savings, setSavings] = useState("1000");
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);

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

  const calculateTotal = () => {
    const regFee = parseFloat(registrationFee) || 0;
    const savingsAmount = parseFloat(savings) || 0;
    const customTotal = customItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    return regFee + savingsAmount + customTotal;
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

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const memberData = {
        member: {
          name: name.trim(),
          phone: phone.trim(),
          group: parseInt(selectedGroup),
          location: location.trim(),
          id_number: idNumber.trim(),
          email: email.trim() || undefined,
          occupation: occupation.trim() || undefined,
          registration_date: registrationDate,
          notes: notes.trim() || undefined
        },
        allocations: {
          registration_fee: parseFloat(registrationFee) || 0,
          savings: parseFloat(savings) || 0,
          other_items: customItems.filter(item => item.description && item.amount > 0)
        },
        officer_name: "Current Officer",
        timestamp: new Date().toISOString(),
        force_create: false
      };

      // TODO: Replace with actual API call
      console.log('Member registration data:', memberData);

      toast({
        title: "Success",
        description: `Member ${name} registered successfully!`,
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
      setRegistrationFee("500");
      setSavings("1000");
      setCustomItems([]);

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

            {/* Registration Date */}
            <div>
              <Label htmlFor="registrationDate" className="text-xs font-semibold flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Registration Date
              </Label>
              <Input
                id="registrationDate"
                type="date"
                value={registrationDate}
                onChange={(e) => setRegistrationDate(e.target.value)}
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

        {/* Allocations */}
        <Card className="shadow-sm">
          <CardHeader className="p-3 border-b bg-muted/30">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              Initial Allocations
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-3">
            {/* Registration Fee */}
            <div>
              <Label htmlFor="registrationFee" className="text-xs font-semibold">
                Registration Fee (KES)
              </Label>
              <Input
                id="registrationFee"
                type="number"
                value={registrationFee}
                onChange={(e) => setRegistrationFee(e.target.value)}
                placeholder="500"
                className="mt-1.5 h-9 text-sm"
              />
            </div>

            {/* Savings */}
            <div>
              <Label htmlFor="savings" className="text-xs font-semibold">
                Initial Savings (KES)
              </Label>
              <Input
                id="savings"
                type="number"
                value={savings}
                onChange={(e) => setSavings(e.target.value)}
                placeholder="1000"
                className="mt-1.5 h-9 text-sm"
              />
            </div>

            {/* Custom Items */}
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
                          <Input
                            placeholder="Item description"
                            value={item.description}
                            onChange={(e) => updateCustomItem(index, 'description', e.target.value)}
                            className="h-8 text-sm"
                          />
                          <Input
                            type="number"
                            placeholder="Amount"
                            value={item.amount || ''}
                            onChange={(e) => updateCustomItem(index, 'amount', parseFloat(e.target.value) || 0)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeCustomItem(index)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
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

            {/* Total */}
            <div className="pt-3 border-t">
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <span className="text-sm font-semibold">Total Amount</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  KES {calculateTotal().toLocaleString()}
                </span>
              </div>
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
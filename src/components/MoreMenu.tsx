import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { 
  GraduationCap,
  UserPlus,
  Users,
  History,
  TrendingUp,
  Bell,
  ArrowLeftRight,
  PiggyBank
} from "lucide-react";
import { useSchoolFees } from "@/contexts/SchoolFeesContext";

interface MoreMenuProps {
  onBack: () => void;
  onNavigate: (page: string) => void;
  onNavigateToSection?: (section: string) => void;
}

export function MoreMenu({ onBack, onNavigate, onNavigateToSection }: MoreMenuProps) {
  const { isSchoolFeesMode, setSchoolFeesMode, startTransition, endTransition } = useSchoolFees();

  const handleSchoolFeesToggle = (checked: boolean) => {
    startTransition(checked); // true = entering, false = exiting
    setTimeout(() => {
      setSchoolFeesMode(checked);
      endTransition();
      // Navigate to cash section after mode switch
      if (onNavigateToSection) {
        onNavigateToSection('cash');
      }
    }, 1500);
  };

  const allMenuItems = [
    {
      id: 'add-member',
      title: 'Add New Member',
      description: 'Register a new member to the system',
      icon: UserPlus,
      color: 'from-green-500 to-green-600',
      action: () => onNavigate('add-member'),
      showInSchoolFees: false
    },
    {
      id: 'group-summary',
      title: 'Group Summary',
      description: 'View group collection summaries',
      icon: Users,
      color: 'from-orange-500 to-orange-600',
      action: () => onNavigate('group-summary'),
      showInSchoolFees: false
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'View and manage your notifications',
      icon: Bell,
      color: 'from-purple-500 to-purple-600',
      action: () => onNavigate('notifications'),
      showInSchoolFees: true
    },
    {
      id: 'account-offset',
      title: 'Account Offset Request',
      description: 'Submit account offset requests',
      icon: ArrowLeftRight,
      color: 'from-cyan-500 to-cyan-600',
      action: () => onNavigate('account-offset'),
      showInSchoolFees: false
    },
    {
      id: 'savings-transfer',
      title: 'Savings Transfer Request',
      description: 'Request savings account transfers',
      icon: PiggyBank,
      color: 'from-pink-500 to-pink-600',
      action: () => onNavigate('savings-transfer'),
      showInSchoolFees: false
    },
    {
      id: 'history',
      title: 'Summary History',
      description: 'View past transaction summaries',
      icon: History,
      color: 'from-amber-500 to-amber-600',
      action: () => onNavigate('history'),
      showInSchoolFees: false
    },
    {
      id: 'performance',
      title: 'Performance Analysis',
      description: 'View your performance metrics',
      icon: TrendingUp,
      color: 'from-indigo-500 to-indigo-600',
      action: () => onNavigate('performance'),
      showInSchoolFees: true
    }
  ];

  // Filter menu items based on school fees mode
  const menuItems = isSchoolFeesMode 
    ? allMenuItems.filter(item => item.showInSchoolFees)
    : allMenuItems;

  return (
    <div className="min-h-screen bg-background pb-20 overflow-x-hidden">
      <div className="space-y-3 px-0.5 py-3">
        {/* Header */}
        <Card className="shadow-sm bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold tracking-tight">More Options</h2>
                <p className="text-xs text-muted-foreground">Additional features and settings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* School Fees Mode Toggle Card */}
        <Card className="shadow-sm border-l-4" style={{ borderLeftColor: `hsl(var(--primary))` }}>
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex-shrink-0">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">School Fees Mode</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Switch to specialized school fees collection</p>
              </div>
              <Switch
                checked={isSchoolFeesMode}
                onCheckedChange={handleSchoolFeesToggle}
                className="data-[state=checked]:bg-blue-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Menu Items */}
        <div className="space-y-2.5">
          {menuItems.map((item) => (
            <Card 
              key={item.id} 
              className="shadow-sm hover:shadow-md transition-all cursor-pointer border-l-4"
              style={{ borderLeftColor: `hsl(var(--primary))` }}
              onClick={item.action}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className={`flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br ${item.color} flex-shrink-0`}>
                    <item.icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate">{item.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info Card */}
        <Card className="shadow-sm bg-muted/50">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">
              More features coming soon! Stay tuned for updates.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

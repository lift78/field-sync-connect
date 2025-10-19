import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft,
  GraduationCap,
  UserPlus,
  UsersRound,
  Users,
  History,
  TrendingUp,
  Settings
} from "lucide-react";

interface MoreMenuProps {
  onBack: () => void;
  onNavigate: (page: string) => void;
}

export function MoreMenu({ onBack, onNavigate }: MoreMenuProps) {
  const [schoolFeesMode, setSchoolFeesMode] = useState(false);

  const menuItems = [
    {
      id: 'school-fees',
      title: 'School Fees Mode',
      description: 'Switch to specialized school fees collection',
      icon: GraduationCap,
      color: 'from-blue-500 to-blue-600',
      action: () => {
        setSchoolFeesMode(!schoolFeesMode);
        // TODO: Implement mode switching logic
      }
    },
    {
      id: 'add-member',
      title: 'Add New Member',
      description: 'Register a new member to the system',
      icon: UserPlus,
      color: 'from-green-500 to-green-600',
      action: () => onNavigate('add-member')
    },
    {
      id: 'add-group',
      title: 'Add New Group',
      description: 'Create a new member group',
      icon: UsersRound,
      color: 'from-purple-500 to-purple-600',
      action: () => onNavigate('add-group')
    },
    {
      id: 'group-summary',
      title: 'Group Summary',
      description: 'View group collection summaries',
      icon: Users,
      color: 'from-orange-500 to-orange-600',
      action: () => onNavigate('group-summary')
    },
    {
      id: 'history',
      title: 'Summary History',
      description: 'View past transaction summaries',
      icon: History,
      color: 'from-cyan-500 to-cyan-600',
      action: () => onNavigate('history')
    },
    {
      id: 'performance',
      title: 'Performance Analysis',
      description: 'View your performance metrics',
      icon: TrendingUp,
      color: 'from-pink-500 to-pink-600',
      action: () => onNavigate('performance')
    },
    {
      id: 'settings',
      title: 'Settings',
      description: 'Configure app preferences',
      icon: Settings,
      color: 'from-slate-500 to-slate-600',
      action: () => onNavigate('settings')
    }
  ];

  return (
    <div className="min-h-screen bg-background pb-20 overflow-x-hidden">
      <div className="space-y-3 px-0.5 py-3">
        {/* Header */}
        <Card className="shadow-sm bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
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
                <h2 className="text-base font-bold tracking-tight">More Options</h2>
                <p className="text-xs text-muted-foreground">Additional features and settings</p>
              </div>
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
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold truncate">{item.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                      </div>
                      {item.id === 'school-fees' && (
                        <Badge 
                          variant={schoolFeesMode ? "default" : "outline"}
                          className="text-xs flex-shrink-0"
                        >
                          {schoolFeesMode ? 'ON' : 'OFF'}
                        </Badge>
                      )}
                    </div>
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
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useKeyboardHandler } from "@/hooks/useKeyboardHandler";
import { dbOperations } from "@/lib/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CashCollectionForm } from "./CashCollectionForm";
import { LoanSection } from "./LoanSection";
import { AdvanceLoanForm } from "./AdvanceLoanForm";
import { SyncManager } from "./SyncManager";
import { RecordDetailView } from "./RecordDetailView";
import { QuickCollections } from "./QuickCollections";
import { GroupSummary } from "./GroupSummary";
import { AddMemberForm } from "./AddMemberForm";
import { MoreMenu } from "./MoreMenu";
import { 
  Wallet, 
  CreditCard, 
  Zap, 
  RefreshCw, 
  Menu,
  X,
  Moon,
  Sun,
  Users,
  MoreHorizontal,
  ArrowLeft
} from "lucide-react";
import { CashCollection, LoanApplication, AdvanceLoan } from "@/lib/database";

type AppSection = 'cash' | 'loan' | 'advance' | 'sync' | 'more';

interface RecordView {
  type: 'cash' | 'loan' | 'advance' | 'group';
  record: {
    id: string;
    memberId: string;
    amount?: number;
    status: 'synced' | 'pending' | 'failed';
    lastUpdated: string;
    data: any;
  };
}

interface LoginScreenProps {
  onLogin: () => void;
}

function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { theme } = useTheme();

  const handleLogin = async () => {
    setIsLoading(true);
    setError("");
    
    try {
      if (username && password) {
        await dbOperations.saveUserCredentials({ username, password });
        onLogin();
      } else {
        setError("Please enter both username and password");
      }
    } catch (err) {
      setError("Login failed. Please try again.");
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const bgClass = theme === "dark" 
    ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" 
    : "bg-gradient-to-br from-white via-gray-50 to-white";

  return (
    <div className={`min-h-screen ${bgClass} flex flex-col items-center justify-center p-4 relative overflow-hidden`}>
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-20 w-32 h-32 rounded-full bg-primary/20 animate-pulse"></div>
        <div className="absolute bottom-32 right-16 w-24 h-24 rounded-full bg-primary/15 animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-background/90 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-border">
          <div className="flex justify-center mb-6">
            <img 
              src={theme === 'dark' ? "/lovable-uploads/logo2.png" : "/lovable-uploads/logo1.png"}
              alt="LIFT Company Logo" 
              className="h-16 w-16"
            />
          </div>

          <h1 className="text-2xl font-bold text-center mb-2">Field Officer Login</h1>
          <p className="text-muted-foreground text-center mb-8">
            Access your workspace securely
          </p>

          <form className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="mt-1"
              />
            </div>

            {error && (
              <div className="text-destructive text-sm text-center">
                {error}
              </div>
            )}

            <Button
              onClick={handleLogin}
              type="submit"
              className="w-full mt-4"
              disabled={isLoading}
            >
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>

          <div className="flex flex-wrap justify-center gap-2 mt-8">
            <Badge variant="outline" className="bg-background">
              🔒 Secure Login
            </Badge>
            <Badge variant="outline" className="bg-background">
              📱 Mobile Ready
            </Badge>
          </div>
        </div>

        <div className="mt-8 text-center text-muted-foreground text-sm">
          <p>Powered by LIFT Financial Solutions</p>
        </div>
      </div>
    </div>
  );
}

export function FieldOfficerApp() {
  const [activeSection, setActiveSection] = useState<AppSection>('cash');
  const [menuOpen, setMenuOpen] = useState(false);
  const [recordView, setRecordView] = useState<RecordView | null>(null);
  const [showLogin, setShowLogin] = useState(true);
  const [showQuickCollections, setShowQuickCollections] = useState(false);
  const [quickDrawerOpen, setQuickDrawerOpen] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [morePage, setMorePage] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  
  useKeyboardHandler();

  const sections = [
    { id: 'cash' as const, title: 'Cash', icon: Wallet, color: 'bg-emerald-500' },
    { id: 'loan' as const, title: 'Loans', icon: CreditCard, color: 'bg-blue-500' },
    { id: 'advance' as const, title: 'Advance', icon: Zap, color: 'bg-amber-500' },
    { id: 'sync' as const, title: 'Sync', icon: RefreshCw, color: 'bg-purple-500' },
    { id: 'more' as const, title: 'More', icon: MoreHorizontal, color: 'bg-slate-500' },
  ];

  const activeTitle = sections.find(s => s.id === activeSection)?.title || 'Field Officer';

  const transformRecordForDetailView = (type: 'cash' | 'loan' | 'advance' | 'group', dbRecord: any) => {
    let amount: number | undefined;
    let timestamp: Date;

    switch (type) {
      case 'cash':
        const cashRecord = dbRecord as CashCollection;
        amount = cashRecord.totalAmount; 
        timestamp = cashRecord.timestamp;
        break;
      case 'loan':
        const loanRecord = dbRecord as LoanApplication;
        amount = loanRecord.loanAmount;
        timestamp = loanRecord.timestamp;
        break;
      case 'advance':
        const advanceRecord = dbRecord as AdvanceLoan;
        amount = advanceRecord.amount;
        timestamp = advanceRecord.timestamp;
        break;
      case 'group':
        amount = dbRecord.finesCollected || 0;
        timestamp = dbRecord.timestamp;
        break;
      default:
        amount = undefined;
        timestamp = new Date();
    }

    return {
      id: dbRecord.id?.toString() || '',
      memberId: dbRecord.memberId || dbRecord.groupId,
      amount,
      status: dbRecord.synced ? 'synced' as const : 'pending' as const,
      lastUpdated: timestamp.toISOString(),
      data: dbRecord
    };
  };

  const handleEditRecord = (recordData: any, type: 'cash' | 'loan' | 'advance' | 'group') => {
    const transformedRecord = transformRecordForDetailView(type, recordData);
    setRecordView({ type, record: transformedRecord });
  };

  const handleBackFromRecord = () => {
    setRecordView(null);
  };

  const handleMoreNavigate = (page: string) => {
    setMorePage(page);
    setShowMoreMenu(false);
    setActiveSection('more');
  };

  const handleBackFromMorePage = () => {
    setMorePage(null);
    setShowMoreMenu(true);
  };

  const renderActiveSection = () => {
    // If showing quick collections
    if (showQuickCollections) {
      return <QuickCollections onBack={() => setShowQuickCollections(false)} />;
    }

    // If viewing a record
    if (recordView) {
      return (
        <RecordDetailView
          record={recordView.record}
          type={recordView.type}
          onBack={handleBackFromRecord}
        />
      );
    }

    // If in More menu
    if (showMoreMenu) {
      return <MoreMenu onBack={() => setShowMoreMenu(false)} onNavigate={handleMoreNavigate} />;
    }

    // If viewing a More page
    if (morePage) {
      switch (morePage) {
        case 'group-summary':
          return <GroupSummary onBack={handleBackFromMorePage} onEditRecord={handleEditRecord} />;
        case 'add-member':
          return <AddMemberForm onBack={handleBackFromMorePage} />;
        case 'add-group':
          return (
            <div className="space-y-3 px-4 py-3 max-w-2xl mx-auto">
              <Card>
                <CardHeader className="p-3">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={handleBackFromMorePage} className="h-9 w-9 rounded-full border-2">
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <CardTitle className="text-sm">Add New Group</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  <p className="text-sm text-muted-foreground">Group creation form coming soon...</p>
                </CardContent>
              </Card>
            </div>
          );
        default:
          return (
            <div className="space-y-3 px-4 py-3 max-w-2xl mx-auto">
              <Card>
                <CardHeader className="p-3">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={handleBackFromMorePage} className="h-9 w-9 rounded-full border-2">
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <CardTitle className="text-sm">{morePage}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  <p className="text-sm text-muted-foreground">Feature coming soon...</p>
                </CardContent>
              </Card>
            </div>
          );
      }
    }

    // Normal sections
    switch (activeSection) {
      case 'cash':
        return <CashCollectionForm />;
      case 'loan':
        return <LoanSection />;
      case 'advance':
        return <AdvanceLoanForm />;
      case 'sync':
        return <SyncManager onEditRecord={handleEditRecord} />;
      case 'more':
        return <MoreMenu onBack={() => setActiveSection('cash')} onNavigate={handleMoreNavigate} />;
      default:
        return <CashCollectionForm />;
    }
  };

  if (showLogin) {
    return <LoginScreen onLogin={() => setShowLogin(false)} />;
  }

  if (showQuickCollections) {
    return <QuickCollections onBack={() => setShowQuickCollections(false)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="bg-background text-foreground p-3 sticky top-0 z-50 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <img 
              src={theme === 'dark' ? "/lovable-uploads/logo2.png" : "/lovable-uploads/logo1.png"}
              alt="Company Logo" 
              className="h-6 w-6 flex-shrink-0"
            />
            <Badge variant="outline" className="text-xs flex-shrink-0">
              Offline
            </Badge>
            <p className="text-xs opacity-90 truncate hidden sm:block">{activeTitle}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setQuickDrawerOpen(true)}
              className="hover:bg-accent h-9 w-9"
              title="Quick Collections"
            >
              <Users className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="hover:bg-accent h-9 w-9"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Quick Collections Drawer */}
      {quickDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-background">
          <QuickCollections onBack={() => setQuickDrawerOpen(false)} />
        </div>
      )}

      {/* Main Content */}
      <main className="pb-20 px-4">
        {renderActiveSection()}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40">
        <div className="grid grid-cols-5 gap-0">
          {sections.map((section) => {
            const isActive = activeSection === section.id;
            return (
              <Button
                key={section.id}
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (section.id === 'more') {
                    setShowMoreMenu(true);
                    setActiveSection('more');
                  } else {
                    setActiveSection(section.id);
                    setShowQuickCollections(false);
                    setShowMoreMenu(false);
                    setMorePage(null);
                  }
                }}
                className={`flex-col h-16 p-1.5 rounded-none ${
                  isActive 
                    ? 'text-primary bg-primary/10 border-t-2 border-t-primary' 
                    : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
                }`}
              >
                <section.icon className="h-5 w-5 mb-1" />
                <span className="text-[10px] font-medium">{section.title}</span>
              </Button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
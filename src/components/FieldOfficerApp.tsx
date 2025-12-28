import { useState, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { App as CapacitorApp } from '@capacitor/app';
import { useKeyboardHandler } from "@/hooks/useKeyboardHandler";
import { useNavigation } from "@/hooks/useNavigation";
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
import { SchoolFeesProvider, useSchoolFees } from "@/contexts/SchoolFeesContext";
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
  ArrowLeft,
  GraduationCap,
  LogOut
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
  readOnly?: boolean;
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

          <div className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
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
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
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
              className="w-full mt-4"
              disabled={isLoading}
            >
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mt-8">
            <Badge variant="outline" className="bg-background">
            🔒 Secure Login
            </Badge>
            <Badge variant="outline" className="bg-background">
            📱 Mobile Ready
            </Badge>
          </div>
        </div>

        <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 border border-amber-500/30">
          <div className="h-2 w-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 animate-pulse"></div>
          <p className="text-sm font-medium bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 bg-clip-text text-transparent">
            Powered by Spekta
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}

// Transition Screen Component
function TransitionScreen({ direction }: { direction: 'entering' | 'exiting' }) {
  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-blue-600 via-blue-700 to-purple-800 flex flex-col items-center justify-center">
      <div className="animate-pulse">
        <GraduationCap className="h-20 w-20 text-white mb-6" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">
        {direction === 'entering' ? 'Entering School Fees Mode...' : 'Exiting School Fees Mode...'}
      </h2>
      <div className="flex gap-1 mt-4">
        <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  );
}

// Full Screen Menu Component
function FullScreenMenu({ 
  onClose, 
  onNavigate,
  activeSection,
  isSchoolFeesMode
}: { 
  onClose: () => void; 
  onNavigate: (section: AppSection) => void;
  activeSection: AppSection;
  isSchoolFeesMode: boolean;
}) {
  const { theme } = useTheme();
  
  const allMenuItems = [
    { id: 'cash' as const, title: 'Cash Collections', icon: Wallet, color: 'bg-emerald-500', description: 'Record member payments', showInSchoolFees: true },
    { id: 'loan' as const, title: 'Loan Applications', icon: CreditCard, color: 'bg-blue-500', description: 'Process loan requests', showInSchoolFees: false },
    { id: 'advance' as const, title: 'Advance Loans', icon: Zap, color: 'bg-amber-500', description: 'Quick loan advances', showInSchoolFees: true },
    { id: 'sync' as const, title: 'Sync Data', icon: RefreshCw, color: 'bg-purple-500', description: 'Synchronize records', showInSchoolFees: true },
    { id: 'more' as const, title: 'More Options', icon: MoreHorizontal, color: 'bg-slate-500', description: 'Additional features', showInSchoolFees: true },
  ];

  // Filter menu items in school fees mode (no loans)
  const menuItems = isSchoolFeesMode 
    ? allMenuItems.filter(item => item.showInSchoolFees)
    : allMenuItems;

  const bgClass = theme === "dark" 
    ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" 
    : "bg-gradient-to-br from-blue-50 via-white to-purple-50";

  return (
    <div className={`fixed inset-0 z-[60] ${bgClass} animate-in fade-in duration-300`}>
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-10 w-40 h-40 rounded-full bg-primary/30 blur-3xl animate-pulse"></div>
        <div className="absolute bottom-32 right-16 w-32 h-32 rounded-full bg-primary/20 blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-primary/10 blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 flex items-center justify-between p-4 border-b border-border/50 backdrop-blur-sm bg-background/30">
        <div className="flex items-center gap-3">
          <img 
            src={theme === 'dark' ? "/lovable-uploads/logo2.png" : "/lovable-uploads/logo1.png"}
            alt="Company Logo" 
            className="h-8 w-8"
          />
          <div>
            <h2 className="text-lg font-bold">
              {isSchoolFeesMode ? 'School Fees Menu' : 'Navigation Menu'}
            </h2>
            <p className="text-xs text-muted-foreground">Select an option below</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-6 overflow-y-auto">
        <div className="w-full max-w-md space-y-3 animate-in slide-in-from-bottom duration-500">
          {menuItems.map((item, index) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                className={`w-full group relative overflow-hidden rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl ${
                  isActive ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
                }`}
                style={{
                  animationDelay: `${index * 100}ms`,
                  animation: 'slideInFromBottom 0.5s ease-out forwards'
                }}
              >
                <div className={`absolute inset-0 ${item.color} opacity-10 group-hover:opacity-20 transition-opacity`}></div>
                <div className="relative bg-card/80 backdrop-blur-sm border border-border p-5 flex items-center gap-4">
                  <div className={`${item.color} p-3 rounded-xl shadow-lg group-hover:scale-110 transition-transform`}>
                    <item.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-base mb-0.5">{item.title}</h3>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  {isActive && (
                    <Badge className="bg-primary text-primary-foreground text-xs">Active</Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            {isSchoolFeesMode ? 'School Fees Mode Active' : 'LIFT Financial Solutions © 2025'}
          </p>
        </div>
      </div>

       <style>{`
        @keyframes slideInFromBottom {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function FieldOfficerAppContent() {
  const { isSchoolFeesMode, setSchoolFeesMode, isTransitioning, transitionDirection, startTransition, endTransition } = useSchoolFees();
  // All navigation state
  const [activeSection, setActiveSection] = useState<AppSection>('cash');
  const [fullScreenMenuOpen, setFullScreenMenuOpen] = useState(false);
  const [quickDrawerOpen, setQuickDrawerOpen] = useState(false);
  const [showQuickCollections, setShowQuickCollections] = useState(false);
  const [recordView, setRecordView] = useState<RecordView | null>(null);
  const [syncViewingRecords, setSyncViewingRecords] = useState<'cash' | 'loan' | 'advance' | 'disbursement' | 'group' | 'newmember' | null>(null);
  const [morePage, setMorePage] = useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLogin, setShowLogin] = useState(true);
  const [showGroupSummary, setShowGroupSummary] = useState(false);
  const [showGroupMemberRecords, setShowGroupMemberRecords] = useState<string | null>(null);
  const [groupSummaryDialog, setGroupSummaryDialog] = useState<'fines' | 'cashFromOffice' | null>(null);
  const [groupSummarySource, setGroupSummarySource] = useState<'cash' | 'more'>('cash');
  
  const { theme, setTheme } = useTheme();
  useKeyboardHandler();

  // Create unified navigation control
  const navigationControl = useNavigation(
    {
      activeSection,
      fullScreenMenuOpen,
      quickDrawerOpen,
      showQuickCollections,
      recordView,
      syncViewingRecords,
      morePage,
      showMoreMenu,
      showLogin,
      showGroupSummary,
      showGroupMemberRecords,
      groupSummaryDialog
    },
    {
      setActiveSection,
      setFullScreenMenuOpen,
      setQuickDrawerOpen,
      setShowQuickCollections,
      setRecordView,
      setSyncViewingRecords,
      setMorePage,
      setShowMoreMenu,
      setShowGroupSummary,
      setShowGroupMemberRecords,
      setGroupSummaryDialog
    }
  );

  // Hardware back button handler - uses unified navigation
  useEffect(() => {
    let backButtonListener: any;

    const setupBackButton = async () => {
      try {
        backButtonListener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
          console.log('Hardware back button pressed');
          
          // Special case: At root (cash section), show exit confirmation
          if (activeSection === 'cash' && 
              !fullScreenMenuOpen && 
              !quickDrawerOpen && 
              !showQuickCollections && 
              !recordView && 
              !syncViewingRecords && 
              !morePage && 
              !showMoreMenu && 
              !showLogin) {
            if (confirm('Exit the app?')) {
              CapacitorApp.exitApp();
            }
            return;
          }
          
          // Use unified navigation for all other cases
          navigationControl.handleBack();
        });

        console.log('Hardware back button handler registered');
      } catch (error) {
        console.log('Back button setup error (might be running in browser):', error);
      }
    };

    setupBackButton();

    return () => {
      if (backButtonListener) {
        backButtonListener.remove();
      }
    };
  }, [navigationControl, activeSection, fullScreenMenuOpen, quickDrawerOpen, showQuickCollections, recordView, syncViewingRecords, morePage, showMoreMenu, showLogin]);

  const allSections = [
    { id: 'cash' as const, title: 'Cash', icon: Wallet, color: 'bg-emerald-500' },
    { id: 'loan' as const, title: 'Loans', icon: CreditCard, color: 'bg-blue-500' },
    { id: 'advance' as const, title: 'Advance', icon: Zap, color: 'bg-amber-500' },
    { id: 'sync' as const, title: 'Sync', icon: RefreshCw, color: 'bg-purple-500' },
    { id: 'more' as const, title: 'More', icon: MoreHorizontal, color: 'bg-slate-500' },
  ];

  // Filter sections in school fees mode (no loans, keep more)
  const sections = isSchoolFeesMode 
    ? allSections.filter(s => s.id !== 'loan')
    : allSections;

  const activeTitle = sections.find(s => s.id === activeSection)?.title || 'Field Officer';
  const shouldShowNavbar = !showQuickCollections && !recordView && !morePage && !syncViewingRecords;

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

  const handleMenuNavigate = (section: AppSection) => {
    if (section === 'more') {
      setShowMoreMenu(true);
      setActiveSection('more');
    } else {
      setActiveSection(section);
      setShowQuickCollections(false);
      setShowMoreMenu(false);
      setMorePage(null);
    }
  };

  const handleMoreNavigate = (page: string) => {
    if (page === 'group-summary') {
      setGroupSummarySource('more');
      setShowGroupSummary(true);
      setShowMoreMenu(false);
    } else {
      setMorePage(page);
      setShowMoreMenu(false);
      setActiveSection('more');
    }
  };

  const renderActiveSection = () => {
    if (showQuickCollections) {
      return <QuickCollections onBack={navigationControl.handleBack} />;
    }

    if (recordView) {
      return (
        <RecordDetailView
          record={recordView.record}
          type={recordView.type}
          onBack={navigationControl.handleBack}
          onSaved={navigationControl.handleBack}
          readOnly={recordView.readOnly}
        />
      );
    }

    if (showGroupSummary) {
      return <GroupSummary onBack={navigationControl.handleBack} onEditRecord={handleEditRecord} />;
    }

    if (showMoreMenu) {
      return <MoreMenu onBack={navigationControl.handleBack} onNavigate={handleMoreNavigate} onNavigateToSection={(section) => setActiveSection(section as AppSection)} />;
    }

    if (morePage) {
      switch (morePage) {
        case 'add-member':
          return <AddMemberForm onBack={navigationControl.handleBack} />;
        case 'add-group':
          return (
            <div className="space-y-3 px-4 py-3 max-w-2xl mx-auto">
              <Card>
                <CardHeader className="p-3">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={navigationControl.handleBack} className="h-9 w-9 rounded-full border-2">
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
                    <Button variant="ghost" size="icon" onClick={navigationControl.handleBack} className="h-9 w-9 rounded-full border-2">
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

    switch (activeSection) {
      case 'cash':
        return (
          <CashCollectionForm 
            onShowGroupSummary={() => {
              setGroupSummarySource('cash');
              setShowGroupSummary(true);
            }}
          />
        );
      case 'loan':
        return <LoanSection />;
      case 'advance':
        return <AdvanceLoanForm />;
      case 'sync':
        return <SyncManager onEditRecord={handleEditRecord} viewingRecords={syncViewingRecords} onViewingRecordsChange={setSyncViewingRecords} />;
      case 'more':
        return <MoreMenu onBack={navigationControl.handleBack} onNavigate={handleMoreNavigate} onNavigateToSection={(section) => setActiveSection(section as AppSection)} />;
      default:
        return (
          <CashCollectionForm 
            onShowGroupSummary={() => {
              setGroupSummarySource('cash');
              setShowGroupSummary(true);
            }}
          />
        );
    }
  };

  if (showLogin) {
    return <LoginScreen onLogin={() => setShowLogin(false)} />;
  }

  if (isTransitioning && transitionDirection) {
    return <TransitionScreen direction={transitionDirection} />;
  }

  if (showQuickCollections) {
    return <QuickCollections onBack={navigationControl.handleBack} />;
  }

  return (
    <div className="min-h-screen bg-background safe-area-inset">
      {fullScreenMenuOpen && (
        <FullScreenMenu 
          onClose={navigationControl.handleBack}
          onNavigate={handleMenuNavigate}
          activeSection={activeSection}
          isSchoolFeesMode={isSchoolFeesMode}
        />
      )}
      
      <style>{`
        .safe-area-inset {
          padding-top: env(safe-area-inset-top);
          padding-bottom: env(safe-area-inset-bottom);
          min-height: 100vh;
          min-height: -webkit-fill-available;
        }
      `}</style>

      <header className="bg-background/95 backdrop-blur-md text-foreground px-4 py-3 sticky top-0 z-50 border-b border-border/50 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <img 
              src={theme === 'dark' ? "/lovable-uploads/logo2.png" : "/lovable-uploads/logo1.png"}
              alt="Company Logo" 
              className="h-8 w-8 flex-shrink-0"
            />
            {isSchoolFeesMode ? (
              <Badge variant="default" className="text-[10px] px-2 py-0.5 h-5 bg-blue-500">
                <GraduationCap className="h-3 w-3 mr-1" />
                School Fees
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 h-5">
                Offline
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isSchoolFeesMode && (
              <button
                onClick={() => {
                  startTransition(false); // exiting
                  setTimeout(() => {
                    setSchoolFeesMode(false);
                    endTransition();
                    setActiveSection('cash');
                  }, 1500);
                }}
                className="p-2 transition-all duration-200 hover:scale-110 active:scale-95 group"
                title="Exit School Fees Mode"
              >
                <LogOut className="h-5 w-5 transition-colors duration-200 text-blue-500 group-hover:text-red-500" />
              </button>
            )}
            <button
              onClick={() => setQuickDrawerOpen(true)}
              className="p-2 transition-all duration-200 hover:scale-110 active:scale-95 group"
              title="Quick Collections"
            >
              <Users className="h-5 w-5 transition-colors duration-200 group-hover:text-blue-500" />
            </button>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 transition-all duration-200 hover:scale-110 active:scale-95 group"
            >
              {theme === 'dark' ? 
                <Sun className="h-5 w-5 transition-colors duration-200 group-hover:text-blue-500" /> : 
                <Moon className="h-5 w-5 transition-colors duration-200 group-hover:text-blue-500" />
              }
            </button>
            <button
              onClick={() => setFullScreenMenuOpen(true)}
              className="p-2 transition-all duration-200 hover:scale-110 active:scale-95 group"
              title="Menu"
            >
              <Menu className="h-5 w-5 transition-colors duration-200 group-hover:text-blue-500" /> 
            </button>
          </div>
        </div>
      </header>

      {quickDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-background">
          <QuickCollections onBack={navigationControl.handleBack} />
        </div>
      )}

      <main className={`px-1.5 pt-2 ${shouldShowNavbar ? 'pb-20' : 'pb-4'}`}>
        {renderActiveSection()}
      </main>

      {shouldShowNavbar && (
        <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/50 z-40 pb-[env(safe-area-inset-bottom)]">
          <div className={`grid gap-0 ${isSchoolFeesMode ? 'grid-cols-4' : 'grid-cols-5'}`}>
          
            {sections.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => handleMenuNavigate(section.id)}
                  className={`flex flex-col items-center justify-center h-16 py-2 px-1 transition-all duration-200 relative group ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-primary rounded-full" />
                  )}
                  <section.icon className={`h-6 w-6 mb-1 transition-all duration-200 ${
                    isActive ? 'scale-110' : 'group-hover:scale-105 group-hover:text-primary'
                  }`} />
                  <span className={`text-[11px] font-medium transition-all duration-200 ${
                    isActive ? '' : 'group-hover:text-primary'
                  }`}>
                    {section.title}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

export function FieldOfficerApp() {
  return (
    <SchoolFeesProvider>
      <FieldOfficerAppContent />
    </SchoolFeesProvider>
  );
}
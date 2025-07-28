import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CashCollectionForm } from "./CashCollectionForm";
import { LoanSection } from "./LoanSection";
import { AdvanceLoanForm } from "./AdvanceLoanForm";
import { SyncManager } from "./SyncManager";
import { RecordDetailView } from "./RecordDetailView";
import { LoginScreen } from "./LoginScreen";
import { useTheme } from "next-themes";
import { 
  Wallet, 
  CreditCard, 
  Zap, 
  RefreshCw, 
  Menu,
  X,
  Moon,
  Sun
} from "lucide-react";
import { CashCollection, LoanApplication, AdvanceLoan } from "@/lib/database";

type AppSection = 'cash' | 'loan' | 'advance' | 'sync';

interface RecordView {
  type: 'cash' | 'loan' | 'advance';
  record: {
    id: string;
    memberId: string;
    amount?: number;
    status: 'synced' | 'pending' | 'failed';
    lastUpdated: string;
    data: any;
  };
}

export function FieldOfficerApp() {
  const [activeSection, setActiveSection] = useState<AppSection>('cash');
  const [menuOpen, setMenuOpen] = useState(false);
  const [recordView, setRecordView] = useState<RecordView | null>(null);
  const [showLogin, setShowLogin] = useState(true);
  const { theme, setTheme } = useTheme();

  const sections = [
    { id: 'cash' as const, title: 'Cash Collection', icon: Wallet, color: 'bg-gradient-primary' },
    { id: 'loan' as const, title: 'Loan Management', icon: CreditCard, color: 'bg-gradient-success' },
    { id: 'advance' as const, title: 'Advance Loan', icon: Zap, color: 'bg-gradient-accent' },
    { id: 'sync' as const, title: 'Sync Data', icon: RefreshCw, color: 'bg-secondary' },
  ];

  const activeTitle = sections.find(s => s.id === activeSection)?.title || 'Field Officer';

  // Transform database record to the format expected by RecordDetailView
  const transformRecordForDetailView = (type: 'cash' | 'loan' | 'advance', dbRecord: CashCollection | LoanApplication | AdvanceLoan) => {
    let amount: number | undefined;
    let timestamp: Date;

    // Extract the appropriate amount and timestamp based on record type
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
      default:
        amount = undefined;
        timestamp = new Date();
    }

    return {
      id: dbRecord.id?.toString() || '',
      memberId: dbRecord.memberId,
      amount,
      status: dbRecord.synced ? 'synced' as const : 'pending' as const,
      lastUpdated: timestamp.toISOString(),
      data: dbRecord // This is the key fix - pass the full record as data
    };
  };

  const handleEditRecord = (type: 'cash' | 'loan' | 'advance', recordData: any) => {
    // Transform the record data to the expected format
    const transformedRecord = transformRecordForDetailView(type, recordData);
    
    // Open record detail view
    setRecordView({ type, record: transformedRecord });
  };

  const handleBackFromRecord = () => {
    setRecordView(null);
  };

  const renderActiveSection = () => {
    // If viewing a record, show the record detail view
    if (recordView) {
      return (
        <RecordDetailView
          record={recordView.record}
          type={recordView.type}
          onBack={handleBackFromRecord}
        />
      );
    }

    // Otherwise show the normal sections
    switch (activeSection) {
      case 'cash':
        return <CashCollectionForm />;
      case 'loan':
        return <LoanSection />;
      case 'advance':
        return <AdvanceLoanForm />;
      case 'sync':
        return <SyncManager onEditRecord={handleEditRecord} />;
      default:
        return <CashCollectionForm />;
    }
  };

  // Show splash screen first
  if (showLogin) {
    return <LoginScreen onLogin={() => setShowLogin(false)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="bg-background text-foreground p-3 sticky top-0 z-50 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <img 
                src="/lovable-uploads/logo1.png" 
                alt="Company Logo" 
                className="h-6 w-6 dark:invert dark:brightness-0 dark:contrast-200"
              />
              <Badge variant="outline" className="text-xs">
                Offline Mode
              </Badge>
            </div>
            <p className="text-sm opacity-90 hidden sm:block">{activeTitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="hover:bg-accent"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMenuOpen(!menuOpen)}
              className="hover:bg-accent"
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-sm">
          <div className="p-6 pt-20">
            <div className="grid gap-4">
              {sections.map((section) => (
                <Button
                  key={section.id}
                  variant={activeSection === section.id ? "default" : "outline"}
                  size="xl"
                  onClick={() => {
                    setActiveSection(section.id);
                    setMenuOpen(false);
                  }}
                  className={`justify-start ${
                    activeSection === section.id ? section.color : ''
                  }`}
                >
                  <section.icon className="mr-3 h-5 w-5" />
                  {section.title}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="p-4 pb-20">
        {renderActiveSection()}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-2 z-40">
        <div className="grid grid-cols-4 gap-1">
          {sections.map((section) => {
            const isActive = activeSection === section.id;
            return (
              <Button
                key={section.id}
                variant="ghost"
                size="sm"
                onClick={() => setActiveSection(section.id)}
                className={`flex-col h-16 p-2 ${
                  isActive 
                    ? 'text-primary bg-primary/10' 
                    : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
                }`}
              >
                <section.icon className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">{section.title.split(' ')[0]}</span>
              </Button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
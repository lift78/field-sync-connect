import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
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
      // In a real app, this would be an API call
      // For demo, just validate locally
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
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-20 w-32 h-32 rounded-full bg-primary/20 animate-pulse"></div>
        <div className="absolute bottom-32 right-16 w-24 h-24 rounded-full bg-primary/15 animate-pulse delay-1000"></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-background/90 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-border">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img 
              src={theme === 'dark' ? "/lovable-uploads/logo2.png" : "/lovable-uploads/logo1.png"}
              alt="LIFT Company Logo" 
              className="h-16 w-16"
            />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-center mb-2">Field Officer Login</h1>
          <p className="text-muted-foreground text-center mb-8">
            Access your workspace securely
          </p>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
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
                type="password"
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
              className="w-full mt-4"
              disabled={isLoading}
            >
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            <Badge variant="outline" className="bg-background">
              🔒 Secure Login
            </Badge>
            <Badge variant="outline" className="bg-background">
              📱 Mobile Ready
            </Badge>
          </div>
        </div>

        {/* Bottom branding */}
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
                src={theme === 'dark' ? "/lovable-uploads/logo2.png" : "/lovable-uploads/logo1.png"}
                alt="Company Logo" 
                className="h-6 w-6"
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
      <main className="p-4 pb-20 mobile-content">
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
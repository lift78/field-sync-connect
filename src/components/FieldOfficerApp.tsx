import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CashCollectionForm } from "./CashCollectionForm";
import { LoanApplicationForm } from "./LoanApplicationForm";
import { AdvanceLoanForm } from "./AdvanceLoanForm";
import { SyncManager } from "./SyncManager";
import { 
  Wallet, 
  CreditCard, 
  Zap, 
  RefreshCw, 
  Menu,
  X 
} from "lucide-react";

type AppSection = 'cash' | 'loan' | 'advance' | 'sync';

export function FieldOfficerApp() {
  const [activeSection, setActiveSection] = useState<AppSection>('cash');
  const [menuOpen, setMenuOpen] = useState(false);

  const sections = [
    { id: 'cash' as const, title: 'Cash Collection', icon: Wallet, color: 'bg-gradient-primary' },
    { id: 'loan' as const, title: 'Loan Application', icon: CreditCard, color: 'bg-gradient-success' },
    { id: 'advance' as const, title: 'Advance Loan', icon: Zap, color: 'bg-accent' },
    { id: 'sync' as const, title: 'Sync Data', icon: RefreshCw, color: 'bg-warning' },
  ];

  const activeTitle = sections.find(s => s.id === activeSection)?.title || 'Field Officer';

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'cash':
        return <CashCollectionForm />;
      case 'loan':
        return <LoanApplicationForm />;
      case 'advance':
        return <AdvanceLoanForm />;
      case 'sync':
        return <SyncManager />;
      default:
        return <CashCollectionForm />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="bg-gradient-primary text-primary-foreground p-4 sticky top-0 z-50 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Field Officer</h1>
            <p className="text-sm opacity-90">{activeTitle}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
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
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <section.icon className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">{section.title.split(' ')[0]}</span>
              </Button>
            );
          })}
        </div>
      </nav>

      {/* Offline Indicator */}
      <div className="fixed top-20 right-4 z-30">
        <Badge variant="outline" className="bg-warning text-warning-foreground">
          Offline Mode
        </Badge>
      </div>
    </div>
  );
}
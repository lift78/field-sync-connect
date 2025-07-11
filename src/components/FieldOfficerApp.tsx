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
    { id: 'advance' as const, title: 'Advance Loan', icon: Zap, color: 'bg-gradient-accent' },
    { id: 'sync' as const, title: 'Sync Data', icon: RefreshCw, color: 'bg-secondary' },
  ];

  const activeTitle = sections.find(s => s.id === activeSection)?.title || 'Field Officer';

  const handleEditRecord = (type: 'cash' | 'loan' | 'advance', recordData: any) => {
    // Switch to the appropriate form section with the record data
    setActiveSection(type);
    // In a real app, you'd pass the recordData to pre-populate the form
    console.log('Editing record:', type, recordData);
  };

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'cash':
        return <CashCollectionForm />;
      case 'loan':
        return <LoanApplicationForm />;
      case 'advance':
        return <AdvanceLoanForm />;
      case 'sync':
        return <SyncManager onEditRecord={handleEditRecord} />;
      default:
        return <CashCollectionForm />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="bg-primary text-white p-4 sticky top-0 z-50 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">LIFT</h1>
              <Badge variant="outline" className="bg-white/20 text-white border-white/30 text-xs">
                Offline Mode
              </Badge>
            </div>
            <p className="text-sm opacity-90 hidden sm:block">{activeTitle}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-white hover:bg-white/20"
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
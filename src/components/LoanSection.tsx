import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, Banknote } from "lucide-react";
import { LoanApplicationForm } from "./LoanApplicationForm";
import { LoanDisbursementForm } from "./LoanDisbursementForm";

type LoanSubSection = 'application' | 'disbursement';

export function LoanSection() {
  const [activeSubSection, setActiveSubSection] = useState<LoanSubSection>('application');

  const subSections = [
    { id: 'application' as const, title: 'Application', icon: CreditCard },
    { id: 'disbursement' as const, title: 'Disbursement', icon: Banknote },
  ];

  const renderActiveSubSection = () => {
    switch (activeSubSection) {
      case 'application':
        return <LoanApplicationForm />;
      case 'disbursement':
        return <LoanDisbursementForm />;
      default:
        return <LoanApplicationForm />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Compact Sub-navigation */}
      <div className="grid grid-cols-2 gap-2">
        {subSections.map((section) => {
          const isActive = activeSubSection === section.id;
          return (
            <Button
              key={section.id}
              variant={isActive ? "default" : "outline"}
              onClick={() => setActiveSubSection(section.id)}
              className="flex items-center gap-2 py-3"
            >
              <section.icon className="h-4 w-4" />
              <span className="text-sm font-medium">{section.title}</span>
            </Button>
          );
        })}
      </div>

      {/* Active sub-section content */}
      {renderActiveSubSection()}
    </div>
  );
}
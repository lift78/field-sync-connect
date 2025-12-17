import { createContext, useContext, useState, ReactNode } from 'react';

interface SchoolFeesContextType {
  isSchoolFeesMode: boolean;
  setSchoolFeesMode: (mode: boolean) => void;
  isTransitioning: boolean;
  transitionDirection: 'entering' | 'exiting' | null;
  startTransition: (entering: boolean) => void;
  endTransition: () => void;
}

const SchoolFeesContext = createContext<SchoolFeesContextType | undefined>(undefined);

export function SchoolFeesProvider({ children }: { children: ReactNode }) {
  const [isSchoolFeesMode, setSchoolFeesMode] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<'entering' | 'exiting' | null>(null);

  const startTransition = (entering: boolean) => {
    setTransitionDirection(entering ? 'entering' : 'exiting');
    setIsTransitioning(true);
  };

  const endTransition = () => {
    setIsTransitioning(false);
    setTransitionDirection(null);
  };

  return (
    <SchoolFeesContext.Provider value={{ 
      isSchoolFeesMode, 
      setSchoolFeesMode, 
      isTransitioning,
      transitionDirection,
      startTransition,
      endTransition
    }}>
      {children}
    </SchoolFeesContext.Provider>
  );
}

export function useSchoolFees() {
  const context = useContext(SchoolFeesContext);
  if (context === undefined) {
    throw new Error('useSchoolFees must be used within a SchoolFeesProvider');
  }
  return context;
}

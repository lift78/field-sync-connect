import { createContext, useContext, useState, ReactNode } from 'react';

interface SchoolFeesContextType {
  isSchoolFeesMode: boolean;
  setSchoolFeesMode: (mode: boolean) => void;
  isTransitioning: boolean;
  setIsTransitioning: (transitioning: boolean) => void;
  isEnteringSchoolFees: boolean;
}

const SchoolFeesContext = createContext<SchoolFeesContextType | undefined>(undefined);

export function SchoolFeesProvider({ children }: { children: ReactNode }) {
  const [isSchoolFeesMode, setSchoolFeesModeState] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isEnteringSchoolFees, setIsEnteringSchoolFees] = useState(false);

  const setSchoolFeesMode = (mode: boolean) => {
    setIsEnteringSchoolFees(mode);
    setSchoolFeesModeState(mode);
  };

  return (
    <SchoolFeesContext.Provider value={{ 
      isSchoolFeesMode, 
      setSchoolFeesMode, 
      isTransitioning, 
      setIsTransitioning,
      isEnteringSchoolFees
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

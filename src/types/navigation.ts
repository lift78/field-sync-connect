/**
 * Navigation Type Definitions
 * Central type definitions for navigation system
 */

// Record view types
export interface RecordView {
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
  
  // Sync viewing record types
  export type SyncViewingRecordType = 'cash' | 'loan' | 'advance' | 'disbursement' | 'group' | 'newmember' | null;
  
  // Active section types
  export type AppSection = 'cash' | 'loan' | 'advance' | 'sync' | 'more';
  
  export interface NavigationState {
    activeSection: AppSection;
    fullScreenMenuOpen: boolean;
    quickDrawerOpen: boolean;
    showQuickCollections: boolean;
    recordView: RecordView | null;
    syncViewingRecords: SyncViewingRecordType;
    morePage: string | null;
    showMoreMenu: boolean;
    showLogin: boolean;
    showGroupSummary: boolean;
    showGroupMemberRecords: string | null;
    groupSummaryDialog: 'fines' | 'cashFromOffice' | null;  // ADD THIS
  }
  
  export interface NavigationActions {
    setActiveSection: (section: AppSection) => void;
    setFullScreenMenuOpen: (open: boolean) => void;
    setQuickDrawerOpen: (open: boolean) => void;
    setShowQuickCollections: (show: boolean) => void;
    setRecordView: (view: RecordView | null) => void;
    setSyncViewingRecords: (type: SyncViewingRecordType) => void;
    setMorePage: (page: string | null) => void;
    setShowMoreMenu: (show: boolean) => void;
    setShowGroupSummary: (show: boolean) => void;
    setShowGroupMemberRecords: (groupId: string | null) => void;
    setGroupSummaryDialog: (dialog: 'fines' | 'cashFromOffice' | null) => void;  // ADD THIS
  }
  
  // Navigation control interface
  export interface NavigationControl {
    // The unified back handler
    handleBack: () => void;
    
    // Individual state setters
    actions: NavigationActions;
    
    // Current state
    state: NavigationState;
  }
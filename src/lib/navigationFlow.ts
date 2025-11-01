/**
 * Navigation Flow Configuration
 * Defines the back navigation behavior for each component/view state
 */

export interface NavigationState {
  activeSection: 'cash' | 'loan' | 'advance' | 'sync' | 'more';
  fullScreenMenuOpen: boolean;
  quickDrawerOpen: boolean;
  showQuickCollections: boolean;
  recordView: { type: string; record: any; readOnly?: boolean } | null;
  syncViewingRecords: string | null;
  morePage: string | null;
  showMoreMenu: boolean;
  showLogin: boolean;
}

export interface NavigationAction {
  action: 'close' | 'navigate' | 'exit' | 'confirm-exit';
  target?: string;
  value?: any;
}

/**
 * Determines the back navigation action based on current state
 * Priority order is critical for consistent UX
 */
export function getBackAction(state: NavigationState): NavigationAction {
  // Priority 1: Close full screen menu overlay
  if (state.fullScreenMenuOpen) {
    return { action: 'close', target: 'fullScreenMenuOpen' };
  }

  // Priority 2: Close quick drawer overlay
  if (state.quickDrawerOpen) {
    return { action: 'close', target: 'quickDrawerOpen' };
  }

  // Priority 3: Close quick collections → back to cash collection
  if (state.showQuickCollections) {
    return { action: 'close', target: 'showQuickCollections' };
  }

  // Priority 4: Close record detail view
  // Flow: RecordDetailView → RecordsList (if from sync) OR → Previous section
  if (state.recordView) {
    return { action: 'close', target: 'recordView' };
  }

  // Priority 5: Close sync records list → back to sync section main view
  if (state.syncViewingRecords) {
    return { action: 'close', target: 'syncViewingRecords' };
  }

  // Priority 6: Close more page → back to more menu
  // Flow: GroupSummary/AddMember/etc → MoreMenu
  if (state.morePage) {
    return { action: 'close', target: 'morePage', value: true }; // Keep more menu open
  }

  // Priority 7: Close more menu → back to cash section
  // Flow: MoreMenu → CashCollection
  if (state.showMoreMenu) {
    return { action: 'navigate', target: 'cash' };
  }

  // Priority 8: Navigate from any section back to cash
  // Flow: Sync/Loan/Advance/More → CashCollection
  if (state.activeSection !== 'cash') {
    return { action: 'navigate', target: 'cash' };
  }

  // Priority 9: On cash section → confirm exit
  // Flow: CashCollection → Exit app
  if (state.activeSection === 'cash' && !state.showLogin) {
    return { action: 'confirm-exit' };
  }

  // Default: Exit without confirmation (shouldn't normally reach here)
  return { action: 'exit' };
}

/**
 * Navigation flow documentation for reference:
 * 
 * COMPONENT FLOWS:
 * ================
 * 
 * Quick Collections:
 *   QuickCollections → CashCollection
 * 
 * Record Management:
 *   RecordDetailView → RecordsList → Sync Section → CashCollection
 *   RecordDetailView → GroupMemberRecords (when from group summary)
 * 
 * More Menu:
 *   GroupSummary → MoreMenu → CashCollection
 *   AddMemberForm → MoreMenu → CashCollection
 *   DataManagement → MoreMenu → CashCollection
 * 
 * Sections:
 *   Sync → CashCollection
 *   Loan → CashCollection
 *   Advance → CashCollection
 *   More → CashCollection
 * 
 * Final Exit:
 *   CashCollection → [Confirm] → Exit App
 */

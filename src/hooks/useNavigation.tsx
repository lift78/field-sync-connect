/**
 * useNavigation Hook
 * Provides unified navigation control for both hardware and UI back buttons
 * All components should use this hook instead of direct state setters
 */

import { useCallback } from 'react';
import type { NavigationState, NavigationActions, NavigationControl } from '@/types/navigation';

/**
 * Creates the navigation controller
 * This hook encapsulates all navigation logic in one place
 */
export function useNavigation(
  state: NavigationState,
  actions: NavigationActions
): NavigationControl {
  
    const handleBack = useCallback(() => {
        console.log('Navigation back triggered:', state);
      
        // Priority 1: Close full screen menu overlay
        if (state.fullScreenMenuOpen) {
          actions.setFullScreenMenuOpen(false);
          return;
        }
      
        // Priority 2: Close quick drawer overlay
        if (state.quickDrawerOpen) {
          actions.setQuickDrawerOpen(false);
          return;
        }
      
        // Priority 3: Close quick collections → back to cash collection
        if (state.showQuickCollections) {
          actions.setShowQuickCollections(false);
          return;
        }
      
        // Priority 4: Close record detail view
        if (state.recordView) {
          // Check if we came from Group Member Records
          if (state.showGroupMemberRecords) {
            actions.setRecordView(null);
            // Stay in Group Member Records view
            return;
          }
          actions.setRecordView(null);
          return;
        }
      
        // Priority 4.5: Close Group Summary dialogs → back to Group Summary
        if (state.groupSummaryDialog) {
          actions.setGroupSummaryDialog(null);
          return;
        }
      
        // Priority 4.6: Close Group Member Records → back to Group Summary
        if (state.showGroupMemberRecords) {
          actions.setShowGroupMemberRecords(null);
          return;
        }
      
        // Priority 4.7: Close Group Summary → back to where it came from
        if (state.showGroupSummary) {
          actions.setShowGroupSummary(false);
          // The activeSection determines where to go back:
          // - If 'more', it will stay on more section (showMoreMenu will be opened next)
          // - If 'cash', it will stay on cash section
          if (state.activeSection === 'more') {
            actions.setShowMoreMenu(true);
          }
          return;
        }
      
        // Priority 5: Close sync records list → back to sync section main view
        if (state.syncViewingRecords) {
          actions.setSyncViewingRecords(null);
          return;
        }

    // Priority 6: Close more page → back to more menu
    if (state.morePage) {
      actions.setMorePage(null);
      actions.setShowMoreMenu(true);
      return;
    }

    // Priority 7: Close more menu → back to cash section
    if (state.showMoreMenu) {
      actions.setShowMoreMenu(false);
      actions.setActiveSection('cash');
      return;
    }

    // Priority 8: Navigate from any section back to cash
    if (state.activeSection !== 'cash') {
      actions.setActiveSection('cash');
      return;
    }

    // Priority 9: On cash section → this will be handled by hardware back button
    // (confirm exit) - UI components at cash level typically don't have back buttons
    console.log('At root level (cash section) - no back action');
  }, [state, actions]);

  return {
    handleBack,
    actions,
    state
  };
}

/**
 * Navigation Flow Documentation
 * =============================
 * 
 * ALL back buttons (hardware & UI) follow this priority order:
 * 
 * 1. Full Screen Menu → closes menu
 * 2. Quick Drawer → closes drawer  
 * 3. Quick Collections → back to cash
 * 4. Record Detail → back to records list (or previous view)
 * 5. Sync Records List → back to sync main
 * 6. More Pages → back to More Menu
 * 7. More Menu → back to Cash
 * 8. Any Section → back to Cash
 * 9. Cash Section → (hardware only: confirm exit)
 */
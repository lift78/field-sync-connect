# Field Officer Mobile App - Complete Setup Guide

## 1. Converting to Mobile App with Capacitor

### Why Capacitor over Expo?
- Better native capabilities integration
- Seamless web-to-mobile transition
- Direct access to device features
- Hot-reload support in development

### Step 1: Install Capacitor Dependencies

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npm install -D @capacitor/cli
```

### Step 2: Initialize Capacitor Project

```bash
npx cap init
```

When prompted, use these values:
- **App ID**: `app.lovable.da3c5a951a55424bb1b2b102a1fdb4b2`
- **App Name**: `Lift Offline`

### Step 3: Configure Capacitor

Create/update `capacitor.config.ts` with:

```typescript
import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'app.lovable.da3c5a951a55424bb1b2b102a1fdb4b2',
  appName: 'Lift Offline',
  webDir: 'dist',
  server: {
    url: "https://da3c5a95-1a55-424b-b1b2-b102a1fdb4b2.lovableproject.com?forceHideBadge=true",
    cleartext: true
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  }
};

export default config;
```

### Step 4: Building and Running on Device

1. **Export to GitHub**: Use the "Export to Github" button in Lovable
2. **Clone locally**: `git clone your-repo-url`
3. **Install dependencies**: `npm install`
4. **Add platforms**: 
   ```bash
   npx cap add ios    # For iOS
   npx cap add android # For Android
   ```
5. **Build project**: `npm run build`
6. **Sync to native**: `npx cap sync`
7. **Run on device**:
   ```bash
   npx cap run android  # For Android
   npx cap run ios      # For iOS (requires Mac + Xcode)
   ```

---

## 2. IndexedDB Integration for Offline Storage

### Step 1: Install Dexie (IndexedDB Wrapper)

```bash
npm install dexie
```

### Step 2: Create Database Schema

Create `src/lib/database.ts`:

```typescript
import Dexie, { Table } from 'dexie';

// Define interfaces for your data
interface CashCollection {
  id?: number;
  memberId: string;
  memberName: string;
  amount: number;
  timestamp: Date;
  synced: boolean;
}

interface LoanApplication {
  id?: number;
  memberId: string;
  memberName: string;
  loanAmount: number;
  installments: number;
  guarantors: string[];
  timestamp: Date;
  synced: boolean;
}

interface LoanDisbursement {
  id?: number;
  loanId: string;
  amountType: 'all' | 'custom';
  customAmount?: number;
  timestamp: Date;
  synced: boolean;
}

interface AdvanceLoan {
  id?: number;
  memberId: string;
  memberName: string;
  amount: number;
  timestamp: Date;
  synced: boolean;
}

// Database class
export class FieldOfficerDB extends Dexie {
  cashCollections!: Table<CashCollection>;
  loanApplications!: Table<LoanApplication>;
  loanDisbursements!: Table<LoanDisbursement>;
  advanceLoans!: Table<AdvanceLoan>;

  constructor() {
    super('FieldOfficerDB');
    this.version(1).stores({
      cashCollections: '++id, memberId, memberName, amount, timestamp, synced',
      loanApplications: '++id, memberId, memberName, loanAmount, installments, timestamp, synced',
      loanDisbursements: '++id, loanId, amountType, customAmount, timestamp, synced',
      advanceLoans: '++id, memberId, memberName, amount, timestamp, synced'
    });
  }
}

export const db = new FieldOfficerDB();

// Database operations
export const dbOperations = {
  // Cash Collections
  async addCashCollection(data: Omit<CashCollection, 'id' | 'synced'>) {
    return await db.cashCollections.add({ ...data, synced: false });
  },

  async getCashCollections() {
    return await db.cashCollections.orderBy('timestamp').reverse().toArray();
  },

  async getUnsyncedCashCollections() {
    return await db.cashCollections.where('synced').equals(false).toArray();
  },

  async markCashCollectionSynced(id: number) {
    return await db.cashCollections.update(id, { synced: true });
  },

  // Loan Applications
  async addLoanApplication(data: Omit<LoanApplication, 'id' | 'synced'>) {
    return await db.loanApplications.add({ ...data, synced: false });
  },

  async getLoanApplications() {
    return await db.loanApplications.orderBy('timestamp').reverse().toArray();
  },

  async getUnsyncedLoanApplications() {
    return await db.loanApplications.where('synced').equals(false).toArray();
  },

  async markLoanApplicationSynced(id: number) {
    return await db.loanApplications.update(id, { synced: true });
  },

  // Loan Disbursements
  async addLoanDisbursement(data: Omit<LoanDisbursement, 'id' | 'synced'>) {
    return await db.loanDisbursements.add({ ...data, synced: false });
  },

  async getLoanDisbursements() {
    return await db.loanDisbursements.orderBy('timestamp').reverse().toArray();
  },

  async getUnsyncedLoanDisbursements() {
    return await db.loanDisbursements.where('synced').equals(false).toArray();
  },

  async markLoanDisbursementSynced(id: number) {
    return await db.loanDisbursements.update(id, { synced: true });
  },

  // Advance Loans
  async addAdvanceLoan(data: Omit<AdvanceLoan, 'id' | 'synced'>) {
    return await db.advanceLoans.add({ ...data, synced: false });
  },

  async getAdvanceLoans() {
    return await db.advanceLoans.orderBy('timestamp').reverse().toArray();
  },

  async getUnsyncedAdvanceLoans() {
    return await db.advanceLoans.where('synced').equals(false).toArray();
  },

  async markAdvanceLoanSynced(id: number) {
    return await db.advanceLoans.update(id, { synced: true });
  },

  // Get all unsynced records
  async getAllUnsyncedRecords() {
    const [cashCollections, loanApplications, loanDisbursements, advanceLoans] = await Promise.all([
      this.getUnsyncedCashCollections(),
      this.getUnsyncedLoanApplications(),
      this.getUnsyncedLoanDisbursements(),
      this.getUnsyncedAdvanceLoans()
    ]);

    return {
      cashCollections,
      loanApplications,
      loanDisbursements,
      advanceLoans,
      total: cashCollections.length + loanApplications.length + loanDisbursements.length + advanceLoans.length
    };
  }
};
```

---

## 3. Sync Operations Implementation

### Step 1: Create Sync Service

Create `src/lib/syncService.ts`:

```typescript
import { dbOperations } from './database';

interface SyncEndpoints {
  cashCollections: string;
  loanApplications: string;
  loanDisbursements: string;
  advanceLoans: string;
}

export class SyncService {
  private baseUrl: string;
  private endpoints: SyncEndpoints;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.endpoints = {
      cashCollections: `${baseUrl}/api/cash-collections`,
      loanApplications: `${baseUrl}/api/loan-applications`,
      loanDisbursements: `${baseUrl}/api/loan-disbursements`,
      advanceLoans: `${baseUrl}/api/advance-loans`
    };
  }

  // Check network connectivity
  async isOnline(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache'
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // Sync individual record types
  private async syncRecordType<T extends { id?: number }>(
    records: T[],
    endpoint: string,
    markSyncedFn: (id: number) => Promise<any>
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const record of records) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(record)
        });

        if (response.ok) {
          if (record.id) {
            await markSyncedFn(record.id);
          }
          success++;
        } else {
          failed++;
          errors.push(`Failed to sync record ${record.id}: ${response.statusText}`);
        }
      } catch (error) {
        failed++;
        errors.push(`Error syncing record ${record.id}: ${error.message}`);
      }
    }

    return { success, failed, errors };
  }

  // Main sync function
  async syncAllData(): Promise<{
    success: boolean;
    summary: {
      cashCollections: { success: number; failed: number };
      loanApplications: { success: number; failed: number };
      loanDisbursements: { success: number; failed: number };
      advanceLoans: { success: number; failed: number };
    };
    errors: string[];
  }> {
    // Check if online
    if (!(await this.isOnline())) {
      throw new Error('No internet connection. Cannot sync data.');
    }

    // Get all unsynced records
    const unsyncedData = await dbOperations.getAllUnsyncedRecords();
    
    if (unsyncedData.total === 0) {
      return {
        success: true,
        summary: {
          cashCollections: { success: 0, failed: 0 },
          loanApplications: { success: 0, failed: 0 },
          loanDisbursements: { success: 0, failed: 0 },
          advanceLoans: { success: 0, failed: 0 }
        },
        errors: []
      };
    }

    // Sync each record type
    const [cashResult, loanAppResult, disbursementResult, advanceResult] = await Promise.all([
      this.syncRecordType(
        unsyncedData.cashCollections,
        this.endpoints.cashCollections,
        dbOperations.markCashCollectionSynced
      ),
      this.syncRecordType(
        unsyncedData.loanApplications,
        this.endpoints.loanApplications,
        dbOperations.markLoanApplicationSynced
      ),
      this.syncRecordType(
        unsyncedData.loanDisbursements,
        this.endpoints.loanDisbursements,
        dbOperations.markLoanDisbursementSynced
      ),
      this.syncRecordType(
        unsyncedData.advanceLoans,
        this.endpoints.advanceLoans,
        dbOperations.markAdvanceLoanSynced
      )
    ]);

    const allErrors = [
      ...cashResult.errors,
      ...loanAppResult.errors,
      ...disbursementResult.errors,
      ...advanceResult.errors
    ];

    const totalFailed = cashResult.failed + loanAppResult.failed + 
                       disbursementResult.failed + advanceResult.failed;

    return {
      success: totalFailed === 0,
      summary: {
        cashCollections: { success: cashResult.success, failed: cashResult.failed },
        loanApplications: { success: loanAppResult.success, failed: loanAppResult.failed },
        loanDisbursements: { success: disbursementResult.success, failed: disbursementResult.failed },
        advanceLoans: { success: advanceResult.success, failed: advanceResult.failed }
      },
      errors: allErrors
    };
  }

  // Background sync (can be called periodically)
  async backgroundSync(): Promise<void> {
    try {
      if (await this.isOnline()) {
        await this.syncAllData();
      }
    } catch (error) {
      console.log('Background sync failed:', error);
      // Silent fail for background sync
    }
  }
}

// Create singleton instance
export const syncService = new SyncService('https://your-backend-api.com');
```

### Step 2: Create Sync Hook

Create `src/hooks/useSync.ts`:

```typescript
import { useState, useCallback } from 'react';
import { syncService } from '@/lib/syncService';
import { useToast } from '@/hooks/use-toast';

export function useSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const { toast } = useToast();

  const performSync = useCallback(async () => {
    setIsSyncing(true);
    
    try {
      const result = await syncService.syncAllData();
      
      if (result.success) {
        const totalSynced = Object.values(result.summary)
          .reduce((total, category) => total + category.success, 0);
        
        toast({
          title: "Sync Successful",
          description: `${totalSynced} records synced successfully`,
        });
      } else {
        toast({
          title: "Sync Completed with Errors",
          description: `Some records failed to sync. Check the details.`,
          variant: "destructive",
        });
      }
      
      setLastSyncTime(new Date());
      return result;
      
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: error.message || "Unable to sync data",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [toast]);

  const checkConnectivity = useCallback(async () => {
    return await syncService.isOnline();
  }, []);

  return {
    isSyncing,
    lastSyncTime,
    performSync,
    checkConnectivity
  };
}
```

---

## 4. Integration Steps

### Step 1: Update Your Components

Replace localStorage calls with IndexedDB operations:

```typescript
// Instead of localStorage
localStorage.setItem('data', JSON.stringify(data));

// Use IndexedDB
await dbOperations.addCashCollection(data);
```

### Step 2: Update SyncManager Component

```typescript
import { useSync } from '@/hooks/useSync';
import { dbOperations } from '@/lib/database';

// In your SyncManager component
const { isSyncing, performSync, checkConnectivity } = useSync();
```

### Step 3: Add Network Status Detection

Install network detection:
```bash
npm install @capacitor/network
```

### Step 4: Implement Auto-sync

Set up periodic background sync when online.

---

## 5. Backend API Requirements

Your backend should provide these endpoints:

```
POST /api/cash-collections
POST /api/loan-applications  
POST /api/loan-disbursements
POST /api/advance-loans
GET  /api/health
```

Each should accept the respective data structure and return success/error responses.

---

## 6. Testing Strategy

1. **Offline Mode**: Test all CRUD operations without internet
2. **Sync Operations**: Test sync with various network conditions
3. **Data Integrity**: Ensure no data loss during sync failures
4. **Performance**: Test with large datasets
5. **Mobile Testing**: Test on actual devices

---

## 7. Production Considerations

- Implement conflict resolution for concurrent edits
- Add data compression for large sync operations
- Implement incremental sync for better performance
- Add user authentication and data encryption
- Set up analytics for sync success rates
- Implement retry mechanisms for failed syncs

---

**Next Steps:**
1. Set up Capacitor following the mobile setup steps
2. Implement IndexedDB integration
3. Test offline functionality thoroughly
4. Deploy backend API with required endpoints
5. Test on physical devices

For mobile development support, read our comprehensive guide: https://lovable.dev/blogs/TODO
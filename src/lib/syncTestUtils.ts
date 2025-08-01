// syncTestUtils.ts - Complete test file for debugging sync issues

import { dbOperations, db } from './database';
import { syncService } from './syncService';

export class SyncTestUtils {
  
  // STEP 1: Complete diagnostic check
  static async runCompleteDiagnostic(): Promise<void> {
    console.log("🔬 ===== COMPLETE SYNC DIAGNOSTIC =====");
    
    // Check 1: Database contents
    console.log("\n📊 STEP 1: Checking database contents...");
    await this.checkDatabaseState();
    
    // Check 2: Authentication
    console.log("\n🔐 STEP 2: Testing authentication...");
    await this.testAuthentication();
    
    // Check 3: Network connectivity
    console.log("\n🌐 STEP 3: Testing connectivity...");
    await this.testConnectivity();
    
    // Check 4: Sync query methods
    console.log("\n🔍 STEP 4: Testing sync queries...");
    await this.testSyncQueries();
    
    console.log("\n🔬 ===== DIAGNOSTIC COMPLETED =====");
    console.log("💡 If you have no records, run: SyncTestUtils.createTestData()");
    console.log("💡 If you have records but they're all synced, run: SyncTestUtils.resetAllToUnsynced()");
    console.log("💡 To test sync, run: SyncTestUtils.testSyncFlow()");
  }

  // Check current database state
  static async checkDatabaseState(): Promise<void> {
    try {
      const allCash = await dbOperations.getCashCollections();
      const unsyncedCash = await dbOperations.getUnsyncedCashCollections();
      
      console.log(`📊 Total cash collections: ${allCash.length}`);
      console.log(`📊 Unsynced cash collections: ${unsyncedCash.length}`);
      
      if (allCash.length === 0) {
        console.log("❌ NO RECORDS FOUND - You need to create some records first!");
        return;
      }
      
      // Show sync status breakdown
      const syncedCount = allCash.filter(r => r.synced === true).length;
      const unsyncedCount = allCash.filter(r => r.synced === false).length;
      const undefinedSyncCount = allCash.filter(r => r.synced === undefined).length;
      
      console.log(`  ✅ Synced: ${syncedCount}`);
      console.log(`  ❌ Unsynced: ${unsyncedCount}`);
      console.log(`  ❓ Undefined sync status: ${undefinedSyncCount}`);
      
      // Show recent records
      console.log("\n📋 Recent records (last 3):");
      allCash.slice(0, 3).forEach((record, index) => {
        console.log(`  ${index + 1}. ID: ${record.id}, Member: ${record.memberName}, Amount: ${record.cashAmount}, Synced: ${record.synced}`);
      });
      
    } catch (error) {
      console.error("💥 Failed to check database state:", error);
    }
  }

  // Test authentication
  static async testAuthentication(): Promise<boolean> {
    try {
      const credentials = await dbOperations.getUserCredentials();
      if (!credentials) {
        console.log("❌ No stored credentials");
        return false;
      }
      
      console.log(`👤 Found credentials for: ${credentials.username}`);
      
      // Test if syncService can authenticate
      const authResult = await (syncService as any).authenticate();
      console.log(`🔐 Authentication result: ${authResult ? '✅ Success' : '❌ Failed'}`);
      
      return authResult;
    } catch (error) {
      console.error("💥 Authentication test failed:", error);
      return false;
    }
  }

  // Test connectivity
  static async testConnectivity(): Promise<boolean> {
    try {
      const isOnline = await syncService.isOnline();
      console.log(`🌐 Connectivity: ${isOnline ? '✅ Online' : '❌ Offline'}`);
      return isOnline;
    } catch (error) {
      console.error("💥 Connectivity test failed:", error);
      return false;
    }
  }

  // Test sync query methods
  static async testSyncQueries(): Promise<void> {
    try {
      // Method 1: dbOperations
      const method1 = await dbOperations.getUnsyncedCashCollections();
      console.log(`🔍 dbOperations.getUnsyncedCashCollections(): ${method1.length}`);
      
      // Method 2: Direct query
      const method2 = await db.cashCollections.where('synced').equals(false).toArray();
      console.log(`🔍 Direct query synced=false: ${method2.length}`);
      
      // Method 3: Check the exact query used in dbOperations
      const method3 = await db.cashCollections.where('synced').equals(0).toArray();
      console.log(`🔍 Direct query synced=0: ${method3.length}`);
      
      if (method1.length !== method2.length) {
        console.log("⚠️ Query mismatch detected! Checking synced field types...");
        const allRecords = await db.cashCollections.toArray();
        const syncedTypes = [...new Set(allRecords.map(r => typeof r.synced))];
        console.log(`🔍 Synced field types found: ${syncedTypes.join(', ')}`);
        
        allRecords.slice(0, 3).forEach(record => {
          console.log(`  Record ${record.id}: synced = ${record.synced} (${typeof record.synced})`);
        });
      }
      
    } catch (error) {
      console.error("💥 Query test failed:", error);
    }
  }

  // Create test data
  static async createTestData(count: number = 3): Promise<void> {
    console.log(`🧪 Creating ${count} test cash collection records...`);
    
    try {
      for (let i = 1; i <= count; i++) {
        const testRecord = {
          memberId: `TEST_${Date.now()}_${i}`,
          memberName: `Test Member ${i}`,
          totalAmount: 100 * i,
          cashAmount: 100 * i,
          mpesaAmount: 0,
          allocations: [
            {
              memberId: `TEST_${Date.now()}_${i}`,
              type: 'savings' as const,
              amount: 100 * i,
              reason: 'Test allocation'
            }
          ],
          timestamp: new Date()
        };

        const recordId = await dbOperations.addCashCollection(testRecord);
        console.log(`✅ Created test record ${i} with ID: ${recordId}`);
      }
      
      console.log("✅ Test data created!");
      await this.checkDatabaseState();
      
    } catch (error) {
      console.error("💥 Failed to create test data:", error);
    }
  }

  // Reset all records to unsynced
  static async resetAllToUnsynced(): Promise<void> {
    console.log("🔄 Resetting all records to unsynced...");
    
    try {
      const allRecords = await dbOperations.getCashCollections();
      
      for (const record of allRecords) {
        if (record.id) {
          await db.cashCollections.update(record.id, { synced: false });
        }
      }
      
      console.log(`✅ Reset ${allRecords.length} records to unsynced`);
      await this.checkDatabaseState();
      
    } catch (error) {
      console.error("💥 Failed to reset records:", error);
    }
  }

  // Test the complete sync flow
  static async testSyncFlow(): Promise<void> {
    console.log("🚀 ===== TESTING COMPLETE SYNC FLOW =====");
    
    try {
      // Step 1: Check prerequisites
      console.log("\n✅ STEP 1: Checking prerequisites...");
      const hasAuth = await this.testAuthentication();
      if (!hasAuth) {
        console.log("❌ Authentication failed - stopping test");
        return;
      }
      
      const isOnline = await this.testConnectivity();
      if (!isOnline) {
        console.log("❌ Offline - stopping test");
        return;
      }
      
      // Step 2: Check for records
      console.log("\n📊 STEP 2: Checking for unsynced records...");
      const unsyncedRecords = await dbOperations.getUnsyncedCashCollections();
      
      if (unsyncedRecords.length === 0) {
        console.log("❌ No unsynced records found!");
        console.log("💡 Run SyncTestUtils.createTestData() first, or SyncTestUtils.resetAllToUnsynced()");
        return;
      }
      
      console.log(`✅ Found ${unsyncedRecords.length} unsynced records`);
      
      // Step 3: Test single record sync
      console.log("\n🧪 STEP 3: Testing single record sync...");
      const testRecord = unsyncedRecords[0];
      console.log("🔍 Test record:", {
        id: testRecord.id,
        memberId: testRecord.memberId,
        memberName: testRecord.memberName,
        cashAmount: testRecord.cashAmount,
        synced: testRecord.synced
      });
      
      const singleSyncResult = await syncService.syncSingleCashCollection(testRecord);
      console.log("📊 Single sync result:", singleSyncResult);
      
      if (singleSyncResult.success) {
        console.log("✅ Single record sync successful!");
        console.log("🎯 Ready to sync all records");
        
        // Optionally sync all
        console.log("\n🚀 STEP 4: Syncing all records...");
        const allSyncResult = await syncService.syncAllData();
        console.log("📊 Full sync result:", allSyncResult);
        
      } else {
        console.log("❌ Single record sync failed:", singleSyncResult.error);
      }
      
    } catch (error) {
      console.error("💥 Sync flow test failed:", error);
    }
    
    console.log("\n🚀 ===== SYNC FLOW TEST COMPLETED =====");
  }

  // Clear all data (use with caution!)
  static async clearAllData(): Promise<void> {
    console.log("🗑️ ===== CLEARING ALL DATA =====");
    console.log("⚠️ This will delete ALL cash collection records!");
    
    const confirmed = confirm("Are you sure you want to delete all cash collection records?");
    if (!confirmed) {
      console.log("❌ Operation cancelled");
      return;
    }
    
    try {
      await db.cashCollections.clear();
      console.log("✅ All data cleared");
      await this.checkDatabaseState();
    } catch (error) {
      console.error("💥 Failed to clear data:", error);
    }
  }
}

// Make available globally
(window as any).SyncTest = SyncTestUtils;

// Export for ES6 imports
export default SyncTestUtils;
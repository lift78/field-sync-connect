import { useState, useEffect } from "react";
import { useSync } from '@/hooks/useSync';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RecordsList } from "./RecordsList";
import { dbOperations } from "@/lib/database";
import { 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Database, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Upload,
  Settings,
  User,
  Key,
  X
} from "lucide-react";

interface SyncData {
  type: 'cash' | 'loan' | 'advance' | 'disbursement'; // Added 'disbursement' type
  count: number;
  lastUpdated: string;
}

interface SyncManagerProps {
  onEditRecord?: (type: 'cash' | 'loan' | 'advance' | 'disbursement', recordData: any) => void; // Added 'disbursement'
}

export function SyncManager({ onEditRecord }: SyncManagerProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [viewingRecords, setViewingRecords] = useState<'cash' | 'loan' | 'advance' | 'disbursement' | null>(null); // Added 'disbursement'
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [offlineData, setOfflineData] = useState<SyncData[]>([]);
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [showCredentialModal, setShowCredentialModal] = useState(false);

  // Load actual data from IndexedDB
  useEffect(() => {
    const loadCredentials = async () => {
      const creds = await dbOperations.getUserCredentials();
      if (creds) {
        setCredentials({ 
          username: creds.username, 
          password: "••••••••" // Masked password
        });
      }
    };
    
    const loadOfflineData = async () => {
      try {
        // FIX: Load UNSYNCED records instead of all records
        const [cash, loans, advances, disbursements] = await Promise.all([
          dbOperations.getUnsyncedCashCollections(),      // ✅ Only unsynced
          dbOperations.getUnsyncedLoanApplications(),     // ✅ Only unsynced
          dbOperations.getUnsyncedAdvanceLoans(),         // ✅ Only unsynced
          dbOperations.getUnsyncedLoanDisbursements()     // ✅ Only unsynced
        ]);

        setOfflineData([
          { 
            type: 'cash', 
            count: cash.length, 
            lastUpdated: cash.length > 0 ? cash[0].timestamp.toISOString() : new Date().toISOString()
          },
          { 
            type: 'loan', 
            count: loans.length, 
            lastUpdated: loans.length > 0 ? loans[0].timestamp.toISOString() : new Date().toISOString()
          },
          { 
            type: 'advance', 
            count: advances.length, 
            lastUpdated: advances.length > 0 ? advances[0].timestamp.toISOString() : new Date().toISOString()
          },
          { 
            type: 'disbursement', 
            count: disbursements.length, 
            lastUpdated: disbursements.length > 0 ? disbursements[0].timestamp.toISOString() : new Date().toISOString()
          },
        ]);
      } catch (error) {
        console.error('Failed to load offline data:', error);
      }
    };

    // Run both functions
    loadCredentials();
    loadOfflineData();
    
    const interval = setInterval(loadOfflineData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const totalRecords = offlineData.reduce((sum, data) => sum + data.count, 0);

  const formatDateTime = (isoString: string) => {
    return new Intl.DateTimeFormat('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoString));
  };
  
  const { performSync, checkConnectivity } = useSync();

  useEffect(() => {
    const updateConnectionStatus = async () => {
      const online = await checkConnectivity();
      setIsOnline(online);
    };

    const handleOnline = async () => {
      await updateConnectionStatus();
      
      if (isOnline && autoSyncEnabled) {
        try {
          await performSync();
          setLastSyncTime(new Date().toISOString());
        } catch (err) {
          console.error('Auto-sync failed:', err);
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    // Initial check
    updateConnectionStatus();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check connectivity every 30 seconds
    const interval = setInterval(updateConnectionStatus, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [autoSyncEnabled, performSync, checkConnectivity, isOnline]);

  const handleSync = async () => {
    if (!isOnline) {
      alert('No internet connection. Please check your connection and try again.');
      return;
    }
  
    setIsSyncing(true);
    setSyncProgress(0);
  
    try {
      const result = await performSync();
  
      // Simulate progress visually
      for (let i = 0; i <= 100; i += 25) {
        setSyncProgress(i);
        await new Promise(resolve => setTimeout(resolve, 150));
      }
  
      setLastSyncTime(new Date().toISOString());
  
      if (result.success) {
        alert('✅ All data synced successfully!');
      } else {
        alert('⚠️ Some records failed to sync. Check server.');
      }
  
    } catch (error) {
      console.error('Sync failed:', error);
      alert('❌ Sync failed. Please try again.');
    } finally {
      setIsSyncing(false);
      setSyncProgress(0);
    }
  };
  
  // FIX: Updated getTypeIcon to include disbursement
  const getTypeIcon = (type: SyncData['type']) => {
    switch (type) {
      case 'cash':
        return '💰';
      case 'loan':
        return '🏦';
      case 'advance':
        return '⚡';
      case 'disbursement':
        return '💸'; // Added disbursement icon
      default:
        return '📄';
    }
  };

  // FIX: Updated getTypeLabel to include disbursement
  const getTypeLabel = (type: SyncData['type']) => {
    switch (type) {
      case 'cash':
        return 'Cash Collections';
      case 'loan':
        return 'Loan Applications';
      case 'advance':
        return 'Advance Loans';
      case 'disbursement':
        return 'Loan Disbursements'; // Added disbursement label
      default:
        return 'Unknown';
    }
  };

  const handleUpdateCredentials = async () => {
    try {
      // Only update if password was changed (not masked)
      const actualPassword = credentials.password === "••••••••" 
        ? "" 
        : credentials.password;
      
      await dbOperations.updateUserCredentials({
        username: credentials.username,
        password: actualPassword
      });
      
      alert("✅ Credentials updated successfully!");
      setShowCredentialModal(false);
      
      // Update local state with masked password
      setCredentials({
        username: credentials.username,
        password: "••••••••"
      });
    } catch (err) {
      alert("❌ Failed to update credentials");
      console.error(err);
    }
  };

  const handleEditRecord = (record: any) => {
    if (onEditRecord && viewingRecords) {
      onEditRecord(viewingRecords, record.data);
      setViewingRecords(null);
    }
  };

  // Show records view if selected
  if (viewingRecords) {
    return (
      <RecordsList
        type={viewingRecords}
        onBack={() => setViewingRecords(null)}
        onEditRecord={handleEditRecord}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card className="shadow-card bg-gradient-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            {isOnline ? (
              <Wifi className="h-5 w-5 mr-2 text-success" />
            ) : (
              <WifiOff className="h-5 w-5 mr-2 text-destructive" />
            )}
            Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Badge 
                variant={isOnline ? "default" : "destructive"}
                className={isOnline ? "bg-success text-success-foreground" : ""}
              >
                {isOnline ? "Online" : "Offline"}
              </Badge>
              <p className="text-sm text-muted-foreground mt-1">
                {isOnline 
                  ? "Ready to sync data to server"
                  : "Working in offline mode"
                }
              </p>
            </div>
            {!isOnline && (
              <AlertCircle className="h-8 w-8 text-warning" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Offline Data Summary */}
      <Card className="shadow-card bg-gradient-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Database className="h-5 w-5 mr-2" />
            Unsynced Data Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {offlineData.map((data) => (
            <div 
              key={data.type} 
              className="flex items-center justify-between p-3 bg-background/50 rounded-lg cursor-pointer hover:bg-background/70 transition-colors"
              onClick={() => setViewingRecords(data.type)}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getTypeIcon(data.type)}</span>
                <div>
                  <p className="font-medium">{getTypeLabel(data.type)}</p>
                  <p className="text-sm text-muted-foreground">
                    {data.count > 0 
                      ? `Last updated: ${formatDateTime(data.lastUpdated)}`
                      : "All records synced"
                    }
                  </p>
                </div>
              </div>
              <Badge variant={data.count > 0 ? "destructive" : "default"} className={data.count > 0 ? "" : "bg-success text-success-foreground"}>
                {data.count > 0 
                  ? `${data.count} unsynced`
                  : "✅ All synced"
                }
              </Badge>
            </div>
          ))}

          <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total Unsynced Records:</span>
              <Badge variant={totalRecords > 0 ? "destructive" : "default"} className={totalRecords > 0 ? "text-lg px-3 py-1" : "bg-success text-success-foreground text-lg px-3 py-1"}>
                {totalRecords > 0 ? totalRecords : "✅ All synced"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync Progress */}
      {isSyncing && (
        <Card className="shadow-card bg-gradient-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
            <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              Syncing Data...
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={syncProgress} className="w-full" />
            <p className="text-center text-sm text-muted-foreground">
              {syncProgress}% complete
            </p>
          </CardContent>
        </Card>
      )}

      {/* Last Sync Info */}
      {lastSyncTime && (
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center space-x-2 text-success">
              <CheckCircle className="h-5 w-5" />
              <div className="text-center">
                <p className="font-medium">Last successful sync</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(lastSyncTime)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Configuration */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Sync Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Auto-sync when online</p>
              <p className="text-sm text-muted-foreground">
                Automatically sync data when internet connection is available
              </p>
            </div>
            <Switch
              checked={autoSyncEnabled}
              onCheckedChange={setAutoSyncEnabled}
            />
          </div>
          
          <div className="border-t pt-4">
            <Badge variant={autoSyncEnabled ? "default" : "secondary"} className="mb-2">
              {autoSyncEnabled ? "Auto-sync enabled" : "Manual sync only"}
            </Badge>
            <p className="text-xs text-muted-foreground">
              {autoSyncEnabled 
                ? "Data will sync automatically when you come online"
                : "You need to manually press the sync button to upload data"
              }
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Sync Button */}
      <Card className="shadow-card">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {totalRecords > 0 
                  ? `Ready to sync ${totalRecords} unsynced records to the server`
                  : "All records are synced to the server"
                }
              </p>
              {!isOnline && totalRecords > 0 && (
                <p className="text-sm text-warning mb-4">
                  ⚠️ Internet connection required for syncing
                </p>
              )}
            </div>
            
            <Button 
              variant="mobile" 
              size="mobile"
              onClick={handleSync}
              disabled={!isOnline || isSyncing || totalRecords === 0}
              className="w-full"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 mr-2" />
                  {autoSyncEnabled ? "Manual Sync" : "Sync All Data"}
                </>
              )}
            </Button>

            {totalRecords === 0 && (
              <p className="text-sm text-success">
                ✅ All data is synced to the server
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sync Tips */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <Clock className="h-4 w-4 mr-2" />
            Sync Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• Sync regularly when you have internet connection</li>
            <li>• Data is safely stored offline until synced</li>
            <li>• All records are backed up locally</li>
            <li>• Sync will retry automatically if it fails</li>
          </ul>
        </CardContent>
      </Card>

      {/* Credentials Management */}
      <Card className="shadow-card bg-gradient-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <User className="h-5 w-5 mr-2" />
            Account Credentials
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">Username</p>
              <div className="flex items-center justify-between bg-background/50 p-3 rounded-lg">
                <span>{credentials.username || "Not set"}</span>
              </div>
            </div>
            
            <div>
              <p className="text-sm font-medium mb-1">Password</p>
              <div className="flex items-center justify-between bg-background/50 p-3 rounded-lg">
                <span>{credentials.password ? "••••••••" : "Not set"}</span>
              </div>
            </div>
            
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={() => setShowCredentialModal(true)}
            >
              <Key className="h-4 w-4 mr-2" />
              Update Credentials
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Credential Update Modal */}
      {showCredentialModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Update Credentials</h3>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setShowCredentialModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label>Username</Label>
                <Input
                  value={credentials.username}
                  onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                  placeholder="Enter username"
                />
              </div>
              
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={credentials.password === "••••••••" ? "" : credentials.password}
                  onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                  placeholder="Enter new password"
                />
              </div>
              
              <Button 
                className="w-full mt-2"
                onClick={handleUpdateCredentials}
                disabled={!credentials.username || !credentials.password}
              >
                Save Credentials
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
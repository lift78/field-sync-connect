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
import { syncService } from "@/lib/syncService";
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
  Eye,
  EyeOff,
  User,
  Key,
  X,
  Users,
  ChevronRight
} from "lucide-react";

interface SyncData {
  type: 'cash' | 'loan' | 'advance' | 'disbursement' | 'group' | 'newmember';
  count: number;
  lastUpdated: string;
}

interface SyncManagerProps {
  onEditRecord?: (recordData: any, type: 'cash' | 'loan' | 'advance' | 'group') => void;
  viewingRecords?: 'cash' | 'loan' | 'advance' | 'disbursement' | 'group' | 'newmember' | null;
  onViewingRecordsChange?: (type: 'cash' | 'loan' | 'advance' | 'disbursement' | 'group' | 'newmember' | null) => void;
}

export function SyncManager({ onEditRecord, viewingRecords: externalViewingRecords, onViewingRecordsChange }: SyncManagerProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUpdatingMembers, setIsUpdatingMembers] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [memberUpdateProgress, setMemberUpdateProgress] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastMemberUpdateTime, setLastMemberUpdateTime] = useState<string | null>(null);
  const [viewingRecords, setViewingRecords] = useState<'cash' | 'loan' | 'advance' | 'disbursement' | 'group' | 'newmember' | null>(externalViewingRecords || null);
  const [recordsListKey, setRecordsListKey] = useState(0);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [offlineData, setOfflineData] = useState<SyncData[]>([]);
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Sync viewingRecords with external state and force RecordsList reload when coming back
  useEffect(() => {
    if (externalViewingRecords !== undefined) {
      const wasNull = viewingRecords === null;
      const isNowSet = externalViewingRecords !== null;
      
      setViewingRecords(externalViewingRecords);
      
      // If we're coming back to viewing records (was null, now set), increment key to force reload
      if (wasNull && isNowSet) {
        setRecordsListKey(prev => prev + 1);
      }
    }
  }, [externalViewingRecords]);

  // Notify parent when viewingRecords changes
  useEffect(() => {
    if (onViewingRecordsChange) {
      onViewingRecordsChange(viewingRecords);
    }
  }, [viewingRecords, onViewingRecordsChange]);

  useEffect(() => {
    const loadCredentials = async () => {
      const creds = await dbOperations.getUserCredentials();
      if (creds) {
        setCredentials({ 
          username: creds.username, 
          password: "••••••••"
        });
      }
    };
    
  const loadOfflineData = async () => {
      try {
        const [cash, loans, advances, disbursements, groups, newMembers] = await Promise.all([
          dbOperations.getUnsyncedCashCollections(),
          dbOperations.getUnsyncedLoanApplications(),
          dbOperations.getUnsyncedAdvanceLoans(),
          dbOperations.getUnsyncedLoanDisbursements(),
          dbOperations.getUnsyncedGroupCollections(),
          dbOperations.getUnsyncedNewMembers()
        ]);

        const offlineDataArray: SyncData[] = [
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
          { 
            type: 'group', 
            count: groups.length, 
            lastUpdated: groups.length > 0 ? groups[0].timestamp.toISOString() : new Date().toISOString()
          },
        ];

        // Only add new members if there are any unsynced
        if (newMembers.length > 0) {
          offlineDataArray.push({
            type: 'newmember',
            count: newMembers.length,
            lastUpdated: newMembers[0].timestamp.toISOString()
          });
        }

        setOfflineData(offlineDataArray);
      } catch (error) {
        console.error('Failed to load offline data:', error);
      }
    };

    loadCredentials();
    loadOfflineData();
    
    const interval = setInterval(loadOfflineData, 5000);
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

    updateConnectionStatus();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

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

  const handleMemberDataUpdate = async () => {
    if (!isOnline) {
      alert('No internet connection. Please check your connection and try again.');
      return;
    }

    setIsUpdatingMembers(true);
    setMemberUpdateProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setMemberUpdateProgress(prev => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 200);

      const result = await syncService.syncMemberDataOnly();

      clearInterval(progressInterval);
      setMemberUpdateProgress(100);

      await new Promise(resolve => setTimeout(resolve, 500));

      setLastMemberUpdateTime(new Date().toISOString());

      if (result.success) {
        alert(`✅ Member data updated successfully!\n📊 ${result.totalMembers} members across ${result.totalMeetings} meetings`);
      } else {
        alert(`⚠️ Member data update failed: ${result.error}`);
      }

    } catch (error: any) {
      console.error('Member data update failed:', error);
      alert('❌ Member data update failed. Please try again.');
    } finally {
      setIsUpdatingMembers(false);
      setMemberUpdateProgress(0);
    }
  };
  
  const getTypeIcon = (type: SyncData['type']) => {
    switch (type) {
      case 'cash':
        return '💰';
      case 'loan':
        return '🏦';
      case 'advance':
        return '⚡';
      case 'disbursement':
        return '💸';
      case 'group':
        return '👥';
      case 'newmember':
        return '🆕';
      default:
        return '📄';
    }
  };

  const getTypeLabel = (type: SyncData['type']) => {
    switch (type) {
      case 'cash':
        return 'Cash Collections';
      case 'loan':
        return 'Loan Applications';
      case 'advance':
        return 'Advance Loans';
      case 'disbursement':
        return 'Loan Disbursements';
      case 'group':
        return 'Group Summary';
      case 'newmember':
        return 'New Members';
      default:
        return 'Unknown';
    }
  };

  const handleUpdateCredentials = async () => {
    try {
      const actualPassword = credentials.password === "••••••••" 
        ? "" 
        : credentials.password;
      
      await dbOperations.updateUserCredentials({
        username: credentials.username,
        password: actualPassword
      });
      
      alert("✅ Credentials updated successfully!");
      setShowCredentialModal(false);
      
      setCredentials({
        username: credentials.username,
        password: "••••••••"
      });
    } catch (err) {
      alert("❌ Failed to update credentials");
      console.error(err);
    }
  };

  const handleEditRecord = (recordData: any, type: 'cash' | 'loan' | 'advance' | 'group') => {
    if (onEditRecord) {
      // Don't clear viewingRecords here - keep it so we return to the list after editing
      onEditRecord(recordData, type);
    }
  };

  const handleBackFromRecords = async () => {
    setViewingRecords(null);
    // Reload offline data to reflect any changes
    const loadOfflineData = async () => {
      try {
        const [cash, loans, advances, disbursements, groups, newMembers] = await Promise.all([
          dbOperations.getUnsyncedCashCollections(),
          dbOperations.getUnsyncedLoanApplications(),
          dbOperations.getUnsyncedAdvanceLoans(),
          dbOperations.getUnsyncedLoanDisbursements(),
          dbOperations.getUnsyncedGroupCollections(),
          dbOperations.getUnsyncedNewMembers()
        ]);

        const offlineDataArray: SyncData[] = [
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
          { 
            type: 'group', 
            count: groups.length, 
            lastUpdated: groups.length > 0 ? groups[0].timestamp.toISOString() : new Date().toISOString()
          }
        ];

        // Only add new members if there are any unsynced
        if (newMembers.length > 0) {
          offlineDataArray.push({
            type: 'newmember',
            count: newMembers.length,
            lastUpdated: newMembers[0].timestamp.toISOString()
          });
        }

        setOfflineData(offlineDataArray);
      } catch (error) {
        console.error('Failed to reload offline data:', error);
      }
    };
    await loadOfflineData();
  };

  if (viewingRecords) {
    return (
      <RecordsList
        key={recordsListKey}
        type={viewingRecords}
        onBack={handleBackFromRecords}
        onEditRecord={handleEditRecord}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full space-y-3 sm:space-y-4 px-0.5 py-3 pb-24">
        {/* Connection Status */}
        <Card className="shadow-sm border-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full ${
                  isOnline ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'
                }`}>
                  {isOnline ? (
                    <Wifi className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <WifiOff className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-sm sm:text-base">
                    {isOnline ? "Connected" : "Offline Mode"}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {isOnline 
                      ? "Ready to sync"
                      : "Working offline"
                    }
                  </p>
                </div>
              </div>
              <Badge 
                className={isOnline 
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200" 
                  : "bg-red-100 text-red-700 border-red-200"
                }
              >
                {isOnline ? "Online" : "Offline"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Unsynced Data Summary */}
        <Card className="shadow-sm">
          <CardHeader className="border-b bg-muted/30 p-3 sm:p-4">
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Database className="h-4 w-4 sm:h-5 sm:w-5" />
              Unsynced Records
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 space-y-2">
            {offlineData.map((data) => (
              <button
                key={data.type}
                onClick={() => setViewingRecords(data.type)}
                className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted rounded-lg transition-colors text-left"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-xl sm:text-2xl flex-shrink-0">{getTypeIcon(data.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm sm:text-base truncate">{getTypeLabel(data.type)}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">
                      {data.count > 0 
                        ? formatDateTime(data.lastUpdated)
                        : "All synced"
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge 
                    className={data.count > 0 
                      ? "bg-red-100 text-red-700 border-red-200" 
                      : "bg-emerald-100 text-emerald-700 border-emerald-200"
                    }
                  >
                    {data.count > 0 ? `${data.count} unsynced` : "All synced"}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}

            <div className="border-t pt-3 mt-3">
              <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <span className="font-bold text-sm sm:text-base">Total Unsynced:</span>
                <Badge className={totalRecords > 0 
                  ? "bg-red-100 text-red-700 border-red-200 text-base sm:text-lg px-3 py-1" 
                  : "bg-emerald-100 text-emerald-700 border-emerald-200 text-base sm:text-lg px-3 py-1"
                }>
                  {totalRecords > 0 ? `${totalRecords} unsynced` : "All synced"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sync Progress */}
        {isSyncing && (
          <Card className="shadow-sm border-2 border-blue-500">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                <span className="font-bold">Syncing Data...</span>
              </div>
              <Progress value={syncProgress} className="w-full h-2" />
              <p className="text-center text-sm text-muted-foreground">
                {syncProgress}% complete
              </p>
            </CardContent>
          </Card>
        )}

        {/* Member Data Update Progress */}
        {isUpdatingMembers && (
          <Card className="shadow-sm border-2 border-purple-500">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 animate-pulse text-purple-600" />
                <span className="font-bold">Updating Members...</span>
              </div>
              <Progress value={memberUpdateProgress} className="w-full h-2" />
              <p className="text-center text-sm text-muted-foreground">
                {memberUpdateProgress}% complete
              </p>
            </CardContent>
          </Card>
        )}

        {/* Last Sync Info */}
        {(lastSyncTime || lastMemberUpdateTime) && (
          <Card className="shadow-sm bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900">
            <CardContent className="p-4 space-y-3">
              {lastSyncTime && (
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">Last data sync</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatDateTime(lastSyncTime)}
                    </p>
                  </div>
                </div>
              )}
              
              {lastMemberUpdateTime && (
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">Last member update</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatDateTime(lastMemberUpdateTime)}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Auto-sync Toggle */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Settings className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <p className="font-medium text-sm sm:text-base">Auto-sync</p>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Sync automatically when online
                </p>
              </div>
              <Switch
                checked={autoSyncEnabled}
                onCheckedChange={setAutoSyncEnabled}
              />
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Member Data Update Button */}
          <Card className="shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-muted-foreground mb-3 text-center">
                Update member balances from server
              </p>
              <Button 
                variant="outline" 
                size="lg"
                onClick={handleMemberDataUpdate}
                disabled={!isOnline || isUpdatingMembers || isSyncing}
                className="w-full h-12 sm:h-14 text-sm sm:text-base border-2"
              >
                {isUpdatingMembers ? (
                  <>
                    <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Update Member Data
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Main Sync Button */}
          <Card className="shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-muted-foreground mb-3 text-center">
                {totalRecords > 0 
                  ? `${totalRecords} records ready to sync`
                  : "All records synced"
                }
              </p>
              <Button 
                size="lg"
                onClick={handleSync}
                disabled={!isOnline || isSyncing || totalRecords === 0 || isUpdatingMembers}
                className="w-full h-12 sm:h-14 text-sm sm:text-base font-bold bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Sync All Data
                  </>
                )}
              </Button>
              
              {!isOnline && totalRecords > 0 && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2 text-center">
                  ⚠️ Internet required
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tips */}
        <Card className="shadow-sm">
          <CardHeader className="border-b bg-muted/30 p-3 sm:p-4">
            <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Quick Tips
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            <ul className="text-xs sm:text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0">•</span>
                <span>Update member data before transactions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0">•</span>
                <span>Sync regularly when online</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0">•</span>
                <span>Data is stored safely offline</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Credentials */}
        <Card className="shadow-sm">
          <CardHeader className="border-b bg-muted/30 p-3 sm:p-4">
            <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
              <User className="h-4 w-4" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 space-y-3">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Username</p>
              <p className="font-medium text-sm">{credentials.username || "Not set"}</p>
            </div>
            
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Password</p>
              <p className="font-medium text-sm">{credentials.password ? "••••••••" : "Not set"}</p>
            </div>
            
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowCredentialModal(true)}
            >
              <Key className="h-4 w-4 mr-2" />
              Update Credentials
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Credential Modal */}
      {showCredentialModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="border-b">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Update Credentials</CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setShowCredentialModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div>
                <Label className="text-sm mb-2 block">Username</Label>
                <Input
                  value={credentials.username}
                  onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                  placeholder="Enter username"
                />
              </div>
              
              <div>
                <Label className="text-sm mb-2 block">Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={credentials.password === "••••••••" ? "" : credentials.password}
                    onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                    placeholder="Enter new password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              
              <Button 
                className="w-full"
                onClick={handleUpdateCredentials}
                disabled={!credentials.username || !credentials.password}
              >
                Save Credentials
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
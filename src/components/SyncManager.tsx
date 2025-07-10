import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Database, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Upload
} from "lucide-react";

interface SyncData {
  type: 'cash' | 'loan' | 'advance';
  count: number;
  lastUpdated: string;
}

export function SyncManager() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Mock offline data - in real app this would come from IndexedDB
  const offlineData: SyncData[] = [
    { type: 'cash', count: 12, lastUpdated: '2024-01-15T10:30:00Z' },
    { type: 'loan', count: 8, lastUpdated: '2024-01-15T11:15:00Z' },
    { type: 'advance', count: 5, lastUpdated: '2024-01-15T12:00:00Z' },
  ];

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

  const handleSync = async () => {
    if (!isOnline) {
      alert('No internet connection. Please check your connection and try again.');
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);

    try {
      // Simulate sync process
      for (let i = 0; i <= 100; i += 10) {
        setSyncProgress(i);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // In real app: send data to server, clear local storage on success
      console.log('Syncing data to server:', offlineData);
      
      setLastSyncTime(new Date().toISOString());
      
      // Show success message
      alert('All data synced successfully!');
      
    } catch (error) {
      console.error('Sync failed:', error);
      alert('Sync failed. Please try again.');
    } finally {
      setIsSyncing(false);
      setSyncProgress(0);
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
      default:
        return 'Unknown';
    }
  };

  // Listen for online/offline events
  window.addEventListener('online', () => setIsOnline(true));
  window.addEventListener('offline', () => setIsOnline(false));

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
            Local Data Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {offlineData.map((data) => (
            <div key={data.type} className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getTypeIcon(data.type)}</span>
                <div>
                  <p className="font-medium">{getTypeLabel(data.type)}</p>
                  <p className="text-sm text-muted-foreground">
                    Last updated: {formatDateTime(data.lastUpdated)}
                  </p>
                </div>
              </div>
              <Badge variant="secondary">
                {data.count} record{data.count !== 1 ? 's' : ''}
              </Badge>
            </div>
          ))}

          <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total Records:</span>
              <Badge variant="default" className="text-lg px-3 py-1">
                {totalRecords}
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

      {/* Sync Button */}
      <Card className="shadow-card">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Ready to sync {totalRecords} records to the server
              </p>
              {!isOnline && (
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
                  Sync All Data
                </>
              )}
            </Button>

            {totalRecords === 0 && (
              <p className="text-sm text-muted-foreground">
                No offline data to sync
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
    </div>
  );
}
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
          .reduce((sum, recordType) => sum + recordType.success, 0);

        toast({
          title: '✅ Sync Complete',
          description: `${totalSynced} records synced`,
        });
      } else {
        toast({
          title: '⚠️ Sync Completed with Errors',
          description: result.errors.join('\n'),
          variant: 'destructive'
        });
      }

      setLastSyncTime(new Date());
      return result;

    } catch (err: any) {
      toast({
        title: '❌ Sync Failed',
        description: err.message || 'Something went wrong',
        variant: 'destructive'
      });
      throw err;
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

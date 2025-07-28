import { useState, useCallback } from 'react';
import { syncService } from '@/lib/syncService';
import { useToast } from '@/hooks/use-toast';

export function useSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const { toast } = useToast();

  const formatSyncErrors = (errors: string[]) => {
    if (errors.length === 0) return '';
    
    // Try different line break approaches for better toast rendering
    const numberedErrors = errors.map((error, index) => {
      return `${index + 1}. ${error}`;
    });

    // Use multiple approaches to ensure line breaks work
    return numberedErrors.join('\n');
  };

  const getSyncSummary = (result: any) => {
    const totalSynced = Object.values(result.summary)
      .reduce((sum: number, recordType: any) => sum + recordType.success, 0);
    
    const totalFailed = result.errors?.length || 0;
    
    if (totalFailed === 0) {
      return `${totalSynced} records synced successfully`;
    }
    
    return `${totalSynced} synced, ${totalFailed} failed`;
  };

  const performSync = useCallback(async () => {
    setIsSyncing(true);
    
    try {
      const result = await syncService.syncAllData();
      
      if (result.success) {
        const totalSynced = Object.values(result.summary)
          .reduce((sum, recordType) => sum + recordType.success, 0);

        toast({
          title: '✅ Sync Complete',
          description: `${totalSynced} records synced successfully`,
        });
      } else {
        const formattedErrors = formatSyncErrors(result.errors);
        const summary = getSyncSummary(result);

        toast({
          title: '⚠️ Sync Completed with Errors',
          description: `${summary}\n\n${formattedErrors}`,
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
    const online = await syncService.isOnline();
    return online;
  }, []);

  return {
    isSyncing,
    lastSyncTime,
    performSync,
    checkConnectivity
  };
}
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, Archive, Info } from 'lucide-react';
import { dbOperations } from '@/lib/database';
import { useToast } from '@/hooks/use-toast';

export function DataManagement() {
  const [isClearing, setIsClearing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [oldPendingCount, setOldPendingCount] = useState<number>(0);
  const { toast } = useToast();

  const checkOldPendingRecords = async () => {
    try {
      const count = await dbOperations.getOldPendingRecordsCount();
      setOldPendingCount(count);
    } catch (error) {
      console.error('Error checking old pending records:', error);
    }
  };

  const handleClearSynced = async () => {
    setIsClearing(true);
    try {
      const result = await dbOperations.clearSyncedRecords();
      toast({
        title: '✅ Synced Records Cleared',
        description: `Removed ${result} synced records from local storage`,
      });
    } catch (error: any) {
      toast({
        title: '❌ Clear Failed',
        description: error.message || 'Failed to clear synced records',
        variant: 'destructive'
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteOldPending = async () => {
    setIsDeleting(true);
    try {
      const result = await dbOperations.deleteOldPendingRecords();
      toast({
        title: '✅ Old Records Deleted',
        description: `Removed ${result} pending records older than 3 days`,
      });
      setOldPendingCount(0);
    } catch (error: any) {
      toast({
        title: '❌ Delete Failed',
        description: error.message || 'Failed to delete old pending records',
        variant: 'destructive'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="h-5 w-5" />
          Data Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="font-medium">Clear Synced Records</h4>
          <p className="text-sm text-muted-foreground">
            Remove successfully synced records from local storage to free up space.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={isClearing}>
                <Archive className="h-4 w-4 mr-2" />
                {isClearing ? 'Clearing...' : 'Clear Synced Records'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Synced Records</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove all successfully synced records from your local storage. 
                  This action cannot be undone, but your data is safely stored on the server.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearSynced}>
                  Clear Records
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Delete Old Pending Records</h4>
          <p className="text-sm text-muted-foreground">
            Remove pending records older than 3 days. This prevents data accumulation while maintaining security.
          </p>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={checkOldPendingRecords}
              size="sm"
            >
              <Info className="h-4 w-4 mr-2" />
              Check Old Records
            </Button>
            {oldPendingCount > 0 && (
              <span className="text-sm text-muted-foreground">
                {oldPendingCount} old pending records found
              </span>
            )}
          </div>
          
          {oldPendingCount > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isDeleting}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isDeleting ? 'Deleting...' : `Delete ${oldPendingCount} Old Records`}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Old Pending Records</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {oldPendingCount} pending records that are older than 3 days. 
                    This action cannot be undone. Only old records are eligible for deletion to maintain data security.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteOldPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Old Records
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
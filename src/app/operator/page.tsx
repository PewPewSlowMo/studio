import { OperatorWorkspace } from '@/components/operator/operator-workspace';
import { getConfig } from '@/actions/config';
import { getUsers } from '@/actions/users';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default async function OperatorPage() {
  const config = await getConfig();
  // In a real app, you would get the currently logged-in user.
  // For this prototype, we'll find the first user with the 'operator' role.
  const users = await getUsers();
  const operatorUser = users.find(u => u.role === 'operator' && u.extension);

  if (!operatorUser) {
    return (
        <div className="container mx-auto max-w-lg mt-10">
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No Operator Found</AlertTitle>
                <AlertDescription>
                    There is no user configured with the 'operator' role and an assigned extension. Please configure an operator in the Admin &gt; User Management panel.
                </AlertDescription>
            </Alert>
        </div>
    )
  }

  return <OperatorWorkspace user={operatorUser} amiConnection={config.ami} ariConnection={config.ari} />;
}

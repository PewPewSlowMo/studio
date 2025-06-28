'use client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { LineChart } from 'lucide-react';

export function CallVolumeChart() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Call Volume</CardTitle>
        <CardDescription>Today's call volume by hour.</CardDescription>
      </CardHeader>
      <CardContent className="pl-2 h-[300px] flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <LineChart className="h-12 w-12 mx-auto mb-4" />
          <p className="font-semibold">Call volume data not available.</p>
          <p className="text-sm">
            This requires a Call Detail Record (CDR) database integration.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

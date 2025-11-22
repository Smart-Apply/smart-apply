'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { ApplicationTrackingStatus } from '@/types';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<
  ApplicationTrackingStatus,
  { label: string; color: string; emoji: string }
> = {
  APPLIED: {
    label: 'Beworben',
    emoji: '📝',
    color: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  },
  INTERVIEW: {
    label: 'Interview',
    emoji: '🗓️',
    color: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  },
  ACCEPTED: {
    label: 'Angenommen',
    emoji: '✅',
    color: 'bg-green-100 text-green-800 hover:bg-green-100',
  },
  REJECTED: {
    label: 'Abgelehnt',
    emoji: '❌',
    color: 'bg-red-100 text-red-800 hover:bg-red-100',
  },
};

interface StatusDropdownProps {
  applicationId: string;
  currentStatus: ApplicationTrackingStatus;
  variant?: 'dropdown' | 'badge';
}

export function StatusDropdown({
  applicationId,
  currentStatus,
  variant = 'dropdown',
}: StatusDropdownProps) {
  const [status, setStatus] = useState(currentStatus);
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: (newStatus: ApplicationTrackingStatus) =>
      api.applications.updateStatus(applicationId, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['application', applicationId] });
      toast.success('Status aktualisiert');
    },
    onError: (error: Error) => {
      toast.error(`Fehler beim Aktualisieren: ${error.message}`);
      setStatus(currentStatus); // Revert on error
    },
  });

  const handleStatusChange = (newStatus: ApplicationTrackingStatus) => {
    setStatus(newStatus);
    updateStatusMutation.mutate(newStatus);
  };

  const config = STATUS_CONFIG[status];

  // Badge-only variant (non-interactive)
  if (variant === 'badge') {
    return (
      <Badge className={config.color}>
        <span className="mr-1">{config.emoji}</span>
        {config.label}
      </Badge>
    );
  }

  // Dropdown variant (interactive)
  return (
    <Select value={status} onValueChange={handleStatusChange}>
      <SelectTrigger className={`w-[180px] ${config.color}`}>
        <SelectValue>
          <span className="flex items-center">
            <span className="mr-2">{config.emoji}</span>
            {config.label}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(STATUS_CONFIG).map(([value, conf]) => (
          <SelectItem key={value} value={value}>
            <span className="flex items-center">
              <span className="mr-2">{conf.emoji}</span>
              {conf.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

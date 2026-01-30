'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { Mail, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';

export function EmailVerificationBanner() {
  const { user } = useAuthStore();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Don't show if user is verified, not logged in, or banner is dismissed
  if (!user || user.emailVerified || isDismissed) {
    return null;
  }

  const handleResendEmail = async () => {
    setIsSending(true);
    try {
      await api.auth.sendVerificationEmail();
      toast.success('Verifizierungs-E-Mail wurde gesendet! Bitte überprüfe dein Postfach.');
    } catch (error) {
      const { ApiError, getErrorMessage } = await import('@/lib/errors');
      if (ApiError.isApiError(error)) {
        if (error.status === 429) {
          toast.error('Bitte warte einen Moment, bevor du eine weitere E-Mail anforderst.');
        } else if (error.data?.code === 'EMAIL_ALREADY_VERIFIED') {
          toast.info('Deine E-Mail-Adresse wurde bereits verifiziert.');
          setIsDismissed(true);
        } else {
          toast.error(getErrorMessage(error));
        }
      } else {
        toast.error('Ein Fehler ist aufgetreten. Bitte versuche es später erneut.');
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="relative bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <Mail className="h-5 w-5 text-amber-600" />
          </div>
          <div className="text-sm">
            <span className="font-medium text-amber-800">
              Bitte verifiziere deine E-Mail-Adresse.
            </span>
            <span className="text-amber-700 ml-1">
              Wir haben dir eine E-Mail an <strong>{user.email}</strong> gesendet.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResendEmail}
            disabled={isSending}
            className="border-amber-300 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Sende...
              </>
            ) : (
              'Erneut senden'
            )}
          </Button>
          <button
            onClick={() => setIsDismissed(true)}
            className="text-amber-600 hover:text-amber-800 p-1"
            aria-label="Banner schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

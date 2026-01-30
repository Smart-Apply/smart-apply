'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api-client';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type VerificationStatus = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const params = useParams();
  const token = params.token as string;
  const [status, setStatus] = useState<VerificationStatus>('loading');
  const [email, setEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const response = await api.auth.verifyEmail(token);
        setEmail(response.email);
        setStatus('success');
      } catch (error) {
        const { ApiError } = await import('@/lib/errors');
        if (ApiError.isApiError(error)) {
          if (error.data?.code === 'INVALID_OR_EXPIRED_TOKEN') {
            setErrorMessage('Der Verifizierungslink ist ungültig oder abgelaufen.');
          } else {
            setErrorMessage('Ein Fehler ist aufgetreten. Bitte versuche es erneut.');
          }
        } else {
          setErrorMessage('Ein Fehler ist aufgetreten. Bitte versuche es erneut.');
        }
        setStatus('error');
      }
    };

    if (token) {
      verifyEmail();
    }
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-8">
        <div className="w-full max-w-md rounded-xl bg-card p-8 shadow-lg border border-border">
          <div className="mb-6 flex justify-center">
            <Image
              src="/Logo/Logo without bg/Full_Logo-removebg-preview.png"
              alt="Smart Apply"
              width={200}
              height={50}
              className="h-12 w-auto"
              priority
            />
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <h1 className="mb-2 font-poppins text-2xl font-semibold text-foreground">
              E-Mail wird verifiziert...
            </h1>
            <p className="text-muted-foreground">Bitte warte einen Moment.</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-8">
        <div className="w-full max-w-md rounded-xl bg-card p-8 shadow-lg border border-border">
          <div className="mb-6 flex justify-center">
            <Image
              src="/Logo/Logo without bg/Full_Logo-removebg-preview.png"
              alt="Smart Apply"
              width={200}
              height={50}
              className="h-12 w-auto"
              priority
            />
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="mb-2 font-poppins text-2xl font-semibold text-foreground">
              E-Mail verifiziert!
            </h1>
            <p className="mb-2 text-muted-foreground">
              Deine E-Mail-Adresse wurde erfolgreich verifiziert.
            </p>
            {email && (
              <p className="mb-6 text-sm font-medium text-foreground">{email}</p>
            )}
            <div className="flex gap-3">
              <Link href="/login">
                <Button>Zur Anmeldung</Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline">Zum Dashboard</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-8">
      <div className="w-full max-w-md rounded-xl bg-card p-8 shadow-lg border border-border">
        <div className="mb-6 flex justify-center">
          <Image
            src="/Logo/Logo without bg/Full_Logo-removebg-preview.png"
            alt="Smart Apply"
            width={200}
            height={50}
            className="h-12 w-auto"
            priority
          />
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="mb-2 font-poppins text-2xl font-semibold text-foreground">
            Verifizierung fehlgeschlagen
          </h1>
          <p className="mb-6 text-muted-foreground">{errorMessage}</p>
          <div className="flex gap-3">
            <Link href="/login">
              <Button variant="outline">Zur Anmeldung</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

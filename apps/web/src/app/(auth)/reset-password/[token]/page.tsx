'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { KeyRound, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PasswordStrength } from '@/components/ui/password-strength';
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from '@/lib/validation/schemas';

export default function ResetPasswordPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const [status, setStatus] = useState<'form' | 'success' | 'error'>('form');
  const [errorMessage, setErrorMessage] = useState('');

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onBlur',
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: ResetPasswordFormValues) => {
    try {
      await api.auth.resetPassword({ token, password: data.password });
      setStatus('success');
      toast.success('Passwort erfolgreich zurückgesetzt!');
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (error) {
      const { ApiError, getErrorMessage } = await import('@/lib/errors');
      if (ApiError.isApiError(error)) {
        if (error.data?.code === 'INVALID_OR_EXPIRED_TOKEN') {
          setStatus('error');
          setErrorMessage('Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.');
        } else {
          toast.error(getErrorMessage(error));
        }
      } else {
        toast.error('Ein Fehler ist aufgetreten. Bitte versuche es erneut.');
      }
    }
  };

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
              Passwort zurückgesetzt
            </h1>
            <p className="mb-6 text-muted-foreground">
              Dein Passwort wurde erfolgreich geändert. Du wirst in Kürze zur Anmeldeseite
              weitergeleitet.
            </p>
            <Link href="/login">
              <Button className="gap-2">Jetzt anmelden</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
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
              Link ungültig
            </h1>
            <p className="mb-6 text-muted-foreground">{errorMessage}</p>
            <Link href="/forgot-password">
              <Button variant="outline" className="gap-2">
                Neuen Link anfordern
              </Button>
            </Link>
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

        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mb-2 font-poppins text-2xl font-semibold text-foreground">
            Neues Passwort festlegen
          </h1>
          <p className="text-muted-foreground">
            Gib dein neues Passwort ein. Wähle ein sicheres Passwort, das du noch nicht verwendet
            hast.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="password"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel className="font-poppins text-base font-semibold text-foreground">
                    Neues Passwort
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Neues Passwort"
                      className={`h-10 rounded-xl border-2 bg-transparent px-4 font-poppins text-[15px] placeholder:text-muted-foreground focus:border-primary ${
                        fieldState.error
                          ? 'border-red-500 focus:border-red-500'
                          : fieldState.isDirty && !fieldState.invalid
                          ? 'border-green-500'
                          : 'border-input'
                      }`}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  <PasswordStrength password={field.value} />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel className="font-poppins text-base font-semibold text-foreground">
                    Passwort wiederholen
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Passwort wiederholen"
                      className={`h-10 rounded-xl border-2 bg-transparent px-4 font-poppins text-[15px] placeholder:text-muted-foreground focus:border-primary ${
                        fieldState.error
                          ? 'border-red-500 focus:border-red-500'
                          : fieldState.isDirty && !fieldState.invalid
                          ? 'border-green-500'
                          : 'border-input'
                      }`}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SubmitButton
              type="submit"
              className="w-full h-10 rounded-xl bg-primary font-poppins text-base font-semibold text-primary-foreground hover:bg-primary/90"
              isLoading={form.formState.isSubmitting}
              loadingText="Speichere..."
            >
              Passwort zurücksetzen
            </SubmitButton>
          </form>
        </Form>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück zur Anmeldung
          </Link>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, resetAuthRedirectFlag } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PasswordStrength } from '@/components/ui/password-strength';
import Link from 'next/link';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[\w@$!%*?&#]{8,}$/;

const registerSchema = z.object({
  firstName: z.string().min(2, 'Vorname muss mindestens 2 Zeichen lang sein'),
  lastName: z.string().min(2, 'Nachname muss mindestens 2 Zeichen lang sein'),
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z
    .string()
    .min(8, 'Passwort muss mindestens 8 Zeichen lang sein')
    .regex(
      PASSWORD_REGEX,
      'Passwort muss einen Großbuchstaben, einen Kleinbuchstaben, eine Zahl und ein Sonderzeichen (@$!%*?&#) enthalten'
    ),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwörter stimmen nicht überein',
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth, isAuthenticated, hasHydrated } = useAuthStore();

  // Redirect to dashboard if already authenticated (wait for hydration first)
  useEffect(() => {
    if (hasHydrated && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, hasHydrated, router]);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { confirmPassword, ...registerData } = data;
      const response = await api.auth.register(registerData);
      
      // Reset the redirect flag to allow future requests
      resetAuthRedirectFlag();
      
      setAuth(response.user);
      toast.success('Account erfolgreich erstellt!');
      router.push('/dashboard');
    } catch (error: unknown) {
      // Use centralized error handling
      const { ApiError, getErrorMessage } = await import('@/lib/errors');
      
      if (ApiError.isApiError(error)) {
        if (error.status === 400 || error.status === 409) {
          toast.error('Diese E-Mail-Adresse ist bereits registriert.');
        } else if (error.status === 429) {
          toast.error(
            'Zu viele Registrierungs-Versuche. Bitte warte 15 Minuten und versuche es erneut.',
            {
              duration: 8000,
              description: 'Aus Sicherheitsgründen wurde dein Zugriff vorübergehend gesperrt.',
            }
          );
        } else {
          toast.error(getErrorMessage(error));
        }
      } else {
        toast.error('Registrierung fehlgeschlagen. Bitte versuche es erneut.');
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Registrieren</CardTitle>
          <CardDescription>
            Erstelle einen neuen Account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vorname</FormLabel>
                      <FormControl>
                        <Input placeholder="Max" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nachname</FormLabel>
                      <FormControl>
                        <Input placeholder="Mustermann" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-Mail</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="max@beispiel.de"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Passwort</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                    <PasswordStrength password={field.value} />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Passwort bestätigen</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? 'Wird registriert...' : 'Registrieren'}
              </Button>
            </form>
          </Form>

          <div className="mt-4 text-center text-sm text-gray-600">
            Bereits einen Account?{' '}
            <Link href="/login" className="text-blue-600 hover:underline">
              Jetzt anmelden
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
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
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from '@/lib/validation/schemas';

export default function ForgotPasswordPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onBlur',
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    try {
      await api.auth.forgotPassword(data);
      setIsSubmitted(true);
    } catch (error) {
      // Always show success to prevent email enumeration
      setIsSubmitted(true);
    }
  };

  if (isSubmitted) {
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
              E-Mail gesendet
            </h1>
            <p className="mb-6 text-muted-foreground">
              Falls ein Konto mit dieser E-Mail-Adresse existiert, erhältst du in Kürze eine E-Mail
              mit einem Link zum Zurücksetzen deines Passworts.
            </p>
            <p className="mb-6 text-sm text-muted-foreground">
              Bitte überprüfe auch deinen Spam-Ordner.
            </p>
            <Link href="/login">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Zurück zur Anmeldung
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
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mb-2 font-poppins text-2xl font-semibold text-foreground">
            Passwort vergessen?
          </h1>
          <p className="text-muted-foreground">
            Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Zurücksetzen deines
            Passworts.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="email"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel className="font-poppins text-base font-semibold text-foreground">
                    E-Mail
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Deine E-Mail-Adresse"
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
              loadingText="Sende..."
            >
              Link senden
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

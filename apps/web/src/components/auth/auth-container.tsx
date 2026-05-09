'use client';

import { useState, useEffect, JSX } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useForm } from 'react-hook-form';
import Image from 'next/image';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, resetAuthRedirectFlag } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from '@/lib/toast';
import { TwoFactorChallengeForm } from '@/components/two-factor';
import { TurnstileWidget, resetTurnstile } from '@/components/auth/turnstile-widget';
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
  loginSchema,
  registerSchema,
  type LoginFormValues,
  type RegisterFormValues,
} from '@/lib/validation/schemas';

type LoginFormData = LoginFormValues;
type RegisterFormData = RegisterFormValues;

interface AuthContainerProps {
  initialMode?: 'login' | 'register';
}

export function AuthContainer({ initialMode = 'login' }: AuthContainerProps) {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [isAnimating, setIsAnimating] = useState(false);
  const [show2FAChallenge, setShow2FAChallenge] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  // Cloudflare Turnstile token for the registration form. The widget
  // sets this asynchronously when the user (invisibly) passes the
  // challenge. Cleared after a failed submit so the next attempt
  // requires a fresh token.
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { setAuth, isAuthenticated, hasHydrated } = useAuthStore();

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (hasHydrated && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, hasHydrated, router]);

  // Sync mode with URL
  useEffect(() => {
    if (pathname === '/login') {
      setIsLogin(true);
    } else if (pathname === '/register') {
      setIsLogin(false);
    }
  }, [pathname]);

  // Login Form
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur', // Validate on blur
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Register Form
  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur', // Validate on blur
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const handleToggle = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setIsLogin(!isLogin);
      // Update URL without full page reload
      const newPath = isLogin ? '/register' : '/login';
      window.history.pushState({}, '', newPath);
    }, 300);
    setTimeout(() => {
      setIsAnimating(false);
    }, 600);
  };

  const onLoginSubmit = async (data: LoginFormData) => {
    try {
      const response = await api.auth.login(data);

      // Check if 2FA is required
      if (response.requiresTwoFactor && response.challengeToken) {
        setChallengeToken(response.challengeToken);
        setShow2FAChallenge(true);
        return;
      }

      // Standard login success (no 2FA required)
      if (response.user) {
        resetAuthRedirectFlag();
        setAuth(response.user);
        toast.success('Erfolgreich angemeldet!');
        router.push('/dashboard');
      }
    } catch (error: unknown) {
      const { ApiError, getErrorMessage } = await import('@/lib/errors');
      if (ApiError.isApiError(error)) {
        if (error.status === 401) {
          toast.error('Ungültige E-Mail oder Passwort.');
        } else if (error.status === 429) {
          toast.error('Zu viele Login-Versuche. Bitte warte 15 Minuten.', {
            duration: 8000,
          });
        } else {
          toast.error(getErrorMessage(error));
        }
      } else {
        toast.error(getErrorMessage(error));
      }
    }
  };

  const handle2FASuccess = () => {
    resetAuthRedirectFlag();
    toast.success('Erfolgreich angemeldet!');
    router.push('/dashboard');
  };

  const handle2FACancel = () => {
    setShow2FAChallenge(false);
    setChallengeToken(null);
    loginForm.reset();
  };

  const onRegisterSubmit = async (data: RegisterFormData) => {
    // If Turnstile is configured (we shipped a site key) but the widget
    // hasn't produced a token yet, short-circuit *before* hitting the
    // backend. This avoids a needless CAPTCHA_FAILED round-trip and —
    // more importantly — makes the error message accurate ("solve the
    // CAPTCHA below") instead of "Bot-Schutz fehlgeschlagen", which
    // suggests Cloudflare rejected something it never received.
    const turnstileConfigured = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
    if (turnstileConfigured && !turnstileToken) {
      toast.error(
        'Bitte löse zuerst das CAPTCHA unten. Falls es nicht erscheint, deaktiviere kurz den Tracking-Schutz / Adblocker für diese Seite.',
        { duration: 8000 },
      );
      return;
    }

    try {
      const { confirmPassword: _confirmPassword, ...registerData } = data;
      const response = await api.auth.register({
        email: registerData.email,
        password: registerData.password,
        firstName: registerData.firstName || '',
        lastName: registerData.lastName || '',
        // Optional — backend accepts unset (e.g. Turnstile not configured
        // on this environment). When configured, missing/expired token
        // is rejected with `code: 'CAPTCHA_FAILED'`.
        turnstileToken: turnstileToken ?? undefined,
      });
      resetAuthRedirectFlag();
      setAuth(response.user);
      toast.success('Account erfolgreich erstellt!');
      router.push('/onboarding');
    } catch (error: unknown) {
      const { ApiError, getErrorMessage } = await import('@/lib/errors');
      // Reset the widget so the user can solve a fresh challenge —
      // Cloudflare rejects reused tokens as "timeout-or-duplicate".
      resetTurnstile();
      setTurnstileToken(null);

      if (ApiError.isApiError(error)) {
        // Captcha-specific failure surfaces a tailored message that hints
        // at common Firefox/Safari causes (Enhanced Tracking Protection,
        // ad blockers, strict cookie settings).
        if (error.data?.code === 'CAPTCHA_FAILED') {
          toast.error(
            'Bot-Schutz fehlgeschlagen. Bitte löse das CAPTCHA erneut. Wenn es nicht erscheint, deaktiviere kurz den Tracking-Schutz oder Adblocker für diese Seite.',
            { duration: 10000 },
          );
        } else if (error.status === 400 || error.status === 409) {
          toast.error('Diese E-Mail-Adresse ist bereits registriert.');
        } else if (error.status === 429) {
          toast.error('Zu viele Registrierungsversuche. Bitte warte 15 Minuten.', {
            duration: 8000,
          });
        } else {
          toast.error(getErrorMessage(error));
        }
      } else {
        toast.error('Registrierung fehlgeschlagen. Bitte versuche es erneut.');
      }
    }
  };

  // Show 2FA challenge form if required
  if (show2FAChallenge && challengeToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-8">
        <div className="w-full max-w-md">
          <TwoFactorChallengeForm
            challengeToken={challengeToken}
            onSuccess={handle2FASuccess}
            onCancel={handle2FACancel}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-8">
      <div className="relative h-[800px] w-[1040px] overflow-hidden rounded-xl bg-card shadow-lg border border-border">
        {/* Sliding Branding Panel */}
        <div
          className={`absolute top-0 z-20 h-full w-1/2 transform transition-transform duration-500 ease-in-out ${isLogin ? 'translate-x-0' : 'translate-x-full'
            }`}
        >
          <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-xl bg-primary p-12">
            {/* Background Texture - Curved Lines */}
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 500 756"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="xMidYMid slice"
            >
              <path
                d="M-30 0 Q 80 200, 50 400 Q 20 600, 80 756"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="12"
                fill="none"
              />
              <path
                d="M520 0 Q 400 200, 430 400 Q 460 600, 380 756"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="12"
                fill="none"
              />
            </svg>

            {/* Content */}
            <div className="relative z-10 flex h-full w-full flex-col justify-center px-4">
              {/* Login Branding (Logo + SmartApply) */}
              <div
                className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-300 ${isLogin && !isAnimating ? 'opacity-100' : 'opacity-0'
                  }`}
              >
                <Image
                  src="/Logo/Logo without bg/Full_Logo-removebg-preview.png"
                  alt="Smart Apply"
                  width={320}
                  height={160}
                  className="h-40 w-auto brightness-0 invert"
                  priority
                />
              </div>

              {/* Register Branding (Motto) */}
              <div
                className={`absolute inset-0 flex flex-col justify-center px-4 transition-opacity duration-300 ${!isLogin && !isAnimating ? 'opacity-100' : 'opacity-0'
                  }`}
              >
                <div className="mb-16 flex justify-center">
                  <Image
                    src="/Logo/Logo without bg/Full_Logo-removebg-preview.png"
                    alt="Smart Apply"
                    width={400}
                    height={80}
                    className="h-20 w-auto brightness-0 invert"
                  />
                </div>
                <div className="space-y-1">
                  <div className="w-[321px] text-left">
                    <p className="font-poppins text-[45px] font-extrabold leading-normal text-primary-foreground">
                      Where
                    </p>
                    <p className="font-poppins text-[45px] font-extrabold leading-normal text-primary-foreground">
                      Applications
                    </p>
                  </div>
                  <div className="ml-auto w-fit text-right">
                    <p className="mt-4 font-poppins text-[45px] font-extrabold leading-normal text-primary-foreground">
                      Become A
                    </p>
                    <p className="font-poppins text-[45px] font-extrabold leading-normal text-primary-foreground">
                      System
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Forms Container */}
        <div className="flex h-full w-full">
          {/* Login Form (Right Side when active) */}
          <div
            className={`absolute right-0 top-0 flex h-full w-1/2 flex-col justify-center px-8 py-12 transition-opacity duration-300 md:px-12 ${isLogin && !isAnimating ? 'z-10 opacity-100' : 'z-0 opacity-0'
              }`}
          >
            <h1 className="mb-8 text-center font-poppins text-2xl font-semibold text-foreground">
              Anmelden
            </h1>

            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-5">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel className="font-poppins text-lg font-semibold text-foreground">
                        E-Mail
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Deine E-Mail"
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

                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel className="font-poppins text-lg font-semibold text-foreground">
                        Passwort
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Dein Passwort"
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

                <div className="flex justify-center pt-2">
                  <SubmitButton
                    type="submit"
                    className="h-10 w-40 rounded-xl bg-primary font-poppins text-base font-semibold text-primary-foreground hover:bg-primary/90"
                    isLoading={loginForm.formState.isSubmitting}
                    loadingText="Anmelden..."
                  >
                    Anmelden
                  </SubmitButton>
                </div>

                <div className="text-center pt-2">
                  <a
                    href="/forgot-password"
                    className="text-sm text-muted-foreground hover:text-primary hover:underline"
                  >
                    Passwort vergessen?
                  </a>
                </div>
              </form>
            </Form>

            <div className="mt-6 text-center font-poppins text-sm">
              <span className="text-foreground">Noch kein Konto? </span>
              <button
                type="button"
                onClick={handleToggle}
                className="font-bold text-primary hover:underline"
              >
                Registrieren
              </button>
            </div>

            {/* Social Login */}
            <div className="mt-6 flex items-center">
              <div className="flex-1 border-t border-border"></div>
              <span className="px-4 font-poppins text-xs text-muted-foreground">Oder anmelden mit</span>
              <div className="flex-1 border-t border-border"></div>
            </div>

            <div className="mt-6 flex justify-center gap-4">
              <SocialButton 
                icon="google" 
                label="Mit Google anmelden"
                onClick={() => window.location.href = api.auth.googleLoginUrl()}
              />
              <SocialButton 
                icon="microsoft" 
                label="Mit Microsoft anmelden"
                onClick={() => window.location.href = api.auth.microsoftLoginUrl()}
              />
            </div>
          </div>

          {/* Register Form (Left Side when active) */}
          <div
            className={`absolute left-0 top-0 flex h-full w-1/2 flex-col justify-center px-8 py-12 transition-opacity duration-300 md:px-12 ${!isLogin && !isAnimating ? 'z-10 opacity-100' : 'z-0 opacity-0'
              }`}
          >
            <h1 className="mb-6 text-center font-poppins text-2xl font-semibold text-foreground">
              Registrieren
            </h1>

            <Form {...registerForm}>
              <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={registerForm.control}
                    name="firstName"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel className="font-poppins text-base font-semibold text-foreground">
                          Vorname
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Dein Vorname"
                            className={`h-9 rounded-xl border-2 bg-transparent px-4 text-[14px] placeholder:text-muted-foreground focus:border-primary ${
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

                  <FormField
                    control={registerForm.control}
                    name="lastName"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel className="font-poppins text-base font-semibold text-foreground">
                          Nachname
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Dein Nachname"
                            className={`h-9 rounded-xl border-2 bg-transparent px-4 text-[14px] placeholder:text-muted-foreground focus:border-primary ${
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
                </div>

                <FormField
                  control={registerForm.control}
                  name="email"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel className="font-poppins text-base font-semibold text-foreground">
                        E-Mail
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Deine E-Mail"
                          className={`h-9 rounded-xl border-2 bg-transparent px-4 text-[14px] placeholder:text-muted-foreground focus:border-primary ${
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

                <FormField
                  control={registerForm.control}
                  name="password"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel className="font-poppins text-base font-semibold text-foreground">
                        Passwort
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Dein Passwort"
                          className={`h-9 rounded-xl border-2 bg-transparent px-4 text-[14px] placeholder:text-muted-foreground focus:border-primary ${
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
                  control={registerForm.control}
                  name="confirmPassword"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel className="font-poppins text-base font-semibold text-foreground">
                        Passwort wiederholen
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Dein Passwort"
                          className={`h-9 rounded-xl border-2 bg-transparent px-4 text-[14px] placeholder:text-muted-foreground focus:border-primary ${
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

                <div className="flex justify-center pt-2">
                  <SubmitButton
                    type="submit"
                    className="h-10 w-40 rounded-xl bg-primary font-poppins text-base font-semibold text-primary-foreground hover:bg-primary/90"
                    isLoading={registerForm.formState.isSubmitting}
                    loadingText="Registriere..."
                  >
                    Registrieren
                  </SubmitButton>
                </div>

                {/* Cloudflare Turnstile CAPTCHA. Renders nothing in dev when
                    NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset. In production
                    it's always visible (`appearance: 'always'`) so users on
                    Firefox / Safari with Enhanced Tracking Protection can
                    actually solve any required interactive challenge — the
                    older `interaction-only` mode could leave the widget
                    invisible while Cloudflare waited for a click. The
                    token feeds into onRegisterSubmit. */}
                <TurnstileWidget
                  className="mt-2 flex justify-center"
                  onToken={setTurnstileToken}
                />
              </form>
            </Form>

            <div className="mt-4 text-center font-poppins text-sm">
              <span className="text-foreground">Bereits ein Konto? </span>
              <button
                type="button"
                onClick={handleToggle}
                className="font-bold text-primary hover:underline"
              >
                Anmelden
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Social Button Component
function SocialButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  const icons: Record<string, JSX.Element> = {
    google: (
      <svg className="h-6 w-6" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    ),
    microsoft: (
      <svg className="h-6 w-6" viewBox="0 0 24 24">
        <path fill="#f25022" d="M0 0h11.377v11.372H0V0z" />
        <path fill="#00a4ef" d="M12.623 0H24v11.372H12.623V0z" />
        <path fill="#7fba00" d="M0 12.623h11.377V24H0V12.623z" />
        <path fill="#ffb900" d="M12.623 12.623H24V24H12.623V12.623z" />
      </svg>
    ),
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card shadow-sm transition-shadow hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label={label}
    >
      {icons[icon]}
    </button>
  );
}

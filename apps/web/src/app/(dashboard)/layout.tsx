'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CurrentTierBadge } from '@/components/subscription';
import { useFeatureGate } from '@/hooks/use-tier-gate';
import type { TierFeatures } from '@/types';
import {
  FileText,
  User,
  LogOut,
  Lock,
  Menu,
  Home,
  Settings,
  MessagesSquare,
  Sparkles,
} from 'lucide-react';
import { EmailVerificationBanner } from '@/components/auth/email-verification-banner';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /**
   * If set, the item is gated by this feature flag. Users without
   * access see a non-clickable, greyed-out tile with an upgrade tooltip
   * (no broken navigation into a paywalled page).
   */
  requiresFeature?: keyof TierFeatures;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Profil', href: '/profile', icon: User },
  { name: 'Bewerbungen', href: '/applications', icon: FileText },
  { name: 'Job-Suche', href: '/job-search', icon: Sparkles, requiresFeature: 'linkedinImport' },
  { name: 'Interview-Coach', href: '/interviews', icon: MessagesSquare, requiresFeature: 'interviewCoach' },
  { name: 'Einstellungen', href: '/settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted/30">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="mt-2 text-sm text-muted-foreground">Laden...</p>
          </div>
        </div>
      }
    >
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </Suspense>
  );
}

function DashboardLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated, user, clearAuth, hasHydrated, setAuth } = useAuthStore();
  const [isLoadingOAuth, setIsLoadingOAuth] = useState(false);

  // Auto-collapse sidebar in edit mode
  const isEditMode = pathname?.includes('/edit');

  useEffect(() => {
    // Wait for auth store to hydrate from localStorage before checking auth
    if (!hasHydrated) return;

    // Handle OAuth success - fetch user data from cookies
    const oauthParam = searchParams.get('oauth');
    if (oauthParam === 'success' && !isAuthenticated && !isLoadingOAuth) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoadingOAuth(true);
      
      // Fetch user data using the HttpOnly cookie set by OAuth callback
      api.auth.me()
        .then((userData) => {
          setAuth(userData);
          // Remove oauth query param from URL
          router.replace(pathname);
        })
        .catch((error) => {
          console.error('OAuth authentication failed:', error);
          router.push('/login?oauth=error');
        })
        .finally(() => {
          setIsLoadingOAuth(false);
        });
      return;
    }

    if (!isAuthenticated && !isLoadingOAuth) {
      router.push('/login');
    }
  }, [isAuthenticated, hasHydrated, router, searchParams, pathname, setAuth, isLoadingOAuth]);

  const handleLogout = async () => {
    try {
      // Call backend to clear cookie (GET request, no CSRF required)
      await api.auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
      // Continue with logout even if backend call fails
    }

    // Clear local auth state
    clearAuth();
    router.push('/login');
  };

  // Show loading while hydrating, loading OAuth, or if not authenticated (redirect pending)
  if (!hasHydrated || isLoadingOAuth || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">
            {isLoadingOAuth ? 'Anmeldung wird abgeschlossen...' : 'Laden...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
    <div className="flex min-h-screen bg-muted/30">
      {/* Email Verification Banner - shows above everything */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <EmailVerificationBanner />
      </div>

      {/* Desktop Sidebar - Hidden in edit mode */}
      {!isEditMode && (
        <aside className="hidden w-80 border-r border-border/50 bg-card/50 backdrop-blur-xl md:block text-foreground shadow-soft z-20">
          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center px-4 border-b border-border/50">
              <Link href="/dashboard" className="flex items-center">
                <Image
                  src="/Logo/Logo without bg/Full_Logo-removebg-preview.png"
                  alt="Smart Apply"
                  width={200}
                  height={40}
                  className="w-[180px] h-auto"
                  priority
                />
              </Link>
            </div>

            <nav className="flex-1 space-y-1 px-4 py-6">
              <div className="mb-4 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                Menu
              </div>
              {navigation.map((item) => (
                <NavLink
                  key={item.name}
                  item={item}
                  isActive={pathname === item.href}
                />
              ))}
            </nav>

            <div className="p-4 border-t border-border/50 bg-muted/10">
              <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-3 shadow-sm transition-all hover:shadow-md cursor-pointer group">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary ring-2 ring-background group-hover:ring-primary/20 transition-all">
                  {(user?.firstName || user?.email)?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {user?.firstName && user?.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user?.firstName || user?.email}
                    </p>
                    <CurrentTierBadge size="sm" />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLogout();
                  }}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Mobile Header */}
      <div className="flex flex-1 flex-col md:hidden">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-md px-4">
          <Link href="/dashboard" className="flex items-center">
            <Image
              src="/Logo/Logo without bg/Full_Logo-removebg-preview.png"
              alt="Smart Apply"
              width={200}
              height={40}
              className="w-[180px] h-auto"
              priority
            />
          </Link>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0 bg-card border-r border-border">
              <div className="flex h-full flex-col">
                <div className="flex h-16 items-center px-4 border-b border-border/50">
                  <Link href="/dashboard" className="flex items-center">
                    <Image
                      src="/Logo/Logo without bg/Full_Logo-removebg-preview.png"
                      alt="Smart Apply"
                      width={250}
                      height={50}
                      className="w-[220px] h-auto"
                    />
                  </Link>
                </div>

                <nav className="flex-1 space-y-1 px-4 py-6">
                  <div className="mb-4 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Menu
                  </div>
                  {navigation.map((item) => (
                    <NavLink
                      key={item.name}
                      item={item}
                      isActive={pathname === item.href}
                    />
                  ))}
                </nav>

                <div className="p-4 border-t border-border/50 bg-muted/10">
                  <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-3 shadow-sm">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {(user?.firstName || user?.email)?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {user?.firstName && user?.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : user?.firstName || user?.email}
                        </p>
                        <CurrentTierBadge size="sm" />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">{children}</main>
      </div>

      {/* Desktop Main Content */}
      <main className="hidden flex-1 md:block overflow-y-auto h-screen">
        {isEditMode ? (
          <div className="h-full p-4">{children}</div>
        ) : (
          <div className="mx-auto max-w-7xl p-8">{children}</div>
        )}
      </main>
    </div>
    </TooltipProvider>
  );
}

/**
 * Single navigation item. Renders as a clickable Link when the user has
 * access (or no feature gate is set), otherwise as a non-clickable,
 * greyed-out tile with a tooltip prompting the user to upgrade.
 *
 * Why two render paths:
 *  - Free users clicking on a Premium-only link previously landed on a
 *    backend 403 / error page. By disabling the link entirely, there is
 *    no broken state to handle.
 *  - The lock icon + tooltip make it obvious *why* the item is disabled.
 */
function NavLink({
  item,
  isActive,
}: {
  item: NavItem;
  isActive: boolean;
}) {
  const Icon = item.icon;

  if (item.requiresFeature) {
    return (
      <NavLinkGated item={item} isActive={isActive} Icon={Icon} />
    );
  }

  return (
    <Link
      href={item.href}
      className={`group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
        isActive
          ? 'bg-primary/5 text-primary shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon
          className={`h-5 w-5 transition-colors ${
            isActive
              ? 'text-primary'
              : 'text-muted-foreground group-hover:text-foreground'
          }`}
        />
        {item.name}
      </div>
      {isActive && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
    </Link>
  );
}

/**
 * Feature-gated nav item. We split this into its own component so the
 * `useFeatureGate` hook is only called for items that actually need it
 * (one subscription fetch instead of one per item).
 */
function NavLinkGated({
  item,
  isActive,
  Icon,
}: {
  item: NavItem;
  isActive: boolean;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  const { hasAccess, isLoading } = useFeatureGate(item.requiresFeature!);

  // While the subscription tier is loading, render the item as a normal
  // link — avoids a flash of “locked” state for paying users.
  if (isLoading || hasAccess) {
    return (
      <Link
        href={item.href}
        className={`group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'bg-primary/5 text-primary shadow-sm'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon
            className={`h-5 w-5 transition-colors ${
              isActive
                ? 'text-primary'
                : 'text-muted-foreground group-hover:text-foreground'
            }`}
          />
          {item.name}
        </div>
        {isActive && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
      </Link>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* The wrapping span is required — Radix Tooltip needs a focusable
            target, but disabled <a> tags can't receive focus. */}
        <span
          aria-disabled="true"
          tabIndex={0}
          className="group flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground/60 opacity-60 transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-muted-foreground/60" />
            {item.name}
          </div>
          <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <p className="font-medium">Upgrade jetzt zu Premium</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {item.name} ist nur für Premium-Mitglieder verfügbar.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

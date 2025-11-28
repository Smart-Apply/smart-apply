'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  FileText,
  Briefcase,
  User,
  LogOut,
  Menu,
  Home,
  Settings,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Profil', href: '/profile', icon: User },
  { name: 'Bewerbungen', href: '/applications', icon: FileText },
  { name: 'Stellenanzeigen', href: '/jobs', icon: Briefcase },
  { name: 'Einstellungen', href: '/settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, clearAuth, hasHydrated } = useAuthStore();

  // Auto-collapse sidebar in edit mode
  const isEditMode = pathname?.includes('/edit');

  useEffect(() => {
    // Wait for auth store to hydrate from localStorage before checking auth
    if (!hasHydrated) return;

    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, hasHydrated, router]);

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

  // Show loading while hydrating or if not authenticated (redirect pending)
  if (!hasHydrated || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop Sidebar - Hidden in edit mode */}
      {!isEditMode && (
        <aside className="hidden w-64 border-r border-sidebar-border bg-sidebar md:block text-sidebar-foreground">
          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center border-b border-sidebar-border px-6">
              <h1 className="text-xl font-bold text-primary">Smart Apply</h1>
            </div>

            <nav className="flex-1 space-y-1 px-3 py-4">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                      }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-sidebar-border p-4">
              <div className="mb-3 flex items-center gap-3 px-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-sm font-semibold text-sidebar-accent-foreground">
                  {(user?.firstName || user?.email)?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 truncate">
                  <p className="truncate text-sm font-medium">
                    {user?.firstName && user?.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user?.firstName || user?.email}
                  </p>
                  <p className="truncate text-xs text-sidebar-foreground/70">{user?.email}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Abmelden
              </Button>
            </div>
          </div>
        </aside>
      )}

      {/* Mobile Header */}
      <div className="flex flex-1 flex-col md:hidden">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background px-4">
          <h1 className="text-lg font-bold text-primary">Smart Apply</h1>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border text-sidebar-foreground">
              <div className="flex h-full flex-col">
                <div className="flex h-16 items-center border-b border-sidebar-border px-6">
                  <h1 className="text-xl font-bold text-primary">Smart Apply</h1>
                </div>

                <nav className="flex-1 space-y-1 px-3 py-4">
                  {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                          }`}
                      >
                        <Icon className="h-5 w-5" />
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>

                <div className="border-t border-sidebar-border p-4">
                  <div className="mb-3 flex items-center gap-3 px-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-sm font-semibold text-sidebar-accent-foreground">
                      {(user?.firstName || user?.email)?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 truncate">
                      <p className="truncate text-sm font-medium">
                        {user?.firstName && user?.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user?.firstName || user?.email}
                      </p>
                      <p className="truncate text-xs text-sidebar-foreground/70">{user?.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Abmelden
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </header>
        <main className="flex-1 p-4">{children}</main>
      </div>

      {/* Desktop Main Content */}
      <main className="hidden flex-1 md:block">
        <div className="mx-auto max-w-7xl p-6">{children}</div>
      </main>
    </div>
  );
}

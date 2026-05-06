'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Shield, Bell, Palette, Trash2, ChevronRight, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { UserPreferences } from '@/types';
import { ApiError } from '@/lib/errors';
import { TwoFactorStatusCard } from '@/components/two-factor';
import { PremiumSupportCard } from '@/components/subscription/premium-support-card';
import { EmailTrackingSection } from '@/components/settings/email-tracking-section';

export default function SettingsPage() {
  const router = useRouter();
  const { user, clearAuth, updateUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Form states
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email] = useState(user?.email || '');
  
  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  // User preferences
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);

  // Load user preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const data = await api.userPreferences.get();
        setPreferences(data);
      } catch (error) {
        console.error('Failed to load preferences:', error);
        toast.error('Fehler beim Laden der Einstellungen');
      } finally {
        setIsLoadingPreferences(false);
      }
    };
    loadPreferences();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const updatedUser = await api.auth.updateProfile({ firstName, lastName });
      updateUser({ firstName: updatedUser.firstName, lastName: updatedUser.lastName });
      toast.success('Profil erfolgreich aktualisiert');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message || 'Fehler beim Aktualisieren des Profils');
      } else {
        toast.error('Fehler beim Aktualisieren des Profils');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('Passwörter stimmen nicht überein');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }

    setIsLoading(true);

    try {
      await api.auth.changePassword({ currentPassword, newPassword });
      toast.success('Passwort erfolgreich geändert. Bitte melden Sie sich erneut an.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Password change invalidates sessions, redirect to login
      clearAuth();
      router.push('/login');
    } catch (error) {
      if (error instanceof ApiError) {
        const message = error.data?.message || error.message || 'Fehler beim Ändern des Passworts';
        toast.error(Array.isArray(message) ? message[0] : message);
      } else {
        toast.error('Fehler beim Ändern des Passworts');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      toast.error('Bitte geben Sie Ihr Passwort ein');
      return;
    }

    setIsDeleting(true);

    try {
      await api.auth.deleteAccount({ password: deletePassword });
      toast.success('Account wurde gelöscht');
      clearAuth();
      router.push('/');
    } catch (error) {
      if (error instanceof ApiError) {
        const message = error.data?.message || error.message || 'Fehler beim Löschen des Accounts';
        toast.error(Array.isArray(message) ? message[0] : message);
      } else {
        toast.error('Fehler beim Löschen des Accounts');
      }
    } finally {
      setIsDeleting(false);
      setDeletePassword('');
    }
  };

  const handleUpdatePreference = async (key: keyof UserPreferences, value: boolean | string) => {
    if (!preferences) return;

    try {
      const updatedPreferences = await api.userPreferences.update({ [key]: value });
      setPreferences(updatedPreferences);
      toast.success('Einstellung gespeichert');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message || 'Fehler beim Speichern der Einstellung');
      } else {
        toast.error('Fehler beim Speichern der Einstellung');
      }
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Einstellungen</h1>
        <p className="text-muted-foreground">
          Verwalte deine Account-Einstellungen und Präferenzen
        </p>
      </div>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="account" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Account</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Sicherheit</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Benachrichtigungen</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Präferenzen</span>
          </TabsTrigger>
        </TabsList>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profil-Informationen</CardTitle>
              <CardDescription>
                Aktualisiere deine persönlichen Informationen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Vorname</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Max"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nachname</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Mustermann"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail-Adresse</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    E-Mail-Adresse kann nicht geändert werden
                  </p>
                </div>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Wird gespeichert...' : 'Änderungen speichern'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Account löschen</CardTitle>
              <CardDescription>
                Lösche deinen Account und alle zugehörigen Daten permanent
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Account löschen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Bist du dir sicher?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Diese Aktion kann nicht rückgängig gemacht werden. Alle deine Daten,
                      einschließlich Profil, Bewerbungen und Stellenanzeigen werden permanent gelöscht.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="py-4">
                    <Label htmlFor="deletePassword">Passwort zur Bestätigung</Label>
                    <Input
                      id="deletePassword"
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="••••••••"
                      className="mt-2"
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDeletePassword('')}>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={isDeleting || !deletePassword}
                    >
                      {isDeleting ? 'Wird gelöscht...' : 'Account löschen'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          <PremiumSupportCard />
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Passwort ändern</CardTitle>
              <CardDescription>
                Aktualisiere dein Passwort regelmäßig für mehr Sicherheit
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Aktuelles Passwort</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Neues Passwort</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Wird geändert...' : 'Passwort ändern'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <TwoFactorStatusCard />

          <Card>
            <CardHeader>
              <CardTitle>Aktive Sitzungen</CardTitle>
              <CardDescription>
                Verwalte deine aktiven Sitzungen auf verschiedenen Geräten
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/settings/sessions">
                <Button variant="outline" className="w-full justify-between">
                  Sitzungen verwalten
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>E-Mail-Benachrichtigungen</CardTitle>
              <CardDescription>
                Wähle aus, welche E-Mails du erhalten möchtest
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingPreferences ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Bewerbungs-Updates</Label>
                      <p className="text-sm text-muted-foreground">
                        Erhalte Updates zu deinen Bewerbungen
                      </p>
                    </div>
                    <Button
                      variant={preferences?.applicationUpdates ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleUpdatePreference('applicationUpdates', !preferences?.applicationUpdates)}
                    >
                      {preferences?.applicationUpdates ? 'Aktiviert' : 'Deaktiviert'}
                    </Button>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Neue Stellenanzeigen</Label>
                      <p className="text-sm text-muted-foreground">
                        Erhalte Benachrichtigungen über neue Stellenanzeigen
                      </p>
                    </div>
                    <Button
                      variant={preferences?.newJobPostings ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleUpdatePreference('newJobPostings', !preferences?.newJobPostings)}
                    >
                      {preferences?.newJobPostings ? 'Aktiviert' : 'Deaktiviert'}
                    </Button>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Marketing-E-Mails</Label>
                      <p className="text-sm text-muted-foreground">
                        Erhalte Newsletter und Produktupdates
                      </p>
                    </div>
                    <Button
                      variant={preferences?.marketingEmails ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleUpdatePreference('marketingEmails', !preferences?.marketingEmails)}
                    >
                      {preferences?.marketingEmails ? 'Aktiviert' : 'Deaktiviert'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Email Tracking (Premium feature) — OAuth inbox sync. Lives
              under "Benachrichtigungen" instead of getting its own tab. */}
          <EmailTrackingSection
            preferences={preferences}
            onTogglePreference={(key, value) => handleUpdatePreference(key, value)}
            isLoadingPreferences={isLoadingPreferences}
          />
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sprache & Region</CardTitle>
              <CardDescription>
                Wähle deine bevorzugte Sprache und Region
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingPreferences ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="language">Sprache</Label>
                  <Select
                    value={preferences?.language || 'de'}
                    onValueChange={(value) => handleUpdatePreference('language', value)}
                  >
                    <SelectTrigger id="language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Design</CardTitle>
              <CardDescription>
                Passe das Erscheinungsbild der Anwendung an
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingPreferences ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select
                    value={preferences?.theme || 'system'}
                    onValueChange={(value) => handleUpdatePreference('theme', value)}
                  >
                    <SelectTrigger id="theme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Hell</SelectItem>
                      <SelectItem value="dark">Dunkel</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Datenschutz</CardTitle>
              <CardDescription>
                Verwalte deine Datenschutz-Einstellungen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingPreferences ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Profil öffentlich</Label>
                      <p className="text-sm text-muted-foreground">
                        Dein Profil kann von anderen gesehen werden
                      </p>
                    </div>
                    <Button
                      variant={preferences?.profilePublic ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleUpdatePreference('profilePublic', !preferences?.profilePublic)}
                    >
                      {preferences?.profilePublic ? 'Aktiviert' : 'Deaktiviert'}
                    </Button>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Analyse-Daten</Label>
                      <p className="text-sm text-muted-foreground">
                        Hilf uns, die App zu verbessern
                      </p>
                    </div>
                    <Button
                      variant={preferences?.analyticsEnabled ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleUpdatePreference('analyticsEnabled', !preferences?.analyticsEnabled)}
                    >
                      {preferences?.analyticsEnabled ? 'Aktiviert' : 'Deaktiviert'}
                    </Button>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label>Meine Daten exportieren</Label>
                      <p className="text-sm text-muted-foreground">
                        Lade alle deine bei uns gespeicherten Daten als JSON-Datei herunter (DSGVO Art. 15 / 20).
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isExporting}
                      onClick={async () => {
                        setIsExporting(true);
                        try {
                          await api.auth.exportData();
                          toast.success('Datenexport heruntergeladen');
                        } catch {
                          toast.error('Datenexport fehlgeschlagen. Bitte versuche es erneut.');
                        } finally {
                          setIsExporting(false);
                        }
                      }}
                    >
                      {isExporting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Wird vorbereitet...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Herunterladen
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

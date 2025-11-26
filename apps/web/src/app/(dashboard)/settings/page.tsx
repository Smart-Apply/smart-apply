'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Shield, Bell, Palette, Trash2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth-store';
import { usePreferences } from '@/hooks/use-preferences';
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

export default function SettingsPage() {
  const router = useRouter();
  const { user, clearAuth, updateUser } = useAuthStore();
  const { preferences, isLoading: prefsLoading, updatePreferences, isUpdating } = usePreferences();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form states
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email] = useState(user?.email || '');
  
  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await api.auth.updateProfile({ firstName, lastName });
      updateUser(response.user);
      toast.success('Profil erfolgreich aktualisiert');
    } catch (error) {
      console.error('Profile update error:', error);
      const errorMessage = (error as Error)?.message || 'Fehler beim Aktualisieren des Profils';
      toast.error(errorMessage);
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
      const response = await api.auth.changePassword({
        currentPassword,
        newPassword,
      });
      toast.success(response.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // User has been logged out from all devices, redirect to login
      clearAuth();
      router.push('/login');
    } catch (error) {
      const errorMessage = (error as Error)?.message || 'Fehler beim Ändern des Passworts';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);

    try {
      await api.auth.deleteAccount();
      toast.success('Account wurde gelöscht');
      clearAuth();
      router.push('/');
    } catch (error) {
      const errorMessage = (error as Error)?.message || 'Fehler beim Löschen des Accounts';
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
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
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Wird gelöscht...' : 'Account löschen'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
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
              {prefsLoading ? (
                <p className="text-sm text-muted-foreground">Laden...</p>
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
                      disabled={isUpdating}
                      onClick={() => {
                        updatePreferences({ applicationUpdates: !preferences?.applicationUpdates });
                        toast.success('Einstellung aktualisiert');
                      }}
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
                      disabled={isUpdating}
                      onClick={() => {
                        updatePreferences({ newJobPostings: !preferences?.newJobPostings });
                        toast.success('Einstellung aktualisiert');
                      }}
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
                      disabled={isUpdating}
                      onClick={() => {
                        updatePreferences({ marketingEmails: !preferences?.marketingEmails });
                        toast.success('Einstellung aktualisiert');
                      }}
                    >
                      {preferences?.marketingEmails ? 'Aktiviert' : 'Deaktiviert'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6">
          {prefsLoading ? (
            <Card>
              <CardContent className="py-6">
                <p className="text-sm text-muted-foreground text-center">Laden...</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Sprache & Region</CardTitle>
                  <CardDescription>
                    Wähle deine bevorzugte Sprache und Region
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="language">Sprache</Label>
                    <Select 
                      value={preferences?.language || 'de'} 
                      onValueChange={(value) => {
                        updatePreferences({ language: value });
                        toast.success('Sprache aktualisiert');
                      }}
                      disabled={isUpdating}
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
                  <div className="space-y-2">
                    <Label htmlFor="theme">Theme</Label>
                    <Select 
                      value={preferences?.theme || 'system'} 
                      onValueChange={(value) => {
                        updatePreferences({ theme: value });
                        toast.success('Theme aktualisiert');
                      }}
                      disabled={isUpdating}
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
                      disabled={isUpdating}
                      onClick={() => {
                        updatePreferences({ profilePublic: !preferences?.profilePublic });
                        toast.success('Einstellung aktualisiert');
                      }}
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
                      disabled={isUpdating}
                      onClick={() => {
                        updatePreferences({ analyticsEnabled: !preferences?.analyticsEnabled });
                        toast.success('Einstellung aktualisiert');
                      }}
                    >
                      {preferences?.analyticsEnabled ? 'Aktiviert' : 'Deaktiviert'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

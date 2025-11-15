'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useApplications } from '@/hooks/use-applications';
import { useProfile } from '@/hooks/use-profile';
import { FileText, Briefcase, User, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: applications, isLoading: applicationsLoading } = useApplications();

  const stats = [
    {
      name: 'Bewerbungen',
      value: applications?.length || 0,
      icon: FileText,
      href: '/applications',
    },
    {
      name: 'Profil vollständig',
      value: profile ? '100%' : '0%',
      icon: User,
      href: '/profile',
    },
    {
      name: 'Aktive Jobs',
      value: 0,
      icon: Briefcase,
      href: '/jobs',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-gray-500">
            Willkommen zurück! Hier ist eine Übersicht deiner Bewerbungen.
          </p>
        </div>
        <Button onClick={() => router.push('/applications/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Neue Bewerbung
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.name}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.name}
                </CardTitle>
                <Icon className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <button
                  onClick={() => router.push(stat.href)}
                  className="mt-1 text-xs text-blue-600 hover:underline"
                >
                  Details anzeigen
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Applications */}
      <Card>
        <CardHeader>
          <CardTitle>Letzte Bewerbungen</CardTitle>
          <CardDescription>
            Deine zuletzt erstellten Bewerbungen
          </CardDescription>
        </CardHeader>
        <CardContent>
          {applicationsLoading ? (
            <div className="text-center text-gray-500">Lädt...</div>
          ) : applications && applications.length > 0 ? (
            <div className="space-y-3">
              {applications.slice(0, 5).map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <p className="font-medium">Bewerbung #{app.id}</p>
                    <p className="text-sm text-gray-500">
                      Status: {app.status}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => router.push(`/applications/${app.id}`)}>
                    Details
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500">
              <p>Noch keine Bewerbungen erstellt.</p>
              <Button className="mt-4" variant="outline" onClick={() => router.push('/applications/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Erste Bewerbung erstellen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Completion */}
      {!profileLoading && !profile?.summary && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">
              Vervollständige dein Profil
            </CardTitle>
            <CardDescription className="text-blue-700">
              Ein vollständiges Profil hilft uns, bessere Bewerbungen für dich zu
              erstellen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="default" onClick={() => router.push('/profile')}>
              <User className="mr-2 h-4 w-4" />
              Profil bearbeiten
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

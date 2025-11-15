'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  FullPageLoader,
  CenteredLoader,
  InlineLoader,
} from '@/components/shared/loading';
import {
  ProfileSkeleton,
  ProfileCardSkeleton,
  JobPostingCardSkeleton,
  ApplicationCardSkeleton,
  FormFieldSkeleton,
  TableSkeleton,
  AvatarSkeleton,
  ButtonSkeleton,
  TextSkeleton,
  ImageSkeleton,
} from '@/components/shared/skeletons';
import { Download, Save, Send } from 'lucide-react';

export default function DemoLoadingPage() {
  const [showFullPageLoader, setShowFullPageLoader] = useState(false);
  const [buttonLoading, setButtonLoading] = useState({
    default: false,
    outline: false,
    destructive: false,
  });

  const simulateLoading = (key: keyof typeof buttonLoading) => {
    setButtonLoading((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setButtonLoading((prev) => ({ ...prev, [key]: false }));
    }, 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Loading Components Demo</h1>
        <p className="mt-1 text-gray-500">
          Showcase of all loading states and skeleton components
        </p>
      </div>

      {/* Spinner Variants */}
      <Card>
        <CardHeader>
          <CardTitle>Spinner Component</CardTitle>
          <CardDescription>Available in multiple sizes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <Spinner size="sm" />
              <p className="mt-2 text-xs text-gray-500">Small</p>
            </div>
            <div className="text-center">
              <Spinner size="default" />
              <p className="mt-2 text-xs text-gray-500">Default</p>
            </div>
            <div className="text-center">
              <Spinner size="lg" />
              <p className="mt-2 text-xs text-gray-500">Large</p>
            </div>
            <div className="text-center">
              <Spinner size="xl" />
              <p className="mt-2 text-xs text-gray-500">Extra Large</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading Wrappers */}
      <Card>
        <CardHeader>
          <CardTitle>Loading Wrappers</CardTitle>
          <CardDescription>Pre-built loading states for common patterns</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-medium mb-3">Centered Loader</h4>
            <div className="border rounded-lg">
              <CenteredLoader message="Loading data..." />
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-3">Inline Loader</h4>
            <div className="space-y-2">
              <InlineLoader message="Processing..." size="sm" />
              <InlineLoader message="Loading content..." />
              <InlineLoader message="Generating report..." size="lg" />
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-3">Full Page Loader</h4>
            <Button onClick={() => setShowFullPageLoader(true)}>
              Show Full Page Loader
            </Button>
            {showFullPageLoader && (
              <FullPageLoader message="Loading application..." />
            )}
            {showFullPageLoader && (
              <Button
                variant="outline"
                onClick={() => setShowFullPageLoader(false)}
                className="ml-2"
              >
                Hide
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Button Loading States */}
      <Card>
        <CardHeader>
          <CardTitle>Button Loading States</CardTitle>
          <CardDescription>Buttons with integrated loading spinners</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              loading={buttonLoading.default}
              onClick={() => simulateLoading('default')}
            >
              <Download className="mr-2 h-4 w-4" />
              Default Button
            </Button>
            <Button
              variant="outline"
              loading={buttonLoading.outline}
              onClick={() => simulateLoading('outline')}
            >
              <Save className="mr-2 h-4 w-4" />
              Outline Button
            </Button>
            <Button
              variant="destructive"
              loading={buttonLoading.destructive}
              onClick={() => simulateLoading('destructive')}
            >
              <Send className="mr-2 h-4 w-4" />
              Destructive Button
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Basic Skeleton */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Skeleton</CardTitle>
          <CardDescription>Simple skeleton shapes with pulse animation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </CardContent>
      </Card>

      {/* Specialized Skeletons */}
      <Card>
        <CardHeader>
          <CardTitle>Specialized Skeletons</CardTitle>
          <CardDescription>Pre-built skeletons for common content types</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-medium mb-3">Application Card Skeleton</h4>
            <ApplicationCardSkeleton />
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-3">Job Posting Card Skeleton</h4>
            <JobPostingCardSkeleton />
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-3">Profile Card Skeleton</h4>
            <ProfileCardSkeleton />
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-3">Form Field Skeleton</h4>
            <div className="space-y-4 max-w-md">
              <FormFieldSkeleton />
              <FormFieldSkeleton />
              <FormFieldSkeleton />
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-3">Text Skeleton</h4>
            <TextSkeleton lines={4} />
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-3">Table Skeleton</h4>
            <TableSkeleton rows={3} columns={4} />
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-3">Avatar & Button Skeletons</h4>
            <div className="flex items-center gap-4">
              <AvatarSkeleton />
              <AvatarSkeleton className="h-12 w-12" />
              <AvatarSkeleton className="h-16 w-16" />
            </div>
            <div className="flex gap-2 mt-4">
              <ButtonSkeleton />
              <ButtonSkeleton className="w-32" />
              <ButtonSkeleton className="w-40" />
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-3">Image Skeleton</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <ImageSkeleton aspectRatio="square" className="max-w-[200px]" />
                <p className="text-xs text-gray-500 mt-2 text-center">Square</p>
              </div>
              <div>
                <ImageSkeleton aspectRatio="video" className="max-w-[200px]" />
                <p className="text-xs text-gray-500 mt-2 text-center">Video (16:9)</p>
              </div>
              <div>
                <ImageSkeleton aspectRatio="portrait" className="max-w-[200px]" />
                <p className="text-xs text-gray-500 mt-2 text-center">Portrait (3:4)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Complete Profile Skeleton */}
      <Card>
        <CardHeader>
          <CardTitle>Complete Profile Skeleton</CardTitle>
          <CardDescription>Full profile page loading state</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg p-4 bg-gray-50">
            <ProfileSkeleton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import Image from 'next/image';
import type { Template } from '@/types';

interface TemplateCardProps {
  template: Template;
  isSelected: boolean;
  onSelect: (templateId: string) => void;
}

export function TemplateCard({ template, isSelected, onSelect }: TemplateCardProps) {
  return (
    <Card 
      className={`relative cursor-pointer transition-all hover:shadow-lg ${
        isSelected ? 'ring-2 ring-blue-500 shadow-lg' : ''
      }`}
      onClick={() => onSelect(template.id)}
    >
      {isSelected && (
        <div className="absolute -top-2 -right-2 z-10">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg">
            <Check className="h-5 w-5" />
          </div>
        </div>
      )}
      
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">{template.name}</CardTitle>
          {template.isDefault && (
            <Badge variant="secondary" className="shrink-0">
              Standard
            </Badge>
          )}
        </div>
        <CardDescription className="line-clamp-2">
          {template.description || 'Keine Beschreibung verfügbar'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Template Preview/Thumbnail - Real PDF Preview */}
        <div className={`relative aspect-[8.5/11] rounded-lg border-2 overflow-hidden transition-all bg-gray-100 ${
          isSelected 
            ? 'border-blue-500 ring-2 ring-blue-200' 
            : 'border-gray-200 hover:border-gray-300'
        }`}>
          {/* Real Template Preview Image */}
          <Image
            src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3000'}/api/v1/templates/${template.id}/preview`}
            alt={`${template.name} Preview`}
            fill
            className="object-cover"
            unoptimized
          />
          
          {/* Category Label Overlay */}
          <div className="absolute bottom-2 right-2 z-10">
            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 shadow-sm backdrop-blur-sm bg-white/90">
              {template.category}
            </Badge>
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          variant={isSelected ? 'default' : 'outline'}
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(template.id);
          }}
        >
          {isSelected ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Ausgewählt
            </>
          ) : (
            'Auswählen'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

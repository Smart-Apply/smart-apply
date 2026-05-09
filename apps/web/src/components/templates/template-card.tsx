'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import Image from 'next/image';
import type { Template } from '@/types';

interface ColorVariant {
  id: string;
  accentColor: string;
  colorVariantName: string;
}

interface TemplateCardProps {
  template: Template;
  isSelected: boolean;
  onSelect: (templateId: string) => void;
  colorVariants?: ColorVariant[];  // All color variants of this template
  selectedVariantId?: string;      // Currently selected variant ID
}

export function TemplateCard({ 
  template, 
  isSelected, 
  onSelect, 
  colorVariants = [],
  selectedVariantId,
}: TemplateCardProps) {
  // Determine which template ID to use for preview (selected variant or base template)
  const displayTemplateId = selectedVariantId || template.id;

  return (
    <Card 
      className={`relative cursor-pointer transition-all hover:shadow-lg ${
        isSelected ? 'ring-2 ring-blue-500 shadow-lg' : ''
      }`}
      onClick={() => onSelect(displayTemplateId)}
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
          {/* Real Template Preview Image - cache bust with templateId to ensure fresh load per variant */}
          <Image
            key={displayTemplateId}
            src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3000'}/api/v1/templates/${displayTemplateId}/preview?t=${displayTemplateId}`}
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

        {/* Color Swatches */}
        {colorVariants.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Farbe:</span>
            <div className="flex gap-1.5">
              {colorVariants.map((variant) => {
                const isVariantSelected = variant.id === selectedVariantId || 
                  (!selectedVariantId && variant.id === template.id);
                return (
                  <button
                    key={variant.id}
                    type="button"
                    title={variant.colorVariantName}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(variant.id);
                    }}
                    className={`h-5 w-5 rounded-full border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                      isVariantSelected 
                        ? 'border-blue-500 ring-2 ring-blue-200' 
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: variant.accentColor }}
                  />
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button
          variant={isSelected ? 'default' : 'outline'}
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(displayTemplateId);
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

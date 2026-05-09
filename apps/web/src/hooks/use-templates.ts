'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Template, TemplateType } from '@/types';

/**
 * Group templates by design (baseTemplateId or category), returning one per design.
 * Prefers the specified language, falls back to 'de', then 'en', then first available.
 */
export function groupTemplatesByDesign(
  templates: Template[] | undefined,
  preferredLanguage: string = 'de'
): Template[] {
  if (!templates || templates.length === 0) return [];

  // Group by baseTemplateId (if set) or category
  const grouped = new Map<string, Template[]>();
  
  for (const template of templates) {
    const groupKey = template.baseTemplateId || template.category;
    const group = grouped.get(groupKey) || [];
    group.push(template);
    grouped.set(groupKey, group);
  }

  // Select best template from each group based on language preference
  const result: Template[] = [];
  for (const group of grouped.values()) {
    const preferred = group.find((t) => t.language === preferredLanguage);
    const fallbackDe = group.find((t) => t.language === 'de');
    const fallbackEn = group.find((t) => t.language === 'en');
    result.push(preferred || fallbackDe || fallbackEn || group[0]);
  }

  return result;
}

/**
 * Hook to fetch all templates with optional type filter
 */
export function useTemplates(type?: TemplateType) {
  return useQuery({
    queryKey: ['templates', type],
    queryFn: () => api.templates.list(type),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch cover letter templates
 */
export function useCoverLetterTemplates() {
  return useTemplates('COVER_LETTER');
}

/**
 * Hook to fetch resume templates
 */
export function useResumeTemplates() {
  return useTemplates('RESUME');
}

/**
 * Hook to fetch a single template with content
 */
export function useTemplate(id: string) {
  return useQuery({
    queryKey: ['template', id],
    queryFn: () => api.templates.getById(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Helper function to get default template from a list
 */
export function getDefaultTemplate(templates: Template[] | undefined): Template | null {
  if (!templates || templates.length === 0) return null;
  return templates.find((t) => t.isDefault) || templates[0];
}

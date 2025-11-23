'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Template, TemplateType, TemplateWithContent } from '@/types';

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

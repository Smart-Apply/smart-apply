import { Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';

interface SubmitButtonProps extends ButtonProps {
  isLoading?: boolean;
  loadingText?: string;
}

/**
 * Reusable submit button component with loading state
 * 
 * @param isLoading - Whether the button should show loading state
 * @param loadingText - Text to show when loading (default: "Lädt...")
 * @param children - Button content when not loading
 * @param ...props - All other Button props (variant, size, className, etc.)
 * 
 * @example
 * ```tsx
 * const mutation = useCreateApplication();
 * 
 * <SubmitButton 
 *   isLoading={mutation.isPending}
 *   loadingText="Erstelle Bewerbung..."
 * >
 *   Bewerbung erstellen
 * </SubmitButton>
 * ```
 */
export function SubmitButton({ 
  isLoading, 
  loadingText = 'Lädt...', 
  children, 
  disabled,
  ...props 
}: SubmitButtonProps) {
  return (
    <Button disabled={isLoading || disabled} {...props}>
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {isLoading ? loadingText : children}
    </Button>
  );
}

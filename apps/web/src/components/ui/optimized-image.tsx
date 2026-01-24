import Image, { ImageProps } from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Optimized Image Component
 * Provides consistent image optimization settings across the app
 * Uses Next.js Image with best practices for performance
 */

interface OptimizedImageProps extends Omit<ImageProps, 'src'> {
  src: string;
  fallbackSrc?: string;
  aspectRatio?: 'square' | '16/9' | '4/3' | '3/2' | 'auto';
}

// Common blur placeholder for faster loading
const shimmer = (w: number, h: number) => `
<svg width="${w}" height="${h}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="g">
      <stop stop-color="#f6f7f8" offset="20%" />
      <stop stop-color="#edeef1" offset="50%" />
      <stop stop-color="#f6f7f8" offset="70%" />
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="#f6f7f8" />
  <rect id="r" width="${w}" height="${h}" fill="url(#g)" />
  <animate xlink:href="#r" attributeName="x" from="-${w}" to="${w}" dur="1s" repeatCount="indefinite"  />
</svg>`;

const toBase64 = (str: string) =>
  typeof window === 'undefined'
    ? Buffer.from(str).toString('base64')
    : window.btoa(str);

export function OptimizedImage({
  src,
  alt,
  className,
  aspectRatio = 'auto',
  fallbackSrc = '/Logo/favicon-icon.png',
  width,
  height,
  ...props
}: OptimizedImageProps) {
  const aspectRatioClasses = {
    'square': 'aspect-square',
    '16/9': 'aspect-video',
    '4/3': 'aspect-[4/3]',
    '3/2': 'aspect-[3/2]',
    'auto': '',
  };

  // Generate placeholder for blur effect
  const blurDataURL = `data:image/svg+xml;base64,${toBase64(shimmer(Number(width) || 700, Number(height) || 475))}`;

  return (
    <div className={cn('relative overflow-hidden', aspectRatioClasses[aspectRatio], className)}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        placeholder="blur"
        blurDataURL={blurDataURL}
        onError={(e) => {
          // Fallback to default image on error
          const target = e.target as HTMLImageElement;
          target.src = fallbackSrc;
        }}
        className={cn(
          'object-cover transition-opacity duration-300',
          aspectRatio !== 'auto' && 'absolute inset-0 h-full w-full'
        )}
        {...props}
      />
    </div>
  );
}

/**
 * Logo Component
 * Consistent logo rendering with proper optimization
 */
interface LogoProps {
  variant?: 'full' | 'icon' | 'medium';
  className?: string;
  inverted?: boolean;
  priority?: boolean;
}

const logoSources = {
  full: '/Logo/Logo without bg/Full_Logo-removebg-preview.png',
  icon: '/Logo/favicon-icon.png',
  medium: '/Logo/Medium Logo.png',
};

const logoSizes = {
  full: { width: 241, height: 247 },
  icon: { width: 192, height: 192 },
  medium: { width: 512, height: 512 },
};

export function Logo({ variant = 'full', className, inverted = false, priority = false }: LogoProps) {
  return (
    <Image
      src={logoSources[variant]}
      alt="Smart Apply Logo"
      width={logoSizes[variant].width}
      height={logoSizes[variant].height}
      className={cn(
        'h-auto',
        inverted && 'brightness-0 invert',
        className
      )}
      priority={priority}
    />
  );
}

/**
 * Avatar Image Component
 * For user profile images with placeholder
 */
interface AvatarImageProps {
  src?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const avatarSizes = {
  sm: 32,
  md: 40,
  lg: 64,
  xl: 96,
};

export function AvatarImage({ src, alt, size = 'md', className }: AvatarImageProps) {
  const dimension = avatarSizes[size];
  const initials = alt
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (!src) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-primary/10 text-primary font-medium',
          className
        )}
        style={{ width: dimension, height: dimension, fontSize: dimension * 0.4 }}
      >
        {initials}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={dimension}
      height={dimension}
      className={cn('rounded-full object-cover', className)}
    />
  );
}

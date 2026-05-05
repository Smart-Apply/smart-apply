'use client';

import { useEffect, useRef } from 'react';

/**
 * Cloudflare Turnstile widget (invisible/managed mode).
 *
 * Renders the official Cloudflare script directly via <script> + global
 * window.turnstile API — no npm wrapper. This keeps the bundle lean and
 * avoids version drift from third-party React wrappers.
 *
 * The widget calls back with a short-lived token (~5 min validity) which
 * the backend re-verifies via siteverify on form submit. We re-render
 * via `turnstile.reset()` whenever the parent form is resubmitted so the
 * one-shot token can't be replayed.
 *
 * Site-key precedence:
 *   1. Explicit `siteKey` prop (handy for tests/storybook)
 *   2. NEXT_PUBLIC_TURNSTILE_SITE_KEY (build-time env var)
 *
 * If neither is set, the component renders nothing and the parent flow
 * proceeds without a token. The backend's `CloudflareTurnstileService`
 * also no-ops when its secret is missing, so dev environments work.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'flexible' | 'compact';
          appearance?: 'always' | 'execute' | 'interaction-only';
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';
const SCRIPT_ID = 'cf-turnstile-script';

interface TurnstileWidgetProps {
  /** Called with the token whenever Turnstile produces (or refreshes) one. */
  onToken: (token: string | null) => void;
  /** Override the build-time site key (e.g. for tests). */
  siteKey?: string;
  /** Tailwind classes for the container div. */
  className?: string;
  /** "auto" follows OS preference; default is "auto". */
  theme?: 'light' | 'dark' | 'auto';
}

export function TurnstileWidget({
  onToken,
  siteKey,
  className,
  theme = 'auto',
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);

  // Keep the latest callback in a ref so the render effect doesn't have
  // to re-run (which would tear down + re-mount the widget on every
  // parent render).
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    const key = siteKey ?? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!key) {
      // No key configured — skip the widget entirely. Parent will submit
      // without a token and the backend will either accept (if also
      // unconfigured) or reject (if production has the secret set).
      return;
    }

    const containerEl = containerRef.current;
    if (!containerEl) return;

    const renderWidget = () => {
      if (!window.turnstile || !containerEl) return;
      try {
        widgetIdRef.current = window.turnstile.render(containerEl, {
          sitekey: key,
          callback: (token) => onTokenRef.current(token),
          'error-callback': () => onTokenRef.current(null),
          'expired-callback': () => onTokenRef.current(null),
          theme,
          // `always` keeps the widget visible at all times. We previously
          // used `interaction-only` (widget hidden until Cloudflare asks
          // for a challenge), but that broke registration on Firefox and
          // Safari users with Enhanced Tracking Protection / ITP enabled:
          // Cloudflare would require interaction, but the widget was
          // hidden so the user couldn't solve it. Token stayed `null`,
          // backend returned CAPTCHA_FAILED on submit, and the rate
          // limiter (incorrectly) burned through the user's budget.
          // Always-visible avoids the silent failure mode.
          appearance: 'always',
          size: 'flexible',
        });
      } catch (err) {
        // Cloudflare throws if the same container is rendered twice
        // (e.g. React strict-mode double-effect in dev). Safe to ignore
        // — the existing widget is still bound to the same callback.
        if (process.env.NODE_ENV === 'development') {
           
          console.warn('Turnstile render skipped:', err);
        }
      }
    };

    // If the script is already loaded, render immediately.
    if (window.turnstile) {
      renderWidget();
    } else if (!document.getElementById(SCRIPT_ID)) {
      // Otherwise inject the script tag and wait for the global onload.
      window.onTurnstileLoad = renderWidget;
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else {
      // Script tag already injected (by another component) but global
      // hasn't fired yet — replace the onload to also render this widget.
      const previousOnload = window.onTurnstileLoad;
      window.onTurnstileLoad = () => {
        previousOnload?.();
        renderWidget();
      };
    }

    return () => {
      // Clean up the widget on unmount so a fresh challenge is issued
      // next time the form is opened.
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Already removed — fine.
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, theme]);

  return <div ref={containerRef} className={className} />;
}

/**
 * Reset a Turnstile widget so the user can solve a fresh challenge.
 * Call this after a failed submit so the previously-consumed token
 * isn't reused (Cloudflare rejects duplicates with `timeout-or-duplicate`).
 *
 * Implementation note: we reset every Turnstile widget on the page since
 * we don't expose individual widget IDs. The current registration flow
 * only ever has one widget mounted at a time, so this is safe.
 */
export function resetTurnstile() {
  if (typeof window !== 'undefined' && window.turnstile) {
    try {
      window.turnstile.reset();
    } catch {
      // No widget mounted — nothing to do.
    }
  }
}

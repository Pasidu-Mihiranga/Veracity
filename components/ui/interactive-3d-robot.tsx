'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

const SPLINE_VIEWER_SRC =
  'https://unpkg.com/@splinetool/viewer@1.12.98/build/spline-viewer.js';

interface InteractiveRobotSplineProps {
  scene: string;
  className?: string;
}

function hideSplineLogo(host: HTMLElement | null) {
  if (!host?.shadowRoot) return false;
  const root = host.shadowRoot;

  // Persistent CSS inside shadow DOM — more reliable than one-off style sets
  if (!root.getElementById('hide-spline-brand')) {
    const style = document.createElement('style');
    style.id = 'hide-spline-brand';
    style.textContent = `
      #logo,
      #logo *,
      a[href*="spline.design"],
      a[href*="spline.design"] *,
      [class*="logo"],
      [part="logo"],
      .logo,
      .logo-container {
        display: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
        width: 0 !important;
        height: 0 !important;
        max-width: 0 !important;
        max-height: 0 !important;
        overflow: hidden !important;
        position: absolute !important;
        left: -9999px !important;
      }
    `;
    root.appendChild(style);
  }

  const candidates = root.querySelectorAll(
    '#logo, a[href*="spline.design"], [class*="logo"], [part="logo"]',
  );
  candidates.forEach((el) => {
    const node = el as HTMLElement;
    node.style.setProperty('display', 'none', 'important');
    node.style.setProperty('visibility', 'hidden', 'important');
    node.style.setProperty('opacity', '0', 'important');
    node.style.setProperty('pointer-events', 'none', 'important');
  });
  return candidates.length > 0;
}

/**
 * Spline Viewer web component — hides the “Built with Spline” badge.
 */
export function InteractiveRobotSpline({ scene, className }: InteractiveRobotSplineProps) {
  const [ready, setReady] = useState(false);
  const viewerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && customElements.get('spline-viewer')) {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    const host = viewerRef.current;
    if (!host) return;

    hideSplineLogo(host);

    const interval = window.setInterval(() => {
      if (hideSplineLogo(host)) {
        // keep trying briefly — badge mounts after scene load
      }
    }, 400);

    const stop = window.setTimeout(() => window.clearInterval(interval), 12000);

    const mo = new MutationObserver(() => hideSplineLogo(host));
    if (host.shadowRoot) {
      mo.observe(host.shadowRoot, { childList: true, subtree: true });
    }

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(stop);
      mo.disconnect();
    };
  }, [ready, scene]);

  return (
    <>
      <Script
        src={SPLINE_VIEWER_SRC}
        type="module"
        strategy="afterInteractive"
        onLoad={() => {
          if (typeof customElements !== 'undefined') {
            customElements.whenDefined('spline-viewer').then(() => setReady(true));
          } else {
            setReady(true);
          }
        }}
      />
      {ready ? (
        <spline-viewer
          ref={(el: HTMLElement | null) => {
            viewerRef.current = el;
          }}
          url={scene}
          className={className}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      ) : (
        <div className={`w-full h-full auth-robot-fallback ${className ?? ''}`} aria-hidden />
      )}
    </>
  );
}

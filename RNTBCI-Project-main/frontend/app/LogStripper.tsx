'use client';

import { useEffect } from 'react';

export function ProductionLogStripper() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      const noop = () => {};
      console.log = noop;
      console.info = noop;
      console.debug = noop;
      // Keep console.error and console.warn for tracking real issues
      const originalWarn = console.warn;
      console.warn = (...args) => {
        if (typeof args[0] === 'string' && (args[0].includes('THREE.Clock') || args[0].includes('WEBGL_lose_context'))) {
          return;
        }
        originalWarn(...args);
      };
    }
  }, []);

  return null;
}

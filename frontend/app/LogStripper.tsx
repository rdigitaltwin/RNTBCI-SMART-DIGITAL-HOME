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
    }
  }, []);

  return null;
}

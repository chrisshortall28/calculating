import { useEffect } from 'react';

/** Ask the browser not to evict our IndexedDB data under storage pressure. */
export function usePersistentStorage() {
  useEffect(() => {
    void navigator.storage?.persist?.();
  }, []);
}

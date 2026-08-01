import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library registers its own cleanup only when Vitest globals are
// enabled. This project runs with `globals: false` (explicit imports), so the
// hook is registered here instead — without it, DOM from one test leaks into
// the next and queries start matching duplicates.
afterEach(() => {
  cleanup();
});

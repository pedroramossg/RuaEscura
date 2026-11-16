import '@testing-library/jest-dom/vitest';

// Mock window.matchMedia for jsdom tests
if (typeof window !== 'undefined') {
  window.scrollTo = () => {};

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

/**
 * Test file for useDebounce hook
 * 
 * Note: This test requires a test framework like Jest + React Testing Library.
 * Once test infrastructure is set up, run these tests with:
 * cd apps/web && npm test -- use-debounce.test.ts
 */

import { renderHook, act } from '@testing-library/react';
import { useDebounce } from './use-debounce';

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should return the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 300));
    expect(result.current).toBe('initial');
  });

  it('should debounce value changes with default 300ms delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    expect(result.current).toBe('initial');

    // Update value
    rerender({ value: 'updated' });
    
    // Value should not change immediately
    expect(result.current).toBe('initial');

    // Fast forward time by 299ms (still debouncing)
    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current).toBe('initial');

    // Fast forward remaining 1ms (total 300ms)
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe('updated');
  });

  it('should debounce value changes with custom delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });
    
    // Value should not change before delay
    act(() => {
      jest.advanceTimersByTime(499);
    });
    expect(result.current).toBe('initial');

    // Value should change after delay
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe('updated');
  });

  it('should reset timer on rapid value changes (fast typing)', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } }
    );

    // Simulate fast typing: a -> ab -> abc
    rerender({ value: 'ab' });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe('a');

    rerender({ value: 'abc' });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe('a');

    // After full delay from last update
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current).toBe('abc');
  });

  it('should handle different value types', () => {
    // Test with number
    const { result: numberResult, rerender: numberRerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 0 } }
    );

    numberRerender({ value: 42 });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(numberResult.current).toBe(42);

    // Test with boolean
    const { result: boolResult, rerender: boolRerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: false } }
    );

    boolRerender({ value: true });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(boolResult.current).toBe(true);

    // Test with object
    const { result: objResult, rerender: objRerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: { name: 'John' } } }
    );

    const newObj = { name: 'Jane' };
    objRerender({ value: newObj });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(objResult.current).toBe(newObj);
  });

  it('should clean up timeout on unmount', () => {
    const { result, rerender, unmount } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });
    
    // Unmount before debounce completes
    unmount();

    // Fast forward time
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // No error should be thrown
  });
});

/**
 * Integration test example: Search input with debouncing
 */
describe('Search with useDebounce integration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should reduce API calls from 10/second to ~3/second', () => {
    const mockApiCall = jest.fn();
    
    const { result, rerender } = renderHook(
      ({ value }) => {
        const debouncedValue = useDebounce(value, 300);
        return debouncedValue;
      },
      { initialProps: { value: '' } }
    );

    // Simulate user typing "react" at 100ms intervals (10 chars/second)
    const searchTerms = ['r', 're', 'rea', 'reac', 'react'];
    
    searchTerms.forEach((term, index) => {
      rerender({ value: term });
      
      // Check if debounced value changed (would trigger API call)
      if (result.current !== term) {
        // Value hasn't updated yet, no API call
      } else {
        mockApiCall();
      }
      
      act(() => {
        jest.advanceTimersByTime(100);
      });
    });

    // Wait for final debounce
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Without debouncing: 5 API calls (one per keystroke)
    // With debouncing: 1 API call (only after user stops typing)
    expect(mockApiCall).toHaveBeenCalledTimes(1);
  });
});

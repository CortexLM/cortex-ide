import {
  createContext,
  useContext,
  ParentProps,
  createSignal,
  createMemo,
  onMount,
  Accessor,
  JSX,
  Setter,
} from "solid-js";

/**
 * LazyProvider utility for deferring context initialization until first access.
 * This reduces app startup time by not initializing heavy contexts that may not be needed immediately.
 * 
 * Usage:
 * ```tsx
 * const [LazySDKProvider, useLazySDK] = createLazyProvider(
 *   SDKProvider,
 *   () => useSDK(),
 *   createDefaultSDKState()
 * );
 * ```
 */

type ProviderComponent = (props: ParentProps) => JSX.Element;

interface LazyProviderState<T> {
  initialized: Accessor<boolean>;
  value: Accessor<T>;
  initialize: () => void;
}

/**
 * Creates a lazy-loading wrapper around an existing provider.
 * The inner provider is only mounted when `initialize()` is called or when the context is first accessed.
 */
export function createLazyProvider<T extends object>(
  Provider: ProviderComponent,
  useHook: () => T,
  defaultValue: T
): [ProviderComponent, () => T & { _lazyInitialize: () => void }] {
  const LazyContext = createContext<LazyProviderState<T>>();

  function LazyProvider(props: ParentProps): JSX.Element {
    const [initialized, setInitialized] = createSignal(false);
    const [innerValue, setInnerValue] = createSignal<T>(defaultValue);

    const initialize = () => {
      if (!initialized()) {
        setInitialized(true);
      }
    };

    const state: LazyProviderState<T> = {
      initialized,
      value: innerValue as Accessor<T>,
      initialize,
    };

    return (
      <LazyContext.Provider value={state}>
        {initialized() ? (
          <Provider>
            <InnerValueCapture 
              useHook={useHook} 
              onCapture={(v: T) => (setInnerValue as Setter<T>)(() => v)}
            >
              {props.children}
            </InnerValueCapture>
          </Provider>
        ) : (
          props.children
        )}
      </LazyContext.Provider>
    );
  }

  function useLazyHook(): T & { _lazyInitialize: () => void } {
    const ctx = useContext(LazyContext);
    if (!ctx) {
      throw new Error("useLazyHook must be used within LazyProvider");
    }

    // Auto-initialize on first access
    if (!ctx.initialized()) {
      ctx.initialize();
    }

    return {
      ...ctx.value(),
      _lazyInitialize: ctx.initialize,
    };
  }

  return [LazyProvider, useLazyHook];
}

/**
 * Helper component to capture the inner provider's value
 */
function InnerValueCapture<T>(props: {
  useHook: () => T;
  onCapture: (value: T) => void;
  children: JSX.Element;
}): JSX.Element {
  const value = props.useHook();
  
  onMount(() => {
    props.onCapture(value);
  });

  // Update whenever value changes
  createMemo(() => {
    props.onCapture(value);
  });

  return <>{props.children}</>;
}

/**
 * Creates a provider that defers heavy initialization (API calls, file reads) to onMount.
 * This allows the provider to render immediately while heavy work happens asynchronously.
 */
export function createDeferredInitProvider<TState, TContext>(
  createInitialState: () => TState,
  createContextValue: (
    state: TState,
    setState: (fn: (prev: TState) => TState) => void,
    initializeAsync: () => Promise<void>
  ) => TContext,
  performAsyncInit: (
    state: TState,
    setState: (fn: (prev: TState) => TState) => void
  ) => Promise<void>
): [ProviderComponent, () => TContext] {
  const Context = createContext<TContext>();

  function DeferredProvider(props: ParentProps): JSX.Element {
    const [state, setStateRaw] = createSignal<TState>(createInitialState());
    
    const setState = (fn: (prev: TState) => TState) => {
      setStateRaw(fn);
    };

    const initializeAsync = async () => {
      await performAsyncInit(state(), setState);
    };

    const contextValue = createContextValue(state(), setState, initializeAsync);

    // Defer async initialization to onMount
    onMount(() => {
      initializeAsync();
    });

    return (
      <Context.Provider value={contextValue}>
        {props.children}
      </Context.Provider>
    );
  }

  function useHook(): TContext {
    const ctx = useContext(Context);
    if (!ctx) {
      throw new Error("Hook must be used within provider");
    }
    return ctx;
  }

  return [DeferredProvider, useHook];
}

/**
 * Utility to batch multiple signal updates together.
 * SolidJS's batch() ensures all updates are processed in a single render cycle.
 */
export { batch } from "solid-js";

/**
 * Creates a selector function that only triggers updates when the selected value changes.
 * Useful for components that only need a small part of a larger context.
 */
export function createSelector<T, R>(
  source: Accessor<T>,
  selector: (value: T) => R,
  equals?: (a: R, b: R) => boolean
): Accessor<R> {
  return createMemo(() => selector(source()), undefined, {
    equals: equals ?? ((a, b) => a === b),
  });
}

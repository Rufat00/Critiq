'use client';

// Adapted from Appliance CRM's unsaved-guard.tsx for Critiq's dialog primitives.
import * as React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

export type UnsavedGuardOptions = {
  when: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
};
export type GuardNavigation = (
  proceed?: () => void | Promise<void>,
) => Promise<boolean>;
type GuardContext = {
  register: (id: string, options: UnsavedGuardOptions) => void;
  unregister: (id: string) => void;
  confirmLeave: (options: UnsavedGuardOptions) => Promise<boolean>;
};
const UnsavedGuardContext = React.createContext<GuardContext | null>(null);

export function useUnsavedGuard(options: UnsavedGuardOptions): GuardNavigation {
  const ctx = React.useContext(UnsavedGuardContext);
  if (!ctx) throw new Error('useUnsavedGuard requires UnsavedGuardProvider.');
  const id = React.useId();
  const latest = React.useRef(options);
  React.useLayoutEffect(() => {
    latest.current = options;
    ctx.register(id, options);
    return () => ctx.unregister(id);
  }, [
    ctx,
    id,
    options.when,
    options.title,
    options.description,
    options.confirmText,
    options.cancelText,
  ]);
  return React.useCallback(
    async (proceed) => {
      if (latest.current.when && !(await ctx.confirmLeave(latest.current)))
        return false;
      await proceed?.();
      return true;
    },
    [ctx],
  );
}

export function UnsavedGuardProvider({
  children,
  onProceed,
}: {
  children: React.ReactNode;
  onProceed?: (href: string) => void;
}) {
  const guards = React.useRef(new Map<string, UnsavedGuardOptions>());
  const activeRequest = React.useRef<{
    promise: Promise<boolean>;
    resolve: (value: boolean) => void;
  } | null>(null);
  const [prompt, setPrompt] = React.useState<UnsavedGuardOptions | null>(null);
  const register = React.useCallback(
    (id: string, options: UnsavedGuardOptions) => {
      guards.current.set(id, options);
    },
    [],
  );
  const unregister = React.useCallback((id: string) => {
    guards.current.delete(id);
  }, []);
  const confirmLeave = React.useCallback((options: UnsavedGuardOptions) => {
    if (activeRequest.current) return activeRequest.current.promise;
    let resolve!: (value: boolean) => void;
    const promise = new Promise<boolean>((done) => {
      resolve = done;
    });
    activeRequest.current = { promise, resolve };
    setPrompt(options);
    return promise;
  }, []);
  const settle = React.useCallback((leave: boolean) => {
    const request = activeRequest.current;
    activeRequest.current = null;
    setPrompt(null);
    request?.resolve(leave);
  }, []);
  React.useEffect(
    () => () => {
      activeRequest.current?.resolve(false);
    },
    [],
  );
  React.useEffect(() => {
    const activeGuard = () =>
      [...guards.current.values()].find((guard) => guard.when);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!activeGuard()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const click = (event: MouseEvent) => {
      const options = activeGuard();
      if (
        !options ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor =
        event.target instanceof Element ? event.target.closest('a') : null;
      if (
        !anchor ||
        (anchor.target && anchor.target !== '_self') ||
        anchor.hasAttribute('download')
      )
        return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      const url = new URL(anchor.href, window.location.href);
      if (
        url.origin !== window.location.origin ||
        url.href === window.location.href
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      void confirmLeave(options).then((leave) => {
        if (!leave) return;
        // Avoid a second native prompt after the user has already confirmed.
        guards.current.clear();
        if (onProceed) onProceed(url.href);
        else window.location.assign(url.href);
      });
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', click, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', click, true);
    };
  }, [confirmLeave, onProceed]);
  const value = React.useMemo(
    () => ({ register, unregister, confirmLeave }),
    [register, unregister, confirmLeave],
  );
  return (
    <UnsavedGuardContext.Provider value={value}>
      {children}
      <AlertDialog
        open={prompt !== null}
        onOpenChange={(open) => {
          if (!open) settle(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {prompt?.title ?? 'Discard unsaved changes?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {prompt?.description ??
                'Your changes haven’t been saved. Leaving will discard them.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>
              {prompt?.cancelText ?? 'Keep editing'}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => settle(true)}
            >
              {prompt?.confirmText ?? 'Discard changes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedGuardContext.Provider>
  );
}

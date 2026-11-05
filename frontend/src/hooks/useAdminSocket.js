import { useEffect, useRef, useSyncExternalStore } from 'react';
import { getSocket, initSocket } from '../services/socket';

/**
 * Subscribe to realtime events from the server for the lifetime of a component.
 * Only OUR handlers are removed on cleanup (the previous code removed every listener of an
 * event, which silently broke other components listening to the same event).
 *
 *   useAdminSocket({ 'screens:list': (list) => ..., 'event:new': (e) => ... });
 */
export function useAdminSocket(handlers) {
  const ref = useRef(handlers);
  // Keep the latest handlers available to the (stable) socket listeners
  useEffect(() => { ref.current = handlers; });

  useEffect(() => {
    const socket = getSocket() || initSocket('admin');
    const bound = Object.keys(ref.current).map((event) => {
      const fn = (...args) => ref.current[event]?.(...args);
      socket.on(event, fn);
      return [event, fn];
    });
    return () => bound.forEach(([event, fn]) => socket.off(event, fn));
    // The set of events is fixed for a component's lifetime; handlers are read through the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.keys(handlers).join('|')]);
}

/** Live "is the realtime connection up?" flag for the admin socket. */
export function useSocketConnected() {
  return useSyncExternalStore(
    (notify) => {
      const socket = getSocket() || initSocket('admin');
      socket.on('connect', notify);
      socket.on('disconnect', notify);
      socket.on('connect_error', notify);
      return () => {
        socket.off('connect', notify);
        socket.off('disconnect', notify);
        socket.off('connect_error', notify);
      };
    },
    () => Boolean(getSocket()?.connected)
  );
}

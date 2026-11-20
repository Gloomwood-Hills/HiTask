import { afterEach, describe, expect, it, vi } from 'vitest';
import { notifySyncDataApplied, subscribeSyncDataApplied } from '../dataEvents';

describe('sync view refresh', () => {
  let unsubscribe: (() => void) | undefined;
  afterEach(() => unsubscribe?.());
  it('notifies mounted views after remote data is applied and stops after unmount', () => {
    const refresh = vi.fn();
    unsubscribe = subscribeSyncDataApplied(refresh);
    notifySyncDataApplied();
    expect(refresh).toHaveBeenCalledOnce();
    unsubscribe();
    notifySyncDataApplied();
    expect(refresh).toHaveBeenCalledOnce();
  });
});

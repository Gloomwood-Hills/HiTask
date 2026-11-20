import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sync: vi.fn(), update: vi.fn(),
  settings: { autoSync: true, webdavUrl: 'https://example.test/dav', webdavUsername: 'user', webdavPassword: 'test', lastSyncedAt: null, syncPolicy: 'twoWay' },
}));
vi.mock('../../database', () => ({ getDatabase: async () => ({}) }));
vi.mock('../../../services/SettingsService', () => ({ SettingsService: class {
  getSettings = async () => mocks.settings;
  updateSettings = mocks.update;
} }));
vi.mock('../engine', () => ({ syncAuto: mocks.sync }));
vi.mock('../syncLog', () => ({ logSync: vi.fn() }));

describe('automatic sync scheduling', () => {
  let scheduler: typeof import('../scheduler');
  let ui: typeof import('../status');
  let windowEvents: EventTarget;
  let documentEvents: EventTarget;
  let values: Map<string, string>;
  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T10:00:00'));
    values = new Map();
    windowEvents = new EventTarget();
    documentEvents = new EventTarget();
    vi.stubGlobal('window', windowEvents);
    vi.stubGlobal('document', Object.assign(documentEvents, { hidden: false }));
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    mocks.sync.mockReset().mockResolvedValue({ status: 'skipped', message: '一致' });
    mocks.update.mockReset().mockResolvedValue(undefined);
    scheduler = await import('../scheduler');
    ui = await import('../status');
    scheduler.startAutoSync();
    await vi.advanceTimersByTimeAsync(0);
  });
  afterEach(() => {
    scheduler.stopAutoSync();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('checks another device changes every minute without user action', async () => {
    expect(mocks.sync).toHaveBeenCalledTimes(1);
    scheduler.startAutoSync();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.sync).toHaveBeenCalledTimes(2);
  });

  it('keeps an edit made during a running sync pending and follows up', async () => {
    let finish!: (value: unknown) => void;
    mocks.sync.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    scheduler.notifyDataChanged();
    await vi.advanceTimersByTimeAsync(3_000);
    scheduler.notifyDataChanged();
    finish({ status: 'merged', message: '成功' });
    await vi.advanceTimersByTimeAsync(0);
    expect(ui.getSyncUiState().kind).toBe('pending');
    expect(values.get('hitask-sync-pending')).toBe('1');
    await vi.advanceTimersByTimeAsync(3_000);
    expect(mocks.sync).toHaveBeenCalledTimes(3);
    expect(values.has('hitask-sync-pending')).toBe(false);
  });

  it('flushes a pending phone edit when entering the background', async () => {
    scheduler.notifyDataChanged();
    Object.assign(documentEvents, { hidden: true });
    documentEvents.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.sync).toHaveBeenCalledTimes(2);
  });

  it('backs off failures rather than retrying every three seconds', async () => {
    mocks.sync.mockResolvedValueOnce({ status: 'error', message: 'offline' });
    scheduler.notifyDataChanged();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(values.get('hitask-sync-pending')).toBe('1');
    await vi.advanceTimersByTimeAsync(14_999);
    expect(mocks.sync).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.sync).toHaveBeenCalledTimes(3);
  });

  it('bounds continuous editing by fifteen seconds', async () => {
    for (let i = 0; i < 7; i++) {
      scheduler.notifyDataChanged();
      await vi.advanceTimersByTimeAsync(2_000);
    }
    expect(mocks.sync).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(mocks.sync).toHaveBeenCalledTimes(2);
  });
});

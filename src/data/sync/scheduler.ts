/** 修改后 3 秒同步，持续编辑最多等待 15 秒；每分钟检查远端，失败逐步退避。 */
import { getDatabase } from '../database';
import { SettingsService } from '../../services/SettingsService';
import { syncAuto } from './engine';
import { logSync } from './syncLog';
import { setSyncUiState } from './status';

const DEBOUNCE_MS = 3_000;
const MAX_WAIT_MS = 15_000;
const INTERVAL_MS = 60_000;
const DIRTY_KEY = 'hitask-sync-pending';
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let syncing = false;
let started = false;
let autoSyncEnabled = true;
let pendingLocalChanges = false;
let firstChangeAt: number | null = null;
let retryAt = 0;
let failureCount = 0;
let rerunRequested = false;

function rememberPending(pending: boolean): void {
  pendingLocalChanges = pending;
  try {
    if (pending) localStorage.setItem(DIRTY_KEY, '1');
    else localStorage.removeItem(DIRTY_KEY);
  } catch { /* 启动仍会完整合并，存储不可用不影响本地任务。 */ }
}

export function configureAutoSync(enabled: boolean): void {
  const wasEnabled = autoSyncEnabled;
  autoSyncEnabled = enabled;
  if (enabled && !wasEnabled && started) requestSyncNow();
}

export function notifyDataChanged(): void {
  rememberPending(true);
  setSyncUiState({ kind: 'pending' });
  firstChangeAt ??= Date.now();
  if (!autoSyncEnabled || syncing || !started) return;
  scheduleSync(Math.max(0, Math.min(DEBOUNCE_MS, MAX_WAIT_MS - (Date.now() - firstChangeAt))));
}

function scheduleSync(delay: number): void {
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runSync('本地变更/补同步');
  }, Math.max(delay, retryAt - Date.now()));
}

function onResume(): void {
  // 手机切后台前立刻发起未上传修改，减少防抖尚未结束就被挂起的机会。
  if (!document.hidden || pendingLocalChanges) requestSyncNow();
}

export function startAutoSync(): void {
  if (started) return;
  started = true;
  try { pendingLocalChanges ||= localStorage.getItem(DIRTY_KEY) === '1'; } catch { /* 继续启动合并 */ }
  window.addEventListener('focus', onResume);
  window.addEventListener('online', requestSyncNow);
  document.addEventListener('visibilitychange', onResume);
  intervalId = setInterval(() => { void runSync('定时检查'); }, INTERVAL_MS);
  void runSync('启动');
}

export function stopAutoSync(): void {
  started = false;
  window.removeEventListener('focus', onResume);
  window.removeEventListener('online', requestSyncNow);
  document.removeEventListener('visibilitychange', onResume);
  if (intervalId !== null) clearInterval(intervalId);
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  intervalId = null;
  debounceTimer = null;
}

export function requestSyncNow(): void {
  if (!started || !autoSyncEnabled) return;
  if (syncing) { rerunRequested = true; return; }
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = null;
  retryAt = 0;
  void runSync('恢复前台/网络');
}

async function runSync(reason: string): Promise<void> {
  if (!started || syncing || !autoSyncEnabled || Date.now() < retryAt) return;
  syncing = true;
  let hadLocalChanges = false;
  let configured = false;
  try {
    const service = new SettingsService(await getDatabase());
    const settings = await service.getSettings();
    if (!settings?.autoSync || !settings.webdavUrl || !settings.webdavUsername || !settings.webdavPassword) {
      setSyncUiState(pendingLocalChanges ? { kind: 'pending' } : { kind: 'idle' });
      return;
    }
    configured = true;
    hadLocalChanges = pendingLocalChanges;
    // 当前轮成功后才清除存储标记；意外退出后仍会补传。
    pendingLocalChanges = false;
    firstChangeAt = null;
    setSyncUiState({ kind: 'syncing' });
    logSync('info', '自动同步', reason + (hadLocalChanges ? '，包含本地修改' : '，检查云端版本'));
    const result = await syncAuto(settings, settings.lastSyncedAt, settings.syncPolicy);
    if (result.status === 'error') throw new Error(result.message);
    failureCount = 0;
    retryAt = 0;
    if (result.status !== 'skipped') {
      await service.updateSettings({
        lastSyncedAt: Date.now(),
        lastSyncAction: result.status === 'uploaded' ? 'upload' : result.status === 'downloaded' ? 'download' : 'merged',
      });
    }
    rememberPending(pendingLocalChanges);
    logSync(result.status === 'skipped' ? 'info' : 'success', '自动同步', result.message);
    setSyncUiState(pendingLocalChanges ? { kind: 'pending' } : { kind: 'synced', at: Date.now() });
  } catch (error) {
    rememberPending(pendingLocalChanges || hadLocalChanges);
    failureCount++;
    const delay = Math.min(300_000, 15_000 * 2 ** Math.min(failureCount - 1, 5));
    retryAt = Date.now() + delay;
    const message = error instanceof Error ? error.message : String(error);
    logSync('error', '自动同步', message + '，' + delay / 1000 + ' 秒后重试');
    setSyncUiState({ kind: 'error', message });
  } finally {
    syncing = false;
    if (started && autoSyncEnabled && configured && (pendingLocalChanges || rerunRequested)) {
      rerunRequested = false;
      scheduleSync(DEBOUNCE_MS);
    }
  }
}

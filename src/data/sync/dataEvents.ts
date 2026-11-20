/** 云端写库后通知所有任务视图刷新；不触发本地修改上传。 */
const listeners = new Set<() => void>();

export function notifySyncDataApplied(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeSyncDataApplied(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

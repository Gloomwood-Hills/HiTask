import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('../syncLog', () => ({ logSync: vi.fn() }));
const settings = { webdavUrl: 'https://example.test/dav/', webdavUsername: 'user', webdavPassword: 'test' };
const response = (content: string, etag: string) => ({
  status: 200, exists: true, lastModified: null, etag,
  content: Array.from(new TextEncoder().encode(content)),
});

describe('conditional cloud downloads', () => {
  beforeEach(() => { vi.resetModules(); invoke.mockReset(); });

  it('reuses the server-validated snapshot on 304 and downloads remote edits', async () => {
    invoke.mockResolvedValueOnce(response('old snapshot', '"one"'))
      .mockResolvedValueOnce({ status: 304, exists: true, content: null })
      .mockResolvedValueOnce(response('phone completed a task', '"two"'));
    const { webdavFetch } = await import('../webdavClient');
    await webdavFetch(settings, 'backup.json');
    expect((await webdavFetch(settings, 'backup.json')).content).toBe('old snapshot');
    expect(invoke.mock.calls[1][1].ifNoneMatch).toBe('"one"');
    expect((await webdavFetch(settings, 'backup.json')).content).toBe('phone completed a task');
  });

  it('does not reuse versions across accounts and invalidates the cache before uploading', async () => {
    invoke.mockResolvedValueOnce(response('a', '"one"'))
      .mockResolvedValueOnce(response('b', '"two"'))
      .mockResolvedValueOnce({ status: 200 })
      .mockResolvedValueOnce(response('c', '"three"'));
    const { webdavFetch, webdavPut } = await import('../webdavClient');
    await webdavFetch(settings, 'backup.json');
    await webdavFetch({ ...settings, webdavUsername: 'other' }, 'backup.json');
    expect(invoke.mock.calls[1][1].ifNoneMatch).toBeNull();
    await webdavPut(settings, 'backup.json', 'new data');
    await webdavFetch(settings, 'backup.json');
    expect(invoke.mock.calls[3][1].ifNoneMatch).toBeNull();
  });

  it('does not misinterpret an uncached 304 as an empty remote file', async () => {
    invoke.mockResolvedValueOnce({ status: 304, exists: true, content: null });
    const { webdavFetch } = await import('../webdavClient');
    await expect(webdavFetch(settings, 'backup.json')).rejects.toThrow('没有快照缓存');
  });
});

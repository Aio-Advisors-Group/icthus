import { describe, expect, it, vi } from 'vitest';
import { YouVersionScriptureProvider } from './scripture';

describe('YouVersionScriptureProvider', () => {
  it('uses the documented app-key header and passage endpoint', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 3034,
            title: 'Berean Standard Bible',
            abbreviation: 'BSB',
            copyright: 'Public domain',
            youversion_deep_link: 'https://www.bible.com/versions/3034',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'PHP.4.6-PHP.4.7',
            reference: 'Philippians 4:6-7',
            content: 'Do not be anxious about anything.',
          }),
          { status: 200 },
        ),
      );
    const provider = new YouVersionScriptureProvider({
      apiBaseUrl: 'https://api.youversion.com',
      appKey: 'test-app-key',
      versionId: '3034',
      fetchImpl,
    });

    const passage = await provider.getBySourceId('web:philippians-4-6');

    expect(passage).toMatchObject({
      text: 'Do not be anxious about anything.',
      provider: 'youversion',
      providerState: 'live',
      translation: { id: '3034', abbreviation: 'BSB' },
    });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.youversion.com/v1/bibles/3034');
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toEqual({ 'X-YVP-App-Key': 'test-app-key' });
    expect(fetchImpl.mock.calls[1]?.[0]).toContain('/v1/bibles/3034/passages/PHP.4.6-PHP.4.7');
  });

  it('returns null for an unknown local source id without calling YouVersion', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const provider = new YouVersionScriptureProvider({
      apiBaseUrl: 'https://api.youversion.com',
      appKey: 'test-app-key',
      versionId: '3034',
      fetchImpl,
    });
    await expect(provider.getBySourceId('unknown:source')).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

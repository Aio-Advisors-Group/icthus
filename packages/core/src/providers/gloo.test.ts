import { describe, expect, it, vi } from 'vitest';
import { GlooStudioProvider } from './gloo';

const request = {
  passageReference: 'Philippians 4:6',
  passageText: 'In nothing be anxious.',
  translationAbbreviation: 'WEB',
  inputSummary: 'Today’s capture: “I feel anxious.”',
  themes: ['anxiety'],
  question: 'How might this passage speak to anxiety?',
};

describe('GlooStudioProvider', () => {
  it('uses the documented OAuth and Completions V2 request shape', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token-1', expires_in: 3600 }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            model: 'gloo-openai-gpt-5-mini',
            choices: [{ message: { content: 'A grounded response.' } }],
          }),
          { status: 200 },
        ),
      );
    const provider = new GlooStudioProvider({
      tokenUrl: 'https://platform.ai.gloo.com/oauth2/token',
      apiBaseUrl: 'https://platform.ai.gloo.com/ai/v2',
      clientId: 'client',
      clientSecret: 'secret',
      scopes: ['api/access'],
      tradition: 'evangelical',
      fetchImpl,
    });

    const result = await provider.ask(request, new Date('2026-08-01T00:00:00Z'));

    expect(result).toMatchObject({
      answer: 'A grounded response.',
      providerState: 'live',
      modelVersion: 'gloo-openai-gpt-5-mini',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://platform.ai.gloo.com/oauth2/token');
    expect(fetchImpl.mock.calls[1]?.[0]).toBe(
      'https://platform.ai.gloo.com/ai/v2/chat/completions',
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))).toMatchObject({
      auto_routing: true,
      tradition: 'evangelical',
      stream: false,
    });
  });

  it('returns an honest unavailable result when the provider fails', async () => {
    const provider = new GlooStudioProvider({
      tokenUrl: 'https://example.test/token',
      apiBaseUrl: 'https://example.test/ai/v2',
      clientId: 'client',
      clientSecret: 'secret',
      scopes: ['api/access'],
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 401 })),
    });

    await expect(provider.ask(request)).resolves.toMatchObject({
      answer: '',
      providerState: 'unavailable',
      errorCode: 'gloo_request_failed',
    });
  });
});

import { vi } from 'vitest';

vi.mock('../src/js/api/auth.js', () => ({
    AUTH_CONFIG: {
        CLIENT_ID: 'test-client',
        REFERER: 'https://example.com'
    },
    getFreshToken: vi.fn().mockResolvedValue('token-123')
}));

import { fetchSearch } from '../src/js/api/api.js';
import { fetchAllLanguages } from '../src/js/api/languages.js';

describe('api and language error handling', () => {
    it('throws on non-OK search response', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({})
        }));

        await expect(fetchSearch('test', 'E', 'videos')).rejects.toThrow(/Search \(videos\) failed/);
    });

    it('returns fallback language list on non-OK language response', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 503,
            json: async () => ({})
        }));

        const languages = await fetchAllLanguages(true);
        expect(Array.isArray(languages)).toBe(true);
        expect(languages[0]).toEqual({ code: 'E', name: 'English' });
    });
});

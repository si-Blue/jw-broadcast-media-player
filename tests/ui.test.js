import { getMediaThumbnailUrl, createMediaCard } from '../src/js/features/ui.js';

describe('ui helpers', () => {
    it('returns icon fallback when image data is missing', () => {
        const url = getMediaThumbnailUrl({}, false);
        expect(url).toBe('icon.png');
    });

    it('prefers audio square image when available', () => {
        const url = getMediaThumbnailUrl({
            images: { sqr: { lg: { url: 'https://example.com/audio.jpg' } } }
        }, true);
        expect(url).toBe('https://example.com/audio.jpg');
    });

    it('creates clickable media card', () => {
        const onClick = vi.fn();
        const item = { guid: 'abc', title: 'Test Item' };
        const card = createMediaCard(item, 0, false, onClick, 1000);
        document.body.appendChild(card);
        card.click();
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('escapes untrusted card title content', () => {
        const onClick = vi.fn();
        const item = { guid: 'xss', title: '<img src=x onerror="window.__xss=1">' };
        const card = createMediaCard(item, 0, false, onClick, 1000);
        document.body.appendChild(card);
        const titleEl = card.querySelector('.media-item-card-title');
        expect(titleEl.innerHTML).toContain('&lt;img');
        expect(titleEl.querySelector('img')).toBeNull();
    });

    it('creates stable fallback id without NaN', () => {
        const onClick = vi.fn();
        const card = createMediaCard({ title: 'No guid item' }, 2, false, onClick);
        expect(card.id.startsWith('media-card-')).toBe(true);
        expect(card.id.includes('NaN')).toBe(false);
    });
});

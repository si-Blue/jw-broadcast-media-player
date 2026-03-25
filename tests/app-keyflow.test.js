import { vi } from 'vitest';

function buildAppDom() {
    document.body.innerHTML = `
        <header id="top-nav">
            <nav>
                <div class="nav-item" tabindex="1" data-cat="home">Home</div>
                <div class="nav-item" tabindex="2" data-cat="VideoOnDemand">Video Categories</div>
                <div class="nav-item" tabindex="3" data-cat="AudioOnDemand">Audio</div>
            </nav>
            <div class="header-actions">
                <div id="global-watch-now" class="watch-now-btn" tabindex="4"><span>Watch Now</span></div>
                <div id="search-btn" class="header-action-btn" tabindex="5"></div>
                <div id="settings-btn" class="header-action-btn" tabindex="6"></div>
            </div>
        </header>
        <main id="content-area">
            <section id="hero-section"></section>
            <div id="action-bar"></div>
            <h2 id="section-title">Latest Videos</h2>
            <div id="grid-container"></div>
        </main>
        <div id="player-container" class="hidden" tabindex="-1">
            <video id="player" autoplay controls tabindex="0"></video>
        </div>
        <div id="search-modal" class="hidden">
            <button id="search-close-btn" class="search-close-btn" tabindex="11">x</button>
            <input type="text" id="search-input" tabindex="0">
            <button class="search-filter-btn active" data-filter="all" tabindex="12">All</button>
            <div id="search-results"></div>
        </div>
        <div id="settings-modal" class="hidden">
            <button class="settings-close-btn" tabindex="300">x</button>
            <button type="button" class="settings-list-row" id="language-row" tabindex="301" aria-expanded="false"></button>
            <button type="button" class="settings-list-row settings-row-toggle" id="subtitles-row" tabindex="302"></button>
            <button type="button" class="settings-list-row" id="resolution-row" tabindex="303" aria-expanded="false"></button>
            <button id="settings-save-btn" class="settings-save-btn" tabindex="305">Save</button>
            <div class="language-picker-section hidden" id="language-picker-section">
                <button type="button" id="language-search-trigger"></button>
                <input type="text" id="language-search">
                <button type="button" id="language-search-clear"></button>
                <div id="language-list"></div>
            </div>
            <div class="resolution-picker-section hidden" id="resolution-picker-section">
                <div id="resolution-picker-list"></div>
            </div>
        </div>
        <input type="hidden" id="language-select" value="">
        <input type="checkbox" id="subtitles-toggle">
        <span id="subtitles-value"></span>
        <span id="resolution-display-value"></span>
        <select id="resolution-select">
            <option value="1080p">1080p</option>
        </select>
    `;
}

function installFetchMock() {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
        const u = String(url);
        if (u.includes('/tokens/jworg.jwt')) {
            return { ok: true, text: async () => 'token-123' };
        }
        if (u.includes('/categories/') && u.includes('FeaturedSetTopBoxes')) {
            return { ok: true, json: async () => ({ category: { name: 'Featured', media: [] } }) };
        }
        if (u.includes('/categories/') && u.includes('LatestVideos')) {
            return { ok: true, json: async () => ({ category: { name: 'Latest', media: [] } }) };
        }
        if (u.includes('/categories/') && u.includes('VideoOnDemand')) {
            return { ok: true, json: async () => ({ category: { subcategories: [] } }) };
        }
        if (u.includes('/languages/all/web')) {
            return { ok: true, json: async () => ({ languages: [{ code: 'E', name: 'English' }] }) };
        }
        return { ok: true, json: async () => ({ category: { media: [] } }) };
    }));
}

describe('app key and focus flow', () => {
    beforeEach(() => {
        vi.resetModules();
        buildAppDom();
        installFetchMock();
        if (!HTMLElement.prototype.scrollIntoView) {
            HTMLElement.prototype.scrollIntoView = () => {};
        }
    });

    it('restores focus and preserves back priority order', async () => {
        await import('../src/js/app.js');
        window.onload();
        await Promise.resolve();

        const searchBtn = document.getElementById('search-btn');
        searchBtn.focus();
        searchBtn.click();

        const searchModal = document.getElementById('search-modal');
        expect(searchModal.classList.contains('hidden')).toBe(false);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));

        expect(searchModal.classList.contains('hidden')).toBe(true);
        expect(document.activeElement).toBe(searchBtn);
        const settingsModal = document.getElementById('settings-modal');
        searchModal.classList.remove('hidden');
        settingsModal.classList.remove('hidden');

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        expect(searchModal.classList.contains('hidden')).toBe(true);
        expect(settingsModal.classList.contains('hidden')).toBe(false);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        expect(settingsModal.classList.contains('hidden')).toBe(true);
    });
});

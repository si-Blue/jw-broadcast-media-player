import * as Api from './api/api.js';
import * as Nav from './core/navigation.js';
import * as UI from './features/ui.js';
import * as State from './core/state.js';
import * as Playback from './features/playback.js';
import * as Settings from './features/settings.js';

let currentSearchFilter = 'all';
let viewRequestId = 0;
let searchRequestId = 0;
let lastFocusedBeforeSearch = null;

function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Total duration in seconds from API fields, or null if unknown. */
function parseMediaDurationSeconds(item) {
    if (!item) return null;
    const d = item.duration;
    if (typeof d === 'number' && d > 0) return d;
    if (typeof d === 'string' && /^\d+(\.\d+)?$/.test(d.trim())) {
        const n = parseFloat(d);
        return n > 0 ? n : null;
    }
    const hhmm = item.durationFormattedHHMM;
    if (typeof hhmm === 'string' && hhmm.trim()) {
        const parts = hhmm.trim().split(':').map(p => parseInt(p, 10));
        if (parts.every(n => !Number.isNaN(n))) {
            if (parts.length === 2) return parts[0] * 60 + parts[1];
            if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
    }
    return null;
}

/** Resume bar + button labels from localStorage and item metadata (shared with landing + restore). */
function computeLandingProgressUi(item) {
    const storageKey = Playback.getProgressStorageKey(item);
    const savedTime = storageKey ? localStorage.getItem(storageKey) : null;
    const hasProgress = savedTime && parseFloat(savedTime) > 10;
    const durationSec = parseMediaDurationSeconds(item);
    const savedSec = hasProgress ? parseFloat(savedTime) : 0;
    const showProgressBar =
        hasProgress &&
        durationSec != null &&
        durationSec > 0 &&
        savedSec > 0 &&
        savedSec < durationSec;
    const progressPct = showProgressBar
        ? Math.min(100, Math.max(0, (savedSec / durationSec) * 100))
        : 0;
    return { storageKey, savedTime, hasProgress, showProgressBar, progressPct };
}

/** Resolve which media item the landing page is for (playlistIndex can be stale if never synced). */
function findPlaylistItemForLanding(landingRoot) {
    if (!State.currentPlaylist.length) return null;
    const g = landingRoot.getAttribute('data-landing-guid');
    const l = landingRoot.getAttribute('data-landing-lank');
    if (g) {
        const m = State.currentPlaylist.find(x => x.guid != null && String(x.guid) === g);
        if (m) return m;
    }
    if (l) {
        const m = State.currentPlaylist.find(x => x.lank != null && String(x.lank) === l);
        if (m) return m;
    }
    const idx = Math.max(0, Math.min(State.playlistIndex, State.currentPlaylist.length - 1));
    return State.currentPlaylist[idx] || null;
}

/**
 * After history/stack restore, landing HTML is stale; re-sync bar + Resume label from localStorage.
 */
function refreshLandingPreviewFromStorage() {
    const landing = document.querySelector('#grid-container .video-landing-container');
    if (!landing || State.currentPlaylist.length === 0) return;
    const item = findPlaylistItemForLanding(landing);
    if (!item) return;

    const { hasProgress, showProgressBar, progressPct } = computeLandingProgressUi(item);
    const previewWrap = landing.querySelector('.video-preview-img');
    if (previewWrap) {
        let bar = previewWrap.querySelector('.landing-preview-progress');
        if (showProgressBar) {
            if (!bar) {
                bar = document.createElement('div');
                bar.className = 'landing-preview-progress';
                bar.setAttribute('aria-hidden', 'true');
                bar.innerHTML = '<div class="landing-preview-progress-fill"></div>';
                previewWrap.appendChild(bar);
            }
            const fill = bar.querySelector('.landing-preview-progress-fill');
            if (fill) fill.style.width = `${progressPct}%`;
        } else if (bar) {
            bar.remove();
        }
    }
    const btn1 = document.getElementById('btn-1');
    if (btn1) btn1.textContent = hasProgress ? 'Resume' : 'Play';
}

/** HTML for the centered loading screen (spinner + text). Use same markup for detection. */
const LOADING_HTML = `<div id="app-loading-spinner" class="app-loading-screen" aria-live="polite" aria-busy="true">
    <div class="app-loading-spinner-icon"></div>
    <p class="app-loading-text">Loading...</p>
</div>`;

function isContainerLoading(container) {
    return container && (container.innerHTML === "Loading..." || container.querySelector('#app-loading-spinner'));
}

function updateGlobalActionBtn(text) {
    const btn = document.getElementById('global-watch-now');
    if (btn) btn.querySelector('span').innerText = text;
}

function logError(scope, message, err, extra = {}) {
    console.error(`[${scope}] ${message}`, {
        ...extra,
        error: err?.message || String(err)
    });
}

// --- Navigation State (build full state for back/restore) ---
function buildNavigationState() {
    if (State.isRestoringState) return null;
    const container = document.getElementById('grid-container');
    const hero = document.getElementById('hero-section');
    if (!container || !container.innerHTML || isContainerLoading(container)) return null;

    const rowItemsMap = {};
    document.querySelectorAll('.media-shelf-section').forEach((section, sectionIdx) => {
        const rowTitle = section.querySelector('.media-shelf-title')?.innerText || `row-${sectionIdx}`;
        const items = [];
        section.querySelectorAll('.media-item-card:not(.action-card-blue)').forEach(card => {
            const guid = card.getAttribute('data-item-guid');
            if (guid) {
                const item = State.currentPlaylist.find(m => m.guid === guid || m.lank === guid);
                if (item) items.push(item);
            }
        });
        if (items.length > 0) rowItemsMap[rowTitle] = items;
    });
    
    const activeNavItem = document.querySelector('.nav-item.active');
    const activeCategory = activeNavItem ? activeNavItem.getAttribute('data-cat') : 'home';

    const sectionIds = [];
    container.querySelectorAll('.media-row-wrapper').forEach(w => { if (w.id) sectionIds.push(w.id); });
    const sectionType = activeCategory === 'home' ? 'home' : (activeCategory === 'VideoOnDemand' ? 'categories' : 'content');

    const sectionTitleText = document.getElementById('section-title')?.innerText;
    const viewTitle = sectionTitleText == null ? '' : String(sectionTitleText);

    return {
        view: viewTitle,
        activeCategory: activeCategory,
        containerHTML: container.innerHTML,
        heroHTML: hero.innerHTML,
        containerClass: container.className,
        currentPlaylist: [...State.currentPlaylist],
        playlistIndex: State.playlistIndex,
        rowItemsMap,
        sectionIds,
        sectionType
    };
}

function saveNavigationState() {
    const state = buildNavigationState();
    if (state) Nav.saveNavigationState(state);
}

function restoreNavigationState(state) {
    State.setIsRestoringState(true);
    clearDynamicSections();
    document.getElementById('section-title').innerText = state.view;
    document.getElementById('grid-container').innerHTML = state.containerHTML;
    document.getElementById('grid-container').className = state.containerClass || '';
    document.getElementById('hero-section').innerHTML = state.heroHTML || '';
    
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeCategory = state.activeCategory || 'home';
    const activeNavItem = document.querySelector(`.nav-item[data-cat="${activeCategory}"]`);
    if (activeNavItem) activeNavItem.classList.add('active');

    State.setPlaylist(state.currentPlaylist || [], state.playlistIndex || 0);

    if (state.rowItemsMap && Object.keys(state.rowItemsMap).length > 0) {
        const all = [];
        Object.values(state.rowItemsMap).forEach(arr => all.push(...arr));
        if (all.length > 0) {
            const prevPlaylist = state.currentPlaylist || [];
            const prevIndex = Math.min(state.playlistIndex ?? 0, prevPlaylist.length - 1);
            const prevItem = prevPlaylist[prevIndex];
            const newIndex = prevItem && (prevItem.guid || prevItem.lank)
                ? all.findIndex(m => (prevItem.guid && m.guid === prevItem.guid) || (prevItem.lank && m.lank === prevItem.lank))
                : -1;
            State.setPlaylist(all, newIndex >= 0 ? newIndex : 0);
        }
    }
    const sectionIds = state.sectionIds && state.sectionIds.length > 0
        ? state.sectionIds
        : Array.from(document.querySelectorAll('#grid-container .media-row-wrapper'))
            .map(w => w.id).filter(Boolean);
    if (sectionIds.length > 0 && typeof SpatialNavigation !== 'undefined') {
        sectionIds.forEach((id, index) => {
            const leaveFor = {};
            if (index < sectionIds.length - 1) leaveFor.down = `@${sectionIds[index + 1]}`;
            if (index > 0) leaveFor.up = `@${sectionIds[index - 1]}`;
            spatialAddSection(id, {
                selector: `#${id} .media-item-card, #${id} .action-card-blue`,
                restrict: 'self-only',
                leaveFor: Object.keys(leaveFor).length ? leaveFor : undefined
            });
            Nav.addHorizontalWrap(id);
        });
        const sectionType = state.sectionType || (state.activeCategory === 'home' ? 'home' : (state.activeCategory === 'VideoOnDemand' ? 'categories' : 'content'));
        if (sectionType === 'home') {
            homeSections.length = 0;
            homeSections.push(...sectionIds);
        } else if (sectionType === 'content') {
            contentPageSections.length = 0;
            contentPageSections.push(...sectionIds);
        }
    }
    reattachEventListeners();
    refreshLandingPreviewFromStorage();
    UI.observeLazyImages();
    Nav.refreshSpatialNavigation();
    setTimeout(() => { State.setIsRestoringState(false); }, 100);
}

function reattachEventListeners() {
    document.querySelectorAll('.media-item-card:not(.action-card-blue)').forEach(card => {
        const guid = card.getAttribute('data-item-guid');
        const isAudio = card.getAttribute('data-is-audio') === 'true' || card.classList.contains('audio-card');
        if (guid) {
            let item = State.currentPlaylist.find(m => m.guid === guid || m.lank === guid);
            if (!item) {
                const title = card.querySelector('.media-item-card-title')?.innerText;
                if (title) item = State.currentPlaylist.find(m => m.title === title);
            }
            if (item) {
                const itemIndex = State.currentPlaylist.indexOf(item);
                card.onclick = () => {
                    saveNavigationState();
                    showLandingPage(item, itemIndex >= 0 ? itemIndex : 0, isAudio);
                };
            }
        }
    });

    document.querySelectorAll('.video-card').forEach(card => {
        const title = card.querySelector('p')?.innerText;
        const categoryKey = card.getAttribute('data-key');
        if (title && categoryKey) {
            card.onclick = () => {
                saveNavigationState();
                loadContentPage(categoryKey, title);
            };
        }
    });

    document.querySelectorAll('.action-card-blue').forEach(card => {
        const label = card.querySelector('.action-label')?.innerText;
        if (label !== "Play All" && label !== "Shuffle") return;
        const rowWrapper = card.closest('.media-row-wrapper');
        if (!rowWrapper) return;
        const items = [];
        rowWrapper.querySelectorAll('.media-item-card:not(.action-card-blue)').forEach(itemCard => {
            const guid = itemCard.getAttribute('data-item-guid');
            if (guid) {
                let item = State.currentPlaylist.find(m => m.guid === guid || m.lank === guid);
                if (!item) {
                    const t = itemCard.querySelector('.media-item-card-title')?.innerText;
                    if (t) item = State.currentPlaylist.find(m => m.title === t);
                }
                if (item) items.push(item);
            }
        });
        if (items.length > 0) {
            if (label === "Play All") {
                card.onclick = () => { State.setPlaylist(items, 0); Playback.playNext(); };
            } else {
                card.onclick = () => {
                    const shuffled = [...items].sort(() => Math.random() - 0.5);
                    State.setPlaylist(shuffled, 0);
                    Playback.playNext();
                };
            }
        }
    });

    const btn1 = document.getElementById('btn-1');
    const btn2 = document.getElementById('btn-2');
    if (btn1 && btn2 && State.currentPlaylist.length > 0) {
        const itemIndex = Math.max(0, Math.min(State.playlistIndex, State.currentPlaylist.length - 1));
        const item = State.currentPlaylist[itemIndex];
        if (item) {
            const storageKey = Playback.getProgressStorageKey(item);
            const savedTime = storageKey ? localStorage.getItem(storageKey) : null;
            const hasProgress = savedTime && parseFloat(savedTime) > 10;
            const isAudio = item.type === 'audio' || !item.files?.some(f => f.label?.includes('p'));
            btn1.onclick = () => {
                const startAt = hasProgress ? parseFloat(savedTime) : 0;
                if (isAudio) {
                    Playback.playAudio(item, startAt, false);
                } else {
                    Playback.playVideo(item.files, storageKey, startAt, false);
                }
            };
            btn2.onclick = () => { State.setPlaylistIndex(itemIndex); Playback.playNext(); };
        }
    }

    const catWatchNow = document.getElementById('cat-watch-now');
    if (catWatchNow) catWatchNow.onclick = triggerWatchNow;

    wireCategoryHeroSpatialIfPresent();
    Nav.registerSpatialNavigationForNewContent();
}

let homeSections = [];
let contentPageSections = [];

/** Remove then add so we never hit "Section has already existed" after races or missed bookkeeping. */
function spatialAddSection(sectionId, config) {
    if (typeof SpatialNavigation === 'undefined') return;
    SpatialNavigation.remove(sectionId);
    SpatialNavigation.add(sectionId, config);
}

function clearNavSpatialDownToHero() {
    document.querySelectorAll('.nav-item').forEach(n => n.removeAttribute('data-sn-down'));
}

function wireTopNavHorizontalNavigation() {
    const home = document.querySelector('.nav-item[data-cat="home"]');
    const categories = document.querySelector('.nav-item[data-cat="VideoOnDemand"]');
    const audio = document.querySelector('.nav-item[data-cat="AudioOnDemand"]');
    const watch = document.getElementById('global-watch-now');
    const search = document.getElementById('search-btn');
    const settings = document.getElementById('settings-btn');
    const ordered = [home, categories, audio, watch, search, settings].filter(Boolean);
    ordered.forEach((el, idx) => {
        const leftTarget = ordered[Math.max(0, idx - 1)];
        const rightTarget = ordered[Math.min(ordered.length - 1, idx + 1)];
        if (leftTarget?.id) el.setAttribute('data-sn-left', `#${leftTarget.id}`);
        else if (leftTarget) el.setAttribute('data-sn-left', `.nav-item[data-cat="${leftTarget.getAttribute('data-cat')}"]`);
        if (rightTarget?.id) el.setAttribute('data-sn-right', `#${rightTarget.id}`);
        else if (rightTarget) el.setAttribute('data-sn-right', `.nav-item[data-cat="${rightTarget.getAttribute('data-cat')}"]`);
    });
}

/**
 * Link category hero Watch Now to first grid focusable and active nav (remote D-pad).
 * No-op when hero or first item is missing.
 */
function wireCategoryHeroSpatialIfPresent() {
    const catWatch = document.getElementById('cat-watch-now');
    if (!catWatch) {
        clearNavSpatialDownToHero();
        return;
    }
    const firstRow = document.querySelector('#grid-container .media-row-wrapper');
    let firstItem = null;
    if (firstRow) {
        firstItem = firstRow.querySelector('.media-item-card, .action-card-blue');
    } else {
        firstItem = document.querySelector('#grid-container .media-item-card');
    }
    if (!firstItem || !firstItem.id) {
        clearNavSpatialDownToHero();
        return;
    }
    catWatch.setAttribute('data-sn-down', `#${firstItem.id}`);
    firstItem.setAttribute('data-sn-up', '#cat-watch-now');
    const activeNav = document.querySelector('.nav-item.active');
    if (activeNav) activeNav.setAttribute('data-sn-down', '#cat-watch-now');
}

function clearDynamicSections() {
    if (typeof SpatialNavigation !== 'undefined') {
        homeSections.forEach(id => SpatialNavigation.remove(id));
        contentPageSections.forEach(id => SpatialNavigation.remove(id));
        for (let i = 0; i < 32; i++) {
            SpatialNavigation.remove(`row-${i}`);
        }
    }
    homeSections = [];
    contentPageSections = [];
}

/**
 * Show user-facing error state in a container with a Retry button.
 * @param {HTMLElement} container - Element to fill (e.g. grid-container)
 * @param {string} message - Error message text
 * @param {function} onRetry - Callback when user clicks Try again
 */
function showErrorState(container, message, onRetry) {
    if (!container) return;
    container.className = '';
    container.innerHTML = `
        <div class="error-state">
            <p>${escapeHtml(message)}</p>
            <button type="button" class="error-retry-btn" tabindex="50">Try again</button>
        </div>
    `;
    const btn = container.querySelector('.error-retry-btn');
    if (btn && typeof onRetry === 'function') btn.onclick = onRetry;
    Nav.registerSpatialNavigationForNewContent();
}

/**
 * Show a brief toast message (e.g. "Could not load. Try again.").
 * Auto-dismisses after 4 seconds.
 */
function showToast(message) {
    let el = document.getElementById('app-toast');
    if (el) el.remove();
    el = document.createElement('div');
    el.id = 'app-toast';
    el.className = 'app-toast';
    el.setAttribute('role', 'alert');
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 4000);
}

// --- View Controllers ---
async function loadHomePage() {
    const requestId = ++viewRequestId;
    const container = document.getElementById('grid-container');
    container.className = '';
    container.innerHTML = LOADING_HTML;
    updateGlobalActionBtn("Watch Now");
    const actionBar = document.getElementById('action-bar');
    if (actionBar) actionBar.classList.add('hidden');
    document.getElementById('section-title').innerText = "";
    document.getElementById('hero-section').innerHTML = "";
    State.setPlaylist([]);
    clearDynamicSections();
    clearNavSpatialDownToHero();

    try {
        const [featured, latest] = await Promise.all([
            Api.fetchCategory('FeaturedSetTopBoxes', State.getLang()),
            Api.fetchCategory('LatestVideos', State.getLang())
        ]);
        if (requestId !== viewRequestId) return;

        container.innerHTML = "";
        let newPlaylist = [];
        let rowIndex = 0;

        if (featured.category?.media) {
            newPlaylist.push(...featured.category.media);
            UI.renderMediaRow(featured.category.name, featured.category.media, container, {
                onMediaClick: (item, i, isAudio, rowItems) => {
                    State.setPlaylist(rowItems || []);
                    saveNavigationState();
                    showLandingPage(item, i, isAudio);
                },
                featured: true
            }, rowIndex);
            homeSections.push(`row-${rowIndex}`);
            rowIndex++;
        }
        if (latest.category?.media) {
            newPlaylist.push(...latest.category.media);
            UI.renderMediaRow(latest.category.name, latest.category.media, container, {
                onMediaClick: (item, i, isAudio, rowItems) => {
                    State.setPlaylist(rowItems || []);
                    saveNavigationState();
                    showLandingPage(item, i, isAudio);
                }
            }, rowIndex);
            homeSections.push(`row-${rowIndex}`);
        }
        State.setPlaylist(newPlaylist);

        homeSections.forEach((id, index) => {
            const leaveFor = {};
            if (index < homeSections.length - 1) leaveFor.down = `@${homeSections[index + 1]}`;
            if (index > 0) leaveFor.up = `@${homeSections[index - 1]}`;

            spatialAddSection(id, {
                selector: `#${id} .media-item-card, #${id} .action-card-blue`,
                restrict: 'self-only',
                leaveFor: Object.keys(leaveFor).length ? leaveFor : undefined
            });
            Nav.addHorizontalWrap(id);
        });

        Nav.refreshSpatialNavigation();
        UI.observeLazyImages();
    } catch (err) {
        if (requestId !== viewRequestId) return;
        logError('home', 'Home load failed', err, { language: State.getLang() });
        showErrorState(container, "Unable to load home. Check your connection.", () => loadHomePage());
    }
}

async function loadTopLevelCategories() {
    const requestId = ++viewRequestId;
    saveNavigationState();
    const container = document.getElementById('grid-container');
    container.className = '';
    container.innerHTML = LOADING_HTML;
    updateGlobalActionBtn("Watch Now");
    const actionBar = document.getElementById('action-bar');
    if (actionBar) actionBar.classList.add('hidden');
    document.getElementById('section-title').innerText = "";
    document.getElementById('hero-section').innerHTML = "";
    State.setPlaylist([]);
    clearDynamicSections();
    clearNavSpatialDownToHero();

    try {
        const data = await Api.fetchCategory('VideoOnDemand', State.getLang());
        if (requestId !== viewRequestId) return;
        container.innerHTML = "";
        container.className = "grid";
        UI.renderCategoryGrid(data.category?.subcategories || [], container, (cat) => {
            saveNavigationState();
            loadContentPage(cat.key, cat.name);
        });
        Nav.refreshSpatialNavigation();
        UI.observeLazyImages();
    } catch (err) {
        if (requestId !== viewRequestId) return;
        logError('categories', 'Categories load failed', err, { language: State.getLang() });
        showErrorState(container, "Unable to load categories. Check your connection.", () => loadTopLevelCategories());
    }
}

async function loadContentPage(categoryKey, title, isAudio = false) {
    const requestId = ++viewRequestId;
    saveNavigationState();
    const container = document.getElementById('grid-container');
    const hero = document.getElementById('hero-section');
    container.className = '';
    container.innerHTML = LOADING_HTML;
    hero.innerHTML = "";
    const actionBar = document.getElementById('action-bar');
    if (actionBar) actionBar.classList.add('hidden');
    document.getElementById('section-title').innerText = "";
    updateGlobalActionBtn(isAudio ? "Listen Now" : "Watch Now");
    State.setPlaylist([]);
    clearDynamicSections();
    clearNavSpatialDownToHero();

    try {
        const data = await Api.fetchCategory(categoryKey, State.getLang());
        if (requestId !== viewRequestId) return;
        let subcategoryResults = [];
        if (data.category?.subcategories?.length > 0) {
            const subFetches = data.category.subcategories.map(sub =>
                Api.fetchCategory(sub.key, State.getLang())
            );
            subcategoryResults = await Promise.all(subFetches);
            if (requestId !== viewRequestId) return;
        }

        container.innerHTML = "";
        hero.innerHTML = "";

        const imgObj = isAudio
            ? (data.category?.images?.sqr?.lg || data.category?.images?.lsq?.lg || data.category?.images?.wss?.lg)
            : data.category?.images?.wss?.lg;
        const heroThumb = (typeof imgObj === 'string') ? imgObj : (imgObj?.url || "icon.png");
        const actionText = isAudio ? "Listen Now" : "Watch Now";

        hero.innerHTML = `
            <div id="category-hero">
                <img src="${escapeHtml(heroThumb)}">
                <div class="hero-info">
                    <h1>${escapeHtml(title)}</h1>
                    <p>${escapeHtml(data.category?.description || '')}</p>
                    <div class="watch-now-btn hero-btn" tabindex="7" id="cat-watch-now">
                        <svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zm-5-6l-7 4V7l7 4z"/></svg>
                        <span>${escapeHtml(actionText)}</span>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('cat-watch-now').onclick = triggerWatchNow;
        
        let newPlaylist = [];
        if (subcategoryResults.length > 0) {
            subcategoryResults.forEach((res, index) => {
                if (res.category?.media?.length > 0) {
                    newPlaylist.push(...res.category.media);
                    UI.renderMediaRow(res.category.name, res.category.media, container, {
                                                onMediaClick: (item, i, isA, rowItems) => {
                            State.setPlaylist(rowItems || []);
                            saveNavigationState();
                            showLandingPage(item, i, isA);
                        },
                        onPlayAll: (items) => { State.setPlaylist(items, 0); Playback.playNext(); },
                        onShuffle: (items) => { State.setPlaylist([...items].sort(() => Math.random() - 0.5), 0); Playback.playNext(); },
                        forceAudio: isAudio
                    }, index);
                    contentPageSections.push(`row-${index}`);
                }
            });
        } else if (data.category?.media) {
            newPlaylist.push(...data.category.media);
            UI.renderMediaGrid(data.category.media, container, (item, i, isA, rowItems) => {
                State.setPlaylist(rowItems || []);
                saveNavigationState();
                showLandingPage(item, i, isA);
            }, { forceAudio: isAudio });
        }
        State.setPlaylist(newPlaylist);

        contentPageSections.forEach((id, index) => {
            spatialAddSection(id, {
                selector: `#${id} .media-item-card, #${id} .action-card-blue`,
                restrict: 'self-only'
            });
            Nav.addHorizontalWrap(id);

            const currentSection = document.getElementById(id);
            const items = currentSection.querySelectorAll('.media-item-card, .action-card-blue');

            if (index < contentPageSections.length - 1) {
                const nextSectionId = contentPageSections[index + 1];
                const nextSection = document.getElementById(nextSectionId);
                const nextFirstItem = nextSection.querySelector('.media-item-card, .action-card-blue');
                if (nextFirstItem) {
                    items.forEach(item => item.setAttribute('data-sn-down', `#${nextFirstItem.id}`));
                }
            }

            if (index > 0) {
                const prevSectionId = contentPageSections[index - 1];
                const prevSection = document.getElementById(prevSectionId);
                const prevFirstItem = prevSection.querySelector('.media-item-card, .action-card-blue');
                if (prevFirstItem) {
                    items.forEach(item => item.setAttribute('data-sn-up', `#${prevFirstItem.id}`));
                }
            }
        });

        wireCategoryHeroSpatialIfPresent();
        Nav.registerSpatialNavigationForNewContent();
        Nav.refreshSpatialNavigation();
        UI.observeLazyImages();
    } catch (err) {
        if (requestId !== viewRequestId) return;
        logError('content', 'Content load failed', err, { language: State.getLang(), categoryKey });
        showErrorState(container, "Unable to load this content. Check your connection.", () => loadContentPage(categoryKey, title, isAudio));
    }
}

// --- Watch Now (random from playlist or Latest) ---
async function triggerWatchNow() {
    if (State.currentPlaylist.length > 0) {
        const newIndex = Math.floor(Math.random() * State.currentPlaylist.length);
        State.setPlaylistIndex(newIndex);
        Playback.playNext();
    } else {
        try {
            const data = await Api.fetchCategory('LatestVideos', State.getLang());
            const newPlaylist = data.category?.media || [];
            if (!newPlaylist.length) {
                showToast("No playable media available right now.");
                return;
            }
            const newIndex = Math.floor(Math.random() * newPlaylist.length);
            State.setPlaylist(newPlaylist, newIndex);
            Playback.playNext();
        } catch (err) {
            logError('watch-now', 'Could not load latest videos', err, { language: State.getLang() });
            showToast("Could not load. Try again.");
        }
    }
}

// --- Landing Page ---
async function showLandingPage(item, i, isAudio, options) {
    if (!options?.skipSaveState) saveNavigationState();
    const container = document.getElementById('grid-container');
    const hero = document.getElementById('hero-section');
    if (item.lank && !item.files?.length) {
        container.className = '';
        hero.innerHTML = '';
        container.innerHTML = LOADING_HTML;
        const full = await Api.fetchMediaByLank(item.lank, State.getLang());
        if (full?.files?.length) {
            item.files = full.files;
            if (full.guid != null) item.guid = full.guid;
            if (full.description != null) item.description = full.description;
            if (full.images) item.images = full.images;
            if (full.duration != null) item.duration = full.duration;
            if (full.durationFormattedHHMM != null) item.durationFormattedHHMM = full.durationFormattedHHMM;
        }
    }
    hero.innerHTML = "";
    container.classList.remove("grid");

    if (State.currentPlaylist.length > 0) {
        const safeIdx = Math.max(0, Math.min(i, State.currentPlaylist.length - 1));
        State.setPlaylistIndex(safeIdx);
    }

    const { hasProgress, showProgressBar, progressPct } = computeLandingProgressUi(item);

    const previewImg = UI.getMediaThumbnailUrl(item, isAudio);
    const progressBarHtml = showProgressBar
        ? `<div class="landing-preview-progress" aria-hidden="true"><div class="landing-preview-progress-fill" style="width:${progressPct}%"></div></div>`
        : '';

    const guidAttr = item.guid != null ? escapeHtml(String(item.guid)) : '';
    const lankAttr = item.lank != null ? escapeHtml(String(item.lank)) : '';

    container.innerHTML = `
        <div class="video-landing-container" data-landing-guid="${guidAttr}" data-landing-lank="${lankAttr}">
            <div class="video-details-top">
                <div class="video-info-text">
                    <h1>${escapeHtml(item.title)}</h1>
                    <div class="landing-buttons">
                        <button class="landing-btn play-btn" id="btn-1" tabindex="20">${hasProgress ? 'Resume' : 'Play'}</button>
                        <button class="landing-btn secondary-btn" id="btn-2" tabindex="21">Play All</button>
                    </div>
                    <p class="video-desc">${escapeHtml(item.description || '')}</p>
                </div>
                <div class="video-preview-img ${isAudio ? 'audio-preview' : ''}">
                    <img src="${escapeHtml(previewImg)}" alt="">
                    ${progressBarHtml}
                </div>
            </div>
            <div class="media-shelf-section">
                <h2 class="media-shelf-title">${escapeHtml(item.rowTitle || document.getElementById('section-title')?.innerText)}</h2>
                <div class="media-row-wrapper" id="landing-row-items"></div>
            </div>
        </div>
    `;

    document.getElementById('btn-1').onclick = () => {
        const canPlay = isAudio
            ? item.files?.some(f => f.progressiveDownloadURL)
            : item.files?.length;
        if (!canPlay) {
            showToast("Playback not available. Try again or use Home/Categories.");
            return;
        }
        const { storageKey: key, savedTime: st, hasProgress: hp } = computeLandingProgressUi(item);
        const startAt = hp ? parseFloat(st) : 0;
        if (isAudio) {
            Playback.playAudio(item, startAt, false);
        } else {
            Playback.playVideo(item.files, key, startAt, false);
        }
    };
    document.getElementById('btn-2').onclick = () => {
        State.setPlaylistIndex(i);
        Playback.playNext();
    };

    const rowItems = document.getElementById('landing-row-items');
    State.currentPlaylist.forEach((media, idx) => {
        const isA = media.subtype === 'audio' || media.type === 'audio';
        const card = UI.createMediaCard(media, idx, isA, (selected, idx2, audio) => {
            saveNavigationState();
            showLandingPage(selected, idx2, audio);
        });
        card.setAttribute('data-row-title', item.rowTitle || '');
        rowItems.appendChild(card);
    });
    document.getElementById('btn-1').focus();
    Nav.registerSpatialNavigationForNewContent();
    UI.observeLazyImages();

    // Push landing state into history so Back (e.g. webOS) restores previous view instead of initial/blank
    const landingState = buildNavigationState();
    if (landingState && !landingState.containerHTML.includes('app-loading-spinner')) {
        const viewTitle = landingState.view || item?.title || 'Landing';
        const viewUrl = `#${String(viewTitle).replace(/\s+/g, '-').toLowerCase()}`;
        history.pushState(landingState, viewTitle, viewUrl);
    }
}

// --- Search ---
function showSearchModal() {
    const modal = document.getElementById('search-modal');
    const searchInput = document.getElementById('search-input');
    const searchCloseBtn = document.getElementById('search-close-btn');

    lastFocusedBeforeSearch = document.activeElement;
    modal.classList.remove('hidden');
    document.getElementById('search-results').innerHTML = '<p class="search-placeholder">Enter a search term, then press <strong>Enter</strong> to see results and use the remote.</p>';
    void modal.offsetWidth;
    updateSearchInputDataSnUp();

    if (typeof SpatialNavigation !== 'undefined') {
        // SpatialNavigation.makeFocusable(modal);
        SpatialNavigation.makeFocusable('search-modal');
        // Force focus into the modal so arrow keys stay in modal (search-modal section).
        // Focus close button first; user can press Down to reach the input (data-sn-down).
        setTimeout(() => {
            if (searchInput) searchInput.focus();
        }, 0);
    } else {
        searchInput.focus();
    }
}

function hideSearchModal() {
    document.getElementById('search-modal').classList.add('hidden');
    const input = document.getElementById('search-input');
    if (input) input.value = '';
    document.querySelectorAll('#search-modal .search-focus-ring').forEach(el => el.classList.remove('search-focus-ring'));
    const fallback = document.getElementById('search-btn');
    const restoreTarget = (lastFocusedBeforeSearch && typeof lastFocusedBeforeSearch.focus === 'function')
        ? lastFocusedBeforeSearch
        : fallback;
    if (restoreTarget && typeof restoreTarget.focus === 'function') {
        restoreTarget.focus();
    }
    lastFocusedBeforeSearch = null;
}

function setSearchModalFocusRing(element) {
    document.querySelectorAll('#search-modal .media-item-card, #search-modal .search-filter-btn').forEach(el => {
        el.classList.toggle('search-focus-ring', el === element);
    });
}

function updateSearchInputDataSnUp() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;
    const firstResult = document.querySelector('#search-results .media-item-card');
    searchInput.setAttribute('data-sn-up', firstResult ? '#search-results .media-item-card' : '#search-modal .search-filter-btn');
}

async function performSearch(query) {
    const requestId = ++searchRequestId;
    const resultsPane = document.getElementById('search-results');
    const filter = document.querySelector('.search-filter-btn.active')?.getAttribute('data-filter') || 'all';
    const trimmed = query.trim().replace(/\s+/g, ' ');
    if (!trimmed) return;

    resultsPane.innerHTML = '<p class="search-loading">Searching...</p>';
    try {
        const results = await Api.fetchSearch(trimmed, State.getLang(), filter);
        if (requestId !== searchRequestId) return;
        resultsPane.innerHTML = "";
        if (results.length > 0) {
            displaySearchResults(results);
        } else {
            resultsPane.innerHTML = `<p class="search-no-results">No media results found for "${escapeHtml(trimmed)}"</p>`;
        }
        updateSearchInputDataSnUp();
        if (typeof SpatialNavigation !== 'undefined') SpatialNavigation.makeFocusable();
    } catch (err) {
        if (requestId !== searchRequestId) return;
        logError('search', 'Search error', err, { language: State.getLang(), query: trimmed, filter });
        resultsPane.innerHTML = `
            <p class="search-no-results">Something went wrong. Please try again.</p>
            <button type="button" class="error-retry-btn" tabindex="60" style="margin-top: 16px;">Try again</button>
        `;
        const retryBtn = resultsPane.querySelector('.error-retry-btn');
        if (retryBtn) retryBtn.onclick = () => performSearch(trimmed);
        updateSearchInputDataSnUp();
        if (typeof SpatialNavigation !== 'undefined') SpatialNavigation.makeFocusable();
    }
}

function displaySearchResults(results) {
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'search-results-grid';
    const playable = results.filter(item =>
        item.subtype === 'video' || item.subtype === 'audio' || item.type === 'video' || item.type === 'audio'
    );
    // Do not set State.setPlaylist(playable) here so that saveNavigationState() when opening
    // a result still sees the main content playlist (home/categories) and saves a restorable state.
    playable.forEach((item, i) => {
        const isAudio = item.subtype === 'audio' || item.type === 'audio';
        const card = UI.createMediaCard(item, i, isAudio, (selected, idx, audio) => {
            document.getElementById('search-modal').classList.add('hidden');
            saveNavigationState();
            State.setPlaylist(playable);
            showLandingPage(selected, idx, audio, { skipSaveState: true });
        });
        grid.appendChild(card);
    });
    resultsContainer.appendChild(grid);
    Nav.registerSpatialNavigationForNewContent();
    UI.observeLazyImages();
}

// --- Global back for webOS / Escape ---
window.navigateBack = function navigateBack() {
    const playerContainer = document.getElementById('player-container');
    if (playerContainer && !playerContainer.classList.contains('hidden')) {
        Playback.stopVideo();
        return;
    }
    if (Nav.navigationStack.length > 0) {
        const prevState = Nav.navigationStack.pop();
        restoreNavigationState(prevState);
    } else {
        if (typeof webOS !== 'undefined' && typeof webOS.platformBack === 'function') {
            webOS.platformBack();
        } else {
            State.setIsRestoringState(true);
            loadHomePage();
            setTimeout(() => { State.setIsRestoringState(false); }, 100);
        }
    }
};

// --- Init ---
window.onload = () => {
    document.getElementById('search-input')?.blur();
    Nav.initializeSpatialNavigation();
    Settings.initSettings();

    document.addEventListener('jw-playback-closed', () => {
        refreshLandingPreviewFromStorage();
    });

    window.addEventListener('popstate', (event) => {
        const playerContainer = document.getElementById('player-container');
        if (playerContainer && !playerContainer.classList.contains('hidden')) {
            Playback.stopVideo();
            return;
        }
        if (event.state && !event.state.video && event.state.containerHTML) {
            restoreNavigationState(event.state);
            const idx = Nav.navigationStack.findIndex(s =>
                s.view === event.state.view && s.containerHTML === event.state.containerHTML
            );
            if (idx >= 0) Nav.setNavigationStack(Nav.navigationStack.slice(0, idx + 1));
            // Pop the state we just restored so the stack matches "where we can back to" (don't keep current view on stack)
            if (Nav.navigationStack.length > 0) {
                const top = Nav.navigationStack[Nav.navigationStack.length - 1];
                if (top.view === event.state.view && top.containerHTML === event.state.containerHTML) {
                    Nav.navigationStack.pop();
                }
            }
        } else {
            if (Nav.navigationStack.length === 0) {
                if (typeof webOS !== 'undefined' && typeof webOS.platformBack === 'function') {
                    webOS.platformBack();
                } else {
                    State.setIsRestoringState(true)
                    loadHomePage();
                    setTimeout(() => { State.setIsRestoringState(false); }, 100);
                }
            } else {
                navigateBack();
            }
        }
    });

    document.addEventListener('visibilitychange', () => {
        const playerContainer = document.getElementById('player-container');
        const player = document.getElementById('player');
        const isPlayerOpen = playerContainer && !playerContainer.classList.contains('hidden');
        if (document.hidden) {
            if (isPlayerOpen && player && !player.paused) {
                player.pause();
            }
            return;
        }
        if (!document.hidden && typeof SpatialNavigation !== 'undefined') {
            SpatialNavigation.focus();
        }
    });

    const initialState = {
        view: 'Home',
        containerHTML: '',
        heroHTML: '',
        containerClass: '',
        currentPlaylist: [],
        playlistIndex: 0,
        rowItemsMap: {}
    };
    history.replaceState(initialState, 'Home', '#home');

    loadHomePage();
    document.querySelector('.nav-item[data-cat="home"]')?.classList.add('active');
    wireTopNavHorizontalNavigation();

    document.getElementById('global-watch-now').onclick = triggerWatchNow;

    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.onclick = () => {
            saveNavigationState();
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            nav.classList.add('active');
            const cat = nav.getAttribute('data-cat');
            if (cat === 'home') loadHomePage();
            else if (cat === 'VideoOnDemand') loadTopLevelCategories();
            else if (cat === 'AudioOnDemand') loadContentPage('Audio', 'Audio', true);
        };
    });

    // --- Settings Modal Trigger ---
    // Instead of: window.location.href = 'settings.html';
    document.getElementById('settings-btn').onclick = () => {
        Settings.openSettingsModal();
    };

    document.getElementById('search-btn').onclick = showSearchModal;
    document.getElementById('search-close-btn').onclick = hideSearchModal;

    const searchInput = document.getElementById('search-input');
    let searchTimeout;
    searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        if (query.length >= 2) {
            searchTimeout = setTimeout(() => performSearch(query), 500);
        } else {
            document.getElementById('search-results').innerHTML = '<p class="search-placeholder">Enter a search term, then press <strong>Enter</strong> to see results and use the remote.</p>';
        }
    });
    searchInput?.addEventListener('blur', () => {
        const modal = document.getElementById('search-modal');
        if (!modal || modal.classList.contains('hidden')) return;
        setTimeout(() => {
            const active = document.activeElement;
            if (!active || !modal.contains(active)) moveFocusToSearchResults();
        }, 0);
    });
    function moveFocusToSearchResults() {
        const firstResult = document.querySelector('#search-results .media-item-card');
        const firstFilter = document.querySelector('#search-modal .search-filter-btn');
        const toFocus = firstResult || firstFilter;
        if (!toFocus) return;
        if (typeof SpatialNavigation !== 'undefined') SpatialNavigation.focus(toFocus);
        toFocus.focus();
        requestAnimationFrame(() => setSearchModalFocusRing(toFocus));
        setTimeout(() => setSearchModalFocusRing(toFocus), 100);
    }

    function updateSearchModalFocusRingFromElement(el) {
        if (!el || !document.getElementById('search-modal')?.contains(el)) return;
        const card = el.closest('#search-modal .media-item-card');
        if (card) {
            setSearchModalFocusRing(card);
            return;
        }
        const filterBtn = el.closest('#search-modal .search-filter-btn');
        if (filterBtn) {
            setSearchModalFocusRing(filterBtn);
            return;
        }
        setSearchModalFocusRing(null);
    }

    const searchModal = document.getElementById('search-modal');
    if (searchModal) {
        searchModal.addEventListener('focusin', (e) => updateSearchModalFocusRingFromElement(e.target));
    }
    document.addEventListener('sn:focused', (e) => {
        const el = e && e.target;
        if (el) updateSearchModalFocusRingFromElement(el);
    }, false);

    searchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.keyCode === 13) {
            e.preventDefault();
            e.stopPropagation();
            searchInput.blur();
            moveFocusToSearchResults();
        }
        // Up (38) is not handled: on webOS the platform defers JS until the next keypress
        // when the keyboard is open, so Up cannot close the keyboard and move focus in one go.
        // Users press Enter to close the keyboard and move to results (see placeholder hint).
    }, true);
    
    const searchBarTrigger = document.getElementById('search-bar-trigger');
    if (searchBarTrigger) {
        searchBarTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            searchInput?.focus();
            searchInput?.click();
        });
        searchBarTrigger.addEventListener('keydown', (e) => {
            if (e.keyCode === 13 || e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                searchInput?.focus();
                searchInput?.click();
            }
        });
    }

    document.querySelectorAll('.search-filter-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.search-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const query = searchInput?.value?.trim();
            if (query && query.length >= 2) performSearch(query);
        };
    });

    document.getElementById('settings-btn').onclick = () => {
        Settings.openSettingsModal();
    };

    const globalKeydownHandler = (e) => {
        if (window.__settingsLanguageSearchActive) return;
        const keyCode = e.keyCode || e.which;
        const isBack = e.key === "Escape" || keyCode === 461;
        const searchModal = document.getElementById('search-modal');
        const settingsModal = document.getElementById('settings-modal');
        const playerContainer = document.getElementById('player-container');

        if (isBack) {
            if (searchModal && !searchModal.classList.contains('hidden')) {
                e.preventDefault();
                e.stopPropagation();
                hideSearchModal();
                return;
            }

            if (settingsModal && !settingsModal.classList.contains('hidden')) {
                const active = document.activeElement;
                if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
                e.preventDefault();
                e.stopPropagation();
                Settings.closeSettingsModal();
                return;
            }

            if (playerContainer && !playerContainer.classList.contains('hidden')) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                Playback.stopVideo();
                return;
            }

            if (Nav.navigationStack.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                navigateBack();
            }
            return;
        }

        // When search modal is open and focus is outside it, trap arrows and move focus in.
        if (searchModal && !searchModal.classList.contains('hidden')) {
            if (keyCode === 37 || keyCode === 38 || keyCode === 39 || keyCode === 40) {
                const active = document.activeElement;
                if (!active || !searchModal.contains(active)) {
                    e.preventDefault();
                    e.stopPropagation();
                    const closeBtn = document.getElementById('search-close-btn');
                    if (closeBtn) closeBtn.focus();
                    return;
                }
            }
        }

        // Keep focus locked in settings while modal is open.
        if (settingsModal && !settingsModal.classList.contains('hidden')) {
            if (keyCode === 13 || e.key === 'Enter') {
                const active = document.activeElement;
                const target = active && settingsModal.contains(active)
                    ? active.closest('.settings-list-row, .settings-save-btn, .settings-close-btn, .language-list-item, .resolution-option, #language-search-trigger, #language-search-clear')
                    : null;
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                if (!target) {
                    const firstRow = settingsModal.querySelector('.settings-list-row');
                    if (firstRow) firstRow.focus();
                    return;
                }
                if (target.id === 'language-search-trigger') {
                    const languageSearchInput = document.getElementById('language-search');
                    if (languageSearchInput) {
                        languageSearchInput.tabIndex = 0;
                        languageSearchInput.focus();
                    }
                    return;
                }
                if (typeof target.click === 'function') target.click();
                return;
            }
            if (keyCode === 13 || keyCode === 37 || keyCode === 38 || keyCode === 39 || keyCode === 40) {
                const active = document.activeElement;
                if (!active || !settingsModal.contains(active)) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    if (typeof SpatialNavigation !== 'undefined') {
                        SpatialNavigation.focus('settings-modal');
                    }
                    const firstRow = settingsModal.querySelector('.settings-list-row');
                    if (firstRow) {
                        firstRow.focus();
                        if (typeof SpatialNavigation !== 'undefined') SpatialNavigation.focus(firstRow);
                    }
                    return;
                }
            }
        }

        if (playerContainer && !playerContainer.classList.contains('hidden')) {
            if (keyCode === 37 || keyCode === 39) {
                if (Playback.handleVideoArrowKey && Playback.handleVideoArrowKey(keyCode)) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }
            if (keyCode === 38 || keyCode === 40) {
                if (Playback.focusVideoForRemoteNavigation && Playback.focusVideoForRemoteNavigation()) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }
            if (keyCode === 13) {
                if (Playback.handleVideoEnterKey && Playback.handleVideoEnterKey()) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }
        }

        if (keyCode === 13) {
            // Respect element-level handlers that already consumed Enter.
            if (e.defaultPrevented) return;
            const focused = document.activeElement;
            if (focused?.tagName === 'SELECT' || focused?.tagName === 'TEXTAREA') return;
            if (focused?.tagName === 'INPUT' && focused.type !== 'button' && focused.type !== 'submit') return;
            if (focused?.onclick) {
                e.preventDefault();
                focused.onclick();
            } else if (focused?.click) {
                e.preventDefault();
                focused.click();
            }
        }
    };
    window.addEventListener('keydown', globalKeydownHandler, true);

    document.addEventListener('mouseover', (e) => {
        if (window.__settingsLanguageSearchActive) return;
        // Fix: Do not steal focus if search modal is open
        if (!document.getElementById('search-modal').classList.contains('hidden')) return;
        if (!document.getElementById('settings-modal').classList.contains('hidden')) return;
        
        const target = e.target.closest('.nav-item, .watch-now-btn, .header-action-btn, .media-item-card, .video-card, .action-card-blue, .landing-btn, .search-filter-btn, .search-close-btn, .audio-pause-button');
        if (target && target.tabIndex >= 0) target.focus();
    }, true);

    document.addEventListener('cursorStateChange', (event) => {
        if (window.__settingsLanguageSearchActive) return;
        const searchModal = document.getElementById('search-modal');
        if (searchModal && !searchModal.classList.contains('hidden')) return;
        if (event.detail && !event.detail.visibility && typeof SpatialNavigation !== 'undefined') {
            SpatialNavigation.focus();
        }
    }, false);

};

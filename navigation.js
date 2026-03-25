// navigation.js
export let navigationStack = [];

// Main content only; search modal has its own section (search-modal) with restrict 'self-only'
const SPATIAL_SELECTORS = '.nav-item, .watch-now-btn, .header-action-btn, .media-item-card, .video-card, .action-card-blue, .landing-btn, #search-bar-trigger, .audio-pause-button, .settings-close-btn, .settings-save-btn, .settings-select, .settings-toggle, #language-select, #subtitles-toggle, #resolution-select, .error-retry-btn, .error-close-btn';
const SPATIAL_SELECTORS_NEW = '.media-item-card, .video-card, .action-card-blue, .landing-btn, .audio-pause-button, .audio-progress-track, .error-retry-btn, .error-close-btn';

/**
 * Save full navigation state. Caller should pass state object with:
 * view, containerHTML, heroHTML, containerClass, currentPlaylist, playlistIndex, rowItemsMap
 */
export function saveNavigationState(state) {
    if (!state || !state.containerHTML || state.containerHTML.includes('app-loading-spinner') || state.containerHTML === "Loading...") return;
    navigationStack.push(state);
    const viewTitle = state.view || 'Home';
    const viewUrl = `#${viewTitle.replace(/\s+/g, '-').toLowerCase()}`;
    history.pushState(state, viewTitle, viewUrl);
    if (navigationStack.length > 10) navigationStack.shift();
}

export function refreshSpatialNavigation() {
    if (typeof SpatialNavigation !== 'undefined') {
        SpatialNavigation.makeFocusable();
        setTimeout(() => SpatialNavigation.focus(), 50);
    }
}

/** Left/right margin (px) to keep the focus ring (outline + offset) fully visible in the row. */
const ROW_FOCUS_MARGIN = 24;

/**
 * Scroll the horizontal row so the focused element (and its focus ring) is fully visible.
 * scrollIntoView often doesn't scroll the row in nested scroll containers (e.g. webOS);
 * we set row.scrollLeft explicitly.
 */
function scrollRowToShowFocused(row, el) {
    if (!row || !el) return;
    const rowRect = row.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const elementContentLeft = row.scrollLeft + (elRect.left - rowRect.left);
    const elementWidth = elRect.width;
    const maxScroll = Math.max(0, row.scrollWidth - row.clientWidth);
    let newScroll = row.scrollLeft;
    if (elementContentLeft - ROW_FOCUS_MARGIN < row.scrollLeft) {
        newScroll = Math.max(0, elementContentLeft - ROW_FOCUS_MARGIN);
    }
    if (elementContentLeft + elementWidth > row.scrollLeft + row.clientWidth - ROW_FOCUS_MARGIN) {
        newScroll = Math.min(maxScroll, elementContentLeft + elementWidth - row.clientWidth + ROW_FOCUS_MARGIN);
    }
    row.scrollLeft = newScroll;
}

/**
 * When focus moves in a horizontal row, scroll the row so the focus ring isn't clipped.
 */
function setupScrollIntoViewOnFocus() {
    document.addEventListener('sn:focused', (e) => {
        const el = e && e.target;
        if (!el || typeof el.closest !== 'function') return;
        const row = el.closest('.media-row-wrapper, .audio-playlist-row');
        if (row) {
            requestAnimationFrame(() => scrollRowToShowFocused(row, el));
        }
    }, false);
}

export function disableMainNavigation() {
    if (typeof SpatialNavigation !== 'undefined') {
        SpatialNavigation.pause(); // Stop processing all navigation
    }
}

export function enableMainNavigation() {
    if (typeof SpatialNavigation !== 'undefined') {
        SpatialNavigation.resume(); // Resume normal navigation
    }
}

const SEARCH_MODAL_SELECTORS = '#search-modal #search-input, #search-modal .search-close-btn, #search-modal .search-filter-btn, #search-modal .media-item-card, #search-modal .error-retry-btn';

export function initializeSpatialNavigation() {
    if (typeof SpatialNavigation !== 'undefined') {
        setupScrollIntoViewOnFocus();
        SpatialNavigation.init();
        SpatialNavigation.add('search-modal', {
            selector: SEARCH_MODAL_SELECTORS,
            restrict: 'self-only',
            enterTo: 'default-element',
        });
        SpatialNavigation.add({
            selector: SPATIAL_SELECTORS,
            enterTo: 'default-element',
        });
        SpatialNavigation.makeFocusable();
        setTimeout(() => {
            SpatialNavigation.focus();
        }, 100);
    }
}

export function addHorizontalWrap(sectionId) {
    if (typeof SpatialNavigation !== 'undefined') {
        const section = document.getElementById(sectionId);
        if (section) {
            const items = section.querySelectorAll('.media-item-card, .action-card-blue');
            if (items.length > 0) {
                const firstItem = items[0];
                const lastItem = items[items.length - 1];
                firstItem.setAttribute('data-sn-left', '');
                lastItem.setAttribute('data-sn-right', '');
            }
        }
    }
}

export function registerSpatialNavigationForNewContent() {
    if (typeof SpatialNavigation !== 'undefined') {
        SpatialNavigation.add({
            selector: SPATIAL_SELECTORS_NEW,
            enterTo: 'default-element'
        });
        SpatialNavigation.makeFocusable();
    }
}

export function navigateBack(restoreUI) {
    if (navigationStack.length > 0) {
        const prevState = navigationStack.pop();
        restoreUI(prevState);
        refreshSpatialNavigation();
    } else if (typeof webOS !== 'undefined' && typeof webOS.platformBack === 'function') {
        webOS.platformBack();
    }
}

export function setNavigationStack(newStack) {
    navigationStack.length = 0;
    if (newStack) {
        navigationStack.push(...newStack);
    }
}
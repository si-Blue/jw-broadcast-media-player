// ui.js

const lazyLoadObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            const src = img.getAttribute('data-src');
            if (src) {
                img.onload = () => {
                    img.removeAttribute('data-src');
                    img.classList.remove('lazy-load');
                    const container = img.closest('.thumbnail-container');
                    if (container) {
                        container.classList.remove('loading');
                    }
                    observer.unobserve(img);
                };
                img.src = src;
            } else {
                observer.unobserve(img);
            }
        }
    });
}, { rootMargin: "2000px" });

export function observeLazyImages() {
    const lazyImages = document.querySelectorAll('img.lazy-load');
    lazyImages.forEach(img => {
        lazyLoadObserver.observe(img);
    });
}

export const ICONS = {
    VIDEO: `<svg class="media-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M6.5 20a.498.498 0 01-.5-.5v-15a.5.5 0 01.735-.441l14 7.468a.501.501 0 01.002.882l-14 7.531A.5.5 0 016.5 20zM7 5.333v13.33l12.441-6.692L7 5.333z"></path></svg>`,
    AUDIO: `<svg class="media-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M21.5 22a.5.5 0 01-.5-.5v-9.605C21 6.804 16.248 3 12 3c-4.249 0-9 3.804-9 8.895V21.5a.5.5 0 01-1 0v-9.605C2 6.23 7.28 2 12 2s10 4.231 10 9.895V21.5a.5.5 0 01-.5.5z M4.5 22a.5.5 0 01-.5-.5v-8a.5.5 0 01.5-.5C7.96 13 8 15.475 8 15.5v4C8 21.477 5.71 22 4.5 22zm.5-7.979v6.94c.73-.092 2-.404 2-1.461v-4c-.004-.137-.094-1.304-2-1.479zM19.5 22c-1.21 0-3.5-.523-3.5-2.5v-4c0-.025.04-2.5 3.5-2.5a.5.5 0 01.5.5v8a.5.5 0 01-.5.5zm-.5-7.979c-1.906.175-1.996 1.343-2 1.486V19.5c0 1.057 1.27 1.37 2 1.46v-6.939z"></path></svg>`
};

const PLACEHOLDER_IMG = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/**
 * Single fallback chain for media thumbnails. Use everywhere (cards, landing, now playing).
 * @param {object} item - Media item with image/images
 * @param {boolean} isAudio - Whether item is audio (square sources)
 * @returns {string} URL or 'icon.png'
 */
export function getMediaThumbnailUrl(item, isAudio) {
    const candidates = isAudio
        ? [
            item?.images?.sqr?.lg,
            item?.images?.sqr?.md,
            item?.image?.url,
            item?.images?.lsq?.lg,
            item?.images?.wss?.sm,
            item?.images?.cvr?.lg,
            item?.images?.cvr?.md
        ]
        : [
            item?.images?.wss?.lg,
            item?.images?.wss?.sm,
            item?.image?.url
        ];
    const raw = candidates.find(v => v != null);
    const url = (typeof raw === 'string') ? raw : (raw?.url ?? '');
    return url || 'icon.png';
}

export function createMediaCard(item, index, isAudio, onClick, baseTabIndex) {
    const card = document.createElement('div');
    card.className = `media-item-card ${isAudio ? 'audio-card' : ''}`;
    card.tabIndex = baseTabIndex !== undefined ? baseTabIndex + index : 100 + index;
    card.id = `media-card-${item.guid || (baseTabIndex + index)}`;
    card.setAttribute('data-item-guid', item.guid || item.lank || '');
    card.setAttribute('data-item-index', String(index));
    card.setAttribute('data-is-audio', isAudio ? 'true' : 'false');

    const thumb = getMediaThumbnailUrl(item, isAudio);
    const duration = item.durationFormattedHHMM || item.duration || "";

    card.innerHTML = `
        <div class="thumbnail-container loading">
            <img class="lazy-load" data-src="${thumb}" src="${PLACEHOLDER_IMG}" onerror="this.src='icon.png'">
            <div class="bottom-overlay">
                ${isAudio ? ICONS.AUDIO : ICONS.VIDEO}
                ${duration ? `<span class="duration-text">${duration}</span>` : ''}
            </div>
        </div>
        <div class="media-item-card-title">${item.title}</div>
    `;
    card.onclick = () => onClick(item, index, isAudio);
    return card;
}

const PLAY_ALL_ICON = `<svg viewBox="0 0 24 24" class="action-svg"><path d="M6.5 20a.498.498 0 01-.5-.5v-15a.5.5 0 01.735-.441l14 7.468a.501.501 0 01.002.882l-14 7.531A.5.5 0 016.5 20zM7 5.333v13.33l12.441-6.692L7 5.333z"/></svg>`;
const SHUFFLE_ICON = `<svg viewBox="0 0 24 24" class="action-svg"><path d="M4.5 6c4.236 0 7.1 2.636 7.982 5.868C13.251 14.686 15.736 17 19.5 17h1.293l-1.146-1.146a.5.5 0 11.707-.707l2 2a.5.5 0 010 .707l-2 2a.5.5 0 11-.707-.707L20.793 18H19.5c-4.236 0-7.1-2.636-7.982-5.868C10.749 9.314 8.264 7 4.5 7h-2a.5.5 0 010-1h2z M10.382 14.202a.5.5 0 01.803.596C9.769 16.7 7.467 18 4.5 18h-2a.5.5 0 010-1h2c2.653 0 4.657-1.15 5.882-2.798zm9.265-10.055a.5.5 0 01.707 0l2 2a.5.5 0 010 .707l-2 2a.5.5 0 01-.707-.707L20.793 7H19.5c-2.653 0-4.656 1.15-5.882 2.798a.5.5 0 01-.802-.596C14.23 7.3 16.533 6 19.5 6h1.293l-1.146-1.146a.5.5 0 010-.707z"/></svg>`;

export function createActionCard(label, type, callback) {
    const card = document.createElement('div');
    card.id = `action-card-${type}-${Math.random().toString(36).substring(2, 9)}`;
    card.className = "media-item-card action-card-blue";
    card.tabIndex = 50;
    const icon = type === "play" ? PLAY_ALL_ICON : SHUFFLE_ICON;
    const iconWrapper = type === 'play' ? 'play-all-icon-wrapper' : 'shuffle-icon-wrapper';
    card.innerHTML = `
        <div class="action-card-thumbnail">
            <div class="action-card-content">
                <div class="${iconWrapper}">${icon}</div>
            </div>
        </div>
        <div class="action-label">${label}</div>
    `;
    card.onclick = callback;
    return card;
}

/**
 * Renders a media shelf row with optional Play All / Shuffle and media cards.
 * options: { onMediaClick, onPlayAll, onShuffle }; rowIndex used for tab order so focus moves to start of next row.
 */
export function renderMediaRow(title, items, container, options = {}, rowIndex = 0) {
    const { onMediaClick, onPlayAll, onShuffle, featured } = options;
    const baseTabIndex = 1000 + rowIndex * 500;
    container.classList.remove("grid");

    const section = document.createElement('div');
    section.className = "media-shelf-section" + (featured ? " featured-row" : "");
    section.setAttribute('data-row-title', title);
    section.innerHTML = `<h2 class="media-shelf-title">${title}</h2>`;

    const wrapper = document.createElement('div');
    wrapper.className = "media-row-wrapper";
    wrapper.id = `row-${rowIndex}`;

    if (onPlayAll && items.length) {
        const playAllBtn = createActionCard("Play All", "play", () => {
            onPlayAll(items);
        });
        wrapper.appendChild(playAllBtn);
    }
    if (onShuffle && items.length) {
        const shuffleBtn = createActionCard("Shuffle", "shuffle", () => {
            onShuffle(items);
        });
        wrapper.appendChild(shuffleBtn);
    }

    items.forEach((item, i) => {
        const isAudio = options.forceAudio || item.subtype === 'audio' || item.type === 'audio';
        const card = createMediaCard(item, i, isAudio, (selected, idx, audio) => {
            if (selected) selected.rowTitle = title;
            onMediaClick(selected, idx, audio, items);
        }, baseTabIndex);
        card.setAttribute('data-row-title', title);
        wrapper.appendChild(card);
    });

    section.appendChild(wrapper);
    container.appendChild(section);
}

export function renderMediaGrid(items, container, onMediaClick, options = {}) {
    container.className = "grid";
    container.innerHTML = "";
    items.forEach((item, i) => {
        const isAudio = options.forceAudio || item.subtype === 'audio' || item.type === 'audio';
        const card = createMediaCard(item, i, isAudio, (selected, idx, audio) => {
            if (selected) selected.rowTitle = "";
            onMediaClick(selected, idx, audio, items);
        });
        container.appendChild(card);
    });
}

export function renderCategoryGrid(categories, container, onClick) {
    container.className = "grid";
    container.innerHTML = "";
    categories.forEach((cat, i) => {
        const div = document.createElement('div');
        div.className = "video-card";
        div.tabIndex = i + 10;
        div.setAttribute('data-key', cat.key);
        const img = cat.images?.pnr?.lg || cat.images?.wss?.sm || cat.images?.lsq?.lg;
        const imgSrc = (typeof img === 'string') ? img : (img?.url || "");
        div.innerHTML = `<div class="thumbnail-container loading"><img class="lazy-load" data-src="${imgSrc}" src="${PLACEHOLDER_IMG}" onerror="this.src='icon.png'"></div><p>${cat.name}</p>`;
        div.onclick = () => onClick(cat);
        container.appendChild(div);
    });
}

/**
 * Creates a card for a Category (Folder) like "Movies" or "Programs"
 */
export function createCategoryCard(category, index, onClick) {
    const card = document.createElement('div');
    card.className = "media-item-card category-card";
    card.tabIndex = 100 + index;

    const thumb = category.images?.wss?.sm || category.image?.url || "icon.png";

    card.innerHTML = `
        <div class="thumbnail-container loading">
            <img class="lazy-load" data-src="${thumb}" src="${PLACEHOLDER_IMG}" onerror="this.src='icon.png'">
        </div>
        <div class="media-item-card-title">${category.name}</div>
    `;

    card.onclick = () => onClick(category);
    return card;
}

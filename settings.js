import { fetchAllLanguages } from './languages.js';

let userSettings = {
    language: localStorage.getItem('jw_language') || 'E',
    resolution: localStorage.getItem('jw_resolution') || '1080p',
    subtitles: localStorage.getItem('jw_subtitles') === 'true'
};

let allLanguagesCache = [];

const CHECKMARK_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
const RESOLUTIONS = ['1080p', '720p', '480p', '360p', '240p'];

function saveSettings() {
    const language = document.getElementById('language-select').value;
    const subtitles = document.getElementById('subtitles-toggle').checked;
    const resolution = document.getElementById('resolution-select').value;

    localStorage.setItem('jw_language', language);
    localStorage.setItem('jw_subtitles', String(subtitles));
    localStorage.setItem('jw_resolution', resolution);

    userSettings.language = language;
    userSettings.subtitles = subtitles;
    userSettings.resolution = resolution;

    window.history.back();
}

function getSelectedLanguageCode() {
    const hidden = document.getElementById('language-select');
    return hidden ? hidden.value : userSettings.language;
}

function setSelectedLanguageCode(code) {
    const hidden = document.getElementById('language-select');
    if (hidden) hidden.value = code || 'E';
}

function renderLanguageList(languages, selectedCode) {
    const listEl = document.getElementById('language-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    const code = selectedCode || getSelectedLanguageCode();

    const selected = languages.find((l) => l.code === code);
    const rest = languages.filter((l) => l.code !== code);
    const ordered = selected ? [selected, ...rest] : languages;

    ordered.forEach((lang) => {
        const primary = lang.name || lang.code || '';
        const secondary = lang.nativeName || lang.name || primary;
        const isSelected = lang.code === code;

        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'language-list-item' + (isSelected ? ' selected' : '');
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', isSelected);
        item.setAttribute('data-lang-code', lang.code);
        item.tabIndex = 0;

        const checkHtml = isSelected ? `<span class="language-item-check">${CHECKMARK_SVG}</span>` : '';
        item.innerHTML = `
            <span class="language-item-text">
                <span class="language-item-primary">${escapeHtml(primary)}</span>
                <span class="language-item-secondary">${escapeHtml(secondary)}</span>
            </span>
            ${checkHtml}
        `;

        item.addEventListener('click', () => selectLanguageItem(lang.code, item));
        item.addEventListener('keydown', (e) => {
            if (e.keyCode === 13 || e.key === 'Enter') {
                e.preventDefault();
                selectLanguageItem(lang.code, item);
            }
        });

        listEl.appendChild(item);
    });

    const selectedRow = listEl.querySelector('.language-list-item.selected');
    if (selectedRow) listEl.scrollTop = 0;
}

function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function getSelectedLanguageName() {
    const code = getSelectedLanguageCode();
    const lang = allLanguagesCache.find((l) => l.code === code);
    return lang ? (lang.name || lang.code || '') : code || '—';
}

function updateLanguageFieldValue() {
    const el = document.getElementById('language-field-value');
    if (el) el.textContent = getSelectedLanguageName();
}

function selectLanguageItem(code, clickedEl) {
    setSelectedLanguageCode(code);
    const list = document.getElementById('language-list');
    if (!list) return;
    list.querySelectorAll('.language-list-item').forEach((el) => el.classList.remove('selected'));
    list.querySelectorAll('.language-list-item').forEach((el) => el.setAttribute('aria-selected', 'false'));
    if (clickedEl) {
        clickedEl.classList.add('selected');
        clickedEl.setAttribute('aria-selected', 'true');
        clickedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    updateLanguageFieldValue();
    closeLanguagePicker();
}

function updateLanguageListFromSearch(query) {
    const trimmed = (query || '').trim().toLowerCase();
    const list = trimmed === ''
        ? allLanguagesCache
        : allLanguagesCache.filter((l) => (l.name || '').toLowerCase().includes(trimmed));
    renderLanguageList(list, getSelectedLanguageCode());
}

function isLanguagePickerOpen() {
    const section = document.getElementById('language-picker-section');
    return section && !section.classList.contains('hidden');
}

function openLanguagePicker() {
    const section = document.getElementById('language-picker-section');
    const trigger = document.getElementById('language-row');
    const searchInput = document.getElementById('language-search');
    const clearBtn = document.getElementById('language-search-clear');
    const listEl = document.getElementById('language-list');
    if (!section || !trigger) return;
    closeResolutionPicker();
    section.classList.remove('hidden');
    trigger.setAttribute('aria-expanded', 'true');
    if (typeof SpatialNavigation !== 'undefined') SpatialNavigation.makeFocusable();
    const firstItem = listEl?.querySelector('.language-list-item');
    setTimeout(() => (firstItem ? firstItem.focus() : trigger.focus()), 50);
}

function closeLanguagePicker() {
    const section = document.getElementById('language-picker-section');
    const trigger = document.getElementById('language-row');
    const searchInput = document.getElementById('language-search');
    const clearBtn = document.getElementById('language-search-clear');
    if (!section || !trigger) return;
    section.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
    if (searchInput) {
        searchInput.tabIndex = -1;
        searchInput.value = '';
    }
    if (clearBtn) clearBtn.tabIndex = -1;
    updateLanguageListFromSearch('');
    trigger.focus();
}

function toggleLanguagePicker() {
    if (isLanguagePickerOpen()) closeLanguagePicker();
    else openLanguagePicker();
}

function isResolutionPickerOpen() {
    const section = document.getElementById('resolution-picker-section');
    return section && !section.classList.contains('hidden');
}

function openResolutionPicker() {
    const section = document.getElementById('resolution-picker-section');
    const listEl = document.getElementById('resolution-picker-list');
    const resolutionSelect = document.getElementById('resolution-select');
    const trigger = document.getElementById('resolution-row');
    if (!section || !listEl || !resolutionSelect || !trigger) return;
    closeLanguagePicker();
    section.classList.remove('hidden');
    trigger.setAttribute('aria-expanded', 'true');
    const current = resolutionSelect.value;
    listEl.innerHTML = '';
    RESOLUTIONS.forEach((res) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'resolution-option' + (res === current ? ' selected' : '');
        btn.setAttribute('role', 'option');
        btn.setAttribute('aria-selected', res === current);
        btn.setAttribute('data-resolution', res);
        btn.tabIndex = 0;
        btn.textContent = res;
        btn.addEventListener('click', () => selectResolution(res, btn));
        btn.addEventListener('keydown', (e) => {
            if (e.keyCode === 13 || e.key === 'Enter') {
                e.preventDefault();
                selectResolution(res, btn);
            }
        });
        listEl.appendChild(btn);
    });
    if (typeof SpatialNavigation !== 'undefined') SpatialNavigation.makeFocusable();
    const first = listEl.querySelector('.resolution-option');
    if (first) setTimeout(() => first.focus(), 50);
}

function selectResolution(value, clickedEl) {
    const resolutionSelect = document.getElementById('resolution-select');
    const displayEl = document.getElementById('resolution-display-value');
    const section = document.getElementById('resolution-picker-section');
    const trigger = document.getElementById('resolution-row');
    if (resolutionSelect) resolutionSelect.value = value;
    if (displayEl) displayEl.textContent = value;
    if (section) section.classList.add('hidden');
    if (trigger) {
        trigger.setAttribute('aria-expanded', 'false');
        trigger.focus();
    }
}

function closeResolutionPicker() {
    const section = document.getElementById('resolution-picker-section');
    const trigger = document.getElementById('resolution-row');
    if (!section || !trigger) return;
    section.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
}

function updateSubtitlesDisplay() {
    const cb = document.getElementById('subtitles-toggle');
    const valueEl = document.getElementById('subtitles-value');
    if (valueEl) valueEl.textContent = cb && cb.checked ? 'On' : 'Off';
}

async function initLanguagePicker() {
    const section = document.getElementById('language-picker-section');
    const trigger = document.getElementById('language-row');
    const searchInput = document.getElementById('language-search');
    const clearBtn = document.getElementById('language-search-clear');
    const hiddenSelect = document.getElementById('language-select');

    if (!hiddenSelect) return;

    hiddenSelect.value = userSettings.language;
    updateLanguageFieldValue();

    try {
        allLanguagesCache = await fetchAllLanguages();
        updateLanguageListFromSearch('');
        const selectedRow = document.querySelector('.language-list-item.selected');
        if (selectedRow) selectedRow.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    } catch (err) {
        console.error('Language API error:', err);
        allLanguagesCache = [{ code: 'E', name: 'English' }];
        renderLanguageList(allLanguagesCache, 'E');
    }
    updateLanguageFieldValue();

    if (trigger) {
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            toggleLanguagePicker();
        });
        trigger.addEventListener('keydown', (e) => {
            if (e.keyCode === 13 || e.key === 'Enter') {
                e.preventDefault();
                toggleLanguagePicker();
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => updateLanguageListFromSearch(searchInput.value));
        searchInput.addEventListener('keydown', (e) => {
            if (e.keyCode === 27 || e.keyCode === 461) {
                e.preventDefault();
                searchInput.blur();
                const firstItem = document.querySelector('.language-list-item');
                if (firstItem) {
                    firstItem.focus();
                    if (typeof SpatialNavigation !== 'undefined') {
                        SpatialNavigation.makeFocusable();
                        setTimeout(() => SpatialNavigation.focus(), 50);
                    }
                } else {
                    document.getElementById('language-search-trigger')?.focus();
                }
            }
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            updateLanguageListFromSearch('');
            searchInput?.focus();
        });
    }

    const searchTrigger = document.getElementById('language-search-trigger');
    if (searchTrigger) {
        searchTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            searchInput?.focus();
        });
        searchTrigger.addEventListener('keydown', (e) => {
            if (e.keyCode === 13 || e.key === 'Enter') {
                e.preventDefault();
                searchInput?.focus();
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (!isLanguagePickerOpen()) return;
        const langSection = document.getElementById('language-picker-section');
        const langRow = document.getElementById('language-row');
        if (langSection && langSection.contains(e.target)) return;
        if (langRow && langRow.contains(e.target)) return;
        closeLanguagePicker();
    });
}

function initResolutionPicker() {
    const trigger = document.getElementById('resolution-row');
    if (!trigger) return;
    trigger.addEventListener('click', (e) => {
        e.preventDefault();
        if (isResolutionPickerOpen()) closeResolutionPicker();
        else openResolutionPicker();
    });
    trigger.addEventListener('keydown', (e) => {
        if (e.keyCode === 13 || e.key === 'Enter') {
            e.preventDefault();
            if (isResolutionPickerOpen()) closeResolutionPicker();
            else openResolutionPicker();
        }
    });
    document.addEventListener('click', (e) => {
        if (!isResolutionPickerOpen()) return;
        const section = document.getElementById('resolution-picker-section');
        const row = document.getElementById('resolution-row');
        if (section && section.contains(e.target)) return;
        if (row && row.contains(e.target)) return;
        closeResolutionPicker();
    });
}

function initSubtitlesRow() {
    const cb = document.getElementById('subtitles-toggle');
    const row = document.getElementById('subtitles-row');
    if (!row || !cb) return;
    updateSubtitlesDisplay();
    row.addEventListener('click', (e) => {
        e.preventDefault();
        cb.checked = !cb.checked;
        updateSubtitlesDisplay();
    });
    row.addEventListener('keydown', (e) => {
        if (e.keyCode === 13 || e.key === 'Enter') {
            e.preventDefault();
            cb.checked = !cb.checked;
            updateSubtitlesDisplay();
        }
    });
}

window.onload = () => {
    if (typeof SpatialNavigation !== 'undefined') {
        SpatialNavigation.init();
        SpatialNavigation.add({
            selector: '.nav-item, .settings-list-row, #language-search-trigger, .language-list-item, .resolution-option, .settings-save-btn'
        });
        SpatialNavigation.makeFocusable();
        SpatialNavigation.focus();
    }

    window.addEventListener('keydown', (e) => {
        const focused = document.activeElement;
        const isLangItem = focused?.classList?.contains('language-list-item');
        if (e.keyCode === 13 || e.key === 'Enter') {
            if (isLangItem) {
                e.preventDefault();
                e.stopPropagation();
                const code = focused.getAttribute('data-lang-code');
                if (code) selectLanguageItem(code, focused);
            }
            return;
        }
        if (isLangItem && (e.keyCode === 38 || e.keyCode === 40)) {
            const list = document.getElementById('language-list');
            const items = list ? Array.from(list.querySelectorAll('.language-list-item')) : [];
            const idx = items.indexOf(focused);
            if (idx < 0) return;
            e.preventDefault();
            e.stopPropagation();
            if (e.keyCode === 38) {
                const prev = items[idx - 1];
                if (prev) prev.focus();
            } else {
                const next = items[idx + 1];
                if (next) next.focus();
            }
        }
    }, true);

    document.getElementById('resolution-select').value = userSettings.resolution;
    const resolutionDisplay = document.getElementById('resolution-display-value');
    if (resolutionDisplay) resolutionDisplay.textContent = document.getElementById('resolution-select').value;

    document.getElementById('subtitles-toggle').checked = userSettings.subtitles;
    initSubtitlesRow();

    initLanguagePicker();
    initResolutionPicker();

    document.querySelector('.nav-item').onclick = () => window.history.back();
    document.getElementById('settings-save-btn').onclick = saveSettings;
};

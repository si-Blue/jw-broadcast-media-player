import { fetchAllLanguages } from '../api/languages.js';
import * as State from '../core/state.js';
import * as Nav from '../core/navigation.js';
import * as UI from './ui.js';

let allLanguagesCache = [];

const CHECKMARK_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
const RESOLUTIONS = ['1080p', '720p', '480p', '360p', '240p'];
let languageSearchActive = false;
let suppressLanguageSearchRefocus = false;
window.__settingsLanguageSearchActive = false;

function deactivateLanguageSearch(restoreTriggerFocus = false) {
    const searchInput = document.getElementById('language-search');
    const searchTrigger = document.getElementById('language-search-trigger');
    const clearBtn = document.getElementById('language-search-clear');

    languageSearchActive = false;
    window.__settingsLanguageSearchActive = false;
    suppressLanguageSearchRefocus = true;
    if (searchInput) {
        searchInput.blur();
    }
    if (clearBtn) clearBtn.tabIndex = 0;
    if (searchTrigger) {
        searchTrigger.tabIndex = 0;
        if (restoreTriggerFocus) searchTrigger.focus();
    }
    Nav.enableMainNavigation();
    // Allow blur-side auto-refocus again for the next activation cycle.
    setTimeout(() => { suppressLanguageSearchRefocus = false; }, 0);
}

function saveSettings() {
    const previousLanguage = State.userSettings.language;
    const language = document.getElementById('language-select').value;
    const subtitles = document.getElementById('subtitles-toggle').checked;
    const resolution = document.getElementById('resolution-select').value;

    State.setLang(language);
    State.setSubtitles(subtitles);
    State.setResolution(resolution);

    closeSettingsModal();
    if (language !== previousLanguage) {
        window.location.reload();
    }
}

function getSelectedLanguageCode() {
    const hidden = document.getElementById('language-select');
    return hidden ? hidden.value : State.userSettings.language;
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

function activateLanguageSearch() {
    const searchInput = document.getElementById('language-search');
    const searchTrigger = document.getElementById('language-search-trigger');
    const clearBtn = document.getElementById('language-search-clear');
    if (!searchInput) return;

    languageSearchActive = true;
    window.__settingsLanguageSearchActive = true;
    suppressLanguageSearchRefocus = false;

    // webOS keyboard opens more reliably when the input is focusable.
    searchInput.tabIndex = 0;
    if (clearBtn) clearBtn.tabIndex = 0;
    if (searchTrigger) searchTrigger.tabIndex = -1;
    Nav.disableMainNavigation();

    setTimeout(() => {
        searchInput.focus();
        // Keep caret at the end so new chars append predictably.
        try {
            const len = searchInput.value?.length || 0;
            searchInput.setSelectionRange(len, len);
        } catch (_) {}
        // webOS can drop focus right after first programmatic focus; retry once.
        setTimeout(() => {
            if (document.activeElement !== searchInput) {
                searchInput.focus();
                try {
                    const len = searchInput.value?.length || 0;
                    searchInput.setSelectionRange(len, len);
                } catch (_) {}
            }
        }, 80);
    }, 0);
}

function isLanguagePickerOpen() {
    const section = document.getElementById('language-picker-section');
    return section && !section.classList.contains('hidden');
}

export function openLanguagePicker() {
    const section = document.getElementById('language-picker-section');
    const trigger = document.getElementById('language-row');
    const searchInput = document.getElementById('language-search');
    const searchTriggerBtn = document.getElementById('language-search-trigger');
    const clearBtn = document.getElementById('language-search-clear');
    const listEl = document.getElementById('language-list');
    if (!section || !trigger) return;
    closeResolutionPicker();
    section.classList.remove('hidden');
    trigger.setAttribute('aria-expanded', 'true');
    if (searchInput) searchInput.tabIndex = 0;
    if (clearBtn) clearBtn.tabIndex = 0;
    if (searchTriggerBtn) searchTriggerBtn.tabIndex = 0;

    // Default to list-first navigation: focus selected/first language.
    // Search is opt-in via the search trigger/button.
    setTimeout(() => {
        const selectedItem = listEl ? listEl.querySelector('.language-list-item.selected') : null;
        const firstItem = listEl ? listEl.querySelector('.language-list-item') : null;
        const target = selectedItem || firstItem || searchTriggerBtn || trigger;
        if (target) target.focus();
    }, 0);
}

export function closeLanguagePicker(options = {}) {
    const { restoreFocus = true } = options;
    const section = document.getElementById('language-picker-section');
    const trigger = document.getElementById('language-row');
    const searchInput = document.getElementById('language-search');
    const searchTriggerBtn = document.getElementById('language-search-trigger');
    const clearBtn = document.getElementById('language-search-clear');
    if (!section || !trigger) return;
    deactivateLanguageSearch(false);
    section.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
    if (searchInput) {
        searchInput.value = '';
        searchInput.tabIndex = 0;
    }
    if (searchTriggerBtn) searchTriggerBtn.tabIndex = 0;
    if (clearBtn) clearBtn.tabIndex = 0;
    updateLanguageListFromSearch('');
    if (restoreFocus) trigger.focus();
}

function toggleLanguagePicker() {
    if (isLanguagePickerOpen()) closeLanguagePicker();
    else openLanguagePicker();
}

function isResolutionPickerOpen() {
    const section = document.getElementById('resolution-picker-section');
    return section && !section.classList.contains('hidden');
}

export function openResolutionPicker() {
    const section = document.getElementById('resolution-picker-section');
    const listEl = document.getElementById('resolution-picker-list');
    const resolutionSelect = document.getElementById('resolution-select');
    const trigger = document.getElementById('resolution-row');
    if (!section || !listEl || !resolutionSelect || !trigger) return;
    // Avoid forcing focus back to language row while opening resolution picker.
    closeLanguagePicker({ restoreFocus: false });
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
    Nav.refreshSpatialNavigation();
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

export function closeResolutionPicker() {
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

export async function initLanguagePicker() {
    const section = document.getElementById('language-picker-section');
    const trigger = document.getElementById('language-row');
    const searchInput = document.getElementById('language-search');
    const clearBtn = document.getElementById('language-search-clear');
    const hiddenSelect = document.getElementById('language-select');

    if (!hiddenSelect) return;

    hiddenSelect.value = State.userSettings.language;
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
                e.stopPropagation();
                toggleLanguagePicker();
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => updateLanguageListFromSearch(searchInput.value));
        searchInput.addEventListener('blur', () => {
            const nextActive = document.activeElement;

            // webOS can briefly drop focused inputs to BODY while opening the soft keyboard.
            // Keep search mode stable unless user intentionally exits (Enter/Escape/deactivate).
            if (!languageSearchActive || suppressLanguageSearchRefocus) return;
            const isBodyDrop = !nextActive || nextActive === document.body || nextActive.tagName === 'BODY';
            if (!isBodyDrop) return;

            setTimeout(() => {
                if (!languageSearchActive || suppressLanguageSearchRefocus) return;
                if (document.activeElement === searchInput) return;
                searchInput.focus();
            }, 30);
        });
        searchInput.addEventListener('keydown', (e) => {
            if (e.keyCode === 37 || e.keyCode === 38 || e.keyCode === 39 || e.keyCode === 40) {
                e.preventDefault();
                e.stopPropagation();
                deactivateLanguageSearch(false);
                // Defer focus handoff so webOS can close keyboard first.
                setTimeout(() => {
                    const firstItem = document.querySelector('.language-list-item');
                    if (firstItem) firstItem.focus();
                }, 0);
                return;
            }
            if (e.keyCode === 13 || e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                deactivateLanguageSearch(false);
                const firstItem = document.querySelector('.language-list-item');
                if (firstItem) {
                    firstItem.focus();
                } else {
                    document.getElementById('language-search-trigger')?.focus();
                }
                return;
            }
            if (e.keyCode === 27 || e.keyCode === 461) {
                e.preventDefault();
                deactivateLanguageSearch(false);
                const firstItem = document.querySelector('.language-list-item');
                if (firstItem) {
                    firstItem.focus();
                    Nav.refreshSpatialNavigation();
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
            activateLanguageSearch();
        });
    }

    const searchTrigger = document.getElementById('language-search-trigger');
    if (searchTrigger) {
        searchTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            activateLanguageSearch();
        });
        searchTrigger.addEventListener('keydown', (e) => {
            if (e.keyCode === 13 || e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                activateLanguageSearch();
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

export function initResolutionPicker() {
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
            e.stopPropagation();
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

export function initSubtitlesRow() {
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
            e.stopPropagation();
            cb.checked = !cb.checked;
            updateSubtitlesDisplay();
        }
    });
}

export function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    
    // Sync UI with current state
    document.getElementById('resolution-select').value = State.userSettings.resolution;
    const resolutionDisplay = document.getElementById('resolution-display-value');
    if (resolutionDisplay) resolutionDisplay.textContent = State.userSettings.resolution;
    
    document.getElementById('subtitles-toggle').checked = State.userSettings.subtitles;
    updateSubtitlesDisplay();
    
    document.getElementById('language-select').value = State.userSettings.language;
    updateLanguageFieldValue();

    modal.classList.remove('hidden');

    if (typeof SpatialNavigation !== 'undefined') {
        SpatialNavigation.remove('settings-modal');
        SpatialNavigation.add('settings-modal', {
            selector: '.settings-list-row, .settings-close-btn, .settings-save-btn, .settings-toggle, .language-list-item, .resolution-option, #language-search-trigger, .language-search-input',
            restrict: 'self-only',
            enterTo: 'default-element'
        });
        SpatialNavigation.makeFocusable('settings-modal');
        SpatialNavigation.focus('settings-modal');
        setTimeout(() => {
            const firstRow = modal.querySelector('.settings-list-row');
            if (firstRow) {
                firstRow.focus();
                SpatialNavigation.focus(firstRow);
            }
        }, 100);
    }
}

export function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    deactivateLanguageSearch(false);
    if (modal) modal.classList.add('hidden');
    
    if (typeof SpatialNavigation !== 'undefined') {
        SpatialNavigation.remove('settings-modal');
        // Return focus to the settings button on the main screen
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) settingsBtn.focus();
    }
}

export function initSettings() {
    // Global key handler for settings-specific interactions (like arrow keys in language list)
    window.addEventListener('keydown', (e) => {
        const focused = document.activeElement;
        const isLangItem = focused?.classList?.contains('language-list-item');
        const isLangSearchTrigger = focused?.id === 'language-search-trigger';
        if (e.keyCode === 13 || e.key === 'Enter') {
            if (isLangItem) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                const code = focused.getAttribute('data-lang-code');
                if (code) selectLanguageItem(code, focused);
                return;
            }
            if (isLangSearchTrigger) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                activateLanguageSearch();
                return;
            }
        }
        if (isLangSearchTrigger && (e.keyCode === 40 || e.keyCode === 39 || e.keyCode === 37)) {
            e.preventDefault();
            e.stopPropagation();
            const firstItem = document.querySelector('.language-list-item');
            if (firstItem) firstItem.focus();
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
                if (prev) {
                    prev.focus();
                } else {
                    const searchTrigger = document.getElementById('language-search-trigger');
                    if (searchTrigger) searchTrigger.focus();
                }
            } else {
                const next = items[idx + 1];
                if (next) next.focus();
            }
        }
    }, true);

    initSubtitlesRow();
    initLanguagePicker();
    initResolutionPicker();

    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) {
        // Fallback for remotes that don't dispatch click for focused controls.
        settingsModal.addEventListener('keydown', (e) => {
            if (e.keyCode !== 13 && e.key !== 'Enter') return;
            const focused = document.activeElement;
            if (!focused || !settingsModal.contains(focused)) return;
            const target = focused.closest(
                '.settings-list-row, .settings-save-btn, .settings-close-btn, .language-list-item, .resolution-option, #language-search-trigger, #language-search-clear'
            );
            if (!target) return;
            e.preventDefault();
            e.stopPropagation();
            if (target.id === 'language-search-trigger') {
                activateLanguageSearch();
                return;
            }
            if (typeof target.click === 'function') target.click();
        }, true);
    }

    const saveBtn = document.getElementById('settings-save-btn');
    if (saveBtn) saveBtn.onclick = saveSettings;
    const closeBtn = document.querySelector('#settings-modal .settings-close-btn');
    if (closeBtn) closeBtn.onclick = closeSettingsModal;
}

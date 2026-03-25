// api.js
import { getFreshToken, AUTH_CONFIG } from './auth.js';

const API_BASE = "https://b.jw-cdn.org/apis/mediator/v1";
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const cache = new Map();

function getCacheKey(url) {
    return `api_cache_${url}`;
}

function getCachedData(url) {
    const key = getCacheKey(url);
    if (cache.has(key)) {
        const entry = cache.get(key);
        if (Date.now() - entry.timestamp < CACHE_DURATION) return entry.data;
        cache.delete(key);
    }
    try {
        const stored = localStorage.getItem(key);
        if (stored) {
            const entry = JSON.parse(stored);
            if (Date.now() - entry.timestamp < CACHE_DURATION) {
                cache.set(key, entry);
                return entry.data;
            }
            localStorage.removeItem(key);
        }
    } catch (e) {
        console.warn('Cache read error:', e);
    }
    return null;
}

function setCachedData(url, data) {
    const key = getCacheKey(url);
    const entry = { data, timestamp: Date.now() };
    cache.set(key, entry);
    try {
        const s = JSON.stringify(entry);
        if (s.length < 5 * 1024 * 1024) localStorage.setItem(key, s);
    } catch (e) {
        console.warn('Cache write error:', e);
    }
}

export async function fetchWithCache(url, options = {}) {
    const cached = getCachedData(url);
    if (cached) {
        const headers = { ...(options.headers || {}) };
        if (!headers["Authorization"] && !headers["authorization"]) {
            getFreshToken().then(token => {
                if (token) headers["Authorization"] = `Bearer ${token}`;
                fetch(url, { ...options, headers }).then(async (res) => {
                    if (res.ok) { const data = await res.json(); setCachedData(url, data); }
                }).catch(() => {});
            });
        } else {
            fetch(url, options).then(async (res) => {
                if (res.ok) { const data = await res.json(); setCachedData(url, data); }
            }).catch(() => {});
        }
        return Promise.resolve(cached);
    }
    const token = (options.headers && (options.headers["Authorization"] || options.headers["authorization"])) ? null : await getFreshToken();
    const headers = { ...(options.headers || {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    setCachedData(url, data);
    return data;
}

/**
 * Single search request for one type path ('videos' or 'audio').
 * Flattens group/item structure and returns playable items.
 */
async function fetchSearchByType(query, lang, typePath, token) {
    const trimmed = query.trim().replace(/\s+/g, ' ');
    const finalQuery = (trimmed.includes(' ') && !trimmed.startsWith('"')) ? `"${trimmed}"` : trimmed;
    const url = `https://b.jw-cdn.org/apis/search/results/${lang}/${typePath}?sort=rel&q=${encodeURIComponent(finalQuery)}&clientType=tv`;

    const response = await fetch(url, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "x-client-id": AUTH_CONFIG.CLIENT_ID,
            "Referer": AUTH_CONFIG.REFERER,
            "accept": "application/json; charset=utf-8"
        }
    });

    const data = await response.json();
    const results = [];

    if (data.results && Array.isArray(data.results)) {
        data.results.forEach(entry => {
            if (entry.type === 'group' && Array.isArray(entry.results)) {
                results.push(...entry.results);
            } else if (entry.type === 'item') {
                results.push(entry);
            }
        });
    }

    return results.filter(item => item.subtype === 'video' || item.subtype === 'audio');
}

/**
 * Search with optional filter: 'all' | 'videos' | 'audio'.
 * For 'all', runs videos + audio in parallel and merges (avoids /all nesting/pagination issues).
 */
export async function fetchSearch(query, lang = 'E', filter = 'all') {
    const token = await getFreshToken();
    if (!token) throw new Error("Token fetch failed");

    if (filter === 'all') {
        const [videos, audio] = await Promise.all([
            fetchSearchByType(query, lang, 'videos', token),
            fetchSearchByType(query, lang, 'audio', token)
        ]);
        return [...videos, ...audio];
    }

    const typePath = filter === 'audio' ? 'audio' : 'videos';
    return fetchSearchByType(query, lang, typePath, token);
}

export async function fetchCategory(categoryKey, lang = 'E') {
    const url = `${API_BASE}/categories/${lang}/${categoryKey}?detailed=1&clientType=tv`;
    const token = await getFreshToken();
    if (!token) throw new Error("Token fetch failed");
    return fetchWithCache(url, { headers: { "Authorization": `Bearer ${token}` } });
}

/**
 * Fetch full media item (with files) by lank for search results.
 * URL: .../media-items/{lang}/{lank}?clientType=tv
 */

export async function fetchMediaByLank(lank, lang = 'E') {
    if (!lank) return null;
    const url = `${API_BASE}/media-items/${lang}/${encodeURIComponent(lank)}?clientType=tv`;
    const token = await getFreshToken();
    
    try {
        const data = await fetchWithCache(url, { 
            headers: { "Authorization": `Bearer ${token}` } 
        });

        // Use the structure confirmed by your JSON result
        const mediaArray = data.media || [];
        const mediaItem = mediaArray[0];

        if (mediaItem && mediaItem.files && mediaItem.files.length > 0) {
            return mediaItem; // Return the specific item for the player to use
        }

        console.warn("fetchMediaByLank: No playable files found in response.");
        return null;
    } catch (e) {
        console.warn("fetchMediaByLank failed:", lank, e);
        return null;
    }
}

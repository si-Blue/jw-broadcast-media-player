// languages.js
import { getFreshToken } from './auth.js';

let allLangs = [];
let lastFetch = 0;

const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

async function fetchAllLanguagesFromAPI() {
    const token = await getFreshToken();
    const url = "https://b.jw-cdn.org/apis/mediator/v1/languages/all/web";
    
    try {
        const response = await fetch(url, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await response.json();
        return data.languages;
    } catch (err) {
        console.error("Language API error:", err);
        return [{ code: 'E', name: 'English' }];
    }
}

export async function fetchAllLanguages(force = false) {
    const now = Date.now();
    if (force || !allLangs.length || (now - lastFetch > CACHE_DURATION)) {
        allLangs = await fetchAllLanguagesFromAPI();
        lastFetch = now;
    }
    return allLangs;
}

export async function fetchLanguages(offset = 0, limit = 50) {
    const languages = await fetchAllLanguages();
    return languages.slice(offset, offset + limit);
}
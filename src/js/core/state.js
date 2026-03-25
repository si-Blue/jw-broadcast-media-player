// state.js
export let userSettings = {
    language: localStorage.getItem('jw_language') || 'E',
    resolution: localStorage.getItem('jw_resolution') || '1080p',
    subtitles: localStorage.getItem('jw_subtitles') === 'true'
};

export let currentPlaylist = [];
export let playlistIndex = 0;
export let isRestoringState = false;

export function getLang() {
    return userSettings.language;
}

export function setLang(lang) {
    userSettings.language = lang;
    localStorage.setItem('jw_language', lang);
}

export function setResolution(res) {
    userSettings.resolution = res;
    localStorage.setItem('jw_resolution', res);
}

export function setSubtitles(enabled) {
    userSettings.subtitles = enabled;
    localStorage.setItem('jw_subtitles', String(enabled));
}

export function setPlaylist(newPlaylist, newIndex = 0) {
    currentPlaylist = newPlaylist;
    playlistIndex = newIndex;
}

export function setPlaylistIndex(newIndex) {
    playlistIndex = newIndex;
}

export function advancePlaylist() {
    playlistIndex++;
    return currentPlaylist[playlistIndex -1];
}

export function setIsRestoringState(val) {
    isRestoringState = val;
}

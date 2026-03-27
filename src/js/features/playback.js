import * as Player from './player.js';
import * as UI from './ui.js';
import * as Nav from '../core/navigation.js';
import * as State from '../core/state.js';
import * as Api from '../api/api.js';

let videoControlHandler = null;
let audioBackHandler = null;

/** localStorage key for resume position — must match all read sites in app.js */
export function getProgressStorageKey(item) {
    if (!item) return '';
    return `progress_${item.title}_${item.guid || item.lank}`;
}

function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function ensureVideoLoadingCover(playerContainer) {
    if (!playerContainer) return null;
    let cover = playerContainer.querySelector('.video-loading-cover');
    if (!cover) {
        cover = document.createElement('div');
        cover.className = 'video-loading-cover';
        playerContainer.appendChild(cover);
    }
    cover.classList.remove('hidden');
    return cover;
}

function playVideo(files, storageKey, startTime = 0, playNextOnEnd = true) {
    const playerContainer = document.getElementById('player-container');
    if (!playerContainer.querySelector('#player') || playerContainer.querySelector('.audio-player-ui')) {
        playerContainer.innerHTML = '<video id="player" autoplay controls tabindex="0" controlsList="nodownload noplaybackrate nofullscreen" disablePictureInPicture disableRemotePlayback></video>';
    }
    const player = document.getElementById('player');

    // Remove existing listener if it exists to prevent duplicates
    if (videoControlHandler) {
        playerContainer.removeEventListener('keydown', videoControlHandler, true);
    }

    const stream = Player.resolveMediaStream(files, State.userSettings.resolution);
    if (!stream?.url) return;

    player.querySelectorAll('track').forEach(t => t.remove());
    if (State.userSettings.subtitles && stream.subtitles) {
        Player.setupSubtitles(player, stream.subtitles, State.getLang());
    }

    const loadingCover = ensureVideoLoadingCover(playerContainer);
    playerContainer.classList.remove('hidden');
    playerContainer.querySelector('.playback-error-overlay')?.remove();
    history.pushState({ video: true }, '', window.location.href);
    player.src = stream.url;
    player.onerror = () => showPlaybackError(playerContainer);
    player.onloadeddata = () => {
        loadingCover?.classList.add('hidden');
    };
    player.onloadedmetadata = () => {
        playerContainer.querySelector('.playback-error-overlay')?.remove();
        if (startTime > 0) {
            try {
                player.currentTime = startTime;
            } catch (_) {}
        }
        player.play();
    };
    // webOS/Chromium: seek may apply after loadeddata; ensure resume position sticks
    if (startTime > 0) {
        const onceSeek = () => {
            if (player.readyState >= 1 && Math.abs(player.currentTime - startTime) > 2) {
                try {
                    player.currentTime = startTime;
                } catch (_) {}
            }
        };
        player.addEventListener('loadeddata', onceSeek, { once: true });
        player.addEventListener('canplay', onceSeek, { once: true });
    }
    player.ontimeupdate = () => {
        if (player.currentTime > 5) localStorage.setItem(storageKey, player.currentTime);
    };
    player.onended = () => {
        localStorage.removeItem(storageKey);
        if (playNextOnEnd) playNext();
        else stopVideo();
    };

    videoControlHandler = (e) => {
        const keyCode = e.keyCode || e.which;
        if (e.key === "Escape" || keyCode === 461) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            stopVideo();
            return false;
        }
        if (e.key === " " || e.key === "Enter" || keyCode === 13) {
            e.preventDefault();
            e.stopPropagation();
            if (player.paused) player.play(); else player.pause();
            return false;
        }
        if (keyCode === 37) { // Left Arrow
            e.preventDefault();
            player.currentTime = Math.max(0, player.currentTime - 10);
            return false;
        }
        if (keyCode === 39) { // Right Arrow
            e.preventDefault();
            player.currentTime = Math.min(player.duration, player.currentTime + 10);
            return false;
        }
        if (e.key === "m" || e.key === "M" || keyCode === 77) {
            e.preventDefault();
            player.muted = !player.muted;
            return false;
        }
    };
    playerContainer.addEventListener('keydown', videoControlHandler, true);
    player.focus();
    playerContainer.focus();
}

function playAudio(item, startTime = 0, playNextOnEnd = true) {
    const playerContainer = document.getElementById('player-container');
    const storageKey = getProgressStorageKey(item);
    const file = item.files?.find(f => f.progressiveDownloadURL)?.progressiveDownloadURL;
    if (!file) return;

    const currentIndex = State.currentPlaylist.findIndex(m => (m.guid && m.guid === item.guid) || (m.lank && m.lank === item.lank));
    if (currentIndex >= 0) State.setPlaylistIndex(currentIndex);

    const thumb = UI.getMediaThumbnailUrl(item, true);
    const rowTitle = item.rowTitle || document.getElementById('section-title')?.innerText || 'Audio';

    playerContainer.innerHTML = `
        <div class="audio-player-ui">
            <div class="audio-player-now-playing">
                <div class="audio-player-thumbnail">
                    <img src="${escapeHtml(thumb)}" alt="${escapeHtml(item.title)}" onerror="this.src='icon.png'">
                </div>
                <div class="audio-player-info">
                    <h2 class="audio-player-title">${escapeHtml(item.title)}</h2>
                    <button id="audio-pause-btn" class="audio-pause-button" tabindex="50">
                        <svg viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                        <span>Pause</span>
                    </button>
                    <div class="audio-progress-bar-wrap">
                        <span id="audio-elapsed" class="audio-time">0:00</span>
                        <div id="audio-progress-track" class="audio-progress-track" tabindex="51">
                            <div id="audio-progress-fill" class="audio-progress-fill"></div>
                        </div>
                        <span id="audio-remaining" class="audio-time">0:00</span>
                    </div>
                </div>
            </div>
            <div class="audio-player-playlist-section">
                <h2 class="audio-playlist-title">${escapeHtml(rowTitle)}</h2>
                <div class="audio-playlist-row" id="audio-playlist-items"></div>
            </div>
        </div>
        <video id="player" style="display: none;" controls controlsList="nodownload noplaybackrate nofullscreen" disablePictureInPicture disableRemotePlayback></video>
    `;

    const playlistContainer = document.getElementById('audio-playlist-items');
    if (playlistContainer && State.currentPlaylist.length > 0) {
        State.currentPlaylist.forEach((audioItem, idx) => {
            const card = UI.createMediaCard(audioItem, idx, true, () => {
                State.setPlaylistIndex(idx);
                playAudio(audioItem, 0);
            });
            if (idx === State.playlistIndex) {
                card.style.borderColor = "#4a90e2";
                card.style.borderWidth = "4px";
            }
            playlistContainer.appendChild(card);
        });
        UI.observeLazyImages();
    }

    const audioPlayer = playerContainer.querySelector('#player');

    function formatTime(seconds) {
        if (seconds == null || !isFinite(seconds) || seconds < 0) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    }

    function updateAudioProgressBar() {
        const elapsedEl = document.getElementById('audio-elapsed');
        const remainingEl = document.getElementById('audio-remaining');
        const fillEl = document.getElementById('audio-progress-fill');
        if (!elapsedEl || !remainingEl || !fillEl) return;
        const t = audioPlayer.currentTime;
        const d = audioPlayer.duration;
        elapsedEl.textContent = formatTime(t);
        remainingEl.textContent = d && isFinite(d) ? `-${formatTime(d - t)}` : "0:00";
        const pct = d && d > 0 ? (t / d) * 100 : 0;
        fillEl.style.width = `${pct}%`;
    }

    const progressTrack = document.getElementById('audio-progress-track');
    if (progressTrack) {
        progressTrack.addEventListener('click', (e) => {
            const d = audioPlayer.duration;
            if (!d || !isFinite(d)) return;
            const rect = progressTrack.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const pct = Math.max(0, Math.min(1, x / rect.width));
            audioPlayer.currentTime = pct * d;
        });
        progressTrack.addEventListener('keydown', (e) => {
            const keyCode = e.keyCode || e.which;
            const d = audioPlayer.duration;
            if (keyCode === 37) {
                e.preventDefault();
                audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 10);
            } else if (keyCode === 39 && d && isFinite(d)) {
                e.preventDefault();
                audioPlayer.currentTime = Math.min(d, audioPlayer.currentTime + 10);
            }
        });
    }

    playerContainer.querySelector('.playback-error-overlay')?.remove();
    audioPlayer.src = file;
    audioPlayer.onerror = () => showPlaybackError(playerContainer);
    audioPlayer.onloadedmetadata = () => {
        playerContainer.querySelector('.playback-error-overlay')?.remove();
        audioPlayer.currentTime = startTime;
        updateAudioProgressBar();
        audioPlayer.play();
    };
    audioPlayer.ontimeupdate = () => {
        updateAudioProgressBar();
        if (audioPlayer.currentTime > 5) localStorage.setItem(storageKey, audioPlayer.currentTime);
    };
    audioPlayer.onended = () => {
        localStorage.removeItem(storageKey);
        if (playNextOnEnd) playNext();
        else stopVideo();
    };

    const pauseBtn = document.getElementById('audio-pause-btn');
    if (pauseBtn) {
        const pathEl = pauseBtn.querySelector('svg path');
        pauseBtn.onclick = () => {
            if (audioPlayer.paused) {
                audioPlayer.play();
                pauseBtn.querySelector('span').innerText = "Pause";
                if (pathEl) pathEl.setAttribute('d', 'M6 4h4v16H6V4zm8 0h4v16h-4V4z');
            } else {
                audioPlayer.pause();
                pauseBtn.querySelector('span').innerText = "Play";
                if (pathEl) pathEl.setAttribute('d', 'M8 5v14l11-7z');
            }
        };
    }

    playerContainer.classList.remove('hidden');
    history.pushState({ video: true }, '', window.location.href);
    Nav.registerSpatialNavigationForNewContent();

    if (audioBackHandler) {
        playerContainer.removeEventListener('keydown', audioBackHandler, true);
    }
    audioBackHandler = (e) => {
        if (e.key === "Escape" || e.keyCode === 461) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            stopVideo();
            return false;
        }
    };
    playerContainer.addEventListener('keydown', audioBackHandler, true);
    playerContainer.focus();
    setTimeout(() => {
        const pb = document.getElementById('audio-pause-btn');
        if (pb) pb.focus();
    }, 100);
}

/**
 * Show user-facing playback error overlay in the player container.
 */
function showPlaybackError(playerContainer) {
    if (!playerContainer || playerContainer.querySelector('.playback-error-overlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'playback-error-overlay';
    overlay.innerHTML = '<p>Playback failed. Check your connection or try another item.</p><button type="button" class="error-close-btn" tabindex="60">Close</button>';
    overlay.querySelector('.error-close-btn').onclick = () => stopVideo();
    playerContainer.appendChild(overlay);
    Nav.registerSpatialNavigationForNewContent();
}

function stopVideo() {
    const playerContainer = document.getElementById('player-container');
    if (playerContainer && videoControlHandler) {
        playerContainer.removeEventListener('keydown', videoControlHandler, true);
        videoControlHandler = null;
    }
    if (playerContainer && audioBackHandler) {
        playerContainer.removeEventListener('keydown', audioBackHandler, true);
        audioBackHandler = null;
    }
    const player = playerContainer?.querySelector('#player') || document.getElementById('player');
    if (player) {
        player.pause();
        player.src = "";
        const newPlayer = player.cloneNode(false);
        if (player.parentNode) {
            player.parentNode.replaceChild(newPlayer, player);
        }
    }
    if (playerContainer) {
        playerContainer.classList.add('hidden');
        playerContainer.innerHTML = '<video id="player" autoplay controls tabindex="0" controlsList="nodownload noplaybackrate nofullscreen" disablePictureInPicture disableRemotePlayback></video><div class="video-loading-cover hidden"></div>';
        playerContainer.blur();
    }
}

async function playNext() {
    if (State.playlistIndex >= State.currentPlaylist.length) {
        stopVideo();
        return;
    }
    let item = State.advancePlaylist();
    if (!item) {
        stopVideo();
        return;
    }
    if (item.lank && !item.files?.length) {
        const full = await Api.fetchMediaByLank(item.lank, State.getLang());
        if (full) {
            if (full.files) item.files = full.files;
            if (full.guid != null) item.guid = full.guid;
        }
    }
    const storageKey = getProgressStorageKey(item);
    const isAudio = item.type === 'audio' || item.subtype === 'audio' || !item.files?.some(f => f.label?.includes('p'));
    if (isAudio) {
        if (item.files?.some?.(f => f.progressiveDownloadURL)) playAudio(item);
        else stopVideo();
    } else if (item.files?.length) {
        playVideo(item.files, storageKey);
    } else {
        stopVideo();
    }
}

/**
 * Handle Enter key when video is visible (e.g. from global keydown when focus is not on player).
 * Toggles pause. Returns true if handled so caller can preventDefault and skip click-on-focused.
 */
function handleVideoEnterKey() {
    const playerContainer = document.getElementById('player-container');
    if (!playerContainer || playerContainer.classList.contains('hidden')) return false;
    if (playerContainer.querySelector('.audio-player-ui')) return false;
    const player = document.getElementById('player');
    if (!player || !player.src) return false;
    if (player.paused) player.play();
    else player.pause();
    return true;
}

/**
 * Handle Left/Right arrow when video is visible. Seeks -10s / +10s.
 * Returns true if handled so caller can preventDefault.
 */
function handleVideoArrowKey(keyCode) {
    const playerContainer = document.getElementById('player-container');
    if (!playerContainer || playerContainer.classList.contains('hidden')) return false;
    if (playerContainer.querySelector('.audio-player-ui')) return false;
    const player = document.getElementById('player');
    if (!player || !player.src) return false;
    if (keyCode === 37) {
        player.currentTime = Math.max(0, player.currentTime - 10);
        return true;
    }
    if (keyCode === 39) {
        const d = player.duration;
        if (d && isFinite(d)) player.currentTime = Math.min(d, player.currentTime + 10);
        return true;
    }
    return false;
}

/**
 * On Up/Down: move focus to the video so the user can reach the native control bar (e.g. 3-dot menu).
 * Only focuses when focus is currently outside the player; if already inside, returns false so the
 * browser can use Up/Down for in-control navigation (e.g. to the captions menu).
 */
function focusVideoForRemoteNavigation() {
    const playerContainer = document.getElementById('player-container');
    if (!playerContainer || playerContainer.classList.contains('hidden')) return false;
    if (playerContainer.querySelector('.audio-player-ui')) return false;
    const player = document.getElementById('player');
    if (!player || !player.src) return false;
    const active = document.activeElement;
    if (active && playerContainer.contains(active)) return false;
    player.focus();
    return true;
}

export { playVideo, playAudio, stopVideo, playNext, handleVideoEnterKey, handleVideoArrowKey, focusVideoForRemoteNavigation };

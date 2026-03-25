// player.js

/**
 * Resolves the best available MP4 and its subtitle track.
 */
export function resolveMediaStream(files, preferredRes = '1080p') {
    if (!files || files.length === 0) return null;

    const mp4Files = files.filter(f => f.progressiveDownloadURL);
    let selected = mp4Files.find(f => f.label === preferredRes);
    
    if (!selected) {
        const resolutionOrder = ['1080p', '720p', '480p', '360p', '240p'];
        for (const res of resolutionOrder) {
            selected = mp4Files.find(f => f.label === res);
            if (selected) break;
        }
    }

    selected = selected || mp4Files[0];

    return {
        url: selected?.progressiveDownloadURL,
        subtitles: selected?.subtitles?.url || null
    };
}

/**
 * Attaches a subtitle track to a video element if subtitles are enabled.
 */
export function setupSubtitles(videoElement, subtitleUrl, lang) {
    // Clear existing tracks
    const tracks = videoElement.querySelectorAll('track');
    tracks.forEach(t => t.remove());

    if (subtitleUrl) {
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = 'Subtitles';
        track.srclang = lang.toLowerCase();
        track.src = subtitleUrl;
        track.default = true;
        
        // Ensure CORS allows track loading
        track.setAttribute('crossorigin', 'anonymous');
        videoElement.appendChild(track);
    }
}
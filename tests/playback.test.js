import * as State from '../src/js/core/state.js';
import { playAudio, playNext, playVideo, stopVideo } from '../src/js/features/playback.js';

describe('playback safety', () => {
    it('playNext does not throw when playlist is empty', async () => {
        document.body.innerHTML = '<div id="player-container" class="hidden"></div>';
        State.setPlaylist([], 0);
        await expect(playNext()).resolves.toBeUndefined();
    });

    it('playNext does not throw when playlist index is invalid', async () => {
        document.body.innerHTML = '<div id="player-container" class="hidden"></div>';
        State.setPlaylist([{ guid: 'x', files: [] }], Number.NaN);
        await expect(playNext()).resolves.toBeUndefined();
    });

    it('replaces audio back handler instead of accumulating listeners', () => {
        document.body.innerHTML = `
            <div id="player-container" class="hidden" tabindex="-1"></div>
            <h2 id="section-title">Audio</h2>
        `;
        const playerContainer = document.getElementById('player-container');
        const removeSpy = vi.spyOn(playerContainer, 'removeEventListener');
        const addSpy = vi.spyOn(playerContainer, 'addEventListener');
        const item = {
            guid: 'audio-1',
            title: 'Track',
            files: [{ progressiveDownloadURL: 'https://example.com/a.mp3' }],
            type: 'audio'
        };
        State.setPlaylist([item], 0);

        playAudio(item, 0, false);
        playAudio(item, 0, false);
        stopVideo();

        expect(addSpy).toHaveBeenCalled();
        expect(removeSpy).toHaveBeenCalled();
    });

    it('shows loading cover until first video frame loads', () => {
        document.body.innerHTML = '<div id="player-container" class="hidden"><video id="player"></video></div>';
        playVideo([{ label: '720p', progressiveDownloadURL: 'https://example.com/v.mp4' }], 'progress_test', 0, false);
        const playerContainer = document.getElementById('player-container');
        const player = document.getElementById('player');
        const cover = playerContainer.querySelector('.video-loading-cover');

        expect(cover).not.toBeNull();
        expect(cover.classList.contains('hidden')).toBe(false);

        player.onloadeddata?.();
        expect(cover.classList.contains('hidden')).toBe(true);
    });
});

import * as State from '../src/js/core/state.js';

describe('state module', () => {
    it('sets and gets language from state', () => {
        State.setLang('F');
        expect(State.getLang()).toBe('F');
    });

    it('updates playlist and advances safely', () => {
        State.setPlaylist([{ guid: 'a' }, { guid: 'b' }], 0);
        const first = State.advancePlaylist();
        const second = State.advancePlaylist();
        expect(first.guid).toBe('a');
        expect(second.guid).toBe('b');
    });

    it('returns undefined when advancing empty playlist', () => {
        State.setPlaylist([], 0);
        const item = State.advancePlaylist();
        expect(item).toBeUndefined();
    });
});

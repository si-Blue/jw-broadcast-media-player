import { navigationStack, saveNavigationState, setNavigationStack } from '../src/js/core/navigation.js';

describe('navigation stack limits', () => {
    beforeEach(() => {
        setNavigationStack([]);
    });

    it('caps stack size to avoid memory growth', () => {
        for (let i = 0; i < 7; i += 1) {
            saveNavigationState({
                view: `View ${i}`,
                containerHTML: `<div>${i}</div>`,
                heroHTML: '',
                containerClass: '',
                currentPlaylist: [],
                playlistIndex: 0,
                rowItemsMap: {}
            });
        }

        expect(navigationStack.length).toBe(5);
        expect(navigationStack[0].view).toBe('View 2');
        expect(navigationStack[4].view).toBe('View 6');
    });

    it('does not push loading screens into stack', () => {
        saveNavigationState({
            view: 'Loading',
            containerHTML: '<div id="app-loading-spinner"></div>'
        });
        expect(navigationStack.length).toBe(0);
    });
});

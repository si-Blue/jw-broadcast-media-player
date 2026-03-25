import { vi } from 'vitest';

globalThis.SpatialNavigation = {
    init: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    makeFocusable: vi.fn(),
    focus: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn()
};

globalThis.webOS = {
    platformBack: vi.fn()
};

globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
};

beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    vi.clearAllMocks();
});

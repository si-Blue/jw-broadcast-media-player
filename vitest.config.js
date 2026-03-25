const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./tests/setup.js'],
        include: ['tests/**/*.test.js']
    }
});

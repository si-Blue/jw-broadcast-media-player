// auth.js
export const AUTH_CONFIG = {
    TOKEN_URL: 'https://b.jw-cdn.org/tokens/jworg.jwt',
    CLIENT_ID: 'eae43721-6bea-4093-ad82-6d47c432633a',
    REFERER: 'https://www.jw.org/'
};

/**
 * Fetches the latest JWT token from the public CDN.
 * Used for both Search and Mediator API calls.
 */
export async function getFreshToken() {
    try {
        const response = await fetch(AUTH_CONFIG.TOKEN_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error("Token fetch failed");
        const token = await response.text();
        return token.trim();
    } catch (err) {
        console.error("Auth Error:", err);
        return null;
    }
}
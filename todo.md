# Project Improvement Plan

- [x] **Code Structure:** Refactor `app.js` by moving playback-related logic (`playVideo`, `playAudio`, `stopVideo`, `playNext`) into a new `playback.js` module.
- [x] **Performance - Perceived Load Time:** Modify the content loading functions (`loadHomePage`, `loadContentPage`, etc.) to ensure the UI updates only after all necessary data has been fetched. This will prevent the screen from populating in stages and instead show a loading indicator until the content is fully ready to be displayed.
- [x] **Performance - Lazy Loading:** Implement lazy loading for images within the media cards (`ui.js`) to improve initial load times and reduce network requests.
- [x] **Error Handling:** Implement user-facing error messages for failed API requests and media playback errors.
- [x] **Settings - Language Search:** Add a search input field to the settings page to allow users to filter the language list.

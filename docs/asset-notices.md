# Asset and License Notes

All currently referenced assets are stored in this project. No image depends on a Downloads folder, temporary screenshot path, or external image host. The build copies the full `assets/` folder, including original variants, so nothing is lost from the handoff.

## Fonts: Review Before Public Upload

`assets/fonts/ABCFavoritMono-Bold.otf` and `ABCFavoritMono-Book.otf` are bundled to preserve the requested typography. No accompanying license document was found in the project. Possession of font files does not establish permission to redistribute them in a public Git repository or serve them as webfonts.

Confirm the license covers the intended domain and distribution method before making the repository public or deploying. If public redistribution is not allowed, use the licensed webfont delivery method or replace these files and their `@font-face` declarations with a font you may publish. A private repository does not by itself authorize public web use. This setup has not purchased or verified a font license.

## Images

- Runtime art includes the logo, hero sticker, bear sprites, campus/CIT and statue images, cloud banks, member card, and social preview.
- Original exports and unused variants remain in `assets/images/` for editing and completeness.
- Artwork origin/permission records were not supplied for every file. The site owner must confirm publication rights; this package does not assign an open-source license to the images.
- No real member portraits are included. Obtain consent before adding names or photographs.

## Vendored Code

`assets/js/tetris-engine.js` bundles `tetris-engine` 1.2.18. Its ISC license and source provenance are retained in `assets/js/tetris-engine.LICENSE.txt` and included in the deployed assets. `scripts/vendor-tetris.mjs` documents the optional rebuild procedure; normal builds do not fetch or regenerate the engine.

The project stays `UNLICENSED` in `package.json` until the owner chooses a code license. That setting is not a license for third-party assets.

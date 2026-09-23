# Content Checklist

Use this before launch.

- [ ] Confirm permissions for the bundled ABC Favorit Mono fonts, including web use and public-repository redistribution. See `asset-notices.md`. Do this before a public push.
- [ ] Add real Discord and Instagram URLs in `assets/data/site-content.json`; empty entries intentionally stay inactive. The 24 resource links are populated; review them periodically (see `resource-links.md`).
- [ ] Confirm that `mailto:csdug@brown.edu` is the correct monitored contact address.
- [ ] Confirm or replace the sample event dates, times, and locations in `index.html`. They are not connected to a live calendar.
- [ ] Set `siteUrl` or the `SITE_URL` build variable. GitHub Pages' workflow fills this automatically.
- [ ] Keep the requested generic member templates for a draft, or replace the `team-member-data` roster for public launch. Four cards per page are calculated automatically.
- [ ] Add approved member portraits when available; the blank frames currently work without external files.
- [ ] Update the social preview art if desired; the existing SVG preview may not display on all social platforms, which often require PNG/JPEG.
- [ ] Confirm permission to publish all included artwork, logos, photos, and names, including original/unused image variants copied with the assets.
- [ ] Only after review, set the three `launchReview` flags in `site-content.json` to `true`.
- [ ] Run `npm run check`, `npm test`, and `npm run build`.
- [ ] Run `npm run check:launch` to list outstanding content items. Generic roster templates remain a warning until replaced.
- [ ] Test the built site on desktop/mobile: section navigation, Space jump, About folders, card pagination, contact/resource links.

Builds are allowed for draft previews. A successful build is not a claim that event content, links, or asset licensing have been approved. Do not put credentials or private information in `site-content.json`; it is public site data.

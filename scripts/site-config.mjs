import { readFile } from 'node:fs/promises';

export const linkKeys = [
  'instagram', 'discord', 'email',
  'courseCatalog', 'concentrationRequirements', 'concentrationHandbook', 'advising', 'studyAbroad', 'mastersOptions',
  'careerCourseMap', 'techRecruiting', 'csGigs', 'careerEvents', 'resumeInterviews', 'alumniNetwork',
  'researchOpenings', 'researchGroups', 'researchGuide', 'researchFunding', 'honorsGuide', 'thesisArchive',
  'taApplications', 'studentJobs', 'researchSymposium', 'studentGroups', 'roomsLabs', 'undergradResources'
];

export function validateConfig(config) {
  if (typeof config.siteUrl !== 'string') throw new Error('siteUrl must be a string.');
  if (config.siteUrl) {
    const url = new URL(config.siteUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
      throw new Error('siteUrl must be a public HTTPS URL without credentials, a query, or a hash.');
    }
  }
  for (const key of linkKeys) {
    const value = config.links?.[key];
    if (typeof value !== 'string') throw new Error(`links.${key} must be a string (empty is allowed).`);
    if (!value) continue;
    if (key === 'email') {
      if (!/^mailto:[^\s@?<>]+@[^\s@?<>]+\.[^\s@?<>]+$/.test(value)) {
        throw new Error('links.email must be a mailto: email address.');
      }
    } else {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password) {
        throw new Error(`links.${key} must be an HTTPS URL without credentials.`);
      }
    }
  }
  for (const key of ['eventDetailsConfirmed', 'contactEmailConfirmed', 'assetAndFontRightsConfirmed']) {
    if (typeof config.launchReview?.[key] !== 'boolean') throw new Error(`launchReview.${key} must be a boolean.`);
  }
  return config;
}

export async function readConfig(root, siteUrl = process.env.SITE_URL) {
  const config = JSON.parse(await readFile(new URL('assets/data/site-content.json', root), 'utf8'));
  if (siteUrl !== undefined) config.siteUrl = siteUrl;
  return validateConfig(config);
}

export function escapeMarkup(text) {
  return text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export function baseUrl(config) {
  return config.siteUrl ? `${config.siteUrl.replace(/\/+$/, '')}/` : '';
}

export function renderSite(source, config) {
  validateConfig(config);
  // Only these explicit template slots are substituted; page markup and game code stay untouched.
  let html = source.replace(/<(span|a) data-site-link="([A-Za-z]+)"[^>]*>([^<]*)<\/\1>/g, (_, tag, key, label) => {
    if (!linkKeys.includes(key)) throw new Error(`Unknown site link: ${key}`);
    const url = config.links[key];
    return url
      ? `<a data-site-link="${key}" href="${escapeMarkup(url)}">${label}</a>`
      : `<span data-site-link="${key}" aria-disabled="true" title="Link coming soon">${label} <small class="link-pending">(soon)</small></span>`;
  });
  const url = baseUrl(config);
  if (url) {
    html = html.replace('<!-- deployment-metadata -->',
      `<link rel="canonical" href="${escapeMarkup(url)}">\n<meta property="og:url" content="${escapeMarkup(url)}">`);
    html = html.replace('content="assets/images/social-preview.svg"',
      `content="${escapeMarkup(new URL('assets/images/social-preview.svg', url).href)}"`);
  }
  return html;
}

export function launchWarnings(config, html) {
  const warnings = linkKeys.filter(key => !config.links[key]).map(key => `Add links.${key} in assets/data/site-content.json.`);
  if (!config.siteUrl) warnings.push('Set siteUrl (or SITE_URL) for canonical URLs and the sitemap.');
  if (!config.launchReview.eventDetailsConfirmed) warnings.push('Confirm or replace the sample events and their dates.');
  if (!config.launchReview.contactEmailConfirmed) warnings.push('Confirm the contact email address.');
  if (!config.launchReview.assetAndFontRightsConfirmed) warnings.push('Confirm artwork and ABC Favorit Mono web-use/public-repository permissions.');
  if (/"name"\s*:\s*"Name"/.test(html)) warnings.push('The member roster intentionally still contains template cards.');
  return warnings;
}

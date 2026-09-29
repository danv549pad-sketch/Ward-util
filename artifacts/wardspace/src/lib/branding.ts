/** Site copy lives here so another ward can change it without editing screens. */
const label = (value: string | undefined, fallback: string) => value?.trim() || fallback;

export const branding = {
  productName: 'WardSpace',
  siteName: label(import.meta.env.VITE_WARDSPACE_SITE_NAME, 'Ysbyty Glan Clwyd'),
  organisationName: label(import.meta.env.VITE_WARDSPACE_ORG_NAME, 'Betsi Cadwaladr University Health Board'),
  organisationNameCy: label(import.meta.env.VITE_WARDSPACE_ORG_NAME_CY, 'Bwrdd Iechyd Prifysgol Betsi Cadwaladr'),
  // Only a deployed, approved same-origin asset is supported; never load a remote logo.
  organisationLogo: (() => {
    const path = import.meta.env.VITE_WARDSPACE_ORG_LOGO?.trim();
    return path && path.startsWith('/') && !path.startsWith('//') ? path : undefined;
  })(),
  prototype: import.meta.env.VITE_WARDSPACE_PROTOTYPE !== 'false',
} as const;
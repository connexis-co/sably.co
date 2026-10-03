/** EmDash themes are Astro templates: replacing one requires a build/deployment. */
export const SABLY_THEME = {
  id: 'sably-classic',
  name: 'Sably Classic',
  version: '1.0.0',
  contentContract: 'sably-content-v1',
  emdashVersion: '1.1.0',
  layouts: ['sably-classic'],
  blocks: ['sably_rich_text', 'sably_image', 'sably_hero', 'sably_cta', 'sably_faq', 'sably_story', 'sably_cards', 'sably_contact'],
  menus: ['primary', 'footer', 'social'],
  widgetAreas: ['header_after', 'footer_after'],
} as const;

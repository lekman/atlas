/**
 * The console's seven sections, in rail order, and the line icons the rail
 * and the top bar draw. Each icon is the inner markup of a 24 by 24 SVG,
 * drawn with `currentColor` strokes so it takes the colour of its button.
 */

export const sections = [
  "map",
  "radar",
  "missions",
  "agents",
  "beam",
  "shields",
  "log",
] as const;
export type Section = (typeof sections)[number];

/** The word each section is shown by, in the rail and in its heading. */
export const sectionNames: Record<Section, string> = {
  map: "Map",
  radar: "Radar",
  missions: "Missions",
  agents: "Agents",
  beam: "Beam",
  shields: "Shields",
  log: "Log",
};

/** What each section holds, for its heading and for screen readers. */
export const sectionPurposes: Record<Section, string> = {
  map: "Systems, missions and agents on the star map",
  radar: "Alerts, tickets and meetings that are not yet your work",
  missions: "Your tasks, grouped into missions",
  agents: "Every agent, by the host it runs on",
  beam: "Approvals and questions from agents",
  shields: "Hosts, the relay and integrations",
  log: "Scores by day and week, and completed missions",
};

const stroke =
  'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';

export const consoleIcons = {
  map: `<g ${stroke}><circle cx="12" cy="12" r="8.5"/><path d="M12 6.5l2.2 5.5L12 17.5 9.8 12z"/></g>`,
  radar: `<g ${stroke}><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><path d="M12 12l6-6"/></g><circle cx="12" cy="12" r="1.3" fill="currentColor"/>`,
  missions: `<g ${stroke}><path d="M6 21V4"/><path d="M6 4.5h11l-2.5 4 2.5 4H6"/></g>`,
  agents: `<g ${stroke}><path d="M12 4l8 15H4z"/></g>`,
  beam: `<g ${stroke}><path d="M5 19l6-6"/><path d="M13 5a6 6 0 0 1 6 6"/><path d="M13 9a2 2 0 0 1 2 2"/></g><circle cx="11.5" cy="12.5" r="1.4" fill="currentColor"/>`,
  shields: `<g ${stroke}><path d="M12 3.5l7 2.5v5.5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z"/></g>`,
  log: `<g ${stroke}><rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/></g>`,
  swap: `<g ${stroke}><path d="M4 9h15l-3.5-3.5"/><path d="M20 15H5l3.5 3.5"/></g>`,
  settings: `<g ${stroke}><circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/></g>`,
  back: `<g ${stroke}><path d="M15 5l-7 7 7 7"/></g>`,
  calendar: `<g ${stroke}><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></g>`,
  filter: `<g ${stroke}><path d="M4 5.5h16l-6.2 7.4v5.4l-3.6 1.9v-7.3z"/></g>`,
  sound: `<g ${stroke}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></g>`,
  muted: `<g ${stroke}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></g>`,
  more: `<circle cx="5.5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="18.5" cy="12" r="1.8" fill="currentColor"/>`,
  logo: `<circle cx="12" cy="12" r="3.2" fill="currentColor"/><ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(-24 12 12)" ${stroke}/>`,
} as const;
export type ConsoleIconName = keyof typeof consoleIcons;

export const penIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 3 7 7-5 10-12 1 1-12Z M4 21l7-7 M14 3l-3 8 5 5 5-6"/><circle cx="12" cy="13" r="2"/></svg>';
export const pencilIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 4 5 5-12 12-5 1 1-5Z M13 6l5 5 M4 17l4 4"/></svg>';
export const commentIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 1-8 8H4v-8a8 8 0 1 1 16 0Z"/><path d="M8 9h8 M8 13h5"/></svg>';
export const chevronIcon =
  '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3"/></svg>';
export const eyeIcon = (hidden) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>${hidden ? '<path d="M3 3l18 18"/>' : ""}</svg>`;
export const lockIcon = (locked) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="${locked ? "M8 10V6a4 4 0 0 1 8 0v4" : "M8 10V6a4 4 0 0 1 8 0"}"/><path d="M12 14v3"/></svg>`;

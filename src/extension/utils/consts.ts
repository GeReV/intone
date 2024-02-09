export const LANG_MAP: Record<string, string> = {
  iw: "he"
};

export const UNSUPPORTED_SITES: (string | RegExp)[] = [
  "https://chrome.google.com/webstore",
  "https://addons.mozilla.org",
  "chrome:",
  "about:",
];

export const ENTITY_MAP: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
  "/": "&#x2F;",
  "`": "&#x60;",
  "=": "&#x3D;"
};
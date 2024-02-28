const MONTH_ABBREVS = {
  Jan: "January",
  Feb: "February",
  Mar: "March",
  Apr: "April",
  May: "May",
  Jun: "June",
  Jul: "July",
  Aug: "August",
  Sep: "September",
  Oct: "October",
  Nov: "November",
  Dec: "December",
} as const;

export function expandMonths(text: string): string {
  for (const [abbrev, expansion] of Object.entries(MONTH_ABBREVS)) {
    text = text.replaceAll(abbrev + ".", expansion);
  }

  return text;
}

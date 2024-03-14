type UnitDescription = string | Partial<Record<Intl.LDMLPluralRule, string>>;
type UnitDictionary = ReadonlyMap<string | RegExp, UnitDescription>;

const enCardinalRules = new Intl.PluralRules("en-US", { type: "cardinal" });
const enNumberFormat = new Intl.NumberFormat("en-US");

const uncounted = (unit: string) => ({
  one: unit,
  other: unit,
});

const plural = (singular: string, plural: string) => ({
  one: singular,
  other: plural,
});

// NOTE: Keep compound units first, from most complex to least (i.e. acceleration before velocity).
const UNIT_ABBREVS: UnitDictionary = new Map<string | RegExp, UnitDescription>([
  [/\bm(?:eters?)?\/s(?:\^2|²)\b/, plural("meter per second squared", "meters per second squared")],

  [/\bm(?:eters?)?\/s(?![\^²])/, plural("meter per second", "meters per second")],
  ["mph", plural("mile per hour", "miles per hour")],
  ["kph", plural("kilometer per hour", "kilometers per hour")],
  ["km/h", plural("kilometer per hour", "kilometers per hour")],

  ["nm", "nanometer"],
  ["um", "micrometer"],
  ["\u00b5m", "micrometer"], // TODO: Why do these not work in a regex?
  ["\u03bcm", "micrometer"],
  ["mm", "millimeter"],
  ["cm", "centimeter"],
  ["m", "meter"],
  ["km", "kilometer"],

  ["mcg", "microgram"],
  ["mg", "milligram"],
  ["g", "gram"],
  ["kg", "kilogram"],
  [/\b[tT]\b/, "ton"],

  ["ft", plural("foot", "feet")],
  [/(?<=\S)in|in\./, plural("inch", "inches")],
  ["yd", "yard"],
  ["mi", "mile"],

  [/\blbs?\b/, "pound"],
  ["oz", "ounce"],

  ["tsp", "teaspoon"],
  [/\btbsp?\b/, "tablespoon"],

  ["ml", "milliliter"],
  ["l", "liter"],
  ["gal", "gallon"],

  ["cal", "calorie"],

  ["B", "byte"],
  [/\bKB|kb\b/, "kilobyte"],
  [/\bMB|mb\b/, "megabyte"],
  [/\bGB|gb\b/, "gigabyte"],
  [/\bTB|tb\b/, "terabyte"],
  [/\bPB|pb\b/, "petabyte"],

  [/\bm[wW]h\b/, "milliwatt-hours"],
  [/\b[wW]h\b/, "watt-hour"],
  [/\bk[wW]h\b/, "kilowatt-hour"],
  [/\bM[wW]h\b/, "megawatt-hour"],
  [/\bG[wW]h\b/, "gigawatt-hour"],
  [/\bT[wW]h\b/, "terawatt-hour"],

  [/\bm[wW]\b/, "milliwatt"],
  [/\b[wW]\b/, "watt"],
  ["kW", "kilowatt"],
  ["MW", "megawatt"],
  ["GW", "gigawatt"],
  ["TW", "terawatt"],

  [/\bm[aA]\b/, "milliamp"],
  [/\b[aA]\b/, "amp"],

  [/\bm[vV]\b/, "millivolt"],
  [/\b[vV]\b/, "volt"],

  ["eV", "electronvolt"],

  [/\b(?:deg |°\s?)F\b/, plural("degree Fahrenheit", "degrees Fahrenheit")],
  [/\b(?:deg |°\s?)C\b/, plural("degree Celsius", "degrees Celsius")],
  [/\b(?:deg |°\s?)K\b/, plural("degree Kelvin", "degrees Kelvin")],

  // Keep these after the ones with "deg".
  ["F", uncounted("Fahrenheit")],
  ["C", uncounted("Celsius")],
  ["K", uncounted("Kelvin")],

  [/\b(?:°|deg)\b/, "degree"],

  ["cd", uncounted("candela")],

  ["s", "second"],
  ["h", "hour"],
  ["d", "day"],
  ["y", "year"],

  [/\b[kK][hH]z\b/, uncounted("kilo-Hertz")],
  [/\bM[hH]z\b/, uncounted("mega-Hertz")],
  [/\bG[hH]z\b/, uncounted("giga-Hertz")],

  ["J", "Joule"],
  ["kJ", "kilo-Joule"],
]);

const NUMBER_REGEX = /-?\d+(?:\.\d*)?(?:[Ee][+-]?\d+)?|\d*\.\d+|\d+/;
const UNIT_REGEX = new RegExp([...UNIT_ABBREVS.keys()].map(abbrev => abbrev instanceof RegExp ? abbrev.source : abbrev).join("|"), "u");
const QUANTITY_REGEX = new RegExp(`\\b(${NUMBER_REGEX.source})[\\s-]*(${UNIT_REGEX.source.replaceAll("\\b", "")})\\b`, "gu");

function find<T>(iter: Iterable<T>, fn: (value: T) => boolean): T | undefined {
  for (const value of iter) {
    if (fn(value)) {
      return value;
    }
  }
}

export function expandUnits(text: string): string {
  return text.replace(QUANTITY_REGEX, (match, num: string, abbrev: string) => {
    const n = parseFloat(num);
    num = enNumberFormat.format(n);

    const result = find(UNIT_ABBREVS, ([k,]) => typeof k === "string" ? k === abbrev : k.test(abbrev));

    if (result) {
      const [, unit] = result;
      const rule = enCardinalRules.select(n);

      if (typeof unit === "string") {
        return `${num} ${unit}` + (rule === "one" ? "" : "s");
      }

      return `${num} ${unit[rule]}`;
    }

    return `${num} ${abbrev}`;
  });
}

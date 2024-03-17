import re

def compile(pattern):
  return re.compile(pattern, re.IGNORECASE)

def uncounted(unit):
  return {
    "one": unit,
    "other": unit,
  }

def plural(singular, plural):
  return {
    "one": singular,
    "other": plural,
  }

units = [
  (compile("\\bm(?:eters?)?\/s(?:\^2|²)\\b"), plural("meter per second squared", "meters per second squared")),

  (compile("\\bm(?:eters?)?\/s(?![\^²])"), plural("meter per second", "meters per second")),
  ("mph", plural("mile per hour", "miles per hour")),
  ("kph", plural("kilometer per hour", "kilometers per hour")),
  ("km/h", plural("kilometer per hour", "kilometers per hour")),

  ("nm", "nanometer"),
  ("um", "micrometer"),
  ("\u00b5m", "micrometer"),
  ("\u03bcm", "micrometer"),
  ("mm", "millimeter"),
  ("cm", "centimeter"),
  ("m", "meter"),
  ("km", "kilometer"),

  ("mcg", "microgram"),
  ("mg", "milligram"),
  ("g", "gram"),
  ("kg", "kilogram"),
  (compile("\\b[tT]\\b"), "ton"),

  ("ft", plural("foot", "feet")),
  # (compile(r"in[.]?"), plural("inch", "inches")), # TODO: Why does this regex fail in Python but works in JS?
  ("yd", "yard"),
  ("mi", "mile"),

  (compile("\\blbs?\\b"), "pound"),
  ("oz", "ounce"),

  ("tsp", "teaspoon"),
  (compile("\\btbsp?\\b"), "tablespoon"),

  ("ml", "milliliter"),
  ("l", "liter"),
  ("gal", "gallon"),

  ("cal", "calorie"),

  ("B", "byte"),
  (compile("\\bKB|kb\\b"), "kilobyte"),
  (compile("\\bMB|mb\\b"), "megabyte"),
  (compile("\\bGB|gb\\b"), "gigabyte"),
  (compile("\\bTB|tb\\b"), "terabyte"),
  (compile("\\bPB|pb\\b"), "petabyte"),

  (compile("\\bm[wW]h\\b"), "milliwatt-hours"),
  (compile("\\b[wW]h\\b"), "watt-hour"),
  (compile("\\bk[wW]h\\b"), "kilowatt-hour"),
  (compile("\\bM[wW]h\\b"), "megawatt-hour"),
  (compile("\\bG[wW]h\\b"), "gigawatt-hour"),
  (compile("\\bT[wW]h\\b"), "terawatt-hour"),

  (compile("\\bm[wW]\\b"), "milliwatt"),
  (compile("\\b[wW]\\b"), "watt"),
  ("kW", "kilowatt"),
  ("MW", "megawatt"),
  ("GW", "gigawatt"),
  ("TW", "terawatt"),

  (compile("\\bm[aA]\\b"), "milliamp"),
  (compile("\\b[aA]\\b"), "amp"),

  (compile("\\bm[vV]\\b"), "millivolt"),
  (compile("\\b[vV]\\b"), "volt"),

  ("eV", "electronvolt"),

  (compile("\\b(?:deg |°\\s?)F\\b"), plural("degree Fahrenheit", "degrees Fahrenheit")),
  (compile("\\b(?:deg |°\\s?)C\\b"), plural("degree Celsius", "degrees Celsius")),
  (compile("\\b(?:deg |°\\s?)K\\b"), plural("degree Kelvin", "degrees Kelvin")),

  # Keep these after the ones with "deg".
  ("F", uncounted("Fahrenheit")),
  ("C", uncounted("Celsius")),
  ("K", uncounted("Kelvin")),

  (compile("\\b(?:°|deg)\\b"), "degree"),

  ("cd", uncounted("candela")),


  #("s", "second"), # TODO: Doesn't work on things like "90s" ("nineties")
  ("h", "hour"),
  ("d", "day"),
  ("y", "year"),

  (compile("\\b[kK][hH]z\\b"), uncounted("kilo-Hertz")),
  (compile("\\bM[hH]z\\b"), uncounted("mega-Hertz")),
  (compile("\\bG[hH]z\\b"), uncounted("giga-Hertz")),

  ("J", "Joule"),
  ("kJ", "kilo-Joule"),
]

number_regex = re.compile(r"-?\d+(?:\.\d*)?(?:[Ee][+-]?\d+)?|\d*\.\d+|\d+")
unit_regex = re.compile('|'.join([t[0] if isinstance(t[0], str) else t[0].pattern for t in units]))
quantity_regex = re.compile("\\b(%s)[\\s-]*(%s)\\b" % (number_regex.pattern, unit_regex.pattern.replace("\\b", "")))

def expand_units(text):
  def repl(match):
    print(match)
    num = match.group(1)
    abbrev = match.group(2)

    n = float(num)
    num = f"{n:n}"

    result = next(filter(lambda k: k[0] == abbrev if isinstance(k[0], str) else k[0].search(abbrev), units), None)

    if result:
      k, unit = result

      rule = "one" if n == 1 else "other"

      if isinstance(unit, str):
        suffix = "" if rule == "one" else "s"
        return f"{num} {unit}{suffix}"

      return f"{num} {unit[rule]}"

    return f"{num} {abbrev}"

  return quantity_regex.sub(repl, text)

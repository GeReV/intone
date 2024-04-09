import re


def re_compile(pattern):
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
    (re_compile(r"\bm(?:eters?)?\/s(?:\^2|²)\b"), plural("meter per second squared", "meters per second squared")),

    (re_compile(r"\bm(?:eters?)?\/s(?!\^²])"), plural("meter per second", "meters per second")),
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
    (re_compile(r"\b[tT]\b"), "ton"),

    ("ft", plural("foot", "feet")),
    # (compile(r"in[.]?"), plural("inch", "inches")), # TODO: Why does this regex fail in Python but works in JS?
    ("yd", "yard"),
    ("mi", "mile"),

    (re_compile(r"\blbs?\b"), "pound"),
    ("oz", "ounce"),

    ("tsp", "teaspoon"),
    (re_compile(r"\btbsp?\b"), "tablespoon"),

    ("ml", "milliliter"),
    ("l", "liter"),
    ("gal", "gallon"),

    ("cal", "calorie"),

    ("B", "byte"),
    (re_compile(r"\bKB|kb\b"), "kilobyte"),
    (re_compile(r"\bMB|mb\b"), "megabyte"),
    (re_compile(r"\bGB|gb\b"), "gigabyte"),
    (re_compile(r"\bTB|tb\b"), "terabyte"),
    (re_compile(r"\bPB|pb\b"), "petabyte"),

    (re_compile(r"\bm[wW]h\b"), "milliwatt-hours"),
    (re_compile(r"\b[wW]h\b"), "watt-hour"),
    (re_compile(r"\bk[wW]h\b"), "kilowatt-hour"),
    (re_compile(r"\bM[wW]h\b"), "megawatt-hour"),
    (re_compile(r"\bG[wW]h\b"), "gigawatt-hour"),
    (re_compile(r"\bT[wW]h\b"), "terawatt-hour"),

    (re_compile(r"\bm[wW]\b"), "milliwatt"),
    (re_compile(r"\b[wW]\b"), "watt"),
    ("kW", "kilowatt"),
    ("MW", "megawatt"),
    ("GW", "gigawatt"),
    ("TW", "terawatt"),

    (re_compile(r"\bm[aA]\b"), "milliamp"),
    (re_compile(r"\b[aA]\b"), "amp"),

    (re_compile(r"\bm[vV]\b"), "millivolt"),
    (re_compile(r"\b[vV]\b"), "volt"),

    ("eV", "electronvolt"),

    (re_compile(r"\b(?:deg |°\s?)F\b"), plural("degree Fahrenheit", "degrees Fahrenheit")),
    (re_compile(r"\b(?:deg |°\s?)C\b"), plural("degree Celsius", "degrees Celsius")),
    (re_compile(r"\b(?:deg |°\s?)K\b"), plural("degree Kelvin", "degrees Kelvin")),

    # Keep these after the ones with "deg".
    ("F", uncounted("Fahrenheit")),
    ("C", uncounted("Celsius")),
    ("K", uncounted("Kelvin")),

    (re_compile(r"\b(?:°|deg)\b"), "degree"),

    ("cd", uncounted("candela")),

    #("s", "second"), # TODO: Doesn't work on things like "90s" ("nineties")
    ("h", "hour"),
    ("d", "day"),
    ("y", "year"),

    (re_compile(r"\b[kK][hH]z\b"), uncounted("kilo-Hertz")),
    (re_compile(r"\bM[hH]z\b"), uncounted("mega-Hertz")),
    (re_compile(r"\bG[hH]z\b"), uncounted("giga-Hertz")),

    ("J", "Joule"),
    ("kJ", "kilo-Joule"),
]

number_regex = re.compile(r"-?\d+(?:\.\d*)?(?:[Ee][+-]?\d+)?|\d*\.\d+|\d+")
unit_regex = re.compile('|'.join([t[0] if isinstance(t[0], str) else t[0].pattern for t in units]))
quantity_regex = re.compile(r"\b(%s)[\s-]*(%s)\b" % (number_regex.pattern, unit_regex.pattern.replace(r"\b", "")))


def expand_units(text):
    def repl(match):
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

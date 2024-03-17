import re

# List of (regular expression, replacement) pairs for abbreviations in english:
abbreviations_en = [
    (re.compile("\\b%s\\." % x[0], re.IGNORECASE), x[1])
    for x in [
        ("capt", "captain"),
        ("co", "company"),
        ("col", "colonel"),
        ("cpl", "corporal"),
        ("dr", "doctor"),
        ("esq", "esquire"),
        ("gen", "general"),
        ("hon", "honorable"),
        ("jr", "junior"),
        ("lt", "lieutenant"),
        ("ltd", "limited"),
        ("no", "number"),
        ("maj", "major"),
        ("mr", "mister"),
        ("mrs", "missus"),
        ("ms", "miss"),
        ("pvt", "private"),
        ("prof", "professor"),
        ("rev", "reverend"),
        ("sgt", "sergeant"),
        ("sr", "senior"),
        ("st", "saint"),
    ]
]

months_en = [
  (re.compile("\\b%s\\." % x[0], re.IGNORECASE), x[1])
  for x in [
    ("jan", "january"),
    ("feb", "february"),
    ("mar", "march"),
    ("apr", "april"),
    ("may", "may"),
    ("jun", "june"),
    ("jul", "july"),
    ("aug", "august"),
    ("sep", "september"),
    ("oct", "october"),
    ("nov", "november"),
    ("dec", "december"),
  ]
]

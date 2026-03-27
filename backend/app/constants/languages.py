"""
ElevenLabs Scribe supported languages (90+).
Source: https://elevenlabs.io/docs/capabilities/speech-to-text

Use `language_code` when calling the Scribe API (language_code param).
Use `label` for UI display.

Auto-detect option is included as the first entry (code = None / empty string).
"""

SCRIBE_LANGUAGES = [
    # Auto-detect first — useful default
    {"code": "",    "label": "Auto-detect"},

    # A
    {"code": "afr", "label": "Afrikaans"},
    {"code": "amh", "label": "Amharic"},
    {"code": "ara", "label": "Arabic"},
    {"code": "hye", "label": "Armenian"},
    {"code": "asm", "label": "Assamese"},
    {"code": "ast", "label": "Asturian"},
    {"code": "aze", "label": "Azerbaijani"},

    # B
    {"code": "bel", "label": "Belarusian"},
    {"code": "ben", "label": "Bengali"},
    {"code": "bos", "label": "Bosnian"},
    {"code": "bul", "label": "Bulgarian"},
    {"code": "mya", "label": "Burmese"},

    # C
    {"code": "yue", "label": "Cantonese"},
    {"code": "cat", "label": "Catalan"},
    {"code": "ceb", "label": "Cebuano"},
    {"code": "nya", "label": "Chichewa"},
    {"code": "hrv", "label": "Croatian"},
    {"code": "ces", "label": "Czech"},

    # D
    {"code": "dan", "label": "Danish"},
    {"code": "nld", "label": "Dutch"},

    # E
    {"code": "eng", "label": "English"},
    {"code": "est", "label": "Estonian"},

    # F
    {"code": "fil", "label": "Filipino"},
    {"code": "fin", "label": "Finnish"},
    {"code": "fra", "label": "French"},
    {"code": "ful", "label": "Fulah"},

    # G
    {"code": "glg", "label": "Galician"},
    {"code": "lug", "label": "Ganda"},
    {"code": "kat", "label": "Georgian"},
    {"code": "deu", "label": "German"},
    {"code": "ell", "label": "Greek"},
    {"code": "guj", "label": "Gujarati"},

    # H
    {"code": "hau", "label": "Hausa"},
    {"code": "heb", "label": "Hebrew"},
    {"code": "hin", "label": "Hindi"},
    {"code": "hun", "label": "Hungarian"},

    # I
    {"code": "isl", "label": "Icelandic"},
    {"code": "ibo", "label": "Igbo"},
    {"code": "ind", "label": "Indonesian"},
    {"code": "gle", "label": "Irish"},
    {"code": "ita", "label": "Italian"},

    # J
    {"code": "jpn", "label": "Japanese"},
    {"code": "jav", "label": "Javanese"},

    # K
    {"code": "kea", "label": "Kabuverdianu"},
    {"code": "kan", "label": "Kannada"},
    {"code": "kaz", "label": "Kazakh"},
    {"code": "khm", "label": "Khmer"},
    {"code": "kor", "label": "Korean"},
    {"code": "kur", "label": "Kurdish"},
    {"code": "kir", "label": "Kyrgyz"},

    # L
    {"code": "lao", "label": "Lao"},
    {"code": "lav", "label": "Latvian"},
    {"code": "lin", "label": "Lingala"},
    {"code": "lit", "label": "Lithuanian"},
    {"code": "luo", "label": "Luo"},
    {"code": "ltz", "label": "Luxembourgish"},

    # M
    {"code": "mkd", "label": "Macedonian"},
    {"code": "msa", "label": "Malay"},
    {"code": "mal", "label": "Malayalam"},
    {"code": "mlt", "label": "Maltese"},
    {"code": "zho", "label": "Mandarin Chinese"},
    {"code": "mri", "label": "Māori"},
    {"code": "mar", "label": "Marathi"},
    {"code": "mon", "label": "Mongolian"},

    # N
    {"code": "npi", "label": "Nepali"},
    {"code": "nor", "label": "Norwegian"},

    # O
    {"code": "oci", "label": "Occitan"},
    {"code": "ori", "label": "Odia"},

    # P
    {"code": "pus", "label": "Pashto"},
    {"code": "fas", "label": "Persian"},
    {"code": "pol", "label": "Polish"},
    {"code": "por", "label": "Portuguese"},
    {"code": "pan", "label": "Punjabi"},

    # R
    {"code": "ron", "label": "Romanian"},
    {"code": "rus", "label": "Russian"},

    # S
    {"code": "srp", "label": "Serbian"},
    {"code": "sna", "label": "Shona"},
    {"code": "snd", "label": "Sindhi"},
    {"code": "sin", "label": "Sinhala"},
    {"code": "slk", "label": "Slovak"},
    {"code": "slv", "label": "Slovenian"},
    {"code": "som", "label": "Somali"},
    {"code": "spa", "label": "Spanish"},
    {"code": "sun", "label": "Sundanese"},
    {"code": "swa", "label": "Swahili"},
    {"code": "swe", "label": "Swedish"},

    # T
    {"code": "tgk", "label": "Tajik"},
    {"code": "tam", "label": "Tamil"},
    {"code": "tat", "label": "Tatar"},
    {"code": "tel", "label": "Telugu"},
    {"code": "tha", "label": "Thai"},
    {"code": "bod", "label": "Tibetan"},
    {"code": "tur", "label": "Turkish"},
    {"code": "tuk", "label": "Turkmen"},

    # U
    {"code": "ukr", "label": "Ukrainian"},
    {"code": "urd", "label": "Urdu"},
    {"code": "uig", "label": "Uyghur"},
    {"code": "uzb", "label": "Uzbek"},

    # V
    {"code": "vie", "label": "Vietnamese"},

    # W
    {"code": "cym", "label": "Welsh"},

    # X / Y / Z
    {"code": "xho", "label": "Xhosa"},
    {"code": "yid", "label": "Yiddish"},
    {"code": "yor", "label": "Yoruba"},
    {"code": "zul", "label": "Zulu"},
]

# Dict lookup by code — useful for backend label resolution
SCRIBE_LANGUAGE_MAP = {lang["code"]: lang["label"] for lang in SCRIBE_LANGUAGES}

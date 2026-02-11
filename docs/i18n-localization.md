# Localization Workflow

This app now supports:
- `en` (English)
- `es` (Spanish)
- `ro` (Romanian)
- `sv` (Swedish)

## How it works

`/Users/adrianchiscop/Projects/Spanish Coast Properties A1/i18n.js` has three layers:

1. **Base locales**
- Full dictionaries in `en` and `es`.

2. **Manual locale overrides**
- `MANUAL_LOCALES` contains curated strings for `ro` and `sv`.
- Use this for brand terms and key UI labels that must be exact.

3. **Automatic locale completion**
- For `ro` and `sv`, missing keys are auto-translated from English (`en`) using a free translation endpoint.
- Results are cached in browser local storage (`scp:i18n:auto:*`).
- If the endpoint fails, the app gracefully falls back via language chain.

## Fallback chain

If a key is missing in the active language, the app checks:

- `ro` -> `en` -> `es` -> key
- `sv` -> `en` -> `es` -> key
- others -> `en` -> key

(Defined in `LANG_FALLBACKS` + `DEFAULT_LANG`.)

## Add a new language (flawless flow)

1. Add code to supported list
- In `i18n.js`, add your language code to `SUPPORTED` base list.

2. Add short/long language labels
- Add `lang.xx`, `lang.xx_short` in `en` and `es` dictionaries.

3. Register manual dictionary
- Add `MANUAL_LOCALES.xx = { ... }` for critical UI and brand-safe copy.

4. Optional auto-fill
- Add the code to `AUTO_TRANSLATE_LANGS` to auto-complete missing keys.

5. Quality pass
- Open the app in that language and replace any machine-translated domain terms in:
  - `MANUAL_LOCALES`
  - `AUTO_TRANSLATION_GLOSSARY`

## Runtime extension (without touching core dictionaries)

You can register a locale at runtime:

```js
window.SCP_I18N.registerLocale('de', {
  'nav.home': 'Startseite',
  'nav.properties': 'Immobilien'
});
```

The language switcher updates from `SCP_I18N.SUPPORTED` and uses `lang.<code>_short` labels.

## Notes

- Blog language filter now falls back to available post languages when app language has no matching posts.
- Auto-translation failures are throttled for 12 hours to avoid repeated failed requests.

// Runtime i18n: centralized JSON dictionaries, lazy loading, English fallback,
// missing-key detection, in-place DOM updates (so open forms keep their data).
import { SUPPORTED_LANGS, FALLBACK_LANG, validateLang, LANG_NAMES } from './logic.js';

const dicts = {};
let current = FALLBACK_LANG;
export const missingKeys = new Set();

async function load(lang) {
  if (dicts[lang]) return;
  const res = await fetch(`assets/i18n/${lang}.json`);
  if (!res.ok) throw new Error('Cannot load ' + lang);
  dicts[lang] = await res.json();
}

const walk = (obj, key) => key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);

export function t(key, params = {}) {
  let v = walk(dicts[current], key);
  if (typeof v !== 'string') {
    missingKeys.add(`${current}:${key}`);
    console.warn(`[i18n] missing "${key}" in ${current}`);
    v = walk(dicts[FALLBACK_LANG], key);
  }
  if (typeof v !== 'string') return key;
  return v.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? params[k] : `{${k}}`));
}

export const lang = () => current;
export const locale = () => `${current}-IN-u-nu-latn`; // Indian formats, Western digits for unambiguous amounts

export function apply(root = document) {
  const P = (el) => { try { return JSON.parse(el.dataset.i18nParams || '{}'); } catch { return {}; } };
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n, P(el)); });
  for (const [attr, target] of [['i18nPlaceholder', 'placeholder'], ['i18nTitle', 'title'], ['i18nAria', 'aria-label']]) {
    root.querySelectorAll(`[data-${attr.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}]`).forEach((el) => {
      el.setAttribute(target, t(el.dataset[attr], P(el)));
    });
  }
}

export async function setLang(code) {
  const l = validateLang(code);
  if (!l) throw new Error('Unsupported language: ' + code);
  await Promise.all([load(FALLBACK_LANG), load(l)]);
  current = l;
  document.documentElement.lang = l;
  document.body.classList.remove(...SUPPORTED_LANGS.map((x) => 'lang-' + x));
  document.body.classList.add('lang-' + l);
  apply(document);
  document.dispatchEvent(new CustomEvent('langchange', { detail: l }));
}

// Money always uses Indian digit grouping (1,25,000) in every language; the mr-IN CLDR data groups in thousands.
export const fmtMoney = (n) => new Intl.NumberFormat('en-IN-u-nu-latn', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
export const fmtDate = (ymd) => new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(`${ymd}T12:00:00+05:30`));
export const fmtTime = (hm) => new Intl.DateTimeFormat(locale(), { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).format(new Date(`1970-01-01T${hm}:00+05:30`));
export const fmtDateTime = (iso) => new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(iso));
export { LANG_NAMES, SUPPORTED_LANGS };

import messages from './i18n.cjs';
let language = 'en';
export const t = (message, values) => messages.translate(language, message, values);
export function setLanguage(value) { language = value === 'uz' ? 'uz' : 'en'; }
export function translateDocument(root = document) {
  document.documentElement.lang = language;
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  for (const attr of ['title', 'aria-label', 'placeholder']) root.querySelectorAll(`[data-i18n-${attr}]`).forEach(el => { el.setAttribute(attr, t(el.getAttribute(`data-i18n-${attr}`))); });
}

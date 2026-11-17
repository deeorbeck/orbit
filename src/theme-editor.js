import themeDefinitions from './themes.cjs';
import { t } from './i18n-dom.js';
const { currentTheme, normalizeCustomThemes } = themeDefinitions;
const $ = selector => document.querySelector(selector);
const labels = { terminal: 'Terminal background', foreground: 'Terminal text', accent: 'Accent & cursor', base: 'Window background', side: 'Sidebar background', bar: 'Tab bar background', text: 'Interface text', muted: 'Secondary text', faint: 'Subtle text' };

export function installThemeEditor({ getConfig, fontOptions, onSave, notify }) {
  let draft, editingId = null, deleting = false;
  const form = $('#theme-form'), dialog = $('#theme-dialog');
  function preview() {
    const box = $('#theme-live-preview');
    box.style.background = draft.terminal; box.style.color = draft.foreground; box.style.borderColor = draft.side;
    $('.theme-preview-chrome').style.background = draft.bar; $('.theme-preview-chrome').style.color = draft.text;
    box.querySelectorAll('.theme-preview-prompt,.theme-preview-dot').forEach(el => el.style.setProperty('--preview-accent', draft.accent));
    const code = $('.theme-preview-code'); code.style.fontFamily = $('#theme-font').value; code.style.fontSize = $('#theme-font-size').value + 'px'; code.style.lineHeight = $('#theme-line-height').value;
  }
  function open(edit = false) {
    const config = getConfig(), source = currentTheme(config);
    editingId = edit && source.custom ? source.id : null; deleting = false;
    draft = { ...source, id: editingId || 'custom-' + crypto.randomUUID(), name: editingId ? source.name : source.name + ' — copy', fontFamily: config.appearance.fontFamily || source.fontFamily, fontSize: config.appearance.fontSize };
    $('#theme-editor-title').textContent = t(editingId ? 'Edit theme' : 'New theme');
    $('#theme-name').value = draft.name;
    const fonts = $('#theme-font'); fonts.replaceChildren();
    const choices = [...fontOptions()]; if (!choices.some(font => font.fontFamily === draft.fontFamily)) choices.push({ name: draft.fontName, fontFamily: draft.fontFamily });
    for (const font of choices) { const option = document.createElement('option'); option.value = font.fontFamily; option.textContent = font.name; fonts.append(option); }
    fonts.value = draft.fontFamily; $('#theme-font-size').value = draft.fontSize; $('#theme-line-height').value = draft.lineHeight; $('#theme-light').checked = !!draft.light;
    const colors = $('#theme-color-fields'); colors.replaceChildren();
    for (const [key, title] of Object.entries(labels)) {
      const row = document.createElement('label'); row.className = 'theme-color-field';
      const label = document.createElement('span'); label.textContent = t(title);
      const picker = document.createElement('input'); picker.type = 'color'; picker.value = draft[key]; picker.setAttribute('aria-label', t(title));
      const hex = document.createElement('input'); hex.type = 'text'; hex.value = draft[key]; hex.required = true; hex.pattern = '#[0-9a-fA-F]{6}'; hex.maxLength = 7; hex.dataset.themeColor = key; hex.setAttribute('aria-label', t(title) + ' · HEX');
      picker.oninput = () => { draft[key] = picker.value; hex.value = picker.value; preview(); };
      hex.oninput = () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)) { draft[key] = hex.value; picker.value = hex.value; preview(); } };
      row.append(label, picker, hex); colors.append(row);
    }
    $('#delete-theme').hidden = !editingId; $('#delete-theme').textContent = t('Delete theme');
    preview(); dialog.showModal(); $('#theme-name').focus(); $('#theme-name').select();
  }
  $('#new-theme').onclick = () => open(); $('#edit-theme').onclick = () => open(true);
  for (const selector of ['#theme-font', '#theme-font-size', '#theme-line-height']) $(selector).oninput = preview;
  form.onsubmit = async event => {
    event.preventDefault(); const save = $('#save-theme'); save.disabled = true;
    try {
      const config = getConfig(), fontFamily = $('#theme-font').value;
      const value = normalizeCustomThemes([{ ...draft, name: $('#theme-name').value, baseTheme: draft.baseTheme || config.appearance.theme, fontFamily, fontName: fontOptions().find(font => font.fontFamily === fontFamily)?.name, fontSize: Number($('#theme-font-size').value), lineHeight: Number($('#theme-line-height').value), light: $('#theme-light').checked }])[0];
      const customThemes = [...(config.customThemes || []).filter(theme => theme.id !== value.id), value];
      if (customThemes.length > 50) throw new Error(t('You can save up to 50 custom themes.'));
      await onSave({ ...config, customThemes, appearance: { ...config.appearance, theme: value.id, fontFamily: '', fontSize: value.fontSize } }); dialog.close();
    } catch (error) { notify(error.message); } finally { save.disabled = false; }
  };
  $('#delete-theme').onclick = async () => {
    if (!deleting) { deleting = true; $('#delete-theme').textContent = t('Click again to delete'); return; }
    try {
      const config = getConfig(), appearance = config.appearance.theme === editingId ? { ...config.appearance, theme: draft.baseTheme || 'graphite' } : config.appearance;
      await onSave({ ...config, customThemes: config.customThemes.filter(theme => theme.id !== editingId), appearance }); dialog.close();
    } catch (error) { notify(error.message); }
  };
}

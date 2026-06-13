'use strict';

const STORAGE_KEY = 'safesignal:v1';
const DEFAULT_MESSAGE = `Necesito ayuda. Estoy en una situación de riesgo o no puedo responder.

Mi ubicación aproximada es:
{{MAP_LINK}}

Coordenadas: {{COORDS}}
Hora: {{TIME}}

Si no respondo, contacta conmigo y avisa a emergencias.`;

const DEFAULT_STATE = {
  contacts: [],
  messageTemplate: DEFAULT_MESSAGE,
  settings: {
    emergencyNumber: '112',
    supportNumber: '016',
    supportWhatsapp: '+34600000016',
    supportEmail: '016-online@igualdad.gob.es',
    fakeCallerName: 'Mamá',
    countdownSeconds: 5,
    vibrationEnabled: true,
    autoShareAfterCountdown: false,
    stealthMode: false
  },
  stealthNote: ''
};

let state = loadState();
let countdownTimer = null;
let checkinTimer = null;
let checkinDeadline = null;
let siren = { active: false, ctx: null, osc: null, gain: null, interval: null };
let fakeCall = { ctx: null, osc: null, gain: null, interval: null };
let deferredInstallPrompt = null;
let lastAlertPayload = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const elements = {
  app: $('#app'),
  installBtn: $('#installBtn'),
  privacyBadge: $('#privacyBadge'),
  permissionBadge: $('#permissionBadge'),
  stealthToggleBtn: $('#stealthToggleBtn'),
  stealthReturnBtn: $('#stealthReturnBtn'),
  stealthReturnPanelBtn: $('#stealthReturnPanelBtn'),
  stealthExitHotspot: $('#stealthExitHotspot'),
  stealthNote: $('#stealthNote'),
  saveStealthNoteBtn: $('#saveStealthNoteBtn'),
  hiddenSignalBtn: $('#hiddenSignalBtn'),
  panicBtn: $('#panicBtn'),
  callEmergencyBtn: $('#callEmergencyBtn'),
  callSupportBtn: $('#callSupportBtn'),
  shareLocationBtn: $('#shareLocationBtn'),
  fakeCallBtn: $('#fakeCallBtn'),
  sirenBtn: $('#sirenBtn'),
  contactForm: $('#contactForm'),
  contactId: $('#contactId'),
  contactName: $('#contactName'),
  contactPhone: $('#contactPhone'),
  contactEmail: $('#contactEmail'),
  contactRelation: $('#contactRelation'),
  contactPriority: $('#contactPriority'),
  clearContactFormBtn: $('#clearContactFormBtn'),
  contactsList: $('#contactsList'),
  messageTemplate: $('#messageTemplate'),
  saveMessageBtn: $('#saveMessageBtn'),
  previewMessageBtn: $('#previewMessageBtn'),
  emergencyNumber: $('#emergencyNumber'),
  supportNumber: $('#supportNumber'),
  supportWhatsapp: $('#supportWhatsapp'),
  supportEmail: $('#supportEmail'),
  whatsappSupportBtn: $('#whatsappSupportBtn'),
  emailSupportBtn: $('#emailSupportBtn'),
  fakeCallerName: $('#fakeCallerName'),
  countdownSeconds: $('#countdownSeconds'),
  vibrationEnabled: $('#vibrationEnabled'),
  autoShareAfterCountdown: $('#autoShareAfterCountdown'),
  saveSettingsBtn: $('#saveSettingsBtn'),
  testModeBtn: $('#testModeBtn'),
  exportBtn: $('#exportBtn'),
  importFile: $('#importFile'),
  deleteAllBtn: $('#deleteAllBtn'),
  showPermissionsBtn: $('#showPermissionsBtn'),
  startCheckinBtn: $('#startCheckinBtn'),
  checkinMinutes: $('#checkinMinutes'),
  checkinPanel: $('#checkinPanel'),
  checkinRemaining: $('#checkinRemaining'),
  cancelCheckinBtn: $('#cancelCheckinBtn'),
  countdownModal: $('#countdownModal'),
  countdownNumber: $('#countdownNumber'),
  cancelCountdownBtn: $('#cancelCountdownBtn'),
  sendNowBtn: $('#sendNowBtn'),
  alertModal: $('#alertModal'),
  alertTitle: $('#alertTitle'),
  alertSubtitle: $('#alertSubtitle'),
  alertMessage: $('#alertMessage'),
  nativeShareBtn: $('#nativeShareBtn'),
  copyAlertBtn: $('#copyAlertBtn'),
  openMapBtn: $('#openMapBtn'),
  callEmergencyModalBtn: $('#callEmergencyModalBtn'),
  closeAlertBtn: $('#closeAlertBtn'),
  contactActionList: $('#contactActionList'),
  fakeCallScreen: $('#fakeCallScreen'),
  fakeCallerDisplay: $('#fakeCallerDisplay'),
  fakeCallerAvatar: $('#fakeCallerAvatar'),
  rejectFakeCallBtn: $('#rejectFakeCallBtn'),
  acceptFakeCallBtn: $('#acceptFakeCallBtn'),
  toast: $('#toast')
};

document.addEventListener('DOMContentLoaded', init);

function init() {
  bindEvents();
  hydrateUI();
  renderContacts();
  updateEmergencyLinks();
  applyStealthMode(state.settings.stealthMode);
  registerServiceWorker();
  checkLocationPermissionSoft();
}

function bindEvents() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    elements.installBtn.classList.remove('hidden');
  });

  elements.installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice.catch(() => null);
    deferredInstallPrompt = null;
    elements.installBtn.classList.add('hidden');
  });

  elements.stealthToggleBtn.addEventListener('click', () => setStealthMode(!state.settings.stealthMode));
  elements.stealthReturnBtn.addEventListener('click', () => setStealthMode(false));
  elements.stealthReturnPanelBtn.addEventListener('click', () => setStealthMode(false));

  bindLongPress(elements.stealthExitHotspot, () => {
    if (state.settings.stealthMode) setStealthMode(false);
  }, 1200);

  bindMultiTap(elements.stealthExitHotspot, () => {
    if (state.settings.stealthMode) setStealthMode(false);
  }, { taps: 3, windowMs: 1200 });

  bindLongPress(elements.hiddenSignalBtn, () => startPanicFlow({ source: 'stealth' }), 1400);
  elements.hiddenSignalBtn.addEventListener('click', () => toast('Mantén pulsado para acción rápida.'));

  elements.saveStealthNoteBtn.addEventListener('click', () => {
    state.stealthNote = elements.stealthNote.value.trim();
    saveState();
    toast('Nota guardada en este dispositivo.');
  });

  elements.panicBtn.addEventListener('click', () => startPanicFlow({ source: 'tap' }));
  bindLongPress(elements.panicBtn, () => startPanicFlow({ source: 'hold' }), 700);

  elements.cancelCountdownBtn.addEventListener('click', closeCountdown);
  elements.sendNowBtn.addEventListener('click', () => {
    closeCountdown();
    prepareAlert({ mode: 'real', skipCountdown: true });
  });

  elements.shareLocationBtn.addEventListener('click', () => prepareAlert({ mode: 'real', skipCountdown: true }));
  elements.fakeCallBtn.addEventListener('click', startFakeCall);
  elements.sirenBtn.addEventListener('click', toggleSiren);
  elements.showPermissionsBtn.addEventListener('click', () => getLocation({ showToasts: true }));

  elements.contactForm.addEventListener('submit', saveContactFromForm);
  elements.clearContactFormBtn.addEventListener('click', clearContactForm);
  elements.contactsList.addEventListener('click', handleContactListClick);

  elements.saveMessageBtn.addEventListener('click', () => {
    state.messageTemplate = sanitizeTemplate(elements.messageTemplate.value) || DEFAULT_MESSAGE;
    elements.messageTemplate.value = state.messageTemplate;
    saveState();
    toast('Mensaje guardado.');
  });
  elements.previewMessageBtn.addEventListener('click', () => prepareAlert({ mode: 'test', skipCountdown: true }));

  elements.saveSettingsBtn.addEventListener('click', saveSettingsFromForm);
  elements.testModeBtn.addEventListener('click', () => prepareAlert({ mode: 'test', skipCountdown: true }));
  elements.exportBtn.addEventListener('click', exportData);
  elements.importFile.addEventListener('change', importData);
  elements.deleteAllBtn.addEventListener('click', deleteAllData);

  elements.startCheckinBtn.addEventListener('click', startCheckin);
  elements.cancelCheckinBtn.addEventListener('click', cancelCheckin);

  elements.closeAlertBtn.addEventListener('click', closeAlert);
  elements.copyAlertBtn.addEventListener('click', copyAlertText);
  elements.nativeShareBtn.addEventListener('click', nativeShareCurrentAlert);
  elements.contactActionList.addEventListener('click', handleContactActionClick);

  elements.rejectFakeCallBtn.addEventListener('click', stopFakeCall);
  elements.acceptFakeCallBtn.addEventListener('click', () => {
    stopFakeCall();
    toast('Llamada falsa finalizada.');
  });

  $$('.tab').forEach((tab) => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeCountdown();
      closeAlert();
      stopFakeCall();
      if (siren.active) stopSiren();
      if (state.settings.stealthMode) setStealthMode(false);
    }
  });
}

function hydrateUI() {
  elements.messageTemplate.value = state.messageTemplate || DEFAULT_MESSAGE;
  elements.emergencyNumber.value = state.settings.emergencyNumber || '112';
  elements.supportNumber.value = state.settings.supportNumber || '016';
  elements.supportWhatsapp.value = state.settings.supportWhatsapp || '+34600000016';
  elements.supportEmail.value = state.settings.supportEmail || '016-online@igualdad.gob.es';
  elements.fakeCallerName.value = state.settings.fakeCallerName || 'Mamá';
  elements.countdownSeconds.value = String(state.settings.countdownSeconds || 5);
  elements.vibrationEnabled.checked = Boolean(state.settings.vibrationEnabled);
  elements.autoShareAfterCountdown.checked = Boolean(state.settings.autoShareAfterCountdown);
  elements.stealthNote.value = state.stealthNote || '';
}

function switchTab(tabName) {
  $$('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === tabName));
  $$('.tab-panel').forEach((panel) => panel.classList.toggle('active', panel.id === tabName));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredCloneSafe(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return mergeState(DEFAULT_STATE, parsed);
  } catch (error) {
    console.warn('No se pudo cargar estado, usando valores por defecto.', error);
    return structuredCloneSafe(DEFAULT_STATE);
  }
}

function mergeState(defaultState, savedState) {
  return {
    contacts: Array.isArray(savedState.contacts) ? savedState.contacts : [],
    messageTemplate: typeof savedState.messageTemplate === 'string' ? savedState.messageTemplate : defaultState.messageTemplate,
    settings: { ...defaultState.settings, ...(savedState.settings || {}) },
    stealthNote: typeof savedState.stealthNote === 'string' ? savedState.stealthNote : ''
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeTemplate(text) {
  return String(text || '').trim().slice(0, 1600);
}

function saveSettingsFromForm() {
  state.settings.emergencyNumber = normalizeDialValue(elements.emergencyNumber.value) || '112';
  state.settings.supportNumber = normalizeDialValue(elements.supportNumber.value) || '016';
  state.settings.supportWhatsapp = normalizePhone(elements.supportWhatsapp.value) || '+34600000016';
  state.settings.supportEmail = normalizeEmail(elements.supportEmail.value) || '016-online@igualdad.gob.es';
  state.settings.fakeCallerName = elements.fakeCallerName.value.trim().slice(0, 60) || 'Mamá';
  state.settings.countdownSeconds = normalizeCountdown(elements.countdownSeconds.value, 5);
  state.settings.vibrationEnabled = elements.vibrationEnabled.checked;
  state.settings.autoShareAfterCountdown = elements.autoShareAfterCountdown.checked;
  saveState();
  updateEmergencyLinks();
  toast('Ajustes guardados.');
}

function updateEmergencyLinks() {
  const emergency = state.settings.emergencyNumber || '112';
  const support = state.settings.supportNumber || '016';
  const supportWhatsapp = normalizePhone(state.settings.supportWhatsapp || '+34600000016');
  const supportEmail = normalizeEmail(state.settings.supportEmail || '016-online@igualdad.gob.es');
  elements.callEmergencyBtn.href = `tel:${emergency}`;
  elements.callEmergencyModalBtn.href = `tel:${emergency}`;
  elements.callSupportBtn.href = `tel:${support}`;
  elements.whatsappSupportBtn.href = supportWhatsapp ? buildWhatsAppLink(supportWhatsapp, 'Necesito información o ayuda.') : '#';
  elements.emailSupportBtn.href = supportEmail ? `mailto:${supportEmail}` : '#';
}

function normalizeDialValue(value) {
  return String(value || '').replace(/[^\d+()\-\s#*]/g, '').trim().slice(0, 28);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s<>"'`]/g, '').slice(0, 120);
}

function isValidEmail(value) {
  return /^\S+@\S+\.\S+$/.test(String(value || ''));
}

function normalizeCountdown(value, fallback = 5) {
  const n = Number(value);
  return [3, 5, 10].includes(n) ? n : fallback;
}

function saveContactFromForm(event) {
  event.preventDefault();
  const id = elements.contactId.value || cryptoRandomId();
  const name = elements.contactName.value.trim().slice(0, 60);
  const phone = normalizePhone(elements.contactPhone.value);
  const email = normalizeEmail(elements.contactEmail.value);
  const relation = elements.contactRelation.value.trim().slice(0, 60);
  const priority = elements.contactPriority.checked;

  if (!name) {
    toast('Añade un nombre para el contacto.');
    return;
  }
  if (!phone && !email) {
    toast('Añade teléfono, WhatsApp o email.');
    return;
  }
  if (email && !isValidEmail(email)) {
    toast('El email no parece válido.');
    return;
  }

  const contact = { id, name, phone, email, relation, priority, createdAt: new Date().toISOString() };
  const index = state.contacts.findIndex((item) => item.id === id);
  if (index >= 0) state.contacts[index] = { ...state.contacts[index], ...contact };
  else state.contacts.push(contact);

  state.contacts.sort((a, b) => Number(b.priority) - Number(a.priority) || a.name.localeCompare(b.name));
  saveState();
  renderContacts();
  clearContactForm();
  toast('Contacto guardado.');
}

function renderContacts() {
  const list = elements.contactsList;
  if (!state.contacts.length) {
    list.innerHTML = '<div class="empty-state">Todavía no hay contactos. Añade al menos uno y prueba el aviso.</div>';
    return;
  }

  list.innerHTML = state.contacts.map((contact) => `
    <article class="contact-item" data-id="${escapeAttr(contact.id)}">
      <header>
        <div>
          <strong>${escapeHtml(contact.name)} ${contact.priority ? '<span class="badge">Prioritario</span>' : ''}</strong>
          <div class="contact-meta">
            ${contact.relation ? `${escapeHtml(contact.relation)} · ` : ''}
            ${contact.phone ? `Tel: ${escapeHtml(contact.phone)}` : ''}
            ${contact.phone && contact.email ? ' · ' : ''}
            ${contact.email ? escapeHtml(contact.email) : ''}
          </div>
        </div>
        <div class="contact-buttons">
          <button class="ghost" data-action="edit" type="button">Editar</button>
          <button class="danger" data-action="delete" type="button">Borrar</button>
        </div>
      </header>
    </article>
  `).join('');
}

function handleContactListClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const item = button.closest('.contact-item');
  const id = item?.dataset.id;
  const contact = state.contacts.find((entry) => entry.id === id);
  if (!contact) return;

  if (button.dataset.action === 'edit') {
    fillContactForm(contact);
    switchTab('contacts');
    elements.contactName.focus();
  }

  if (button.dataset.action === 'delete') {
    const ok = confirm(`¿Borrar a ${contact.name}?`);
    if (!ok) return;
    state.contacts = state.contacts.filter((entry) => entry.id !== id);
    saveState();
    renderContacts();
    toast('Contacto borrado.');
  }
}

function fillContactForm(contact) {
  elements.contactId.value = contact.id;
  elements.contactName.value = contact.name || '';
  elements.contactPhone.value = contact.phone || '';
  elements.contactEmail.value = contact.email || '';
  elements.contactRelation.value = contact.relation || '';
  elements.contactPriority.checked = Boolean(contact.priority);
}

function clearContactForm() {
  elements.contactId.value = '';
  elements.contactForm.reset();
}

function normalizePhone(value) {
  return String(value || '').replace(/[^+\d]/g, '').slice(0, 24);
}

function cryptoRandomId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function startPanicFlow({ source = 'tap' } = {}) {
  if (elements.countdownModal.classList.contains('hidden') === false) return;
  saveSettingsFromFormQuietly();
  const seconds = Number(state.settings.countdownSeconds) || 5;
  let remaining = seconds;
  elements.countdownNumber.textContent = String(remaining);
  elements.countdownModal.classList.remove('hidden');
  vibrate([120, 80, 120]);

  countdownTimer = setInterval(() => {
    remaining -= 1;
    elements.countdownNumber.textContent = String(Math.max(remaining, 0));
    if (remaining <= 0) {
      closeCountdown();
      prepareAlert({ mode: 'real', source, skipCountdown: true });
    }
  }, 1000);
}

function saveSettingsFromFormQuietly() {
  state.settings.emergencyNumber = normalizeDialValue(elements.emergencyNumber.value) || state.settings.emergencyNumber || '112';
  state.settings.supportNumber = normalizeDialValue(elements.supportNumber.value) || state.settings.supportNumber || '016';
  state.settings.supportWhatsapp = normalizePhone(elements.supportWhatsapp.value) || state.settings.supportWhatsapp || '+34600000016';
  state.settings.supportEmail = normalizeEmail(elements.supportEmail.value) || state.settings.supportEmail || '016-online@igualdad.gob.es';
  state.settings.fakeCallerName = elements.fakeCallerName.value.trim().slice(0, 60) || state.settings.fakeCallerName || 'Mamá';
  state.settings.countdownSeconds = normalizeCountdown(elements.countdownSeconds.value, state.settings.countdownSeconds || 5);
  state.settings.vibrationEnabled = elements.vibrationEnabled.checked;
  state.settings.autoShareAfterCountdown = elements.autoShareAfterCountdown.checked;
  saveState();
  updateEmergencyLinks();
}

function closeCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = null;
  elements.countdownModal.classList.add('hidden');
}

async function prepareAlert({ mode = 'real', source = 'manual', skipCountdown = false } = {}) {
  if (!skipCountdown && mode === 'real') {
    startPanicFlow({ source });
    return;
  }

  toast(mode === 'test' ? 'Preparando prueba sin enviar...' : 'Obteniendo ubicación...');

  const location = mode === 'test'
    ? buildTestLocation()
    : await getLocation({ showToasts: false }).catch((error) => ({ error }));

  const payload = buildAlertPayload({ location, mode });
  lastAlertPayload = payload;
  openAlertModal(payload, { mode });

  if (mode === 'real' && state.settings.autoShareAfterCountdown) {
    await nativeShare(payload).catch(() => toast('El navegador no permitió abrir compartir automáticamente. Usa el botón Compartir.'));
  }
}

function buildTestLocation() {
  return {
    coords: {
      latitude: 41.3948,
      longitude: 2.0787,
      accuracy: 25
    },
    timestamp: Date.now(),
    test: true
  };
}

function getLocation({ showToasts = true } = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      updateLocationBadge('Ubicación no compatible', 'warning');
      if (showToasts) toast('Este navegador no permite obtener ubicación.');
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateLocationBadge('Ubicación disponible', 'ok');
        if (showToasts) toast('Ubicación obtenida correctamente.');
        resolve(position);
      },
      (error) => {
        updateLocationBadge('Ubicación no disponible', 'warning');
        if (showToasts) toast(locationErrorMessage(error));
        reject(error);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }
    );
  });
}

function locationErrorMessage(error) {
  if (!error) return 'No se pudo obtener ubicación.';
  if (error.code === 1) return 'Permiso de ubicación denegado.';
  if (error.code === 2) return 'Ubicación no disponible en este momento.';
  if (error.code === 3) return 'La ubicación tardó demasiado.';
  return 'No se pudo obtener ubicación.';
}

async function checkLocationPermissionSoft() {
  if (!navigator.permissions?.query) {
    updateLocationBadge('Ubicación bajo permiso', 'muted');
    return;
  }
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    updateLocationBadge(permissionLabel(result.state), result.state === 'granted' ? 'ok' : 'muted');
    result.addEventListener('change', () => updateLocationBadge(permissionLabel(result.state), result.state === 'granted' ? 'ok' : 'muted'));
  } catch {
    updateLocationBadge('Ubicación bajo permiso', 'muted');
  }
}

function permissionLabel(stateValue) {
  if (stateValue === 'granted') return 'Ubicación permitida';
  if (stateValue === 'denied') return 'Ubicación denegada';
  return 'Ubicación bajo permiso';
}

function updateLocationBadge(text, type) {
  elements.permissionBadge.textContent = text;
  elements.permissionBadge.classList.toggle('warning', type === 'warning');
  elements.permissionBadge.classList.toggle('muted', type !== 'ok' && type !== 'warning');
}

function buildAlertPayload({ location, mode }) {
  const now = new Date();
  const isError = location?.error || !location?.coords;
  const coords = isError ? null : location.coords;
  const lat = coords ? Number(coords.latitude).toFixed(6) : null;
  const lng = coords ? Number(coords.longitude).toFixed(6) : null;
  const accuracy = coords?.accuracy ? Math.round(coords.accuracy) : null;
  const mapLink = coords ? `https://maps.google.com/?q=${lat},${lng}` : 'Ubicación no disponible';
  const coordText = coords ? `${lat}, ${lng}${accuracy ? ` · precisión aprox. ${accuracy} m` : ''}` : 'No disponibles';
  const timeText = now.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
  const template = sanitizeTemplate(elements.messageTemplate.value || state.messageTemplate || DEFAULT_MESSAGE);
  const prefix = mode === 'test' ? '[PRUEBA - NO ES UNA EMERGENCIA]\n\n' : '';
  const text = prefix + template
    .replaceAll('{{MAP_LINK}}', mapLink)
    .replaceAll('{{COORDS}}', coordText)
    .replaceAll('{{TIME}}', timeText)
    .trim();

  return { text, mapLink, coords: coordText, timeText, hasLocation: Boolean(coords), mode };
}

function openAlertModal(payload, { mode }) {
  elements.alertTitle.textContent = mode === 'test' ? 'Prueba preparada' : 'Aviso preparado';
  elements.alertSubtitle.textContent = payload.hasLocation
    ? 'Ubicación añadida. Revisa y comparte por la app que prefieras.'
    : 'No se obtuvo ubicación. Puedes compartir el aviso igualmente.';
  elements.alertMessage.value = payload.text;
  elements.openMapBtn.href = payload.hasLocation ? payload.mapLink : '#';
  elements.openMapBtn.classList.toggle('hidden', !payload.hasLocation);
  renderContactActions(payload);
  elements.alertModal.classList.remove('hidden');
  setTimeout(() => elements.nativeShareBtn.focus(), 60);
}

function closeAlert() {
  elements.alertModal.classList.add('hidden');
}

function renderContactActions(payload) {
  if (!state.contacts.length) {
    elements.contactActionList.innerHTML = '<div class="empty-state">No hay contactos guardados. Usa Compartir o añade contactos en la pestaña Contactos.</div>';
    return;
  }
  elements.contactActionList.innerHTML = state.contacts.map((contact) => {
    const phone = contact.phone || '';
    const email = contact.email || '';
    const smsLink = phone ? buildSmsLink(phone, payload.text) : '';
    const whatsappLink = phone ? buildWhatsAppLink(phone, payload.text) : '';
    const emailLink = email ? buildEmailLink(email, payload.text) : '';
    return `
      <article class="contact-action-item" data-id="${escapeAttr(contact.id)}">
        <strong>${escapeHtml(contact.name)} ${contact.priority ? '<span class="badge">Prioritario</span>' : ''}</strong>
        <div class="contact-buttons">
          ${phone ? `<a class="secondary button-link" href="${escapeAttr(smsLink)}">SMS</a>` : ''}
          ${phone ? `<a class="secondary button-link" href="${escapeAttr(whatsappLink)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
          ${email ? `<a class="secondary button-link" href="${escapeAttr(emailLink)}">Email</a>` : ''}
          ${phone ? `<a class="danger button-link" href="tel:${escapeAttr(phone)}">Llamar</a>` : ''}
        </div>
      </article>
    `;
  }).join('');
}

function buildSmsLink(phone, text) {
  const recipient = normalizePhone(phone);
  const separator = isIOSDevice() ? '&' : '?';
  return `sms:${recipient}${separator}body=${encodeURIComponent(text)}`;
}

function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function buildWhatsAppLink(phone, text) {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function buildEmailLink(email, text) {
  const recipient = normalizeEmail(email);
  return `mailto:${recipient}?subject=${encodeURIComponent('SafeSignal - necesito ayuda')}&body=${encodeURIComponent(text)}`;
}

function handleContactActionClick(event) {
  const link = event.target.closest('a');
  if (!link) return;
  vibrate(40);
}

async function nativeShareCurrentAlert() {
  if (!lastAlertPayload) return;
  await nativeShare(lastAlertPayload);
}

async function nativeShare(payload) {
  if (!navigator.share) {
    toast('Tu navegador no tiene menú de compartir. Usa copiar, SMS, WhatsApp o email.');
    return;
  }
  try {
    await navigator.share({ title: 'SafeSignal', text: payload.text, url: payload.hasLocation ? payload.mapLink : undefined });
    toast('Menú de compartir abierto.');
  } catch (error) {
    if (error?.name !== 'AbortError') toast('No se pudo abrir compartir. Usa copiar o contactos.');
  }
}

async function copyAlertText() {
  const text = elements.alertMessage.value;
  try {
    await navigator.clipboard.writeText(text);
    toast('Texto copiado.');
  } catch {
    elements.alertMessage.focus();
    elements.alertMessage.select();
    document.execCommand('copy');
    toast('Texto seleccionado para copiar.');
  }
}

function startCheckin() {
  const minutes = Math.max(1, Math.min(180, Number(elements.checkinMinutes.value) || 10));
  checkinDeadline = Date.now() + minutes * 60 * 1000;
  elements.checkinPanel.classList.remove('hidden');
  tickCheckin();
  if (checkinTimer) clearInterval(checkinTimer);
  checkinTimer = setInterval(tickCheckin, 1000);
  toast(`Check-in iniciado: ${minutes} min.`);
}

function tickCheckin() {
  if (!checkinDeadline) return;
  const remainingMs = checkinDeadline - Date.now();
  if (remainingMs <= 0) {
    cancelCheckin({ silent: true });
    toast('Check-in vencido. Preparando aviso.');
    prepareAlert({ mode: 'real', skipCountdown: true });
    return;
  }
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  elements.checkinRemaining.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function cancelCheckin({ silent = false } = {}) {
  if (checkinTimer) clearInterval(checkinTimer);
  checkinTimer = null;
  checkinDeadline = null;
  elements.checkinPanel.classList.add('hidden');
  if (!silent) toast('Check-in cancelado.');
}

function toggleSiren() {
  if (siren.active) stopSiren();
  else startSiren();
}

async function startSiren() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) throw new Error('AudioContext not supported');
    siren.ctx = new AudioCtx();
    siren.osc = siren.ctx.createOscillator();
    siren.gain = siren.ctx.createGain();
    siren.osc.type = 'sawtooth';
    siren.gain.gain.value = 0.0001;
    siren.osc.connect(siren.gain).connect(siren.ctx.destination);
    siren.osc.start();
    siren.gain.gain.exponentialRampToValueAtTime(0.22, siren.ctx.currentTime + 0.06);
    let high = false;
    siren.interval = setInterval(() => {
      high = !high;
      if (siren.osc) siren.osc.frequency.setTargetAtTime(high ? 980 : 520, siren.ctx.currentTime, 0.05);
      vibrate([80, 70, 80]);
    }, 420);
    document.body.classList.add('flash');
    siren.active = true;
    elements.sirenBtn.textContent = 'Detener sirena';
    toast('Sirena activada. Pulsa otra vez para detener.');
  } catch {
    document.body.classList.add('flash');
    siren.active = true;
    elements.sirenBtn.textContent = 'Detener luz';
    toast('Audio no disponible. Luz visual activada.');
  }
}

function stopSiren() {
  if (siren.interval) clearInterval(siren.interval);
  try {
    siren.gain?.gain?.exponentialRampToValueAtTime(0.0001, siren.ctx.currentTime + 0.04);
    setTimeout(() => {
      try { siren.osc?.stop(); } catch {}
      try { siren.ctx?.close(); } catch {}
    }, 80);
  } catch {}
  siren = { active: false, ctx: null, osc: null, gain: null, interval: null };
  document.body.classList.remove('flash');
  elements.sirenBtn.textContent = 'Sirena / luz';
  vibrate(0);
}

function startFakeCall() {
  saveSettingsFromFormQuietly();
  const name = state.settings.fakeCallerName || 'Mamá';
  elements.fakeCallerDisplay.textContent = name;
  elements.fakeCallerAvatar.textContent = name.trim().charAt(0).toUpperCase() || 'M';
  elements.fakeCallScreen.classList.remove('hidden');
  vibrate([450, 300, 450, 600]);
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    fakeCall.ctx = new AudioCtx();
    fakeCall.osc = fakeCall.ctx.createOscillator();
    fakeCall.gain = fakeCall.ctx.createGain();
    fakeCall.osc.type = 'sine';
    fakeCall.osc.frequency.value = 440;
    fakeCall.gain.gain.value = 0.0001;
    fakeCall.osc.connect(fakeCall.gain).connect(fakeCall.ctx.destination);
    fakeCall.osc.start();
    let on = false;
    fakeCall.interval = setInterval(() => {
      on = !on;
      fakeCall.gain.gain.setTargetAtTime(on ? 0.11 : 0.0001, fakeCall.ctx.currentTime, 0.04);
      fakeCall.osc.frequency.setTargetAtTime(on ? 520 : 390, fakeCall.ctx.currentTime, 0.04);
      if (on) vibrate([300, 120, 300]);
    }, 800);
  } catch {}
}

function stopFakeCall() {
  elements.fakeCallScreen.classList.add('hidden');
  if (fakeCall.interval) clearInterval(fakeCall.interval);
  try { fakeCall.osc?.stop(); } catch {}
  try { fakeCall.ctx?.close(); } catch {}
  fakeCall = { ctx: null, osc: null, gain: null, interval: null };
  vibrate(0);
}

function setStealthMode(enabled, { silent = false } = {}) {
  state.settings.stealthMode = Boolean(enabled);
  saveState();
  applyStealthMode(state.settings.stealthMode);
  if (!silent) toast(state.settings.stealthMode ? 'Modo discreto activado.' : 'Modo normal activado.');
}

function applyStealthMode(enabled) {
  const active = Boolean(enabled);
  document.body.classList.toggle('stealth', active);
  $$('.normal-panel').forEach((el) => el.classList.toggle('hidden', active));
  $$('.stealth-panel').forEach((el) => el.classList.toggle('hidden', !active));
  $$('[data-normal]').forEach((node) => {
    node.textContent = active ? node.dataset.stealth : node.dataset.normal;
  });
  elements.stealthToggleBtn?.setAttribute('aria-pressed', String(active));
  document.title = active ? 'Notas' : 'SafeSignal';
}

function bindLongPress(target, callback, delay = 1200) {
  let timer = null;
  let fired = false;
  const start = (event) => {
    fired = false;
    timer = setTimeout(() => {
      fired = true;
      callback(event);
    }, delay);
  };
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  target.addEventListener('pointerdown', start);
  target.addEventListener('pointerup', cancel);
  target.addEventListener('pointerleave', cancel);
  target.addEventListener('pointercancel', cancel);
  target.addEventListener('click', (event) => {
    if (fired) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

function bindMultiTap(target, callback, { taps = 3, windowMs = 1200 } = {}) {
  let count = 0;
  let timer = null;
  target.addEventListener('click', () => {
    count += 1;
    clearTimeout(timer);
    if (count >= taps) {
      count = 0;
      callback();
      return;
    }
    timer = setTimeout(() => { count = 0; }, windowMs);
  });
}

function vibrate(pattern) {
  if (!state.settings.vibrationEnabled) return;
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}

function exportData() {
  const exportObject = {
    exportedAt: new Date().toISOString(),
    app: 'SafeSignal',
    version: '1.3.0',
    data: state
  };
  const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `safesignal-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Copia exportada. Guárdala con cuidado.');
}

async function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const imported = parsed.data || parsed;
    const nextState = mergeState(DEFAULT_STATE, imported);
    const ok = confirm('Importar reemplazará los datos actuales de SafeSignal en este navegador. ¿Continuar?');
    if (!ok) return;
    if (!Array.isArray(nextState.contacts)) throw new Error('Invalid contacts');
    state = nextState;
    saveState();
    hydrateUI();
    renderContacts();
    applyStealthMode(state.settings.stealthMode);
    updateEmergencyLinks();
    toast('Datos importados.');
  } catch {
    toast('No se pudo importar el archivo.');
  } finally {
    event.target.value = '';
  }
}

function deleteAllData() {
  const ok = confirm('Esto borrará contactos, mensaje, ajustes y nota local de este navegador. ¿Seguro?');
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  state = structuredCloneSafe(DEFAULT_STATE);
  hydrateUI();
  renderContacts();
  applyStealthMode(false);
  updateEmergencyLinks();
  toast('Datos borrados.');
}

function toast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => elements.toast.classList.add('hidden'), 3200);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./sw.js');
  } catch (error) {
    console.warn('Service worker no registrado:', error);
  }
}

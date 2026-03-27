/**
 * PasswordCat Chrome Extension - Popup (No master password, no password generator)
 */

const STORAGE_KEY = 'passwordcat_entries';

let entries = [];
let editingId = null;
let showPasswordField = false;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadEntries();
  bindEvents();
}

// Load entries from storage
async function loadEntries() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  entries = result[STORAGE_KEY] || [];
  renderEntries();
}

// Save entries to storage
async function saveEntries() {
  await chrome.storage.local.set({ [STORAGE_KEY]: entries });
}

function bindEvents() {
  document.getElementById('btnAdd').addEventListener('click', openAddForm);
  document.getElementById('searchInput').addEventListener('input', renderEntries);
  document.getElementById('btnCloseModal').addEventListener('click', closeModal);
  document.getElementById('btnCancel').addEventListener('click', closeModal);
  document.getElementById('btnSave').addEventListener('click', saveEntry);
  document.getElementById('btnTogglePassword').addEventListener('click', togglePassword);
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal')) closeModal();
  });
}

function openAddForm() {
  editingId = null;
  document.getElementById('modalTitle').textContent = '添加密码';
  document.getElementById('inputTitle').value = '';
  document.getElementById('inputUrl').value = '';
  document.getElementById('inputUsername').value = '';
  document.getElementById('inputPassword').value = '';
  resetPasswordToggle();
  hideFormError();
  document.getElementById('modal').style.display = 'flex';
}

function openEditForm(entry) {
  editingId = entry.id;
  document.getElementById('modalTitle').textContent = '编辑密码';
  document.getElementById('inputTitle').value = entry.title;
  document.getElementById('inputUrl').value = entry.url || '';
  document.getElementById('inputUsername').value = entry.username;
  document.getElementById('inputPassword').value = entry.password;
  resetPasswordToggle();
  hideFormError();
  document.getElementById('modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  editingId = null;
}

function resetPasswordToggle() {
  showPasswordField = false;
  document.getElementById('inputPassword').type = 'password';
  document.getElementById('btnTogglePassword').textContent = '👁️';
}

function togglePassword() {
  showPasswordField = !showPasswordField;
  document.getElementById('inputPassword').type = showPasswordField ? 'text' : 'password';
  document.getElementById('btnTogglePassword').textContent = showPasswordField ? '🙈' : '👁️';
}

function showFormError(msg) {
  const el = document.getElementById('formError');
  el.textContent = msg;
  el.style.display = 'block';
}

function hideFormError() {
  document.getElementById('formError').style.display = 'none';
}

async function saveEntry() {
  hideFormError();
  const title = document.getElementById('inputTitle').value.trim();
  const url = document.getElementById('inputUrl').value.trim();
  const username = document.getElementById('inputUsername').value.trim();
  const password = document.getElementById('inputPassword').value;

  if (!title || !username || !password) {
    showFormError('请填写必填项');
    return;
  }

  if (editingId) {
    const index = entries.findIndex(e => e.id === editingId);
    if (index !== -1) {
      entries[index] = { ...entries[index], title, url, username, password, updatedAt: Date.now() };
    }
  } else {
    entries.push({
      id: crypto.randomUUID(),
      title, url, username, password,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  await saveEntries();
  closeModal();
  renderEntries();
}

async function deleteEntry(id) {
  if (!confirm('确定删除此密码？')) return;
  entries = entries.filter(e => e.id !== id);
  await saveEntries();
  renderEntries();
}

function renderEntries() {
  const query = document.getElementById('searchInput').value.toLowerCase();
  const filtered = query
    ? entries.filter(e =>
        e.title.toLowerCase().includes(query) ||
        e.username.toLowerCase().includes(query) ||
        (e.url && e.url.toLowerCase().includes(query))
      )
    : entries;

  const list = document.getElementById('entriesList');

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🔑</div><p>${query ? '没有匹配的结果' : '暂无保存的密码'}</p></div>`;
    return;
  }

  list.innerHTML = filtered.map(entry => `
    <div class="entry-card" data-id="${entry.id}">
      <div class="entry-icon">${getPlatformIcon(entry.title)}</div>
      <div class="entry-info">
        <div class="entry-title">${escapeHtml(entry.title)}</div>
        <div class="entry-username">${escapeHtml(entry.username)}</div>
      </div>
      <div class="entry-actions">
        <button class="btn-icon" data-action="copy-user" data-id="${entry.id}" title="复制账户">📋</button>
        <button class="btn-icon" data-action="copy-pass" data-id="${entry.id}" title="复制密码">🔑</button>
        <button class="btn-icon btn-icon-danger" data-action="delete" data-id="${entry.id}" title="删除">🗑️</button>
      </div>
    </div>
  `).join('');

  // Bind events
  list.querySelectorAll('.entry-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) {
        const id = card.dataset.id;
        const entry = entries.find(e => e.id === id);
        if (entry) openEditForm(entry);
        return;
      }
      const { action, id } = btn.dataset;
      const entry = entries.find(e => e.id === id);
      if (!entry) return;
      if (action === 'copy-user') copyToClipboard(entry.username, '账户');
      if (action === 'copy-pass') copyToClipboard(entry.password, '密码');
      if (action === 'delete') deleteEntry(id);
    });
  });
}

async function copyToClipboard(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(label + '已复制');
  } catch (e) {
    showToast('复制失败');
  }
}

function getPlatformIcon(title) {
  const icons = {
    'github': '🐙', 'gmail': '📧', 'twitter': '𝕏', 'facebook': '👍',
    'instagram': '📷', 'bilibili': '📺', 'youtube': '▶️', 'google': '🔍',
    'baidu': '🦆', 'qq': '🐧', 'wechat': '💬', 'taobao': '🛒', 'jd': '🛍️'
  };
  const lower = title.toLowerCase();
  for (const [key, icon] of Object.entries(icons)) {
    if (lower.includes(key)) return icon;
  }
  return '🔑';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

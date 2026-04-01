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
    if (e.target.id === 'modal') closeModal();
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
  showModal();
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
  showModal();
}

function showModal() {
  const modal = document.getElementById('modal');
  modal.style.display = 'flex';
}

function closeModal() {
  const modal = document.getElementById('modal');
  modal.style.display = 'none';
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
        <button class="btn-icon btn-icon-fill" data-action="fill" data-id="${entry.id}" title="填入到页面">⌨️</button>
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
      if (action === 'fill') fillToPage(entry);
      if (action === 'copy-user') copyToClipboard(entry.username, '账户');
      if (action === 'copy-pass') copyToClipboard(entry.password, '密码');
      if (action === 'delete') deleteEntry(id);
    });
  });
}

// 填入到当前页面
async function fillToPage(entry) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) { showToast('无法获取当前标签页'); return; }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (username, password) => {
        // 查找用户名框（多种选择器）
        const usernameSelectors = [
          'input[autocomplete="username"]',
          'input[autocomplete="email"]',
          'input[type="email"]',
          'input[name*="user" i]',
          'input[name*="email" i]',
          'input[name*="login" i]',
          'input[id*="user" i]',
          'input[id*="email" i]',
          'input[id*="login" i]',
          'input[type="text"]',
        ];

        const passwordSelectors = [
          'input[autocomplete="current-password"]',
          'input[autocomplete="new-password"]',
          'input[type="password"]',
        ];

        function fillInput(el, value) {
          if (!el || !value) return false;
          // 兼容 React/Vue 等框架的受控组件
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (nativeInputValueSetter) nativeInputValueSetter.call(el, value);
          else el.value = value;
          ['input', 'change', 'blur'].forEach(evt =>
            el.dispatchEvent(new Event(evt, { bubbles: true }))
          );
          return true;
        }

        let filled = false;

        // 填充用户名
        for (const sel of usernameSelectors) {
          const el = document.querySelector(sel);
          if (el && el.offsetParent !== null) { // 只填可见元素
            if (fillInput(el, username)) { filled = true; break; }
          }
        }

        // 填充密码
        for (const sel of passwordSelectors) {
          const el = document.querySelector(sel);
          if (el && el.offsetParent !== null) {
            fillInput(el, password);
            break;
          }
        }

        return filled;
      },
      args: [entry.username, entry.password],
    });

    showToast('已填入账户和密码 ✓');
    // 自动关闭 popup
    setTimeout(() => window.close(), 800);
  } catch (e) {
    showToast('填入失败：' + (e.message || '请检查页面权限'));
  }
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

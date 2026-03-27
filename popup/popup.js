/**
 * PasswordCat Chrome Extension - Popup (Vanilla JS)
 */

const VAULT_KEY = 'passwordcat_master_key';
const SALT_KEY = 'passwordcat_salt';

// State
let isUnlocked = false;
let hasVault = false;
let entries = [];
let masterPassword = '';
let editingId = null;
let showPassword = false;

// DOM Elements
const lockScreen = document.getElementById('lockScreen');
const mainScreen = document.getElementById('mainScreen');
const setupForm = document.getElementById('setupForm');
const unlockForm = document.getElementById('unlockForm');
const modal = document.getElementById('modal');
const entriesList = document.getElementById('entriesList');
const errorMessage = document.getElementById('errorMessage');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  await checkVault();
  bindEvents();
}

async function checkVault() {
  const result = await chrome.storage.local.get([VAULT_KEY, SALT_KEY]);
  hasVault = !!(result[VAULT_KEY] && result[SALT_KEY]);
  showLockScreen();
}

function showLockScreen() {
  lockScreen.style.display = 'flex';
  mainScreen.style.display = 'none';
  setupForm.style.display = hasVault ? 'none' : 'flex';
  unlockForm.style.display = hasVault ? 'flex' : 'none';
}

function showMainScreen() {
  lockScreen.style.display = 'none';
  mainScreen.style.display = 'flex';
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorMessage.style.display = 'block';
}

function hideError() {
  errorMessage.style.display = 'none';
}

function bindEvents() {
  // Create vault
  document.getElementById('btnCreateVault').addEventListener('click', createVault);
  
  // Unlock
  document.getElementById('btnUnlock').addEventListener('click', unlock);
  document.getElementById('masterPassword').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') unlock();
  });
  
  // Search
  document.getElementById('searchInput').addEventListener('input', renderEntries);
  
  // Add
  document.getElementById('btnAdd').addEventListener('click', openAddForm);
  
  // Modal
  document.getElementById('btnCloseModal').addEventListener('click', closeModal);
  document.getElementById('btnCancel').addEventListener('click', closeModal);
  document.getElementById('btnSave').addEventListener('click', saveEntry);
  document.getElementById('btnTogglePassword').addEventListener('click', togglePassword);
  document.getElementById('btnGenerate').addEventListener('click', generatePassword);
  
  // Lock & Settings
  document.getElementById('btnLock').addEventListener('click', lock);
  document.getElementById('btnSettings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // Close modal on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

async function createVault() {
  hideError();
  const newPassword = document.getElementById('newMasterPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  
  if (!newPassword) {
    showError('请输入主密码');
    return;
  }
  if (newPassword.length < 8) {
    showError('密码长度至少8位');
    return;
  }
  if (newPassword !== confirmPassword) {
    showError('两次密码不一致');
    return;
  }
  
  try {
    const salt = PasswordCatCrypto.generateSalt();
    const saltArray = Array.from(salt);
    const encrypted = await PasswordCatCrypto.encrypt({}, newPassword, salt);
    
    await chrome.storage.local.set({
      [VAULT_KEY]: encrypted,
      [SALT_KEY]: saltArray.join(',')
    });
    
    hasVault = true;
    masterPassword = newPassword;
    entries = [];
    isUnlocked = true;
    showMainScreen();
  } catch (e) {
    showError('创建失败');
  }
}

async function unlock() {
  hideError();
  const password = document.getElementById('masterPassword').value;
  
  if (!password) {
    showError('请输入主密码');
    return;
  }
  
  try {
    const result = await chrome.storage.local.get([VAULT_KEY, SALT_KEY]);
    
    if (!result[VAULT_KEY]) {
      showError('未找到保险库');
      return;
    }
    
    const saltArray = result[SALT_KEY].split(',').map(Number);
    const salt = new Uint8Array(saltArray);
    
    await PasswordCatCrypto.decrypt(result[VAULT_KEY], password);
    
    masterPassword = password;
    await loadEntries();
    isUnlocked = true;
    showMainScreen();
  } catch (e) {
    showError('密码错误');
  }
}

async function loadEntries() {
  const result = await chrome.storage.local.get(['passwordcat_entries_index', VAULT_KEY, SALT_KEY]);
  if (result.passwordcat_entries_index) {
    try {
      const saltArray = result[SALT_KEY].split(',').map(Number);
      const salt = new Uint8Array(saltArray);
      const decrypted = await PasswordCatCrypto.decrypt(result.passwordcat_entries_index, masterPassword);
      entries = decrypted || [];
    } catch (e) {
      entries = [];
    }
  } else {
    entries = [];
  }
  renderEntries();
}

async function saveEntriesIndex() {
  const result = await chrome.storage.local.get([SALT_KEY]);
  const saltArray = result[SALT_KEY].split(',').map(Number);
  const salt = new Uint8Array(saltArray);
  const encrypted = await PasswordCatCrypto.encrypt(entries, masterPassword, salt);
  await chrome.storage.local.set({ passwordcat_entries_index: encrypted });
}

function lock() {
  isUnlocked = false;
  masterPassword = '';
  entries = [];
  editingId = null;
  document.getElementById('masterPassword').value = '';
  showLockScreen();
}

function openAddForm() {
  editingId = null;
  document.getElementById('modalTitle').textContent = '添加密码';
  document.getElementById('inputTitle').value = '';
  document.getElementById('inputUrl').value = '';
  document.getElementById('inputUsername').value = '';
  document.getElementById('inputPassword').value = '';
  showPassword = false;
  document.getElementById('inputPassword').type = 'password';
  document.getElementById('btnTogglePassword').textContent = '👁️';
  modal.style.display = 'flex';
  hideError();
}

function openEditForm(entry) {
  editingId = entry.id;
  document.getElementById('modalTitle').textContent = '编辑密码';
  document.getElementById('inputTitle').value = entry.title;
  document.getElementById('inputUrl').value = entry.url || '';
  document.getElementById('inputUsername').value = entry.username;
  document.getElementById('inputPassword').value = entry.password;
  showPassword = false;
  document.getElementById('inputPassword').type = 'password';
  document.getElementById('btnTogglePassword').textContent = '👁️';
  modal.style.display = 'flex';
  hideError();
}

function closeModal() {
  modal.style.display = 'none';
  editingId = null;
}

async function saveEntry() {
  hideError();
  const title = document.getElementById('inputTitle').value.trim();
  const url = document.getElementById('inputUrl').value.trim();
  const username = document.getElementById('inputUsername').value.trim();
  const password = document.getElementById('inputPassword').value;
  
  if (!title || !username || !password) {
    showError('请填写必填项');
    return;
  }
  
  try {
    if (editingId) {
      const index = entries.findIndex(e => e.id === editingId);
      if (index !== -1) {
        entries[index] = {
          ...entries[index],
          title,
          url,
          username,
          password,
          updatedAt: Date.now()
        };
      }
    } else {
      entries.push({
        id: crypto.randomUUID(),
        title,
        url,
        username,
        password,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
    
    await saveEntriesIndex();
    closeModal();
    renderEntries();
  } catch (e) {
    showError('保存失败');
  }
}

function renderEntries() {
  const query = document.getElementById('searchInput').value.toLowerCase();
  let filtered = entries;
  
  if (query) {
    filtered = entries.filter(entry =>
      entry.title.toLowerCase().includes(query) ||
      entry.username.toLowerCase().includes(query) ||
      (entry.url && entry.url.toLowerCase().includes(query))
    );
  }
  
  if (filtered.length === 0) {
    entriesList.innerHTML = '<div class="empty-state"><p>暂无保存的密码</p></div>';
    return;
  }
  
  entriesList.innerHTML = filtered.map(entry => `
    <div class="entry-card" data-id="${entry.id}">
      <div class="entry-icon">${getPlatformIcon(entry.title)}</div>
      <div class="entry-info">
        <div class="entry-title">${escapeHtml(entry.title)}</div>
        <div class="entry-username">${escapeHtml(entry.username)}</div>
      </div>
      <div class="entry-actions">
        <button class="btn-icon" onclick="copyUsername('${entry.id}')" title="复制账户">📋</button>
        <button class="btn-icon" onclick="copyPassword('${entry.id}')" title="复制密码">🔑</button>
      </div>
    </div>
  `).join('');
  
  // Bind click events
  entriesList.querySelectorAll('.entry-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.classList.contains('btn-icon')) {
        const id = card.dataset.id;
        const entry = entries.find(e => e.id === id);
        if (entry) openEditForm(entry);
      }
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function copyToClipboard(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(label + '已复制');
  } catch (e) {
    showError('复制失败');
  }
}

window.copyUsername = function(id) {
  const entry = entries.find(e => e.id === id);
  if (entry) copyToClipboard(entry.username, '账户');
};

window.copyPassword = function(id) {
  const entry = entries.find(e => e.id === id);
  if (entry) copyToClipboard(entry.password, '密码');
};

function togglePassword() {
  showPassword = !showPassword;
  const input = document.getElementById('inputPassword');
  input.type = showPassword ? 'text' : 'password';
  document.getElementById('btnTogglePassword').textContent = showPassword ? '🙈' : '👁️';
}

function generatePassword() {
  const password = PasswordCatCrypto.generatePassword(16, {
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true
  });
  document.getElementById('inputPassword').value = password;
  showPassword = true;
  document.getElementById('inputPassword').type = 'text';
  document.getElementById('btnTogglePassword').textContent = '🙈';
}

function getPlatformIcon(title) {
  const icons = {
    'github': '🐙',
    'gmail': '📧',
    'twitter': '𝕏',
    'facebook': '👍',
    'instagram': '📷',
    'bilibili': '📺',
    'youtube': '▶️',
    'google': '🔍',
    'baidu': '🦆',
    'qq': '🐧',
    'wechat': '💬',
    'taobao': '🛒',
    'jd': '🛍️'
  };
  const lower = title.toLowerCase();
  for (const [key, icon] of Object.entries(icons)) {
    if (lower.includes(key)) return icon;
  }
  return '🔑';
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

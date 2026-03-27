/**
 * PasswordCat Chrome Extension - Options Page (Vanilla JS)
 */

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadSettings();
  await loadStats();
  bindEvents();
}

async function loadSettings() {
  const result = await chrome.storage.local.get('passwordcat_settings');
  const settings = result.passwordcat_settings || {
    autoFill: true,
    showFab: true,
    autoDetect: true,
    autoLockMinutes: 15
  };
  
  document.getElementById('autoFillToggle').classList.toggle('active', settings.autoFill);
  document.getElementById('fabToggle').classList.toggle('active', settings.showFab);
  document.getElementById('autoDetectToggle').classList.toggle('active', settings.autoDetect);
  document.getElementById('autoLockMinutes').value = settings.autoLockMinutes;
  updateAutoLockDisplay(settings.autoLockMinutes);
}

async function loadStats() {
  const result = await chrome.storage.local.get('passwordcat_entries_index');
  const entriesCount = document.getElementById('entriesCount');
  if (result.passwordcat_entries_index) {
    entriesCount.textContent = '?';
  }
}

function updateAutoLockDisplay(minutes) {
  const display = document.getElementById('autoLockDisplay');
  if (minutes === 0) {
    display.textContent = '从不';
  } else {
    display.textContent = minutes + '分钟';
  }
}

function bindEvents() {
  // Toggles
  document.getElementById('autoFillToggle').addEventListener('click', () => {
    document.getElementById('autoFillToggle').classList.toggle('active');
    saveSettings();
  });
  
  document.getElementById('fabToggle').addEventListener('click', () => {
    document.getElementById('fabToggle').classList.toggle('active');
    saveSettings();
  });
  
  document.getElementById('autoDetectToggle').addEventListener('click', () => {
    document.getElementById('autoDetectToggle').classList.toggle('active');
    saveSettings();
  });
  
  // Auto-lock select
  document.getElementById('autoLockMinutes').addEventListener('change', (e) => {
    updateAutoLockDisplay(parseInt(e.target.value));
    saveSettings();
  });
  
  // Export
  document.getElementById('exportBtn').addEventListener('click', exportData);
  
  // Import
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  
  document.getElementById('importFile').addEventListener('change', importData);
  
  // Delete all
  document.getElementById('deleteAllBtn').addEventListener('click', deleteAllData);
}

async function saveSettings() {
  const settings = {
    autoFill: document.getElementById('autoFillToggle').classList.contains('active'),
    showFab: document.getElementById('fabToggle').classList.contains('active'),
    autoDetect: document.getElementById('autoDetectToggle').classList.contains('active'),
    autoLockMinutes: parseInt(document.getElementById('autoLockMinutes').value)
  };
  
  await chrome.storage.local.set({ passwordcat_settings: settings });
}

async function exportData() {
  try {
    const result = await chrome.storage.local.get(null);
    
    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      data: result
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'passwordcat-backup-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('导出失败');
  }
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const importData = JSON.parse(text);
    
    if (!importData.data) {
      throw new Error('无效的备份文件');
    }
    
    await chrome.storage.local.set(importData.data);
    alert('导入成功！');
    location.reload();
  } catch (e) {
    alert('导入失败: ' + e.message);
  }
}

async function deleteAllData() {
  if (!confirm('确定要删除所有数据吗？此操作不可恢复！')) return;
  if (!confirm('再次确认：所有密码数据将被永久删除！')) return;
  
  try {
    await chrome.storage.local.clear();
    alert('所有数据已删除');
    location.reload();
  } catch (e) {
    alert('删除失败');
  }
}

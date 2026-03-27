/**
 * PasswordCat Chrome Extension - Options Page
 */

const { decrypt, encrypt } = window.PasswordCatCrypto;
const { loadData, saveData } = window.PasswordCatStorage;

// 加载设置
async function loadSettings() {
  const result = await chrome.storage.local.get(['passwordcat_settings', 'passwordcat_entries_index']);
  
  // 加载开关状态
  const settings = result.passwordcat_settings || {
    autoFill: true,
    showFab: true,
    autoDetect: true,
    autoLockMinutes: 15
  };
  
  updateToggles(settings);
  
  // 加载统计数据
  if (result.passwordcat_entries_index) {
    document.getElementById('entriesCount').textContent = '?';
  }
}

// 更新开关状态
function updateToggles(settings) {
  const autoFillToggle = document.getElementById('autoFillToggle');
  const fabToggle = document.getElementById('fabToggle');
  const autoDetectToggle = document.getElementById('autoDetectToggle');
  
  autoFillToggle.classList.toggle('active', settings.autoFill);
  fabToggle.classList.toggle('active', settings.showFab);
  autoDetectToggle.classList.toggle('active', settings.autoDetect);
  
  document.getElementById('autoLockMinutes').value = settings.autoLockMinutes;
}

// 保存设置
async function saveSettings() {
  const settings = {
    autoFill: document.getElementById('autoFillToggle').classList.contains('active'),
    showFab: document.getElementById('fabToggle').classList.contains('active'),
    autoDetect: document.getElementById('autoDetectToggle').classList.contains('active'),
    autoLockMinutes: parseInt(document.getElementById('autoLockMinutes').value)
  };
  
  await chrome.storage.local.set({ passwordcat_settings: settings });
}

// 导出数据
async function exportData() {
  try {
    const result = await chrome.storage.local.get(['passwordcat_entries_index', 'passwordcat_salt', 'passwordcat_settings']);
    
    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      data: result
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `passwordcat-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('导出失败: ' + e.message);
  }
}

// 导入数据
async function importData(file) {
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

// 删除所有数据
async function deleteAllData() {
  if (!confirm('确定要删除所有数据吗？此操作不可恢复！')) {
    return;
  }
  
  if (!confirm('再次确认：所有密码数据将被永久删除！')) {
    return;
  }
  
  try {
    await chrome.storage.local.clear();
    alert('所有数据已删除');
    location.reload();
  } catch (e) {
    alert('删除失败: ' + e.message);
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  
  // 开关事件
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
  
  document.getElementById('autoLockMinutes').addEventListener('change', saveSettings);
  
  // 导出
  document.getElementById('exportBtn').addEventListener('click', exportData);
  
  // 导入
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  
  document.getElementById('importFile').addEventListener('change', (e) => {
    if (e.target.files[0]) {
      importData(e.target.files[0]);
    }
  });
  
  // 删除
  document.getElementById('deleteAllBtn').addEventListener('click', deleteAllData);
});

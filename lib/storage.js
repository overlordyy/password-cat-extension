/**
 * PasswordCat Chrome Extension - Storage Manager
 * 使用 Chrome Storage API 存储加密数据
 */

const STORAGE_KEY = 'passwordcat_vault';

// 存储结构
const defaultData = {
  entries: [],      // 密码条目
  settings: {
    autoLockMinutes: 15,
    autoFillEnabled: true
  }
};

// 加载存储数据
async function loadData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      if (result[STORAGE_KEY]) {
        resolve(result[STORAGE_KEY]);
      } else {
        resolve(defaultData);
      }
    });
  });
}

// 保存数据
async function saveData(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: data }, resolve);
  });
}

// 添加密码条目
async function addEntry(entry) {
  const data = await loadData();
  const newEntry = {
    id: crypto.randomUUID(),
    ...entry,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  data.entries.push(newEntry);
  await saveData(data);
  return newEntry;
}

// 更新密码条目
async function updateEntry(id, updates) {
  const data = await loadData();
  const index = data.entries.findIndex(e => e.id === id);
  if (index !== -1) {
    data.entries[index] = {
      ...data.entries[index],
      ...updates,
      updatedAt: Date.now()
    };
    await saveData(data);
    return data.entries[index];
  }
  return null;
}

// 删除密码条目
async function deleteEntry(id) {
  const data = await loadData();
  data.entries = data.entries.filter(e => e.id !== id);
  await saveData(data);
}

// 搜索密码条目
async function searchEntries(query) {
  const data = await loadData();
  if (!query) return data.entries;
  
  const lowerQuery = query.toLowerCase();
  return data.entries.filter(entry =>
    entry.title.toLowerCase().includes(lowerQuery) ||
    entry.username.toLowerCase().includes(lowerQuery) ||
    entry.url?.toLowerCase().includes(lowerQuery)
  );
}

// 获取域名的所有条目
async function getEntriesByDomain(domain) {
  const data = await loadData();
  return data.entries.filter(entry => {
    if (!entry.url) return false;
    try {
      const entryDomain = new URL(entry.url).hostname;
      return entryDomain.includes(domain) || domain.includes(entryDomain);
    } catch {
      return entry.url.toLowerCase().includes(domain.toLowerCase());
    }
  });
}

// 导出模块
window.PasswordCatStorage = {
  loadData,
  saveData,
  addEntry,
  updateEntry,
  deleteEntry,
  searchEntries,
  getEntriesByDomain,
  defaultData
};

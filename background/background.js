/**
 * PasswordCat Chrome Extension - Background Service Worker
 * 处理后台任务和消息传递
 */

// 监听来自 content script 和 popup 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CREDENTIALS') {
    handleGetCredentials(message.domain)
      .then(credentials => sendResponse({ success: true, data: credentials }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 异步响应
  }
  
  if (message.type === 'SAVE_CREDENTIAL') {
    handleSaveCredential(message.credential)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.type === 'FILL_CREDENTIAL') {
    handleFillCredential(message.credential, sender.tab.id)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// 获取域名的凭据
async function handleGetCredentials(domain) {
  const result = await chrome.storage.local.get(['passwordcat_entries_index', 'passwordcat_salt']);
  
  if (!result.passwordcat_entries_index) {
    return [];
  }
  
  // 需要解锁才能访问，这里返回匹配域名的条目（未解密）
  // 实际解密在 popup 中完成
  return [];
}

// 保存凭据
async function handleSaveCredential(credential) {
  // 这个功能在 popup 中实现
  console.log('Save credential:', credential);
}

// 填充凭据到页面
async function handleFillCredential(credential, tabId) {
  // 注入脚本到页面填充表单
  chrome.scripting.executeScript({
    target: { tabId },
    func: fillForm,
    args: [credential]
  });
}

// 页面脚本：填充表单
function fillForm(credential) {
  // 常见的用户名输入框选择器
  const usernameSelectors = [
    'input[type="text"]',
    'input[type="email"]',
    'input[name="username"]',
    'input[name="login"]',
    'input[id="username"]',
    'input[id="email"]',
    'input[autocomplete="username"]',
    'input[autocomplete="email"]'
  ];
  
  // 常见的密码输入框选择器
  const passwordSelectors = [
    'input[type="password"]'
  ];
  
  // 查找并填充用户名
  for (const selector of usernameSelectors) {
    const input = document.querySelector(selector);
    if (input && credential.username) {
      input.value = credential.username;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      break;
    }
  }
  
  // 查找并填充密码
  for (const selector of passwordSelectors) {
    const input = document.querySelector(selector);
    if (input && credential.password) {
      input.value = credential.password;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      break;
    }
  }
}

// 插件安装时
chrome.runtime.onInstalled.addListener(() => {
  console.log('PasswordCat 扩展已安装');
});

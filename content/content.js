/**
 * PasswordCat Chrome Extension - Content Script
 * 检测登录表单并提供自动填充功能
 */

(function() {
  // 检测是否为登录页面
  function isLoginPage() {
    const url = window.location.href.toLowerCase();
    const keywords = ['login', 'signin', 'sign-in', 'auth', 'account', 'logon', 'register', 'signup', 'sign-up'];
    return keywords.some(kw => url.includes(kw));
  }
  
  // 查找登录表单
  function findLoginForms() {
    const forms = document.querySelectorAll('form');
    const loginForms = [];
    
    forms.forEach(form => {
      const hasPassword = form.querySelector('input[type="password"]');
      const hasUsername = form.querySelector('input[type="text"], input[type="email"], input[name*="user"], input[name*="login"], input[name*="email"]');
      
      if (hasPassword && hasUsername) {
        loginForms.push(form);
      }
    });
    
    return loginForms;
  }
  
  // 创建浮动按钮
  function createFloatingButton() {
    const button = document.createElement('div');
    button.id = 'passwordcat-fab';
    button.innerHTML = '🔐';
    button.title = 'PasswordCat - 自动填充';
    
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      border-radius: 50%;
      box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
      cursor: pointer;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      transition: transform 0.3s, box-shadow 0.3s;
    `;
    
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.1)';
      button.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.4)';
    });
    
    // 点击打开 popup（通过发送消息给 background）
    button.addEventListener('click', () => {
      // 通知 background 打开 popup
      chrome.runtime.sendMessage({
        type: 'OPEN_POPUP',
        domain: window.location.hostname,
        url: window.location.href
      });
    });
    
    document.body.appendChild(button);
    
    return button;
  }
  
  // 检测页面上的输入框并添加自动填充功能
  function setupAutoFill() {
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    
    passwordInputs.forEach(input => {
      // 查找关联的用户名输入框
      const form = input.closest('form');
      if (!form) return;
      
      const usernameInput = form.querySelector('input[type="text"], input[type="email"]');
      
      // 添加图标按钮
      const iconBtn = document.createElement('button');
      iconBtn.type = 'button';
      iconBtn.innerHTML = '🔐';
      iconBtn.title = '使用 PasswordCat 自动填充';
      iconBtn.className = 'passwordcat-autofill-btn';
      
      iconBtn.style.cssText = `
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 16px;
        opacity: 0.6;
        transition: opacity 0.3s;
        padding: 4px;
      `;
      
      iconBtn.addEventListener('mouseenter', () => {
        iconBtn.style.opacity = '1';
      });
      
      iconBtn.addEventListener('mouseleave', () => {
        iconBtn.style.opacity = '0.6';
      });
      
      // 定位
      const parent = input.parentElement;
      if (getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
      }
      
      parent.appendChild(iconBtn);
      
      iconBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({
          type: 'SHOW_POPUP_FOR_DOMAIN',
          domain: window.location.hostname,
          usernameField: usernameInput,
          passwordField: input
        });
      });
    });
  }
  
  // 初始化
  function init() {
    // 延迟执行，等待页面加载完成
    setTimeout(() => {
      // 创建浮动按钮
      createFloatingButton();
      
      // 设置自动填充
      setupAutoFill();
    }, 1000);
  }
  
  // 监听来自 background 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FILL_CREDENTIALS') {
      fillCredentials(message.username, message.password);
      sendResponse({ success: true });
    }
  });
  
  // 填充凭据
  function fillCredentials(username, password) {
    const forms = findLoginForms();
    
    if (forms.length > 0) {
      const form = forms[0];
      
      // 填充用户名
      const usernameInput = form.querySelector('input[type="text"], input[type="email"]');
      if (usernameInput && username) {
        usernameInput.value = username;
        usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      // 填充密码
      const passwordInput = form.querySelector('input[type="password"]');
      if (passwordInput && password) {
        passwordInput.value = password;
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
        passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }
  
  // 等待 DOM 加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

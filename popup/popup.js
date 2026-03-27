/**
 * PasswordCat Chrome Extension - Popup App
 */

const { createApp } = Vue;
const { encrypt, decrypt, generatePassword } = window.PasswordCatCrypto;
const { loadData, saveData, addEntry, updateEntry, deleteEntry, searchEntries } = window.PasswordCatStorage;

const VAULT_KEY = 'passwordcat_master_key';
const SALT_KEY = 'passwordcat_salt';

const app = createApp({
  data() {
    return {
      // 状态
      isUnlocked: false,
      hasVault: false,
      error: '',
      
      // 表单
      masterPassword: '',
      newMasterPassword: '',
      confirmPassword: '',
      
      // 数据
      entries: [],
      searchQuery: '',
      showAddForm: false,
      editingEntry: null,
      showPassword: false,
      
      // 新增/编辑表单
      formData: {
        title: '',
        url: '',
        username: '',
        password: ''
      }
    };
  },
  
  computed: {
    filteredEntries() {
      if (!this.searchQuery) return this.entries;
      const query = this.searchQuery.toLowerCase();
      return this.entries.filter(entry =>
        entry.title.toLowerCase().includes(query) ||
        entry.username.toLowerCase().includes(query) ||
        entry.url?.toLowerCase().includes(query)
      );
    }
  },
  
  async mounted() {
    await this.checkVault();
  },
  
  methods: {
    // 检查是否已有保险库
    async checkVault() {
      const data = await loadData();
      this.hasVault = data.entries.length > 0 || await this.hasStoredVault();
      this.isUnlocked = false;
    },
    
    async hasStoredVault() {
      return new Promise(resolve => {
        chrome.storage.local.get([VAULT_KEY, SALT_KEY], result => {
          resolve(!!result[VAULT_KEY] && !!result[SALT_KEY]);
        });
      });
    },
    
    // 创建保险库
    async createVault() {
      this.error = '';
      
      if (!this.newMasterPassword) {
        this.error = '请输入主密码';
        return;
      }
      
      if (this.newMasterPassword.length < 8) {
        this.error = '密码长度至少8位';
        return;
      }
      
      if (this.newMasterPassword !== this.confirmPassword) {
        this.error = '两次密码不一致';
        return;
      }
      
      try {
        // 生成盐并派生密钥
        const salt = window.PasswordCatCrypto.generateSalt();
        const key = await encrypt({}, this.newMasterPassword, salt);
        
        // 保存到存储
        await chrome.storage.local.set({
          [VAULT_KEY]: key,
          [SALT_KEY]: Array.from(salt).join(',')
        });
        
        this.hasVault = true;
        this.isUnlocked = true;
        this.masterPassword = this.newMasterPassword;
        this.entries = [];
        
        // 保存未加密的密码列表索引（用于快速搜索）
        await this.saveEntriesIndex();
      } catch (e) {
        this.error = '创建失败: ' + e.message;
      }
    },
    
    // 解锁保险库
    async unlock() {
      this.error = '';
      
      if (!this.masterPassword) {
        this.error = '请输入主密码';
        return;
      }
      
      try {
        const result = await chrome.storage.local.get([VAULT_KEY, SALT_KEY]);
        
        if (!result[VAULT_KEY]) {
          this.error = '未找到保险库';
          return;
        }
        
        // 尝试解密
        const saltArray = result[SALT_KEY].split(',').map(Number);
        const salt = new Uint8Array(saltArray);
        
        await decrypt(result[VAULT_KEY], this.masterPassword);
        
        this.isUnlocked = true;
        
        // 加载数据
        await this.loadEntries();
      } catch (e) {
        this.error = '密码错误';
      }
    },
    
    // 加载条目
    async loadEntries() {
      const result = await chrome.storage.local.get(['passwordcat_entries_index', VAULT_KEY, SALT_KEY]);
      if (result.passwordcat_entries_index) {
        try {
          const saltArray = result[SALT_KEY].split(',').map(Number);
          const salt = new Uint8Array(saltArray);
          const decrypted = await decrypt(result.passwordcat_entries_index, this.masterPassword);
          this.entries = decrypted;
        } catch (e) {
          this.entries = [];
        }
      } else {
        this.entries = [];
      }
    },
    
    // 保存条目索引
    async saveEntriesIndex() {
      const saltArray = await this.getSalt();
      const encrypted = await encrypt(this.entries, this.masterPassword, saltArray);
      await chrome.storage.local.set({ passwordcat_entries_index: encrypted });
    },
    
    // 获取盐
    async getSalt() {
      const result = await chrome.storage.local.get([SALT_KEY]);
      return new Uint8Array(result[SALT_KEY].split(',').map(Number));
    },
    
    // 锁定
    lock() {
      this.isUnlocked = false;
      this.masterPassword = '';
      this.entries = [];
    },
    
    // 选择条目
    selectEntry(entry) {
      this.editingEntry = { ...entry };
      this.formData = { ...entry };
      this.showAddForm = true;
    },
    
    // 关闭表单
    closeForm() {
      this.showAddForm = false;
      this.editingEntry = null;
      this.formData = {
        title: '',
        url: '',
        username: '',
        password: ''
      };
      this.showPassword = false;
    },
    
    // 保存条目
    async saveEntry() {
      if (!this.formData.title || !this.formData.username || !this.formData.password) {
        this.error = '请填写必填项';
        return;
      }
      
      try {
        if (this.editingEntry) {
          // 更新
          const index = this.entries.findIndex(e => e.id === this.editingEntry.id);
          if (index !== -1) {
            this.entries[index] = {
              ...this.entries[index],
              ...this.formData,
              updatedAt: Date.now()
            };
          }
        } else {
          // 新增
          this.entries.push({
            id: crypto.randomUUID(),
            ...this.formData,
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
        }
        
        await this.saveEntriesIndex();
        this.closeForm();
      } catch (e) {
        this.error = '保存失败: ' + e.message;
      }
    },
    
    // 删除条目
    async deleteEntry(id) {
      this.entries = this.entries.filter(e => e.id !== id);
      await this.saveEntriesIndex();
    },
    
    // 复制到剪贴板
    async copyToClipboard(text, label) {
      try {
        await navigator.clipboard.writeText(text);
        this.showToast(`${label}已复制`);
      } catch (e) {
        this.error = '复制失败';
      }
    },
    
    copyUsername(entry) {
      this.copyToClipboard(entry.username, '账户');
    },
    
    copyPassword(entry) {
      this.copyToClipboard(entry.password, '密码');
    },
    
    // 生成密码
    generateNewPassword() {
      this.formData.password = generatePassword(16, {
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true
      });
      this.showPassword = true;
    },
    
    // 获取平台图标
    getPlatformIcon(title) {
      const icons = {
        'github': '🐙',
        'gmail': '📧',
        'twitter': '𝕏',
        'facebook': '👍',
        'instagram': '📷',
        'bilibili': '📺',
        'youtube': '▶️',
        'google': '🔍',
        'baidu': '🦆'
      };
      const lower = title.toLowerCase();
      for (const [key, icon] of Object.entries(icons)) {
        if (lower.includes(key)) return icon;
      }
      return '🔑';
    },
    
    // Toast 提示
    showToast(message) {
      // 简单的实现，实际可以用更优雅的方式
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = message;
      toast.style.cssText = `
        position: fixed;
        bottom: 60px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--primary);
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        z-index: 1000;
      `;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    },
    
    // 打开设置页
    openOptions() {
      chrome.runtime.openOptionsPage();
    }
  }
});

app.mount('#app');

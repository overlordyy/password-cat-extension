/**
 * PasswordCat Chrome Extension - Popup App
 */

document.addEventListener('DOMContentLoaded', function() {
  // Wait for Vue to be available
  if (typeof Vue === 'undefined') {
    document.body.innerHTML = '<div style="padding:20px;text-align:center;">Loading...</div>';
    return;
  }

  const { encrypt, decrypt, generatePassword, generateSalt } = window.PasswordCatCrypto;
  const { loadData, saveData } = window.PasswordCatStorage;

  const VAULT_KEY = 'passwordcat_master_key';
  const SALT_KEY = 'passwordcat_salt';

  Vue.createApp({
    data() {
      return {
        // State
        isUnlocked: false,
        hasVault: false,
        error: '',
        
        // Form
        masterPassword: '',
        newMasterPassword: '',
        confirmPassword: '',
        
        // Data
        entries: [],
        searchQuery: '',
        showAddForm: false,
        isEditing: false,
        showPasswordField: false,
        
        // Form Data
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
          (entry.url && entry.url.toLowerCase().includes(query))
        );
      }
    },
    
    async mounted() {
      await this.checkVault();
    },
    
    methods: {
      // Check if vault exists
      async checkVault() {
        this.hasVault = await this.hasStoredVault();
        this.isUnlocked = false;
      },
      
      async hasStoredVault() {
        return new Promise((resolve) => {
          chrome.storage.local.get([VAULT_KEY, SALT_KEY], result => {
            resolve(!!result[VAULT_KEY] && !!result[SALT_KEY]);
          });
        });
      },
      
      // Create vault
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
          const salt = generateSalt();
          const saltArray = Array.from(salt);
          const encrypted = await encrypt({}, this.newMasterPassword, salt);
          
          await chrome.storage.local.set({
            [VAULT_KEY]: encrypted,
            [SALT_KEY]: saltArray.join(',')
          });
          
          this.hasVault = true;
          this.isUnlocked = true;
          this.masterPassword = this.newMasterPassword;
          this.entries = [];
        } catch (e) {
          this.error = '创建失败';
        }
      },
      
      // Unlock vault
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
          
          const saltArray = result[SALT_KEY].split(',').map(Number);
          const salt = new Uint8Array(saltArray);
          
          await decrypt(result[VAULT_KEY], this.masterPassword);
          
          this.isUnlocked = true;
          await this.loadEntries();
        } catch (e) {
          this.error = '密码错误';
        }
      },
      
      // Load entries
      async loadEntries() {
        const result = await chrome.storage.local.get(['passwordcat_entries_index', VAULT_KEY, SALT_KEY]);
        if (result.passwordcat_entries_index) {
          try {
            const saltArray = result[SALT_KEY].split(',').map(Number);
            const salt = new Uint8Array(saltArray);
            const decrypted = await decrypt(result.passwordcat_entries_index, this.masterPassword);
            this.entries = decrypted || [];
          } catch (e) {
            this.entries = [];
          }
        } else {
          this.entries = [];
        }
      },
      
      // Save entries index
      async saveEntriesIndex() {
        const result = await chrome.storage.local.get([SALT_KEY]);
        const saltArray = result[SALT_KEY].split(',').map(Number);
        const salt = new Uint8Array(saltArray);
        const encrypted = await encrypt(this.entries, this.masterPassword, salt);
        await chrome.storage.local.set({ passwordcat_entries_index: encrypted });
      },
      
      // Lock
      lock() {
        this.isUnlocked = false;
        this.masterPassword = '';
        this.entries = [];
      },
      
      // Open add form
      openAddForm() {
        this.isEditing = false;
        this.formData = {
          title: '',
          url: '',
          username: '',
          password: ''
        };
        this.showPasswordField = false;
        this.showAddForm = true;
        this.error = '';
      },
      
      // Open edit form
      openEditForm(entry) {
        this.isEditing = true;
        this.formData = { ...entry };
        this.showPasswordField = false;
        this.showAddForm = true;
        this.error = '';
      },
      
      // Close form
      closeForm() {
        this.showAddForm = false;
        this.isEditing = false;
        this.formData = {
          title: '',
          url: '',
          username: '',
          password: ''
        };
        this.showPasswordField = false;
        this.error = '';
      },
      
      // Save entry
      async saveEntry() {
        if (!this.formData.title || !this.formData.username || !this.formData.password) {
          this.error = '请填写必填项';
          return;
        }
        
        try {
          if (this.isEditing) {
            const index = this.entries.findIndex(e => e.id === this.formData.id);
            if (index !== -1) {
              this.entries[index] = {
                ...this.entries[index],
                ...this.formData,
                updatedAt: Date.now()
              };
            }
          } else {
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
          this.error = '保存失败';
        }
      },
      
      // Copy to clipboard
      async copyToClipboard(text, label) {
        try {
          await navigator.clipboard.writeText(text);
          this.showToast(label + '已复制');
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
      
      // Generate password
      generateNewPassword() {
        this.formData.password = generatePassword(16, {
          uppercase: true,
          lowercase: true,
          numbers: true,
          symbols: true
        });
        this.showPasswordField = true;
      },
      
      // Get platform icon
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
      },
      
      // Toast notification
      showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
      },
      
      // Open options page
      openOptions() {
        chrome.runtime.openOptionsPage();
      }
    }
  }).mount('#app');
});

// ══════════════════════════════════════════
// H.A.M.D — Core Application Engine
// Auth, Navigation, State, Utils
// ══════════════════════════════════════════

// ── APP STATE ──
const App = {
  state: {
    tenant: null,
    user: null,
    currentPage: 'dashboard',
    isOnline: navigator.onLine,
    sidebarCollapsed: false,
    pendingSync: 0,
    notifications: [],
    theme: localStorage.getItem('hamd_theme') || 'dark',
    lang: localStorage.getItem('hamd_lang') || 'ar'
  },

  // ── INIT ──
  async init() {
    this.applyTheme(this.state.theme);
    this.applyLanguage(this.state.lang);
    await window.db.init();
    this.setupOnlineDetection();
    this.setupServiceWorker();
    if (typeof Barcode !== 'undefined' && Barcode.initGlobalListener) {
      Barcode.initGlobalListener();
    }
    const session = this.getSession();
    if (session) {
      await this.restoreSession(session);
    } else {
      this.showAuthScreen();
    }
  },

  getSession() {
    try {
      const s = localStorage.getItem('hamd_session');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  },

  saveSession(tenant, user) {
    localStorage.setItem('hamd_session', JSON.stringify({ tenantId: tenant.id, userId: user.id }));
  },

  clearSession() {
    localStorage.removeItem('hamd_session');
  },

  async restoreSession(session) {
    const tenant = await window.db.get('tenants', session.tenantId);
    const user = await window.db.get('users', session.userId);
    if (tenant && user) {
      this.state.tenant = tenant;
      this.state.user = user;
      this.startApp();
    } else {
      this.showAuthScreen();
    }
  },

  // ── THEME & LANGUAGE ──
  applyTheme(theme) {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    const icon = document.getElementById('theme-icon');
    if (icon) {
      icon.className = theme === 'light' ? 'fa fa-moon' : 'fa fa-sun';
    }
  },

  toggleTheme() {
    this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('hamd_theme', this.state.theme);
    this.applyTheme(this.state.theme);
    if (typeof Pages !== 'undefined' && Pages._renderDashboard) {
      // Re-render dashboard to update chart colors if needed
      if (this.state.currentPage === 'dashboard') this.navigate('dashboard');
    }
  },

  applyLanguage(lang) {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    const icon = document.getElementById('lang-icon');
    if (icon) {
      icon.innerText = lang === 'ar' ? 'EN' : 'عربي';
    }
    // Translation will be applied if i18n is available
    if (window.i18n) window.i18n.translateDOM();
  },

  toggleLanguage() {
    this.state.lang = this.state.lang === 'ar' ? 'en' : 'ar';
    localStorage.setItem('hamd_lang', this.state.lang);
    this.applyLanguage(this.state.lang);
    this.renderLayout();
    this.navigate(this.state.currentPage);
  },

  // ── ONLINE/OFFLINE ──
  setupOnlineDetection() {
    const updateStatus = (online) => {
      this.state.isOnline = online;
      const banner = document.getElementById('offline-banner');
      if (banner) banner.classList.toggle('show', !online);
      const topbarStatus = document.getElementById('connection-status');
      if (topbarStatus) {
        topbarStatus.innerHTML = online
          ? '<i class="fa fa-wifi text-success"></i>'
          : '<i class="fa fa-wifi-slash text-danger"></i>';
        topbarStatus.title = online ? 'متصل بالإنترنت' : 'غير متصل - وضع أوفلاين';
      }
      if (online) this.syncOfflineQueue();
    };
    window.addEventListener('online', () => { updateStatus(true); Toast.show('تم استعادة الاتصال بالإنترنت', 'success'); });
    window.addEventListener('offline', () => { updateStatus(false); Toast.show('أنت الآن في وضع أوفلاين', 'warning'); });
    updateStatus(navigator.onLine);
  },

  async syncOfflineQueue() {
    if (!this.state.tenant) return;
    const queue = await window.db.getPendingQueue(this.state.tenant.id);
    if (queue.length > 0) {
      Toast.show(`جاري مزامنة ${queue.length} عملية معلقة...`, 'info');
    }
  },

  // ── SERVICE WORKER (only on https/localhost) ──
  setupServiceWorker() {
    const isSecure = location.protocol === 'https:' ||
                     location.hostname === 'localhost' ||
                     location.hostname === '127.0.0.1';
    if ('serviceWorker' in navigator && isSecure) {
      navigator.serviceWorker.register('./sw.js').then(reg => {
        console.log('SW registered:', reg.scope);
      }).catch(err => console.warn('SW registration failed:', err));
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_START') {
          Toast.show('جاري مزامنة البيانات...', 'info');
        }
      });
    } else {
      console.log('IndexedDB offline storage active (SW requires https)');
    }
  },

  // ── BARCODE SCANNER ──
  Scanner: {
    html5QrcodeScanner: null,
    open(onScanSuccess) {
      const t = window.t || (k => k);
      Modal.open('scanner-modal', 'مسح الباركود / QR', `
        <div id="reader" style="width: 100%; max-width: 500px; margin: 0 auto; border-radius: var(--radius-lg); overflow: hidden;"></div>
        <div class="modal-footer" style="padding:0;margin-top:16px;justify-content:center">
          <button class="btn btn-secondary" onclick="App.Scanner.close()">${t('cancel')||'إلغاء'}</button>
        </div>
      `, 'modal-md');

      setTimeout(() => {
        try {
          this.html5QrcodeScanner = new Html5QrcodeScanner(
            "reader",
            { fps: 10, qrbox: {width: 250, height: 250} },
            false
          );
          this.html5QrcodeScanner.render((decodedText) => {
            this.close();
            onScanSuccess(decodedText);
          }, () => {});
        } catch (e) {
          console.error("Scanner error:", e);
          Toast.show("تعذر تشغيل الكاميرا", "error");
        }
      }, 300);
    },
    close() {
      if (this.html5QrcodeScanner) {
        try { this.html5QrcodeScanner.clear(); } catch (e) {}
        this.html5QrcodeScanner = null;
      }
      Modal.close('scanner-modal');
    }
  },

  // ── AUTH SCREEN ──
  showAuthScreen() {
    document.getElementById('app').style.display = 'none';
    const auth = document.getElementById('auth-screen');
    auth.style.display = 'flex';
    this.renderAuthScreen();
  },

  renderAuthScreen() {
    const auth = document.getElementById('auth-screen');
    auth.innerHTML = `
      <div class="auth-bg"></div>
      <div class="auth-card fade-in">
        <div class="auth-logo">
          <div class="auth-logo-icon">H.A</div>
          <h1>H.A.M.D</h1>
          <p>نظام إدارة المخازن الاحترافي</p>
        </div>
        <div id="auth-content">
          ${this.renderLoginForm()}
        </div>
      </div>
    `;
  },

  renderLoginForm() {
    return `
      <form id="login-form" onsubmit="App.handleLogin(event)">
        <div class="form-group">
          <label class="form-label required">اسم المستخدم</label>
          <input type="text" class="form-control" id="login-username" placeholder="أدخل اسم المستخدم" value="admin" autocomplete="username" required>
        </div>
        <div class="form-group">
          <label class="form-label required">كلمة المرور</label>
          <div style="position:relative">
            <input type="password" class="form-control" id="login-password" placeholder="أدخل كلمة المرور" value="admin123" autocomplete="current-password" required>
            <button type="button" onclick="this.previousElementSibling.type=this.previousElementSibling.type==='password'?'text':'password';this.innerHTML=this.previousElementSibling.type==='password'?'<i class=fa fa-eye></i>':'<i class=fa fa-eye-slash></i>'" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer"><i class="fa fa-eye"></i></button>
          </div>
        </div>
        <div id="login-error" class="alert alert-danger" style="display:none"></div>
        <button type="submit" class="btn btn-primary btn-block btn-lg" id="login-btn">
          <i class="fa fa-sign-in-alt"></i> تسجيل الدخول
        </button>
        <p style="text-align:center;margin-top:16px;font-size:12px;color:var(--text-muted)">
          demo: admin / admin123
        </p>
      </form>
    `;
  },

  async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> جاري التحقق...';

    await new Promise(r => setTimeout(r, 600)); // UX delay

    const allUsers = await window.db.getAll('users');
    const user = allUsers.find(u => u.username === username && u.password === password && u.active);

    if (!user) {
      errEl.style.display = 'flex';
      errEl.innerHTML = '<i class="fa fa-exclamation-circle"></i> اسم المستخدم أو كلمة المرور غير صحيحة';
      btn.disabled = false;
      btn.innerHTML = '<i class="fa fa-sign-in-alt"></i> تسجيل الدخول';
      return;
    }

    const allTenants = await window.db.getAll('tenants');
    const userTenants = allTenants.filter(t => {
      return window.db.getAll('users').then ? true : true; // We check by tenantId
    });
    const tenant = await window.db.get('tenants', user.tenantId);

    this.state.tenant = tenant;
    this.state.user = user;
    this.saveSession(tenant, user);

    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    this.startApp();
  },

  logout() {
    Modal.confirm('تسجيل الخروج', 'هل أنت متأكد من تسجيل الخروج؟', () => {
      this.state.tenant = null;
      this.state.user = null;
      this.clearSession();
      document.getElementById('app').style.display = 'none';
      document.getElementById('auth-screen').style.display = 'flex';
    });
  },

  // ── APP START ──
  startApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    this.renderLayout();
    this.navigate('dashboard');
    this.setupSidebar();
  },

  // ── LAYOUT ──
  renderLayout() {
    const { tenant, user } = this.state;
    const roleLabel = { admin: 'مدير النظام', cashier: 'كاشير', storekeeper: 'أمين مخزن', accountant: 'محاسب', sales: 'مندوب مبيعات' };
    const nav = this.getNavItems();

    document.getElementById('app').innerHTML = `
      <!-- OFFLINE BANNER -->
      <div id="offline-banner">
        <i class="fa fa-wifi-slash"></i> أنت في وضع أوفلاين — ستتم المزامنة تلقائياً عند استعادة الاتصال
      </div>

      <!-- SIDEBAR -->
      <nav id="sidebar">
        <div class="sidebar-logo">
          <div class="logo-icon">H.A</div>
          <div class="logo-text">
            <h1>H.A.M.D</h1>
            <span>نظام إدارة المخازن</span>
          </div>
        </div>

        <div class="sidebar-tenant" onclick="App.showTenantModal()">
          <div class="tenant-avatar" style="background:linear-gradient(135deg,${tenant.color || '#6366f1'},#0ea5e9)">${tenant.logo || tenant.name[0]}</div>
          <div class="tenant-info">
            <div class="tenant-name">${tenant.name}</div>
            <div class="tenant-plan">${tenant.plan === 'pro' ? '⭐ Pro' : 'Basic'}</div>
          </div>
          <i class="fa fa-chevron-down tenant-chevron" style="font-size:11px;color:var(--text-muted)"></i>
        </div>

        <div class="sidebar-nav">
          ${nav.map(section => `
            <div class="nav-section">
              ${section.title ? `<div class="nav-section-title">${section.title}</div>` : ''}
              ${section.items.map(item => `
                <div class="nav-item ${item.id === this.state.currentPage ? 'active' : ''}"
                     id="nav-${item.id}"
                     onclick="App.navigate('${item.id}')"
                     title="${item.label}">
                  <i class="${item.icon}"></i>
                  <span class="nav-label">${item.label}</span>
                  ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>

        <div class="sidebar-bottom">
          <div class="sidebar-user" onclick="Pages.settings()">
            <div class="user-avatar">${user.name[0]}</div>
            <div class="user-info">
              <div class="user-name">${user.name}</div>
              <div class="user-role">${roleLabel[user.role] || user.role}</div>
            </div>
          </div>
          <button onclick="App.logout()" class="btn btn-ghost btn-sm" style="width:100%;justify-content:flex-start;gap:10px">
            <i class="fa fa-sign-out-alt"></i>
            <span class="nav-label">تسجيل الخروج</span>
          </button>
        </div>
      </nav>

      <!-- MAIN -->
      <div id="main">
        <!-- TOPBAR -->
        <header id="topbar">
          <div class="topbar-left">
            <button class="btn-icon" id="sidebar-toggle" onclick="App.toggleSidebar()">
              <i class="fa fa-bars"></i>
            </button>
            <div>
              <div class="topbar-title" id="topbar-title">لوحة التحكم</div>
              <div class="topbar-breadcrumb" id="topbar-breadcrumb">H.A.M.D / لوحة التحكم</div>
            </div>
          </div>
          <div class="topbar-search">
            <input type="text" placeholder="بحث سريع..." id="global-search" oninput="App.globalSearch(this.value)">
            <i class="fa fa-search"></i>
          </div>
          <div class="topbar-right">
            <button class="btn-icon" onclick="App.toggleTheme()" title="تغيير المظهر">
              <i class="fa ${this.state.theme === 'light' ? 'fa-moon' : 'fa-sun'}" id="theme-icon"></i>
            </button>
            <button class="btn-icon" onclick="App.toggleLanguage()" title="تغيير اللغة" style="font-size:13px;font-weight:bold;font-family:sans-serif" id="lang-icon">
              ${this.state.lang === 'ar' ? 'EN' : 'عربي'}
            </button>
            <button class="btn-icon" id="connection-status" title="حالة الاتصال">
              <i class="fa fa-wifi ${navigator.onLine ? 'text-success' : 'text-danger'}"></i>
            </button>
            <div class="notif-btn">
              <button class="btn-icon" onclick="App.showNotifications()" title="الإشعارات">
                <i class="fa fa-bell"></i>
              </button>
              <span class="notif-dot" id="notif-dot"></span>
            </div>
            <button class="btn-icon" onclick="Pages.pos()" title="نقطة البيع">
              <i class="fa fa-cash-register"></i>
            </button>
          </div>
        </header>

        <!-- PAGE CONTENT -->
        <main id="page-content"></main>
      </div>

      <!-- MODALS CONTAINER -->
      <div id="modals"></div>

      <!-- TOAST CONTAINER -->
      <div id="toast-container"></div>

      <!-- MOBILE SIDEBAR OVERLAY -->
      <div id="sidebar-overlay" onclick="App.closeMobileSidebar()" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99;backdrop-filter:blur(4px)"></div>
    `;

    // Update offline banner if needed
    if (!this.state.isOnline) {
      document.getElementById('offline-banner').classList.add('show');
    }
  },

  getNavItems() {
    const t = window.t || (k => k);
    const role = this.state.user?.role || 'admin';
    const isCashier = role === 'cashier';
    
    let nav = [
      {
        title: null,
        items: [
          { id: 'dashboard', icon: 'fa fa-th-large', label: t('dashboard') },
          { id: 'pos', icon: 'fa fa-cash-register', label: t('pos') },
        ]
      },
      {
        title: t('inventory'),
        items: [
          { id: 'products', icon: 'fa fa-box', label: t('products') },
          { id: 'categories', icon: 'fa fa-tags', label: t('categories') },
          { id: 'warehouses', icon: 'fa fa-warehouse', label: t('warehouses') },
          { id: 'stock-moves', icon: 'fa fa-exchange-alt', label: t('inventory') },
        ]
      },
      {
        title: t('sales'),
        items: [
          { id: 'invoices', icon: 'fa fa-file-invoice', label: t('invoices') },
          { id: 'customers', icon: 'fa fa-users', label: t('customers') },
        ]
      },
      {
        title: t('purchases'),
        items: [
          { id: 'purchases', icon: 'fa fa-shopping-cart', label: t('purchases') },
          { id: 'suppliers', icon: 'fa fa-truck', label: t('suppliers') },
        ]
      },
      {
        title: t('accounting'),
        items: [
          { id: 'expenses', icon: 'fa fa-receipt', label: t('expenses') },
          { id: 'reports', icon: 'fa fa-chart-bar', label: t('reports') },
        ]
      },
      {
        title: t('settings'),
        items: [
          { id: 'users', icon: 'fa fa-user-cog', label: t('contacts') },
          { id: 'settings', icon: 'fa fa-cog', label: t('settings') },
        ]
      },
    ];

    if (isCashier) {
      // Cashier can only see POS, Invoices, Customers
      nav = [
        {
          title: null,
          items: [
            { id: 'pos', icon: 'fa fa-cash-register', label: t('pos') },
          ]
        },
        {
          title: t('sales'),
          items: [
            { id: 'invoices', icon: 'fa fa-file-invoice', label: t('invoices') },
            { id: 'customers', icon: 'fa fa-users', label: t('customers') },
          ]
        }
      ];
    }
    
    return nav;
  },

  navigate(page) {
    this.state.currentPage = page;
    const t = window.t || (k => k);
    // Update active nav
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navEl = document.getElementById(`nav-${page}`);
    if (navEl) navEl.classList.add('active');
    
    // Update topbar
    const titles = {
      dashboard: t('dashboard'), pos: t('pos'), products: t('products'),
      categories: t('categories'), warehouses: t('warehouses'), 'stock-moves': t('inventory'),
      sales: t('sales'), invoices: t('invoices'), customers: t('customers'),
      purchases: t('purchases'), suppliers: t('suppliers'),
      expenses: t('expenses'), reports: t('reports'), users: t('contacts'), settings: t('settings'),
    };
    const title = titles[page] || page;
    const topbarTitle = document.getElementById('topbar-title');
    const topbarBreadcrumb = document.getElementById('topbar-breadcrumb');
    if (topbarTitle) topbarTitle.textContent = title;
    if (topbarBreadcrumb) topbarBreadcrumb.textContent = `H.A.M.D / ${title}`;
    document.title = `${title} — H.A.M.D`;
    // Render page with error handling
    const pc = document.getElementById('page-content');
    if (!pc) { console.error('page-content element not found'); return; }
    const fnName = page.replace(/-([a-z])/g, (_, l) => l.toUpperCase());
    const fn = Pages[fnName];
    if (fn) {
      try {
        const result = fn.call(Pages);
        // Handle async errors
        if (result && typeof result.then === 'function') {
          result.catch(err => {
            console.error(`Page [${page}] async error:`, err);
            if (pc) pc.innerHTML = `
              <div style="padding:40px 20px;text-align:center">
                <i class="fa fa-exclamation-triangle" style="font-size:40px;color:var(--danger);margin-bottom:16px"></i>
                <h3 style="color:var(--text-primary);margin-bottom:8px">حدث خطأ في تحميل الصفحة</h3>
                <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px">${err.message || 'Unknown error'}</p>
                <button class="btn btn-primary" onclick="App.navigate('${page}')">إعادة المحاولة</button>
              </div>
            `;
          });
        }
      } catch (err) {
        console.error(`Page [${page}] sync error:`, err);
        pc.innerHTML = `
          <div style="padding:40px 20px;text-align:center">
            <i class="fa fa-exclamation-triangle" style="font-size:40px;color:var(--danger);margin-bottom:16px"></i>
            <h3 style="color:var(--text-primary);margin-bottom:8px">حدث خطأ في تحميل الصفحة</h3>
            <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px">${err.message || 'Unknown error'}</p>
            <button class="btn btn-primary" onclick="App.navigate('${page}')">إعادة المحاولة</button>
          </div>
        `;
      }
    } else {
      pc.innerHTML = `<div class="empty-state"><i class="fa fa-tools"></i><h3>${title}</h3><p>هذه الصفحة قيد التطوير</p></div>`;
    }
    // Mobile: close sidebar
    this.closeMobileSidebar();
  },

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('main');
    if (window.innerWidth <= 768) {
      // Mobile: show overlay
      sidebar.classList.add('mobile-open');
      document.getElementById('sidebar-overlay').style.display = 'block';
    } else {
      // Desktop: collapse
      this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
      sidebar.classList.toggle('collapsed', this.state.sidebarCollapsed);
      main.classList.toggle('expanded', this.state.sidebarCollapsed);
    }
  },

  closeMobileSidebar() {
    document.getElementById('sidebar')?.classList.remove('mobile-open');
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) overlay.style.display = 'none';
  },

  setupSidebar() {
    const preferred = localStorage.getItem('hamd_sidebar_collapsed') === 'true';
    if (preferred && window.innerWidth > 768) {
      this.state.sidebarCollapsed = true;
      document.getElementById('sidebar')?.classList.add('collapsed');
      document.getElementById('main')?.classList.add('expanded');
    }
  },

  showTenantModal() {
    Modal.open('tenantSwitch', 'تبديل الحساب', async () => {
      const tenants = await window.db.getAll('tenants');
      return `
        <div class="tenant-list">
          ${tenants.map(t => `
            <div class="tenant-card ${t.id === App.state.tenant.id ? 'selected' : ''}" onclick="App.switchTenant('${t.id}')">
              <div class="tenant-logo" style="background:linear-gradient(135deg,${t.color || '#6366f1'},#0ea5e9)">${t.logo || t.name[0]}</div>
              <div>
                <div style="font-weight:700;font-size:14px">${t.name}</div>
                <div style="font-size:12px;color:var(--text-secondary)">${t.plan === 'pro' ? '⭐ Pro' : 'Basic'} — ${t.currency || 'EGP'}</div>
              </div>
              ${t.id === App.state.tenant.id ? '<i class="fa fa-check text-success ms-auto"></i>' : ''}
            </div>
          `).join('')}
        </div>
      `;
    });
  },

  async switchTenant(tenantId) {
    const tenant = await window.db.get('tenants', tenantId);
    if (!tenant) return;
    // Find admin user for that tenant
    const users = await window.db.getByIndex('users', 'tenantId', tenantId);
    const adminUser = users.find(u => u.role === 'admin') || users[0];
    if (!adminUser) { Toast.show('لا يوجد مستخدمين في هذا الحساب', 'error'); return; }
    this.state.tenant = tenant;
    this.state.user = adminUser;
    this.saveSession(tenant, adminUser);
    Modal.closeAll();
    Toast.show(`تم التبديل إلى ${tenant.name}`, 'success');
    this.renderLayout();
    this.navigate('dashboard');
  },

  showNotifications() {
    Toast.show('لا توجد إشعارات جديدة', 'info');
    document.getElementById('notif-dot').style.display = 'none';
  },

  globalSearch(q) {
    if (!q || q.length < 2) return;
    // TODO: implement global search modal
  },
};

// ── TOAST ──
const Toast = {
  show(msg, type = 'success', duration = 3500) {
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="fa ${icons[type] || icons.info}"></i><span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }
};

// ── MODAL ──
const Modal = {
  open(id, title, contentFn, size = '') {
    const existing = document.getElementById(`modal-overlay-${id}`);
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.className = `modal-overlay ${size}`;
    overlay.id = `modal-overlay-${id}`;
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">${title}</h2>
          <button class="modal-close" onclick="Modal.close('${id}')"><i class="fa fa-times"></i></button>
        </div>
        <div class="modal-body" id="modal-body-${id}">
          <div class="text-center"><i class="fa fa-spinner fa-spin" style="font-size:24px;color:var(--primary)"></i></div>
        </div>
      </div>
    `;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) Modal.close(id); });
    document.getElementById('modals').appendChild(overlay);
    setTimeout(() => overlay.classList.add('active'), 10);
    if (typeof contentFn === 'function') {
      Promise.resolve(contentFn()).then(html => {
        const body = document.getElementById(`modal-body-${id}`);
        if (body) body.innerHTML = html;
      });
    } else if (contentFn) {
      document.getElementById(`modal-body-${id}`).innerHTML = contentFn;
    }
    return overlay;
  },

  close(id) {
    const overlay = document.getElementById(`modal-overlay-${id}`);
    if (!overlay) return;
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);
  },

  closeAll() {
    document.querySelectorAll('.modal-overlay').forEach(el => {
      el.classList.remove('active');
      setTimeout(() => el.remove(), 300);
    });
  },

  confirm(title, msg, onYes, onNo) {
    const id = 'confirm';
    Modal.open(id, title, `
      <p style="font-size:14px;color:var(--text-secondary);margin-bottom:24px">${msg}</p>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn-secondary" onclick="Modal.close('${id}');${onNo ? 'Modal._confirmNo()' : ''}">إلغاء</button>
        <button class="btn btn-danger" onclick="Modal.close('${id}');Modal._confirmYes()">تأكيد</button>
      </div>
    `, 'modal-sm');
    Modal._confirmYes = onYes || (() => {});
    Modal._confirmNo = onNo || (() => {});
  },
};

// ── FORMATTING HELPERS ──
const Fmt = {
  currency(n, currency = 'EGP') {
    const t = App.state.tenant;
    const cur = t?.currency || currency;
    return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: cur }).format(n || 0);
  },
  number(n) { return new Intl.NumberFormat('ar-EG').format(n || 0); },
  date(d) { return d ? new Date(d).toLocaleDateString('ar-EG') : '—'; },
  dateTime(d) { return d ? new Date(d).toLocaleString('ar-EG') : '—'; },
  percent(n) { return `${(n || 0).toFixed(1)}%`; },
};

// ── BARCODE UTILS ──
const Barcode = {
  _scannerBuffer: '',
  _scannerTimer: null,
  _listeners: [],

  initGlobalListener() {
    document.addEventListener('keypress', (e) => {
      // Ignore if typing in an input field (except if we explicitly want to intercept, but usually we don't intercept normal typing)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        // If it's a manual barcode input, we let it handle itself
        if (e.target.id === 'manual-barcode') return; 
      }

      if (e.key === 'Enter') {
        if (this._scannerBuffer.length > 2) {
          const code = this._scannerBuffer;
          this._listeners.forEach(cb => cb(code));
        }
        this._scannerBuffer = '';
        clearTimeout(this._scannerTimer);
      } else {
        this._scannerBuffer += e.key;
        clearTimeout(this._scannerTimer);
        // Clear buffer if typing is too slow (human typing vs scanner)
        this._scannerTimer = setTimeout(() => {
          this._scannerBuffer = '';
        }, 50); 
      }
    });
  },

  onScan(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(cb => cb !== callback);
    };
  },

  generate(code, canvas, options = {}) {
    // Basic barcode renderer (Fallback)
    if (!canvas || !code) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width; const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#000';
    const bars = this._encode(String(code));
    const barW = w / bars.length;
    bars.forEach((b, i) => {
      if (b) ctx.fillRect(i * barW, 0, barW, h - 20);
    });
    ctx.fillStyle = '#000';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(code, w / 2, h - 6);
  },

  _encode(code) {
    const result = [];
    for (const char of code) {
      const bits = char.charCodeAt(0).toString(2).padStart(7, '0');
      for (const bit of bits) result.push(bit === '1');
      result.push(false);
    }
    return result;
  },

  generateQR(text, elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerHTML = '';
    new QRCode(el, {
      text: text,
      width: 128,
      height: 128,
      colorDark : "#000000",
      colorLight : "#ffffff",
      correctLevel : QRCode.CorrectLevel.M
    });
  },

  async scanFromCamera(containerId, onResult) {
    try {
      if (!window.Html5Qrcode) {
        Toast.show('مكتبة الباركود غير محملة', 'error');
        return null;
      }
      const html5QrCode = new Html5Qrcode(containerId);
      const config = { fps: 10, qrbox: { width: 250, height: 150 } };
      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          html5QrCode.stop().then(() => {
             onResult(decodedText);
          }).catch(() => {});
        },
        (errorMessage) => {
          // ignore stream errors
        }
      );
      return () => {
        if (html5QrCode.isScanning) {
          html5QrCode.stop().catch(() => {});
        }
      };
    } catch (err) {
      Toast.show('لا يمكن الوصول للكاميرا', 'error');
      return null;
    }
  }
};

// ── PRINT ──
const Print = {
  _getZatcaQr(seller, vatNo, timestamp, total, tax) {
    // TLV Base64 encoding for ZATCA (Saudi e-invoice standard) or generic standard
    const toHex = (str) => {
      let hex = '';
      for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i).toString(16);
        hex += (code.length === 1 ? '0' : '') + code;
      }
      return hex;
    };
    const tlv = (tag, val) => {
      const v = String(val);
      const tagHex = tag.toString(16).padStart(2, '0');
      const lenHex = new TextEncoder().encode(v).length.toString(16).padStart(2, '0');
      return tagHex + lenHex + Array.from(new TextEncoder().encode(v)).map(b => b.toString(16).padStart(2,'0')).join('');
    };
    try {
      const hex = tlv(1, seller || 'Seller') +
                  tlv(2, vatNo || '123456789012345') +
                  tlv(3, timestamp || new Date().toISOString()) +
                  tlv(4, total || '0') +
                  tlv(5, tax || '0');
      // Convert hex to base64
      let str = '';
      for (let i = 0; i < hex.length; i += 2) str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
      return btoa(str);
    } catch { return 'ZATCA-QR-ERROR'; }
  },

  async invoice(invoice, items, customer, tenant, format = 'thermal') {
    // format can be 'thermal' or 'a4'
    const zatcaStr = this._getZatcaQr(tenant?.name, tenant?.taxNumber||'111111111111111', new Date(invoice.date).toISOString(), invoice.total, invoice.tax);
    
    // Create temporary QR element to get Base64 image
    const qrDiv = document.createElement('div');
    new QRCode(qrDiv, { text: zatcaStr, width: 128, height: 128, correctLevel: QRCode.CorrectLevel.M });
    await new Promise(r => setTimeout(r, 100)); // wait for qrcode to render canvas
    const qrCanvas = qrDiv.querySelector('canvas');
    const qrData = qrCanvas ? qrCanvas.toDataURL() : '';

    const w = window.open('', '_blank', 'width=800,height=600');
    
    const style = format === 'thermal' ? `
      body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; color: #000; margin: 0; padding: 10px; width: 80mm; font-size: 12px; }
      .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
      .header h1 { font-size: 18px; margin: 0; }
      .header p { margin: 2px 0; font-size: 11px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
      th, td { border-bottom: 1px dashed #ccc; padding: 4px 0; text-align: right; }
      th { font-weight: bold; }
      .totals { border-top: 1px dashed #000; padding-top: 10px; font-size: 12px; }
      .total-row { display: flex; justify-content: space-between; padding: 2px 0; }
      .total-row.final { font-weight: bold; font-size: 14px; margin-top: 4px; border-top: 1px solid #000; padding-top: 4px; }
      .qr-container { text-align: center; margin-top: 15px; }
      .qr-container img { width: 100px; height: 100px; }
      .footer { text-align: center; margin-top: 15px; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px; }
      @media print { button { display: none; } @page { margin: 0; } body { padding: 5mm; } }
    ` : `
      body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; color: #111; padding: 40px; max-width: 800px; margin: 0 auto; }
      .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
      .header h1 { font-size: 28px; margin: 0; color: #6366f1; }
      .header p { margin: 4px 0; color: #555; }
      .invoice-title { font-size: 24px; font-weight: 800; margin-bottom: 20px; text-align: center; }
      .info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
      .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
      .info-box h3 { font-size: 14px; color: #64748b; margin: 0 0 12px; text-transform: uppercase; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: right; }
      th { background: #f1f5f9; font-weight: bold; }
      .totals { width: 300px; margin-right: auto; margin-left: 0; background: #f8fafc; padding: 16px; border-radius: 8px; }
      .total-row { display: flex; justify-content: space-between; padding: 6px 0; }
      .total-row.final { font-weight: 800; font-size: 18px; border-top: 2px solid #cbd5e1; padding-top: 12px; margin-top: 6px; color: #6366f1; }
      .qr-container { text-align: left; margin-top: 20px; }
      .qr-container img { width: 120px; height: 120px; }
      .footer { text-align: center; margin-top: 40px; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 20px; }
      @media print { button { display: none; } }
    `;

    w.document.write(`
      <!DOCTYPE html><html dir="rtl" lang="ar"><head>
      <meta charset="UTF-8">
      <title>فاتورة ${invoice.number || invoice.id}</title>
      <style>${style}</style>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
      </head><body>
      <div style="text-align:left"><button onclick="window.print()" style="margin-bottom:16px;padding:8px 20px;background:#6366f1;color:white;border:none;border-radius:8px;cursor:pointer;font-family:'Cairo',sans-serif;font-weight:bold">🖨️ طباعة الفاتورة</button></div>
      
      ${format === 'a4' ? `
        <div class="header">
          <div>
            <h1>${tenant?.name || 'H.A.M.D'}</h1>
            <p>${tenant?.address || ''}</p>
            <p>هاتف: ${tenant?.phone || ''} | الرقم الضريبي: ${tenant?.taxNumber || '---'}</p>
          </div>
          <div style="text-align:left">
            <h2 style="margin:0;color:#333">فاتورة ضريبية مبسطة</h2>
            <p>رقم الفاتورة: <strong>${invoice.number || invoice.id.slice(-6)}</strong></p>
            <p>التاريخ: ${Fmt.date(invoice.date)}</p>
          </div>
        </div>
      ` : `
        <div class="header">
          <h1>${tenant?.name || 'H.A.M.D'}</h1>
          <p>${tenant?.address || ''}</p>
          <p>ت: ${tenant?.phone || ''}</p>
          <p>رقم ضريبي: ${tenant?.taxNumber || '---'}</p>
          <h2 style="font-size:14px;margin:10px 0 5px;border-top:1px dashed #000;padding-top:10px">فاتورة مبيعات رقم: ${invoice.number || invoice.id.slice(-6)}</h2>
          <p>التاريخ: ${Fmt.date(invoice.date)}</p>
        </div>
      `}

      ${format === 'a4' ? `
      <div class="info">
        <div class="info-box">
          <h3>فاتورة إلى (العميل)</h3>
          <p style="font-size:16px;font-weight:bold;margin:0 0 5px">${customer?.name || 'عميل نقدي'}</p>
          <p style="margin:0 0 5px">هاتف: ${customer?.phone || '---'}</p>
          <p style="margin:0">عنوان: ${customer?.address || '---'}</p>
        </div>
        <div class="info-box">
          <h3>تفاصيل الدفع</h3>
          <p>طريقة الدفع: <strong>${invoice.paymentMethod === 'cash' ? 'نقدي' : invoice.paymentMethod === 'card' ? 'بطاقة ائتمان' : 'تحويل بنكي'}</strong></p>
          <p>حالة الفاتورة: <strong>${invoice.status === 'completed' ? 'مكتملة' : 'معلقة'}</strong></p>
        </div>
      </div>
      ` : `
      <div style="margin-bottom:10px;font-size:11px">
        عميل: <strong>${customer?.name || 'عميل نقدي'}</strong>
      </div>
      `}

      <table>
        <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th>${format==='a4'?'<th>الخصم</th>':''}<th>الإجمالي</th></tr></thead>
        <tbody>
          ${items.map((item) => `
            <tr>
              <td>${item.name || item.productId}</td>
              <td>${item.qty}</td>
              <td>${Fmt.currency(item.price)}</td>
              ${format==='a4'?`<td>${Fmt.currency(item.discount || 0)}</td>`:''}
              <td>${Fmt.currency(item.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals">
        <div class="total-row"><span>الإجمالي الفرعي:</span><span>${Fmt.currency(invoice.subtotal)}</span></div>
        <div class="total-row"><span>الخصم:</span><span>${Fmt.currency(invoice.discount || 0)}</span></div>
        <div class="total-row"><span>ضريبة القيمة المضافة (${tenant?.taxRate || 14}%):</span><span>${Fmt.currency(invoice.tax)}</span></div>
        <div class="total-row final"><span>الإجمالي الكلي:</span><span>${Fmt.currency(invoice.total)}</span></div>
        <div class="total-row" style="margin-top:10px;color:#555"><span>المدفوع:</span><span>${Fmt.currency(invoice.paid)}</span></div>
        <div class="total-row" style="color:${(invoice.remaining||0)>0?'#ef4444':'#10b981'}">
          <span>المتبقي:</span><span>${Fmt.currency(invoice.remaining || 0)}</span>
        </div>
      </div>

      <div class="qr-container">
        ${qrData ? `<img src="${qrData}" alt="QR Code">` : ''}
      </div>

      ${invoice.notes ? `<p style="margin-top:16px;font-size:12px;color:#555;padding:10px;background:#f9f9f9;border-right:3px solid #6366f1"><strong>ملاحظات:</strong> ${invoice.notes}</p>` : ''}
      
      <div class="footer">
        <p style="font-weight:bold;font-size:14px;color:#333;margin:0 0 5px">شكراً لتعاملكم معنا</p>
        <p style="margin:0">تم إصدار هذه الفاتورة آلياً بواسطة نظام H.A.M.D</p>
      </div>
      </body></html>
    `);
    w.document.close();
  }
};

// ── EXPORT ──
const Export = {
  toExcel(headers, rows, filename, tenant = {}) { 
    if (typeof XLSX === 'undefined') {
      Toast.show('مكتبة التصدير قيد التحميل، يرجى المحاولة بعد قليل', 'warning');
      return;
    }
    const wb = XLSX.utils.book_new();
    
    const wsData = [];
    wsData.push([tenant.name || 'H.A.M.D']);
    wsData.push([filename.replace(/_/g, ' ')]);
    wsData.push([]); 
    wsData.push(headers);
    rows.forEach(r => wsData.push(r));
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({c: C, r: R});
        if (!ws[cellRef]) continue;

        let style = { font: { name: 'Arial', sz: 11 }, alignment: { horizontal: 'center', vertical: 'center' } };

        if (R === 0) {
          style.font = { name: 'Arial', bold: true, sz: 16, color: { rgb: "4F46E5" } };
        } else if (R === 1) {
          style.font = { name: 'Arial', bold: true, sz: 14, color: { rgb: "333333" } };
        } else if (R === 3) {
          style.font = { name: 'Arial', bold: true, color: { rgb: "FFFFFF" } };
          style.fill = { fgColor: { rgb: "4F46E5" } };
          style.border = {
            top: { style: 'thin', color: { auto: 1 } },
            bottom: { style: 'thin', color: { auto: 1 } },
            left: { style: 'thin', color: { auto: 1 } },
            right: { style: 'thin', color: { auto: 1 } }
          };
        } else if (R > 3) {
          style.border = {
            top: { style: 'thin', color: { rgb: "DDDDDD" } },
            bottom: { style: 'thin', color: { rgb: "DDDDDD" } },
            left: { style: 'thin', color: { rgb: "DDDDDD" } },
            right: { style: 'thin', color: { rgb: "DDDDDD" } }
          };
          if (R % 2 !== 0) {
            style.fill = { fgColor: { rgb: "F8FAFC" } };
          }
        }
        
        ws[cellRef].s = style;
      }
    }
    
    if(!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: {r:0, c:0}, e: {r:0, c:Math.max(headers.length-1, 1)} });
    ws['!merges'].push({ s: {r:1, c:0}, e: {r:1, c:Math.max(headers.length-1, 1)} });

    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    
    if (!ws['!views']) ws['!views'] = [];
    ws['!views'].push({ rightToLeft: true });

    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, filename + '.xlsx');
  },
  
  toPDF(headers, rows, title, tenant = {}) {
    const w = window.open('', '_blank', 'width=1000,height=800');
    if (!w) { Toast.show('يرجى السماح بالنوافذ المنبثقة (Pop-ups)', 'warning'); return; }
    
    const formatCell = (val) => {
      if (typeof val === 'number') {
        if (val > 100 || !Number.isInteger(val)) return Fmt.currency(val);
        return val;
      }
      return val ?? '';
    };

    const companyName = tenant.name || 'H.A.M.D';
    const addressInfo = tenant.address ? `<div><i class="fa fa-map-marker-alt" style="width:16px"></i> ${tenant.address}</div>` : '';
    const contactInfo = `
      ${tenant.phone ? `<div><i class="fa fa-phone" style="width:16px"></i> ${tenant.phone}</div>` : ''}
      ${tenant.taxNumber ? `<div><i class="fa fa-file-invoice-dollar" style="width:16px"></i> الرقم الضريبي: ${tenant.taxNumber}</div>` : ''}
    `;

    let html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
        <style>
          :root { --primary: #4f46e5; --text: #1e293b; --border: #e2e8f0; --bg: #f8fafc; }
          body { font-family: 'Cairo', sans-serif; padding: 40px; color: var(--text); direction: rtl; margin: 0; background: #fff; }
          .report-wrapper { max-width: 100%; margin: 0 auto; position: relative; }
          .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 120px; font-weight: 800; color: rgba(79, 70, 229, 0.04); z-index: -1; white-space: nowrap; pointer-events: none; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid var(--primary); padding-bottom: 20px; margin-bottom: 30px; }
          .header-right h1 { margin: 0 0 10px 0; font-size: 32px; font-weight: 800; color: var(--primary); }
          .header-info { font-size: 14px; color: #64748b; display: flex; flex-direction: column; gap: 5px; }
          .header-left { text-align: left; }
          .report-title { background: var(--bg); padding: 15px 20px; border-radius: 8px; border-right: 4px solid var(--primary); margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
          .report-title h2 { margin: 0; font-size: 24px; font-weight: 700; color: #0f172a; }
          .print-date { font-size: 13px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
          th, td { border: 1px solid var(--border); padding: 12px 15px; text-align: right; }
          th { background-color: var(--primary); font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 0.5px; }
          tr:nth-child(even) { background-color: var(--bg); }
          tr:hover { background-color: #f1f5f9; }
          .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid var(--border); text-align: center; font-size: 12px; color: #94a3b8; }
          @media print {
            body { padding: 0; }
            .report-wrapper { padding: 20px; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="watermark">${companyName}</div>
        <div class="report-wrapper">
          <div class="header">
            <div class="header-right">
              <h1>${companyName}</h1>
              <div class="header-info">${addressInfo}${contactInfo}</div>
            </div>
            <div class="header-left">
              <div style="width:80px;height:80px;background:var(--bg);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#cbd5e1;border:1px dashed #cbd5e1;font-size:11px;">شعار الشركة</div>
            </div>
          </div>
          
          <div class="report-title">
            <h2>${title.replace(/_/g, ' ')}</h2>
            <div class="print-date">تاريخ الطباعة: <span dir="ltr">${new Date().toLocaleString('ar-EG')}</span></div>
          </div>

          <table>
            <thead>
              <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows.map(r => `<tr>${r.map(cell => `<td>${formatCell(cell)}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>

          <div class="footer">
            تم إنشاء هذا التقرير بواسطة نظام H.A.M.D المطور لإدارة المخازن ونقاط البيع.
          </div>
        </div>
        <script>
          window.onload = () => { setTimeout(() => { window.print(); }, 500); };
        </script>
      </body>
      </html>
    `;
    w.document.write(html);
    w.document.close();
  },
  toJSON(data, filename) {
    this._download(JSON.stringify(data, null, 2), filename + '.json', 'application/json');
  },
  _download(content, filename, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = filename;
    a.click();
  }
};

// ── NUMBER GENERATOR ──
const NumGen = {
  invoice(prefix = 'FA') { return `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`; },
  customer(n) { return `C${String(n + 1).padStart(4, '0')}`; },
  supplier(n) { return `S${String(n + 1).padStart(4, '0')}`; },
};

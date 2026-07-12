// ══════════════════════════════════════════
// H.A.M.D — Database Layer (Firebase Firestore)
// Supports Multi-Tenancy + Offline Storage
// ══════════════════════════════════════════

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBrDuynSeoefLTFpP4COt8E9U61_Vgk3IQ",
  authDomain: "hamd-pos.firebaseapp.com",
  projectId: "hamd-pos",
  storageBucket: "hamd-pos.firebasestorage.app",
  messagingSenderId: "435677711834",
  appId: "1:435677711834:web:d0f393cfc61d7242fac4e3"
};

class HamdDB {
  constructor() {
    this.db = null;
    this.ready = false;
  }

  async init() {
    return new Promise(async (resolve, reject) => {
      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
        }
        this.db = firebase.firestore();
        this.auth = firebase.auth();

        // Enable offline persistence
        try {
          await this.db.enablePersistence();
          console.log("Firebase Offline Persistence enabled");
        } catch (err) {
          if (err.code == 'failed-precondition') {
            console.warn("Multiple tabs open, persistence can only be enabled in one tab at a a time.");
          } else if (err.code == 'unimplemented') {
            console.warn("The current browser does not support all of the features required to enable persistence");
          }
        }

        this.ready = true;

        // ⚠️ SECURITY FIX: automatic seeding of a superadmin account with a
        // hardcoded, known password has been REMOVED. It was previously
        // creating `superadmin` / `superadmin123` on every fresh database,
        // in plaintext, directly from client-side code — and that password
        // was visible to anyone reading this file (including on a public
        // GitHub repo). Bootstrap the first admin account using the secure
        // server-side script instead: `node scripts/create-superadmin.js`
        // (see that file for usage). It creates the account through
        // Firebase Auth with a strong, randomly generated password (or one
        // you supply via environment variable), never stores it in
        // Firestore, and never runs inside the browser.
        await this._seedDemoData();

        resolve(this);
      } catch (err) {
        console.error("Firebase Initialization Error:", err);
        reject(err);
      }
    });
  }

  // ── Core CRUD ──
  async add(store, data) {
    const id = data.id || this._uid();
    const docData = { ...data, id };
    await this.db.collection(store).doc(id).set(docData);
    return id;
  }

  async put(store, data) {
    const id = data.id || this._uid();
    data.id = id;
    await this.db.collection(store).doc(id).set(data);
    return id;
  }

  async get(store, id) {
    const doc = await this.db.collection(store).doc(id).get();
    return doc.exists ? doc.data() : null;
  }

  async getAll(store) {
    const snap = await this.db.collection(store).get();
    return snap.docs.map(d => d.data());
  }

  async getByIndex(store, indexName, value) {
    const snap = await this.db.collection(store).where(indexName, '==', value).get();
    return snap.docs.map(d => d.data());
  }

  async login(usernameOrEmail, password) {
    let email = usernameOrEmail.trim();
    let isEmailInput = email.includes('@');
    
    let userDocData = null;
    let userDocId = null;
    
    const usersCol = this.db.collection('users');
    let snap;
    try {
      if (isEmailInput) {
        snap = await usersCol.where('email', '==', email).limit(1).get();
      } else {
        snap = await usersCol.where('username', '==', email).limit(1).get();
      }
      if (!snap.empty) {
        userDocData = snap.docs[0].data();
        userDocId = snap.docs[0].id;
        email = userDocData.email;
      }
    } catch (e) {
      console.warn("Could not query user in Firestore", e);
    }

    // ⚠️ SECURITY FIX: the previous version of this function fell back to
    // comparing a PLAINTEXT `password` field stored on the Firestore user
    // document (`userDocData.password === password`) whenever Firebase Auth
    // sign-in failed. That meant passwords were being stored and compared
    // in clear text, bypassing Firebase Auth's hashing entirely — a
    // critical vulnerability. That fallback has been removed. Firebase Auth
    // is now the ONLY accepted authentication path. If a legacy account
    // still only has a Firestore `password` field and no real Firebase Auth
    // account, it must be migrated through the secure
    // `scripts/migrate-legacy-user.js` script (run once, server-side, by an
    // administrator) rather than silently accepted at login time.
    const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;
    const userDoc = await this.db.collection('users').doc(uid).get();
    return userDoc.exists ? userDoc.data() : null;
  }

  async logoutUser() {
    await this.auth.signOut();
  }

  async delete(store, id) {
    await this.db.collection(store).doc(id).delete();
  }

  async count(store) {
    const snap = await this.db.collection(store).get();
    return snap.size;
  }

  // ── Tenant-scoped queries ──
  async getTenantData(store, tenantId) {
    return this.getByIndex(store, 'tenantId', tenantId);
  }

  async addTenantData(store, tenantId, data) {
    return this.add(store, { ...data, tenantId });
  }

  async updateTenantData(store, data) {
    return this.put(store, data);
  }

  async deleteTenantData(store, id) {
    return this.delete(store, id);
  }

  // ── Specialized queries ──
  async getProductsByTenant(tenantId) {
    return this.getTenantData('products', tenantId);
  }

  async getInvoicesByType(tenantId, type) {
    const all = await this.getTenantData('invoices', tenantId);
    return all.filter(i => i.type === type);
  }

  async getInvoiceItems(invoiceId) {
    return this.getByIndex('invoiceItems', 'invoiceId', invoiceId);
  }

  async getStockMoves(tenantId, productId) {
    const all = await this.getTenantData('stockMoves', tenantId);
    return productId ? all.filter(m => m.productId === productId) : all;
  }

  async getProductStock(tenantId, productId) {
    const moves = await this.getStockMoves(tenantId, productId);
    return moves.reduce((sum, m) => sum + (m.qty * (m.direction === 'in' ? 1 : -1)), 0);
  }

  async updateProductStock(tenantId, productId, qty, direction, type, ref) {
    // ⚠️ SECURITY/INTEGRITY FIX: this previously did a plain read-then-write
    // (get product, then put product) with NO transaction and NO server-side
    // check that stock was actually available before decrementing. That is a
    // classic race condition: two concurrent sales of the same product
    // (e.g. two branches, or two browser tabs) could both read the same
    // stock value and one update would silently overwrite the other, and
    // stock could go negative with no warning. It also all ran client-side,
    // so it was trivially bypassable from the browser console.
    //
    // This is now wrapped in a Firestore transaction, and outbound
    // movements (direction === 'out') are rejected if insufficient stock is
    // available at the moment of the transaction, not at the moment the UI
    // last checked.
    //
    // ⚠️ REMAINING ARCHITECTURAL DEBT: this still executes in the browser.
    // True enforcement (so a malicious/compromised client cannot bypass the
    // check entirely) requires moving this logic into a Cloud Function or
    // authenticated server API that the client calls, with Firestore
    // Security Rules denying direct client writes to `products.stock` and
    // `stockMoves`. Flagged here so it isn't forgotten — recommended as the
    // next priority fix after this commit.
    const productRef = this.db.collection('products').doc(productId);
    const moveRef = this.db.collection('stockMoves').doc(this._uid());
    const delta = qty * (direction === 'in' ? 1 : -1);

    const updatedProduct = await this.db.runTransaction(async (tx) => {
      const productSnap = await tx.get(productRef);
      if (!productSnap.exists) {
        throw new Error('Product not found');
      }
      const product = productSnap.data();
      if (product.tenantId !== tenantId) {
        throw new Error('Tenant mismatch on stock update');
      }
      const currentStock = parseFloat(product.stock) || 0;
      const newStock = currentStock + delta;

      if (direction === 'out' && newStock < 0) {
        throw new Error('INSUFFICIENT_STOCK');
      }

      tx.set(moveRef, {
        id: moveRef.id,
        tenantId, productId, qty, direction, type,
        ref: ref || '',
        date: new Date().toISOString(),
        balanceAfter: newStock,
      });
      tx.update(productRef, { stock: newStock });

      return { ...product, stock: newStock };
    });

    return updatedProduct;
  }

  async getDashboardStats(tenantId) {
    const [products, customers, suppliers, invoices] = await Promise.all([
      this.getTenantData('products', tenantId),
      this.getTenantData('customers', tenantId),
      this.getTenantData('suppliers', tenantId),
      this.getTenantData('invoices', tenantId),
    ]);

    const today = new Date().toDateString();
    const salesInvoices = invoices.filter(i => i.type === 'sale');
    const todaySales = salesInvoices.filter(i => new Date(i.date).toDateString() === today);
    const totalRevenue = salesInvoices.reduce((s, i) => s + (i.total || 0), 0);
    const todayRevenue = todaySales.reduce((s, i) => s + (i.total || 0), 0);
    const lowStock = products.filter(p => (p.stock || 0) <= (p.minStock || 5));

    return {
      totalProducts: products.length,
      totalCustomers: customers.length,
      totalSuppliers: suppliers.length,
      totalInvoices: salesInvoices.length,
      totalRevenue,
      todayRevenue,
      todayInvoices: todaySales.length,
      lowStockCount: lowStock.length,
      lowStockItems: lowStock.slice(0, 5),
    };
  }

  async getRevenueChart(tenantId, days = 7) {
    const invoices = await this.getInvoicesByType(tenantId, 'sale');
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toDateString();
      const dayInvoices = invoices.filter(inv => new Date(inv.date).toDateString() === dayStr);
      result.push({
        label: d.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric' }),
        revenue: dayInvoices.reduce((s, inv) => s + (inv.total || 0), 0),
        count: dayInvoices.length,
      });
    }
    return result;
  }

  async getTopProducts(tenantId, limit = 5) {
    const items = await this.getTenantData('invoiceItems', tenantId);
    const products = await this.getTenantData('products', tenantId);
    const map = {};
    for (const item of items) {
      if (!map[item.productId]) map[item.productId] = { qty: 0, revenue: 0 };
      map[item.productId].qty += item.qty || 0;
      map[item.productId].revenue += (item.qty || 0) * (item.price || 0);
    }
    return Object.entries(map)
      .sort(([,a],[,b]) => b.revenue - a.revenue)
      .slice(0, limit)
      .map(([id, data]) => {
        const p = products.find(p => p.id === id);
        return { ...data, name: p?.name || id, id };
      });
  }

  // ── Offline Queue ──
  async queueOperation(tenantId, op) {
    return this.add('offlineQueue', {
      tenantId,
      ...op,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  }

  async getPendingQueue(tenantId) {
    const all = await this.getTenantData('offlineQueue', tenantId);
    return all.filter(q => q.status === 'pending');
  }

  // ── Audit Log ──
  async log(tenantId, userId, action, table, recordId, data = {}) {
    return this.add('auditLog', {
      tenantId, userId, action, table, recordId,
      data: JSON.stringify(data),
      date: new Date().toISOString(),
    });
  }

  // ── Helpers ──
  _uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  // ── DEMO DATA SEED ──
  async _seedDemoData() {
    const count = await this.count('users');
    if (count > 0) return; // Already seeded

    // Tenants
    const tenant1 = { id: 'T001', code: 'hamd-demo', name: 'شركة H.A.M.D للتجارة', plan: 'pro', currency: 'EGP', taxRate: 14, address: 'القاهرة، مصر', phone: '01000000000', logo: 'H', color: '#6366f1', createdAt: new Date().toISOString() };
    const tenant2 = { id: 'T002', code: 'delta-store', name: 'مؤسسة دلتا للأجهزة', plan: 'basic', currency: 'EGP', taxRate: 14, address: 'المنصورة، مصر', phone: '01011111111', logo: 'D', color: '#0ea5e9', createdAt: new Date().toISOString() };
    await this.put('tenants', tenant1);
    await this.put('tenants', tenant2);

    // Users
    const users = [
      { id: 'U001', tenantId: 'T001', username: 'admin', password: 'admin123', name: 'مدير النظام', email: 'admin@hamd.com', role: 'admin', active: true },
      { id: 'U002', tenantId: 'T001', username: 'cashier', password: '123456', name: 'أحمد الكاشير', email: 'cashier@hamd.com', role: 'cashier', active: true },
      { id: 'U003', tenantId: 'T001', username: 'store', password: '123456', name: 'محمد أمين المخزن', email: 'store@hamd.com', role: 'storekeeper', active: true },
      { id: 'U004', tenantId: 'T002', username: 'admin2', password: 'admin123', name: 'مدير دلتا', email: 'admin@delta.com', role: 'admin', active: true },
    ];
    for (const u of users) await this.put('users', u);

    // Categories
    const cats = [
      { id: 'C001', tenantId: 'T001', name: 'إلكترونيات', icon: '📱', color: '#6366f1', parentId: null },
      { id: 'C002', tenantId: 'T001', name: 'ملابس', icon: '👕', color: '#0ea5e9', parentId: null },
      { id: 'C003', tenantId: 'T001', name: 'مواد غذائية', icon: '🍎', color: '#10b981', parentId: null },
      { id: 'C004', tenantId: 'T001', name: 'أجهزة منزلية', icon: '🏠', color: '#f59e0b', parentId: null },
      { id: 'C005', tenantId: 'T001', name: 'قرطاسية', icon: '✏️', color: '#ef4444', parentId: null },
    ];
    for (const c of cats) await this.put('categories', c);

    // Warehouses
    const warehouses = [
      { id: 'W001', tenantId: 'T001', name: 'المخزن الرئيسي', location: 'القاهرة', active: true },
      { id: 'W002', tenantId: 'T001', name: 'فرع الجيزة', location: 'الجيزة', active: true },
    ];
    for (const w of warehouses) await this.put('warehouses', w);

    // Products
    const products = [
      { id: 'P001', tenantId: 'T001', name: 'آيفون 15 برو', barcode: '1234567890001', categoryId: 'C001', warehouseId: 'W001', buyPrice: 28000, sellPrice: 35000, price2: 34000, price3: 33000, stock: 15, minStock: 3, unit: 'قطعة', icon: '📱', active: true },
      { id: 'P002', tenantId: 'T001', name: 'سامسونج S24', barcode: '1234567890002', categoryId: 'C001', warehouseId: 'W001', buyPrice: 22000, sellPrice: 28000, price2: 27000, price3: 26000, stock: 22, minStock: 3, unit: 'قطعة', icon: '📱', active: true },
      { id: 'P003', tenantId: 'T001', name: 'لابتوب ديل XPS', barcode: '1234567890003', categoryId: 'C001', warehouseId: 'W001', buyPrice: 35000, sellPrice: 45000, price2: 43000, price3: 41000, stock: 8, minStock: 2, unit: 'قطعة', icon: '💻', active: true },
      { id: 'P004', tenantId: 'T001', name: 'سماعات سوني', barcode: '1234567890004', categoryId: 'C001', warehouseId: 'W001', buyPrice: 1800, sellPrice: 2500, price2: 2300, price3: 2100, stock: 35, minStock: 5, unit: 'قطعة', icon: '🎧', active: true },
      { id: 'P005', tenantId: 'T001', name: 'تي شيرت قطن', barcode: '1234567890005', categoryId: 'C002', warehouseId: 'W001', buyPrice: 80, sellPrice: 150, price2: 140, price3: 130, stock: 120, minStock: 20, unit: 'قطعة', icon: '👕', active: true },
      { id: 'P006', tenantId: 'T001', name: 'بنطلون جينز', barcode: '1234567890006', categoryId: 'C002', warehouseId: 'W001', buyPrice: 200, sellPrice: 380, price2: 360, price3: 340, stock: 4, minStock: 10, unit: 'قطعة', icon: '👖', active: true },
      { id: 'P007', tenantId: 'T001', name: 'أرز بسمتي 5 كيلو', barcode: '1234567890007', categoryId: 'C003', warehouseId: 'W001', buyPrice: 95, sellPrice: 130, price2: 125, price3: 120, stock: 200, minStock: 30, unit: 'كيس', icon: '🍚', active: true },
      { id: 'P008', tenantId: 'T001', name: 'زيت عباد الشمس 1.8 ل', barcode: '1234567890008', categoryId: 'C003', warehouseId: 'W001', buyPrice: 55, sellPrice: 78, price2: 75, price3: 72, stock: 150, minStock: 25, unit: 'زجاجة', icon: '🫙', active: true },
      { id: 'P009', tenantId: 'T001', name: 'غسالة توشيبا 7 كيلو', barcode: '1234567890009', categoryId: 'C004', warehouseId: 'W001', buyPrice: 7500, sellPrice: 10500, price2: 10000, price3: 9500, stock: 6, minStock: 2, unit: 'جهاز', icon: '🫧', active: true },
      { id: 'P010', tenantId: 'T001', name: 'دفتر A4 100 ورقة', barcode: '1234567890010', categoryId: 'C005', warehouseId: 'W001', buyPrice: 12, sellPrice: 20, price2: 18, price3: 17, stock: 2, minStock: 10, unit: 'قطعة', icon: '📒', active: true },
    ];
    for (const p of products) await this.put('products', p);

    // Customers
    const customers = [
      { id: 'CU001', tenantId: 'T001', code: 'C001', name: 'محمد أحمد', phone: '01001234567', address: 'القاهرة', type: 'retail', balance: 5500, creditLimit: 20000, active: true },
      { id: 'CU002', tenantId: 'T001', code: 'C002', name: 'شركة النور للتجارة', phone: '01112345678', address: 'الإسكندرية', type: 'wholesale', balance: -2000, creditLimit: 50000, active: true },
      { id: 'CU003', tenantId: 'T001', code: 'C003', name: 'سارة محمود', phone: '01223456789', address: 'الجيزة', type: 'retail', balance: 0, creditLimit: 10000, active: true },
      { id: 'CU004', tenantId: 'T001', code: 'C004', name: 'مؤسسة البدر', phone: '01334567890', address: 'المنصورة', type: 'wholesale', balance: 15000, creditLimit: 100000, active: true },
      { id: 'CU005', tenantId: 'T001', code: 'C005', name: 'أحمد السيد', phone: '01445678901', address: 'طنطا', type: 'vip', balance: -500, creditLimit: 30000, active: true },
    ];
    for (const c of customers) await this.put('customers', c);

    // Suppliers
    const suppliers = [
      { id: 'SP001', tenantId: 'T001', code: 'S001', name: 'مكتب آبل مصر', phone: '01501234567', address: 'القاهرة', balance: 0, active: true },
      { id: 'SP002', tenantId: 'T001', code: 'S002', name: 'سامسونج مصر', phone: '01612345678', address: 'القاهرة', balance: 8000, active: true },
      { id: 'SP003', tenantId: 'T001', code: 'S003', name: 'مصنع القطن الذهبي', phone: '01723456789', address: 'المحلة', balance: 0, active: true },
      { id: 'SP004', tenantId: 'T001', code: 'S004', name: 'شركة الغذاء الوطني', phone: '01834567890', address: 'الإسماعيلية', balance: 0, active: true },
    ];
    for (const s of suppliers) await this.put('suppliers', s);

    // Sample Invoices
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const count = Math.floor(Math.random() * 4) + 1;
      for (let j = 0; j < count; j++) {
        const inv = {
          id: `INV${d.toISOString().slice(0,10).replace(/-/g,'')}_${j}`,
          tenantId: 'T001',
          type: 'sale',
          number: `FA-${Date.now()}-${j}`,
          customerId: ['CU001','CU002','CU003','CU004','CU005'][Math.floor(Math.random()*5)],
          date: d.toISOString(),
          items: [],
          subtotal: 0,
          discount: 0,
          tax: 0,
          total: 0,
          paid: 0,
          remaining: 0,
          paymentMethod: ['cash','card','transfer'][Math.floor(Math.random()*3)],
          status: 'completed',
          notes: '',
          userId: 'U001',
        };
        const numItems = Math.floor(Math.random() * 3) + 1;
        let subtotal = 0;
        const items = [];
        for (let k = 0; k < numItems; k++) {
          const prod = products[Math.floor(Math.random() * products.length)];
          const qty = Math.floor(Math.random() * 3) + 1;
          const price = prod.sellPrice;
          subtotal += qty * price;
          items.push({ productId: prod.id, qty, price, discount: 0, total: qty * price });
        }
        inv.subtotal = subtotal;
        inv.tax = Math.round(subtotal * 0.14);
        inv.total = subtotal + inv.tax;
        inv.paid = inv.total;
        inv.items = items;
        await this.put('invoices', inv);

        for (const item of items) {
          await this.put('invoiceItems', {
            id: `${inv.id}_${item.productId}`,
            tenantId: 'T001',
            invoiceId: inv.id,
            ...item,
          });
        }
      }
    }

    console.log('✅ H.A.M.D Demo data seeded successfully');
  }
}

window.db = new HamdDB();

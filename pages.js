// ══════════════════════════════════════════
// H.A.M.D — All Page Renderers
// Dashboard, POS, Products, Customers,
// Sales, Purchases, Finance, Reports...
// ══════════════════════════════════════════

const Pages = {
  // ══════════════════════════════════════════
  //  DASHBOARD
  // ══════════════════════════════════════════
  async dashboard() {
    const t = window.t || (k => k);
    const pc = document.getElementById('page-content');
    pc.innerHTML = '<div class="skeleton" style="height:120px;margin-bottom:16px"></div>'.repeat(4) + '<div class="skeleton" style="height:300px"></div>';
    const tenantId = App.state.tenant.id;
    const stats = await window.db.getDashboardStats(tenantId);
    const chartData = await window.db.getRevenueChart(tenantId, 7);
    const topProducts = await window.db.getTopProducts(tenantId);

    pc.innerHTML = `
      <div class="fade-in">
        <!-- KPIs -->
        <div class="kpi-grid">
          <div class="kpi-card blue">
            <div class="kpi-header">
              <div class="kpi-icon blue"><i class="fa fa-dollar-sign"></i></div>
              <span class="kpi-change up"><i class="fa fa-arrow-up"></i> 12.5%</span>
            </div>
            <div class="kpi-value">${Fmt.currency(stats.todayRevenue)}</div>
            <div class="kpi-label">${t('today_sales')}</div>
          </div>
          <div class="kpi-card green">
            <div class="kpi-header">
              <div class="kpi-icon green"><i class="fa fa-chart-line"></i></div>
              <span class="kpi-change up"><i class="fa fa-arrow-up"></i> 8.3%</span>
            </div>
            <div class="kpi-value">${Fmt.currency(stats.totalRevenue)}</div>
            <div class="kpi-label">${t('total_revenue')}</div>
          </div>
          <div class="kpi-card orange">
            <div class="kpi-header">
              <div class="kpi-icon orange"><i class="fa fa-file-invoice"></i></div>
              <span class="kpi-change up"><i class="fa fa-arrow-up"></i> ${stats.todayInvoices}</span>
            </div>
            <div class="kpi-value">${Fmt.number(stats.totalInvoices)}</div>
            <div class="kpi-label">${t('total_invoices')}</div>
          </div>
          <div class="kpi-card cyan">
            <div class="kpi-header">
              <div class="kpi-icon cyan"><i class="fa fa-box"></i></div>
              <span class="kpi-change ${stats.lowStockCount > 0 ? 'down' : 'up'}">
                <i class="fa fa-${stats.lowStockCount > 0 ? 'exclamation-triangle' : 'check'}"></i>
                ${stats.lowStockCount} ${t('low_stock_short') || 'منخفض'}
              </span>
            </div>
            <div class="kpi-value">${Fmt.number(stats.totalProducts)}</div>
            <div class="kpi-label">${t('total_products')}</div>
          </div>
          <div class="kpi-card blue">
            <div class="kpi-header">
              <div class="kpi-icon blue"><i class="fa fa-users"></i></div>
              <span class="kpi-change up"><i class="fa fa-arrow-up"></i> 3</span>
            </div>
            <div class="kpi-value">${Fmt.number(stats.totalCustomers)}</div>
            <div class="kpi-label">${t('customers')}</div>
          </div>
          <div class="kpi-card red">
            <div class="kpi-header">
              <div class="kpi-icon red"><i class="fa fa-truck"></i></div>
              <span class="kpi-change up"><i class="fa fa-arrow-up"></i> 1</span>
            </div>
            <div class="kpi-value">${Fmt.number(stats.totalSuppliers)}</div>
            <div class="kpi-label">${t('suppliers')}</div>
          </div>
        </div>

        <!-- ALERTS -->
        ${stats.lowStockCount > 0 ? `
          <div class="alert alert-warning mb-16">
            <i class="fa fa-exclamation-triangle"></i>
            <div>
              <strong>${stats.lowStockCount} ${t('low_stock_alert')}</strong>
              ${stats.lowStockItems.map(p => `<span class="badge badge-warning" style="margin:0 4px">${p.name}</span>`).join('')}
              <a href="#" onclick="App.navigate('products')" style="color:var(--warning);margin-right:8px">${t('view_all')}</a>
            </div>
          </div>
        ` : ''}

        <!-- CHARTS -->
        <div class="charts-grid mb-24">
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">${t('sales_last_7_days')}</div>
                <div class="card-subtitle">${t('daily_revenue_analysis')}</div>
              </div>
              <select class="form-control" style="width:auto" onchange="Pages.refreshChart(this.value)">
                <option value="7">${t('days_7')}</option>
                <option value="30">${t('days_30')}</option>
              </select>
            </div>
            <div class="chart-container">
              <canvas id="revenue-chart"></canvas>
            </div>
          </div>
          <div class="card">
            <div class="card-header">
              <div class="card-title">${t('top_selling_products')}</div>
            </div>
            <div class="chart-container">
              <canvas id="products-chart"></canvas>
            </div>
          </div>
        </div>

        <!-- RECENT SALES + LOW STOCK -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="card">
            <div class="card-header">
              <div class="card-title">آخر الفواتير</div>
              <button class="btn btn-ghost btn-sm" onclick="App.navigate('sales')">عرض الكل</button>
            </div>
            <div id="recent-invoices">
              <div class="text-center"><i class="fa fa-spinner fa-spin"></i></div>
            </div>
          </div>
          <div class="card">
            <div class="card-header">
              <div class="card-title">أصناف منخفضة المخزون</div>
              <button class="btn btn-ghost btn-sm" onclick="App.navigate('products')">عرض الكل</button>
            </div>
            <div id="low-stock-list">
              <div class="text-center"><i class="fa fa-spinner fa-spin"></i></div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Render charts after DOM is ready
    setTimeout(() => this._renderDashboardCharts(chartData, topProducts), 50);
    this._renderRecentInvoices(tenantId);
    this._renderLowStock(tenantId);
  },

  _renderDashboardCharts(chartData, topProducts) {
    // Revenue Chart
    const revenueCanvas = document.getElementById('revenue-chart');
    if (revenueCanvas && window.Chart) {
      new Chart(revenueCanvas, {
        type: 'bar',
        data: {
          labels: chartData.map(d => d.label),
          datasets: [{
            label: 'الإيرادات',
            data: chartData.map(d => d.revenue),
            backgroundColor: 'rgba(99,102,241,0.3)',
            borderColor: 'rgba(99,102,241,1)',
            borderWidth: 2,
            borderRadius: 6,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => Fmt.currency(ctx.parsed.y) } } },
          scales: {
            x: { ticks: { color: '#94a3b8', font: { family: 'Cairo' } }, grid: { color: 'rgba(255,255,255,0.05)' } },
            y: { ticks: { color: '#94a3b8', font: { family: 'Cairo' }, callback: v => Fmt.currency(v) }, grid: { color: 'rgba(255,255,255,0.05)' } },
          }
        }
      });
    }
    // Top Products Chart
    const prodCanvas = document.getElementById('products-chart');
    if (prodCanvas && window.Chart && topProducts.length > 0) {
      new Chart(prodCanvas, {
        type: 'doughnut',
        data: {
          labels: topProducts.map(p => p.name),
          datasets: [{
            data: topProducts.map(p => p.revenue),
            backgroundColor: ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444'],
            borderWidth: 0,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Cairo' }, boxWidth: 12 } },
            tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${Fmt.currency(ctx.parsed)}` } }
          },
          cutout: '65%',
        }
      });
    }
  },

  async _renderRecentInvoices(tenantId) {
    const invoices = await window.db.getInvoicesByType(tenantId, 'sale');
    const recent = invoices.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    const el = document.getElementById('recent-invoices');
    if (!el) return;
    if (recent.length === 0) { el.innerHTML = '<div class="empty-state" style="padding:20px"><i class="fa fa-file-invoice" style="font-size:24px"></i><p>لا توجد فواتير بعد</p></div>'; return; }
    const customers = await window.db.getTenantData('customers', tenantId);
    el.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">` +
      recent.map(inv => {
        const cust = customers.find(c => c.id === inv.customerId);
        const payIcon = { cash: 'fa-money-bill-wave', card: 'fa-credit-card', transfer: 'fa-university' }[inv.paymentMethod] || 'fa-money-bill';
        return `
          <div style="display:flex;align-items:center;gap:12px;padding:10px;background:var(--bg-elevated);border-radius:8px;cursor:pointer" onclick="Pages.viewInvoice('${inv.id}')">
            <div style="width:36px;height:36px;background:linear-gradient(135deg,#4f46e5,#6366f1);border-radius:8px;display:flex;align-items:center;justify-content:center">
              <i class="fa ${payIcon}" style="color:white;font-size:13px"></i>
            </div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700">${cust?.name || '—'}</div>
              <div style="font-size:11px;color:var(--text-muted)">${Fmt.date(inv.date)}</div>
            </div>
            <div style="font-size:14px;font-weight:800;color:var(--success)">${Fmt.currency(inv.total)}</div>
          </div>
        `;
      }).join('') + '</div>';
  },

  async _renderLowStock(tenantId) {
    const products = await window.db.getTenantData('products', tenantId);
    const lowStock = products.filter(p => (p.stock || 0) <= (p.minStock || 5)).slice(0, 6);
    const el = document.getElementById('low-stock-list');
    if (!el) return;
    if (lowStock.length === 0) {
      el.innerHTML = '<div class="empty-state" style="padding:20px"><i class="fa fa-check-circle text-success" style="font-size:24px"></i><p>جميع الأصناف بمستويات جيدة</p></div>';
      return;
    }
    el.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">` +
      lowStock.map(p => {
        const pct = Math.min(100, ((p.stock || 0) / (p.minStock || 5)) * 100);
        const color = pct < 30 ? 'var(--danger)' : pct < 60 ? 'var(--warning)' : 'var(--success)';
        return `
          <div style="padding:10px;background:var(--bg-elevated);border-radius:8px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:13px;font-weight:600">${p.icon || '📦'} ${p.name}</span>
              <span style="font-size:13px;font-weight:800;color:${color}">${p.stock || 0} ${p.unit || ''}</span>
            </div>
            <div class="progress">
              <div class="progress-bar" style="width:${pct}%;background:${color}"></div>
            </div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:4px">الحد الأدنى: ${p.minStock || 5}</div>
          </div>
        `;
      }).join('') + '</div>';
  },

  async refreshChart(days) {
    const data = await window.db.getRevenueChart(App.state.tenant.id, parseInt(days));
    // Re-render (simplified)
  },

  // ══════════════════════════════════════════
  //  POS — POINT OF SALE
  // ══════════════════════════════════════════
  async pos() {
    const t = window.t || (k => k);
    const pc = document.getElementById('page-content');
    const tenantId = App.state.tenant.id;
    const products = await window.db.getTenantData('products', tenantId);
    const categories = await window.db.getTenantData('categories', tenantId);

    window._posCart = [];
    window._posDiscount = 0;
    window._posPayMethod = 'cash';

    // Subscribing to global barcode scanner
    if (window._posBarcodeCleanup) window._posBarcodeCleanup();
    window._posBarcodeCleanup = Barcode.onScan((code) => {
      const product = window._posProducts?.find(p => p.barcode === code || String(p.barcode) === code);
      if (product) {
        Pages._posAddItem(product.id);
        Toast.show(`تم مسح الباركود: ${product.name}`, 'success');
      } else {
        Toast.show(`باركود غير موجود: ${code}`, 'warning');
      }
    });

    pc.innerHTML = `
      <div class="pos-layout fade-in">
        <!-- PRODUCTS PANEL -->
        <div class="pos-products">
          <!-- Search & Filter -->
          <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
            <div style="position:relative;flex:1;min-width:200px">
              <input type="text" class="form-control" id="pos-search" placeholder="${t('search_name_barcode') || 'بحث بالاسم أو الباركود...'}"
                oninput="Pages._posFilter()" style="padding-left:40px">
              <i class="fa fa-search" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted)"></i>
            </div>
            <button class="btn btn-secondary" onclick="Pages._posScanBarcode()">
              <i class="fa fa-barcode"></i> ${t('scan') || 'مسح'}
            </button>
          </div>
          <!-- Categories -->
          <div style="display:flex;gap:8px;margin-bottom:16px;overflow-x:auto;padding-bottom:4px">
            <button class="btn btn-primary btn-sm" onclick="Pages._posFilterCategory(null)">${t('all') || 'الكل'}</button>
            ${categories.map(c => `
              <button class="btn btn-secondary btn-sm" onclick="Pages._posFilterCategory('${c.id}')">
                ${c.icon || ''} ${c.name}
              </button>
            `).join('')}
          </div>
          <!-- Products Grid -->
          <div class="product-grid" id="pos-products-grid">
            ${products.map(p => `
              <div class="product-card" onclick="Pages._posAddItem('${p.id}')" data-category="${p.categoryId}" data-name="${p.name}" data-barcode="${p.barcode || ''}">
                <div class="product-img">${p.icon || '📦'}</div>
                <div class="product-name">${p.name}</div>
                <div class="product-price">${Fmt.currency(p.sellPrice)}</div>
                <div class="product-stock ${(p.stock || 0) <= (p.minStock || 5) ? 'text-danger' : 'text-muted'}">
                  ${t('available')} ${p.stock || 0} ${p.unit || ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- CART PANEL -->
        <div class="pos-cart">
          <div class="cart-header">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <h3 style="font-size:15px;font-weight:700">🛒 ${t('shopping_cart')}</h3>
              <button class="btn btn-ghost btn-sm" onclick="Pages._posClearCart()"><i class="fa fa-trash"></i> ${t('clear')}</button>
            </div>
            <select class="form-control mt-8" id="pos-customer" style="margin-top:8px">
              <option value="">${t('cash_customer')}</option>
              ${(window._posCustomers || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="cart-items" id="pos-cart-items">
            <div class="empty-state" style="padding:30px">
              <i class="fa fa-shopping-cart" style="font-size:32px"></i>
              <p>${t('add_items_to_invoice')}</p>
            </div>
          </div>
          <div class="cart-footer">
            <div class="cart-summary">
              <div class="cart-row">
                <span>${t('subtotal')}</span>
                <span id="pos-subtotal">${Fmt.currency(0)}</span>
              </div>
              <div class="cart-row" style="align-items:center">
                <span>${t('discount')}</span>
                <div style="display:flex;align-items:center;gap:6px">
                  <input type="number" id="pos-discount" value="0" min="0"
                    style="width:70px;padding:4px 8px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-family:'Cairo',sans-serif;text-align:center"
                    oninput="Pages._posUpdateTotals()" ${App.state.user.role === 'cashier' ? 'disabled title="غير مصرح للكاشير بالخصم"' : ''}>
                  <span></span>
                </div>
              </div>
              <div class="cart-row">
                <span>${t('tax')} (${App.state.tenant.taxRate || 14}%):</span>
                <span id="pos-tax">${Fmt.currency(0)}</span>
              </div>
              <div class="cart-row total">
                <span>${t('total')}</span>
                <span id="pos-total">${Fmt.currency(0)}</span>
              </div>
            </div>
            <!-- Payment Methods -->
            <div style="display:flex;gap:6px;margin-bottom:10px">
              ${[{v:'cash',i:'fa-money-bill-wave',l:t('pay_cash')},{v:'card',i:'fa-credit-card',l:t('pay_card')},{v:'transfer',i:'fa-university',l:t('pay_transfer')},{v:'credit',i:'fa-clock',l:t('pay_credit')}].map(m => `
                <button class="btn ${window._posPayMethod === m.v ? 'btn-primary' : 'btn-secondary'} btn-sm" style="flex:1;flex-direction:column;padding:8px 4px;gap:4px" onclick="Pages._posSetPayment('${m.v}',this)" id="pay-${m.v}">
                  <i class="fa ${m.i}"></i>
                  <span style="font-size:10px">${m.l}</span>
                </button>
              `).join('')}
            </div>
            <button class="btn btn-success btn-block btn-lg" onclick="Pages._posCheckout()" id="pos-checkout-btn">
              <i class="fa fa-check"></i> ${t('checkout')}
            </button>
          </div>
        </div>
      </div>
    `;
    // Load customers into select
    const customers = await window.db.getTenantData('customers', tenantId);
    window._posCustomers = customers;
    const sel = document.getElementById('pos-customer');
    if (sel) {
      customers.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} (${c.phone})`;
        sel.appendChild(opt);
      });
    }
    window._posProducts = products;
  },

  _posFilter() {
    const q = document.getElementById('pos-search').value.toLowerCase();
    document.querySelectorAll('#pos-products-grid .product-card').forEach(el => {
      const name = el.dataset.name?.toLowerCase() || '';
      const barcode = el.dataset.barcode?.toLowerCase() || '';
      el.style.display = (!q || name.includes(q) || barcode.includes(q)) ? '' : 'none';
    });
  },

  _posFilterCategory(catId) {
    document.querySelectorAll('#pos-products-grid .product-card').forEach(el => {
      el.style.display = (!catId || el.dataset.category === catId) ? '' : 'none';
    });
  },

  _posAddItem(productId) {
    const t = window.t || (k => k);
    const product = window._posProducts?.find(p => p.id === productId);
    if (!product) return;
    const stockAvailable = parseFloat(product.stock) || 0;
    if (stockAvailable <= 0) { Toast.show(t('out_of_stock'), 'warning'); return; }

    const existing = window._posCart.find(i => i.productId === productId);
    if (existing) {
      if (existing.qty >= stockAvailable) { Toast.show(t('qty_exceeds_stock'), 'warning'); return; }
      existing.qty++;
      existing.total = existing.qty * existing.price;
    } else {
      window._posCart.push({ productId, name: product.name, price: product.sellPrice, qty: 1, total: product.sellPrice, unit: product.unit, icon: product.icon });
    }
    this._posRenderCart();
  },

  _posRenderCart() {
    const t = window.t || (k => k);
    const container = document.getElementById('pos-cart-items');
    if (!container) return;
    if (window._posCart.length === 0) {
      container.innerHTML = `<div class="empty-state" style="padding:30px"><i class="fa fa-shopping-cart" style="font-size:32px"></i><p>${t('add_items_to_invoice')}</p></div>`;
      this._posUpdateTotals();
      return;
    }
    container.innerHTML = window._posCart.map((item, i) => `
      <div class="cart-item">
        <span style="font-size:18px">${item.icon || '📦'}</span>
        <div style="flex:1;min-width:0">
          <div class="cart-item-name" style="font-size:12px">${item.name}</div>
          <div style="font-size:11px;color:var(--primary-light)">${Fmt.currency(item.price)}</div>
        </div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="Pages._posChangeQty(${i},-1)">−</button>
          <span style="min-width:24px;text-align:center;font-weight:700">${item.qty}</span>
          <button class="qty-btn" onclick="Pages._posChangeQty(${i},1)">+</button>
        </div>
        <div class="cart-item-total">${Fmt.currency(item.total)}</div>
        <button onclick="Pages._posRemoveItem(${i})" style="background:none;border:none;color:var(--danger);cursor:pointer;padding:4px"><i class="fa fa-times"></i></button>
      </div>
    `).join('');
    this._posUpdateTotals();
  },

  _posChangeQty(index, delta) {
    const item = window._posCart[index];
    if (!item) return;
    const product = window._posProducts?.find(p => p.id === item.productId);
    const stockAvailable = parseFloat(product?.stock) || 0;
    if (delta > 0 && product) {
      if (item.qty + delta > stockAvailable) {
        Toast.show('الكمية تتجاوز المخزون المتاح', 'warning');
        return;
      }
    }
    item.qty = Math.max(1, item.qty + delta);
    item.total = item.qty * item.price;
    this._posRenderCart();
  },

  _posRemoveItem(index) {
    window._posCart.splice(index, 1);
    this._posRenderCart();
  },

  _posClearCart() {
    window._posCart = [];
    window._posDiscount = 0;
    document.getElementById('pos-discount').value = '0';
    this._posRenderCart();
  },

  _posSetPayment(method, btn) {
    window._posPayMethod = method;
    document.querySelectorAll('[id^="pay-"]').forEach(b => { b.className = b.className.replace('btn-primary', 'btn-secondary'); });
    btn.className = btn.className.replace('btn-secondary', 'btn-primary');
  },

  _posUpdateTotals() {
    const subtotal = window._posCart.reduce((s, i) => s + i.total, 0);
    const discount = parseFloat(document.getElementById('pos-discount')?.value || 0) || 0;
    const taxable = Math.max(0, subtotal - discount);
    const taxRate = (App.state.tenant.taxRate || 14) / 100;
    const tax = taxable * taxRate;
    const total = taxable + tax;
    window._posSubtotal = subtotal;
    window._posDiscount = discount;
    window._posTax = tax;
    window._posTotal = total;
    const s = document.getElementById('pos-subtotal');
    const t = document.getElementById('pos-tax');
    const tot = document.getElementById('pos-total');
    if (s) s.textContent = Fmt.currency(subtotal);
    if (t) t.textContent = Fmt.currency(tax);
    if (tot) tot.textContent = Fmt.currency(total);
  },

  async _posCheckout() {
    if (window._posCart.length === 0) { Toast.show('السلة فارغة!', 'warning'); return; }
    const btn = document.getElementById('pos-checkout-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> جاري الحفظ...';
    try {
      const tenantId = App.state.tenant.id;
      const customerId = document.getElementById('pos-customer')?.value || null;
      const invoice = {
        tenantId, type: 'sale',
        number: NumGen.invoice('FA'),
        customerId: customerId || null,
        date: new Date().toISOString(),
        subtotal: window._posSubtotal || 0,
        discount: window._posDiscount || 0,
        tax: window._posTax || 0,
        total: window._posTotal || 0,
        paid: window._posTotal || 0,
        remaining: 0,
        paymentMethod: window._posPayMethod || 'cash',
        status: 'completed',
        notes: '',
        userId: App.state.user.id,
      };
      const savedInvoiceId = await window.db.add('invoices', invoice);
      invoice.id = savedInvoiceId;
      // Save items & update stock
      for (const item of window._posCart) {
        await window.db.add('invoiceItems', {
          tenantId, invoiceId: savedInvoiceId,
          productId: item.productId, qty: item.qty,
          price: item.price, discount: 0, total: item.total,
        });
        await window.db.updateProductStock(tenantId, item.productId, item.qty, 'out', 'sale', invoice.number);
        const pCache = window._posProducts?.find(p => p.id === item.productId);
        if (pCache) pCache.stock = (parseFloat(pCache.stock) || 0) - item.qty;
      }
      Toast.show(`تم حفظ الفاتورة ${invoice.number} بنجاح ✓`, 'success');
      this._posClearCart();
      // Ask to print
      Modal.confirm('طباعة الفاتورة', 'هل تريد طباعة الفاتورة؟', async () => {
        const customer = customerId ? await window.db.get('customers', customerId) : null;
        Print.invoice(invoice, window._posCart.map(i => ({...i, name: i.name})), customer, App.state.tenant);
      });
    } catch (err) {
      // NOTE: if this fails partway through the items loop (e.g.
      // INSUFFICIENT_STOCK on a later item), the invoice document and any
      // already-processed stock movements are NOT rolled back — this whole
      // checkout flow needs to become a single atomic operation (ideally a
      // server-side Cloud Function) so either the entire sale succeeds or
      // none of it does. Flagged as a priority follow-up; not fixed in this
      // pass to avoid a large untested rewrite of the POS flow.
      if (err && err.message === 'INSUFFICIENT_STOCK') {
        Toast.show('الكمية المطلوبة غير متاحة في المخزون', 'error');
      } else {
        Toast.show('حدث خطأ أثناء حفظ الفاتورة', 'error');
      }
      console.error(err);
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="fa fa-check"></i> إتمام البيع';
  },

  async _posScanBarcode() {
    App.Scanner.open((decodedText) => {
      const product = window._posProducts?.find(p => p.barcode === decodedText);
      if (product) {
        this._posAddItem(product.id);
        Toast.show(`تمت الإضافة: ${product.name}`, 'success');
      } else {
        Toast.show(`المنتج غير موجود (${decodedText})`, 'warning');
      }
    });
  },

  // ══════════════════════════════════════════
  //  PRODUCTS
  // ══════════════════════════════════════════
  async products() {
    const t = window.t || (k => k);
    const pc = document.getElementById('page-content');
    const tenantId = App.state.tenant.id;
    const [products, categories] = await Promise.all([
      window.db.getTenantData('products', tenantId),
      window.db.getTenantData('categories', tenantId),
    ]);
    const catMap = {};
    categories.forEach(c => catMap[c.id] = c);

    pc.innerHTML = `
      <div class="fade-in">
        <div class="table-toolbar">
          <div class="search-box">
            <input type="text" id="prod-search" placeholder="${t('search_name_barcode') || 'بحث بالاسم أو الباركود...'}" oninput="Pages._filterTable('prod-table',this.value,['name','barcode','categoryName'])">
            <i class="fa fa-search"></i>
          </div>
          <select class="form-control" style="width:auto" onchange="Pages._filterTableByField('prod-table','categoryId',this.value)">
            <option value="">${t('all_categories')}</option>
            ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
          <button class="btn btn-secondary" onclick="Pages._exportProducts()"><i class="fa fa-file-excel"></i> ${t('export')}</button>
          <button class="btn btn-primary" onclick="Pages.productForm()"><i class="fa fa-plus"></i> ${t('add_product')}</button>
        </div>

        <div class="table-wrapper">
          <table class="table" id="prod-table">
            <thead>
              <tr>
                <th>${t('product')}</th>
                <th>${t('barcode')}</th>
                <th>${t('category')}</th>
                <th>${t('buy_price')}</th>
                <th>${t('sell_price')}</th>
                <th>${t('stock')}</th>
                <th>${t('status')}</th>
                <th>${t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              ${products.map(p => `
                <tr data-name="${p.name}" data-barcode="${p.barcode || ''}" data-categoryname="${catMap[p.categoryId]?.name || ''}" data-categoryid="${p.categoryId || ''}">
                  <td>
                    <div style="display:flex;align-items:center;gap:10px">
                      <span style="font-size:24px">${p.icon || '📦'}</span>
                      <div>
                        <div style="font-weight:700">${p.name}</div>
                        <div style="font-size:11px;color:var(--text-muted)">${p.unit || t('piece')}</div>
                      </div>
                    </div>
                  </td>
                  <td><code style="font-size:12px;background:var(--bg-elevated);padding:2px 8px;border-radius:4px">${p.barcode || '—'}</code></td>
                  <td><span class="badge badge-secondary">${catMap[p.categoryId]?.icon || ''} ${catMap[p.categoryId]?.name || '—'}</span></td>
                  <td>${Fmt.currency(p.buyPrice)}</td>
                  <td><strong>${Fmt.currency(p.sellPrice)}</strong></td>
                  <td>
                    <span class="${(p.stock || 0) <= (p.minStock || 5) ? 'text-danger fw-bold' : 'text-success fw-bold'}">
                      ${p.stock || 0}
                    </span>
                    <span class="text-muted fs-sm"> / ${t('min_stock')} ${p.minStock || 5}</span>
                  </td>
                  <td><span class="badge ${p.active ? 'badge-success' : 'badge-secondary'}">${p.active ? t('active') : t('inactive')}</span></td>
                  <td>
                    <div class="actions">
                      <button class="btn btn-secondary btn-sm" onclick="Pages.productForm('${p.id}')" title="${t('edit')}"><i class="fa fa-edit"></i></button>
                      <button class="btn btn-secondary btn-sm" onclick="Pages._showBarcode('${p.id}','${p.barcode || p.id}','${p.name}')" title="${t('barcode')}"><i class="fa fa-barcode"></i></button>
                      <button class="btn btn-secondary btn-sm" onclick="Pages._stockAdjust('${p.id}')" title="${t('adjust_stock')}"><i class="fa fa-boxes"></i></button>
                      <button class="btn btn-danger btn-sm" onclick="Pages._deleteProduct('${p.id}')" title="${t('delete')}"><i class="fa fa-trash"></i></button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async productForm(productId = null) {
    const t = window.t || (k => k);
    const tenantId = App.state.tenant.id;
    const [categories, warehouses] = await Promise.all([
      window.db.getTenantData('categories', tenantId),
      window.db.getTenantData('warehouses', tenantId),
    ]);
    const product = productId ? await window.db.get('products', productId) : null;
    const title = product ? t('edit_product') : t('add_new_product');
    const v = product || {};
    Modal.open('product-form', title, `
      <form onsubmit="Pages._saveProduct(event,'${productId || ''}')">
        <div class="form-row cols-2">
          <div class="form-group">
            <label class="form-label required">${t('product_name')}</label>
            <input type="text" class="form-control" name="name" value="${v.name || ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">${t('icon_emoji')}</label>
            <input type="text" class="form-control" name="icon" value="${v.icon || '📦'}" placeholder="📦">
          </div>
        </div>
        <div class="form-row cols-2">
          <div class="form-group">
            <label class="form-label">${t('barcode')}</label>
            <div style="display:flex;gap:6px">
              <input type="text" class="form-control" name="barcode" id="barcode-input" value="${v.barcode || ''}">
              <button type="button" class="btn btn-primary" onclick="Pages._scanProductBarcode()" title="${t('scan_camera')}"><i class="fa fa-camera"></i></button>
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('barcode-input').value=Date.now()">${t('generate')}</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">${t('unit')}</label>
            <select class="form-control" name="unit">
              ${['قطعة','كيلو','لتر','متر','علبة','كرتون','زجاجة','كيس','جهاز'].map(u => `<option ${v.unit===u?'selected':''}>${u}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row cols-2">
          <div class="form-group">
            <label class="form-label">${t('category')}</label>
            <select class="form-control" name="categoryId">
              <option value="">${t('uncategorized')}</option>
              ${categories.map(c => `<option value="${c.id}" ${v.categoryId===c.id?'selected':''}>${c.icon||''} ${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">${t('warehouse')}</label>
            <select class="form-control" name="warehouseId">
              ${warehouses.map(w => `<option value="${w.id}" ${v.warehouseId===w.id?'selected':''}>${w.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row cols-3">
          <div class="form-group">
            <label class="form-label required">${t('buy_price')}</label>
            <input type="number" class="form-control" name="buyPrice" value="${v.buyPrice || ''}" step="0.01" min="0" required>
          </div>
          <div class="form-group">
            <label class="form-label required">${t('retail_price')}</label>
            <input type="number" class="form-control" name="sellPrice" value="${v.sellPrice || ''}" step="0.01" min="0" required>
          </div>
          <div class="form-group">
            <label class="form-label">${t('wholesale_price')}</label>
            <input type="number" class="form-control" name="price2" value="${v.price2 || ''}" step="0.01" min="0">
          </div>
        </div>
        <div class="form-row cols-3">
          <div class="form-group">
            <label class="form-label">${t('current_stock')}</label>
            <input type="number" class="form-control" name="stock" value="${v.stock || 0}" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">${t('min_stock')}</label>
            <input type="number" class="form-control" name="minStock" value="${v.minStock || 5}" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">${t('status')}</label>
            <select class="form-control" name="active">
              <option value="true" ${v.active!==false?'selected':''}>${t('active')}</option>
              <option value="false" ${v.active===false?'selected':''}>${t('inactive')}</option>
            </select>
          </div>
        </div>
        <div class="modal-footer" style="padding:0;margin-top:16px">
          <button type="button" class="btn btn-secondary" onclick="Modal.close('product-form')">${t('cancel')}</button>
          <button type="submit" class="btn btn-primary"><i class="fa fa-save"></i> ${t('save')}</button>
        </div>
      </form>
    `, 'modal-lg');
  },

  _scanProductBarcode() {
    App.Scanner.open((decodedText) => {
      const input = document.getElementById('barcode-input');
      if (input) {
        input.value = decodedText;
        Toast.show('تم التقاط الباركود بنجاح!', 'success');
      }
    });
  },

  async _saveProduct(e, productId) {
    const t = window.t || (k => k);
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    data.tenantId = App.state.tenant.id;
    data.buyPrice = parseFloat(data.buyPrice) || 0;
    data.sellPrice = parseFloat(data.sellPrice) || 0;
    data.price2 = parseFloat(data.price2) || 0;
    data.stock = parseInt(data.stock) || 0;
    data.minStock = parseInt(data.minStock) || 5;
    data.active = data.active === 'true';
    if (productId) {
      data.id = productId;
      await window.db.put('products', data);
      Toast.show(t('product_edited'), 'success');
    } else {
      const limitExceeded = await this._checkLimitExceeded('products', 15);
      if (limitExceeded) {
        Toast.show('لقد تجاوزت الحد المسموح به لهذه الباقة (15 صنف)، يرجى ترقية الحساب للباقة الاحترافية!', 'warning', 6000);
        return;
      }
      await window.db.add('products', data);
      Toast.show(t('product_added'), 'success');
    }
    Modal.close('product-form');
    this.products();
  },

  async _deleteProduct(id) {
    const t = window.t || (k => k);
    Modal.confirm(t('delete_product'), t('confirm_delete_product'), async () => {
      await window.db.delete('products', id);
      Toast.show(t('product_deleted'), 'success');
      this.products();
    });
  },

  _showBarcode(id, code, name) {
    Modal.open('barcode-modal', `باركود: ${name}`, `
      <div style="text-align:center">
        <canvas id="barcode-canvas" width="300" height="80" style="border:1px solid var(--border);border-radius:8px;background:white"></canvas>
        <p style="margin-top:8px;font-size:12px;color:var(--text-muted)">${code}</p>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:16px">
          <button class="btn btn-secondary btn-sm" onclick="window.print()"><i class="fa fa-print"></i> طباعة</button>
        </div>
      </div>
    `, 'modal-sm');
    setTimeout(() => {
      const canvas = document.getElementById('barcode-canvas');
      if (canvas) Barcode.generate(code, canvas);
    }, 100);
  },

  async _stockAdjust(productId) {
    const product = await window.db.get('products', productId);
    Modal.open('stock-adjust', `تعديل مخزون: ${product?.name}`, `
      <form onsubmit="Pages._saveStockAdjust(event,'${productId}')">
        <div class="alert alert-info">
          <i class="fa fa-info-circle"></i>
          <span>المخزون الحالي: <strong>${product?.stock || 0} ${product?.unit || ''}</strong></span>
        </div>
        <div class="form-group">
          <label class="form-label required">نوع العملية</label>
          <select class="form-control" name="direction">
            <option value="in">إضافة (وارد)</option>
            <option value="out">خصم (صادر)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label required">الكمية</label>
          <input type="number" class="form-control" name="qty" min="1" required>
        </div>
        <div class="form-group">
          <label class="form-label">السبب</label>
          <input type="text" class="form-control" name="reason" placeholder="مثال: جرد - تلف - هدية">
        </div>
        <div class="modal-footer" style="padding:0;margin-top:16px">
          <button type="button" class="btn btn-secondary" onclick="Modal.close('stock-adjust')">إلغاء</button>
          <button type="submit" class="btn btn-primary">تأكيد</button>
        </div>
      </form>
    `, 'modal-sm');
  },

  async _saveStockAdjust(e, productId) {
    const t = window.t || (k => k);
    e.preventDefault();
    const fd = new FormData(e.target);
    const direction = fd.get('direction');
    const qty = parseInt(fd.get('qty')) || 0;
    const reason = fd.get('reason') || 'تعديل يدوي';
    await window.db.updateProductStock(App.state.tenant.id, productId, qty, direction, 'adjust', reason);
    Toast.show(t('stock_adjust_success'), 'success');
    Modal.close('stock-adjust');
    this.products();
  },

  async _exportProducts() {
    const t = window.t || (k => k);
    const products = await window.db.getTenantData('products', App.state.tenant.id);
    Export.toCSV(['name','barcode','sellPrice','buyPrice','stock','unit'], products, 'products-' + new Date().toISOString().slice(0,10));
    Toast.show(t('export_products_success'), 'success');
  },

  // ══════════════════════════════════════════
  //  CUSTOMERS
  // ══════════════════════════════════════════
  async customers() {
    const t = window.t || (k => k);
    const pc = document.getElementById('page-content');
    const tenantId = App.state.tenant.id;
    const customers = await window.db.getTenantData('customers', tenantId);
    const typeLabels = { retail: t('retail'), wholesale: t('wholesale'), vip: t('vip') };
    pc.innerHTML = `
      <div class="fade-in">
        <div class="table-toolbar">
          <div class="search-box">
            <input type="text" placeholder="${t('search') || 'بحث...'}" oninput="Pages._filterTable('cust-table',this.value,['name','phone','code'])">
            <i class="fa fa-search"></i>
          </div>
          <button class="btn btn-secondary" onclick="Pages._exportCustomers()"><i class="fa fa-file-excel"></i> ${t('export')}</button>
          <button class="btn btn-primary" onclick="Pages.customerForm()"><i class="fa fa-plus"></i> ${t('new_customer')}</button>
        </div>
        <div class="table-wrapper">
          <table class="table" id="cust-table">
            <thead><tr><th>${t('code')}</th><th>${t('name')}</th><th>${t('phone')}</th><th>${t('type')}</th><th>${t('balance')}</th><th>${t('credit_limit')}</th><th>${t('status')}</th><th>${t('actions')}</th></tr></thead>
            <tbody>
              ${customers.map(c => `
                <tr data-name="${c.name}" data-phone="${c.phone||''}" data-code="${c.code||''}">
                  <td><code style="font-size:12px">${c.code || '—'}</code></td>
                  <td><strong>${c.name}</strong></td>
                  <td dir="ltr">${c.phone || '—'}</td>
                  <td><span class="badge ${c.type==='vip'?'badge-warning':c.type==='wholesale'?'badge-info':'badge-secondary'}">${typeLabels[c.type]||c.type}</span></td>
                  <td class="${(c.balance||0)<0 ? 'text-success' : ((c.balance||0)>0 ? 'text-danger' : '')}" style="color:${(c.balance||0)<0?'var(--success)':(c.balance||0)>0?'var(--danger)':''}">
                    ${Fmt.currency(c.balance || 0)}
                  </td>
                  <td>${Fmt.currency(c.creditLimit || 0)}</td>
                  <td><span class="badge ${c.active?'badge-success':'badge-secondary'}">${c.active?t('active'):t('inactive')}</span></td>
                  <td>
                    <div class="actions">
                      <button class="btn btn-secondary btn-sm" onclick="Pages.customerForm('${c.id}')"><i class="fa fa-edit"></i></button>
                      <button class="btn btn-secondary btn-sm" onclick="Pages._customerStatement('${c.id}')"><i class="fa fa-file-alt"></i></button>
                      <button class="btn btn-danger btn-sm" onclick="Pages._deleteCustomer('${c.id}')"><i class="fa fa-trash"></i></button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async customerForm(customerId = null) {
    const t = window.t || (k => k);
    const customer = customerId ? await window.db.get('customers', customerId) : null;
    const v = customer || {};
    const tenantId = App.state.tenant.id;
    const allCustomers = await window.db.getTenantData('customers', tenantId);
    const nextCode = NumGen.customer(allCustomers.length);
    Modal.open('customer-form', customer ? t('edit_customer') : t('new_customer'), `
      <form onsubmit="Pages._saveCustomer(event,'${customerId||''}')">
        <div class="form-row cols-2">
          <div class="form-group">
            <label class="form-label required">${t('customer_name')}</label>
            <input type="text" class="form-control" name="name" value="${v.name||''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">${t('code')}</label>
            <input type="text" class="form-control" name="code" value="${v.code||nextCode}">
          </div>
        </div>
        <div class="form-row cols-2">
          <div class="form-group">
            <label class="form-label">${t('phone')}</label>
            <input type="tel" class="form-control" name="phone" value="${v.phone||''}" dir="ltr">
          </div>
          <div class="form-group">
            <label class="form-label">${t('customer_type')}</label>
            <select class="form-control" name="type">
              <option value="retail" ${v.type==='retail'?'selected':''}>${t('retail')}</option>
              <option value="wholesale" ${v.type==='wholesale'?'selected':''}>${t('wholesale')}</option>
              <option value="vip" ${v.type==='vip'?'selected':''}>${t('vip')}</option>
            </select>
          </div>
        </div>
        <div class="form-row cols-2">
          <div class="form-group">
            <label class="form-label">${t('credit_limit')}</label>
            <input type="number" class="form-control" name="creditLimit" value="${v.creditLimit||0}" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">${t('opening_balance')}</label>
            <input type="number" class="form-control" name="balance" value="${v.balance||0}" step="0.01">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">${t('address')}</label>
          <input type="text" class="form-control" name="address" value="${v.address||''}">
        </div>
        <div class="modal-footer" style="padding:0;margin-top:16px">
          <button type="button" class="btn btn-secondary" onclick="Modal.close('customer-form')">${t('cancel')}</button>
          <button type="submit" class="btn btn-primary"><i class="fa fa-save"></i> ${t('save')}</button>
        </div>
      </form>
    `);
  },

  async _saveCustomer(e, customerId) {
    const t = window.t || (k => k);
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    data.tenantId = App.state.tenant.id;
    data.creditLimit = parseFloat(data.creditLimit) || 0;
    data.balance = parseFloat(data.balance) || 0;
    data.active = true;
    if (customerId) { 
      data.id = customerId; 
      await window.db.put('customers', data); 
      Toast.show(t('customer_updated'), 'success'); 
    } else { 
      const limitExceeded = await this._checkLimitExceeded('customers', 5);
      if (limitExceeded) {
        Toast.show('لقد تجاوزت الحد المسموح به للعملاء لهذه الباقة (5 عملاء)، يرجى ترقية الحساب للباقة الاحترافية!', 'warning', 6000);
        return;
      }
      await window.db.add('customers', data); 
      Toast.show(t('customer_added'), 'success'); 
    }
    Modal.close('customer-form');
    this.customers();
  },

  async _deleteCustomer(id) {
    const t = window.t || (k => k);
    Modal.confirm(t('delete_customer'), t('are_you_sure'), async () => {
      await window.db.delete('customers', id);
      Toast.show(t('deleted_successfully'), 'success');
      this.customers();
    });
  },

  async _customerStatement(customerId) {
    const t = window.t || (k => k);
    const customer = await window.db.get('customers', customerId);
    const invoices = await window.db.getTenantData('invoices', App.state.tenant.id);
    const custInvoices = invoices.filter(i => i.customerId === customerId).sort((a,b) => new Date(a.date)-new Date(b.date));
    Modal.open('cust-statement', `${t('account_statement')} ${customer?.name}`, `
      <div>
        <div style="display:flex;gap:16px;margin-bottom:16px">
          <div class="card" style="flex:1;text-align:center">
            <div class="kpi-value" style="font-size:20px">${Fmt.currency(customer?.balance||0)}</div>
            <div class="kpi-label">${t('current_balance')}</div>
          </div>
          <div class="card" style="flex:1;text-align:center">
            <div class="kpi-value" style="font-size:20px">${custInvoices.length}</div>
            <div class="kpi-label">${t('invoices_count')}</div>
          </div>
          <div class="card" style="flex:1;text-align:center">
            <div class="kpi-value" style="font-size:20px">${Fmt.currency(custInvoices.reduce((s,i)=>s+(i.total||0),0))}</div>
            <div class="kpi-label">${t('total_transactions')}</div>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="table">
            <thead><tr><th>${t('date')}</th><th>${t('invoice_number')}</th><th>${t('amount')}</th><th>${t('status')}</th></tr></thead>
            <tbody>
              ${custInvoices.map(inv => `
                <tr>
                  <td>${Fmt.date(inv.date)}</td>
                  <td><code style="font-size:12px">${inv.number||inv.id}</code></td>
                  <td>${Fmt.currency(inv.total)}</td>
                  <td><span class="badge ${inv.status==='completed'?'badge-success':'badge-warning'}">${inv.status==='completed'?t('completed'):t('pending')}</span></td>
                </tr>
              `).join('') || `<tr><td colspan="4" class="text-center text-muted">${t('no_transactions')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `, 'modal-lg');
  },

  async _exportCustomers() {
    const customers = await window.db.getTenantData('customers', App.state.tenant.id);
    Export.toCSV(['code','name','phone','type','balance','creditLimit','address'], customers, 'customers');
    Toast.show('تم التصدير', 'success');
  },

  // ══════════════════════════════════════════
  //  SALES INVOICES
  // ══════════════════════════════════════════
  async sales() {
    const t = window.t || (k => k);
    const pc = document.getElementById('page-content');
    const tenantId = App.state.tenant.id;
    const [invoices, customers] = await Promise.all([
      window.db.getInvoicesByType(tenantId, 'sale'),
      window.db.getTenantData('customers', tenantId),
    ]);
    const custMap = {};
    customers.forEach(c => custMap[c.id] = c);
    const sorted = invoices.sort((a, b) => new Date(b.date) - new Date(a.date));
    pc.innerHTML = `
      <div class="fade-in">
        <div class="table-toolbar">
          <div class="search-box">
            <input type="text" placeholder="${t('search_invoice') || 'بحث برقم الفاتورة أو العميل...'}" oninput="Pages._filterTable('sales-table',this.value,['number','customerName'])">
            <i class="fa fa-search"></i>
          </div>
          <button class="btn btn-primary" onclick="App.navigate('pos')"><i class="fa fa-plus"></i> ${t('new_invoice')}</button>
        </div>
        <div class="table-wrapper">
          <table class="table" id="sales-table">
            <thead>
              <tr><th>${t('invoice_number')}</th><th>${t('customer')}</th><th>${t('date')}</th><th>${t('total')}</th><th>${t('paid')}</th><th>${t('remaining')}</th><th>${t('payment_method')}</th><th>${t('status')}</th><th>${t('actions')}</th></tr>
            </thead>
            <tbody>
              ${sorted.map(inv => {
                const cust = custMap[inv.customerId];
                const payLabels = { cash: t('pay_cash'), card: t('pay_card'), transfer: t('pay_transfer'), credit: t('pay_credit') };
                return `
                  <tr data-number="${inv.number||inv.id}" data-customername="${cust?.name||t('cash_customer')}">
                    <td><code style="font-size:12px">${inv.number || inv.id.slice(-8)}</code></td>
                    <td>${cust?.name || `<span class="text-muted">${t('cash_customer')}</span>`}</td>
                    <td>${Fmt.date(inv.date)}</td>
                    <td><strong>${Fmt.currency(inv.total)}</strong></td>
                    <td class="text-success">${Fmt.currency(inv.paid)}</td>
                    <td class="${(inv.remaining||0)>0?'text-danger':''}">${Fmt.currency(inv.remaining||0)}</td>
                    <td><span class="badge badge-secondary">${payLabels[inv.paymentMethod]||'—'}</span></td>
                    <td><span class="badge ${inv.status==='completed'?'badge-success':'badge-warning'}">${inv.status==='completed'?t('completed'):t('pending')}</span></td>
                    <td>
                      <div class="actions">
                        <button class="btn btn-secondary btn-sm" onclick="Pages.viewInvoice('${inv.id}')" title="${t('view')}"><i class="fa fa-eye"></i></button>
                        <button class="btn btn-secondary btn-sm" onclick="Pages._printInvoice('${inv.id}', 'a4')" title="${t('print_a4')}"><i class="fa fa-file-pdf"></i></button>
                        <button class="btn btn-secondary btn-sm" onclick="Pages._printInvoice('${inv.id}', 'thermal')" title="${t('print_thermal')}"><i class="fa fa-receipt"></i></button>
                        ${App.state.user.role !== 'cashier' ? `<button class="btn btn-danger btn-sm" onclick="Pages._deleteInvoice('${inv.id}')" title="${t('delete')}"><i class="fa fa-trash"></i></button>` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async viewInvoice(invoiceId) {
    const t = window.t || (k => k);
    const inv = await window.db.get('invoices', invoiceId);
    if (!inv) return;
    const [items, customer, products] = await Promise.all([
      window.db.getInvoiceItems(invoiceId),
      inv.customerId ? window.db.get('customers', inv.customerId) : null,
      window.db.getTenantData('products', App.state.tenant.id),
    ]);
    const prodMap = {};
    products.forEach(p => prodMap[p.id] = p);
    Modal.open('view-invoice', `${t('invoice_colon')} ${inv.number || inv.id.slice(-8)}`, `
      <div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div>
            <div class="form-label">${t('customer')}</div>
            <div style="font-weight:700">${customer?.name || t('cash_customer')}</div>
            <div style="font-size:12px;color:var(--text-muted)">${customer?.phone || ''}</div>
          </div>
          <div>
            <div class="form-label">${t('date')}</div>
            <div style="font-weight:700">${Fmt.dateTime(inv.date)}</div>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="table">
            <thead><tr><th>${t('product')}</th><th>${t('qty')}</th><th>${t('price')}</th><th>${t('total')}</th></tr></thead>
            <tbody>
              ${items.map(item => {
                const p = prodMap[item.productId];
                return `<tr>
                  <td>${p?.icon || '📦'} ${p?.name || item.productId}</td>
                  <td>${item.qty} ${p?.unit || ''}</td>
                  <td>${Fmt.currency(item.price)}</td>
                  <td><strong>${Fmt.currency(item.total)}</strong></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div style="max-width:240px;margin-right:auto;margin-top:12px;margin-left:0">
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px"><span>${t('subtotal')}</span><span>${Fmt.currency(inv.subtotal)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px"><span>${t('tax')}</span><span>${Fmt.currency(inv.tax)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:16px;font-weight:800;border-top:1px solid var(--border)"><span>${t('total')}</span><span class="text-success">${Fmt.currency(inv.total)}</span></div>
        </div>
        <div style="margin-top:16px;display:flex;gap:8px">
          <button class="btn btn-secondary" onclick="Pages._printInvoice('${invoiceId}')"><i class="fa fa-print"></i> ${t('print')}</button>
        </div>
      </div>
    `, 'modal-lg');
  },

  async _printInvoice(invoiceId, format = 'thermal') {
    const inv = await window.db.get('invoices', invoiceId);
    const items = await window.db.getInvoiceItems(invoiceId);
    const products = await window.db.getTenantData('products', App.state.tenant.id);
    const prodMap = {};
    products.forEach(p => prodMap[p.id] = p);
    const customer = inv.customerId ? await window.db.get('customers', inv.customerId) : null;
    const enrichedItems = items.map(i => ({ ...i, name: prodMap[i.productId]?.name || i.productId }));
    Print.invoice(inv, enrichedItems, customer, App.state.tenant, format);
  },

  async _deleteInvoice(id) {
    const t = window.t || (k => k);
    Modal.confirm(t('delete_invoice'), t('delete_invoice_confirm'), async () => {
      await window.db.delete('invoices', id);
      Toast.show(t('deleted_successfully'), 'success');
      this.sales();
    });
  },

  // ══════════════════════════════════════════
  //  SUPPLIERS
  // ══════════════════════════════════════════
  async suppliers() {
    const t = window.t || (k => k);
    const tenantId = App.state.tenant.id;
    const suppliers = await window.db.getTenantData('suppliers', tenantId);
    document.getElementById('page-content').innerHTML = `
      <div class="fade-in">
        <div class="table-toolbar">
          <div class="search-box">
            <input type="text" placeholder="${t('search') || 'بحث...'}" oninput="Pages._filterTable('supp-table',this.value,['name','code','phone'])">
            <i class="fa fa-search"></i>
          </div>
          <button class="btn btn-primary" onclick="Pages.supplierForm()"><i class="fa fa-plus"></i> ${t('new_supplier')}</button>
        </div>
        <div class="table-wrapper">
          <table class="table" id="supp-table">
            <thead><tr><th>${t('code')}</th><th>${t('name')}</th><th>${t('phone')}</th><th>${t('address')}</th><th>${t('balance')}</th><th>${t('credit_limit') || 'الحد الائتماني'}</th><th>${t('status')}</th><th>${t('actions')}</th></tr></thead>
            <tbody>
              ${suppliers.map(s => `
                <tr data-name="${s.name}" data-code="${s.code||''}" data-phone="${s.phone||''}">
                  <td><code style="font-size:12px">${s.code||'—'}</code></td>
                  <td><strong>${s.name}</strong></td>
                  <td dir="ltr">${s.phone||'—'}</td>
                  <td>${s.address||'—'}</td>
                  <td class="${(s.balance||0)>0 ? 'text-danger' : ((s.balance||0)<0 ? 'text-success' : '')}">
                    ${Fmt.currency(s.balance||0)}
                  </td>
                  <td>${Fmt.currency(s.creditLimit||0)}</td>
                  <td><span class="badge ${s.active?'badge-success':'badge-secondary'}">${s.active?t('active'):t('inactive')}</span></td>
                  <td><div class="actions">
                    <button class="btn btn-secondary btn-sm" onclick="Pages.supplierForm('${s.id}')"><i class="fa fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="Pages._deleteSupplier('${s.id}')"><i class="fa fa-trash"></i></button>
                  </div></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async supplierForm(supplierId = null) {
    const t = window.t || (k => k);
    const supplier = supplierId ? await window.db.get('suppliers', supplierId) : null;
    const v = supplier || {};
    const allSuppliers = await window.db.getTenantData('suppliers', App.state.tenant.id);
    Modal.open('supplier-form', supplier ? t('edit_supplier') : t('new_supplier'), `
      <form onsubmit="Pages._saveSupplier(event,'${supplierId||''}')">
        <div class="form-row cols-2">
          <div class="form-group"><label class="form-label required">${t('supplier_name')}</label><input type="text" class="form-control" name="name" value="${v.name||''}" required></div>
          <div class="form-group"><label class="form-label">${t('code')}</label><input type="text" class="form-control" name="code" value="${v.code||NumGen.supplier(allSuppliers.length)}"></div>
        </div>
        <div class="form-row cols-2">
          <div class="form-group"><label class="form-label">${t('phone')}</label><input type="tel" class="form-control" name="phone" value="${v.phone||''}" dir="ltr"></div>
          <div class="form-group"><label class="form-label">${t('address')}</label><input type="text" class="form-control" name="address" value="${v.address||''}"></div>
        </div>
        <div class="form-row cols-2">
          <div class="form-group"><label class="form-label">${t('opening_balance')}</label><input type="number" class="form-control" name="balance" value="${v.balance||0}" step="0.01"></div>
          <div class="form-group"><label class="form-label">${t('credit_limit') || 'الحد الائتماني'}</label><input type="number" class="form-control" name="creditLimit" value="${v.creditLimit||0}" min="0"></div>
        </div>
        <div class="modal-footer" style="padding:0;margin-top:16px">
          <button type="button" class="btn btn-secondary" onclick="Modal.close('supplier-form')">${t('cancel')}</button>
          <button type="submit" class="btn btn-primary"><i class="fa fa-save"></i> ${t('save')}</button>
        </div>
      </form>
    `);
  },

  async _saveSupplier(e, supplierId) {
    const t = window.t || (k => k);
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    data.tenantId = App.state.tenant.id;
    data.balance = parseFloat(data.balance) || 0;
    data.creditLimit = parseFloat(data.creditLimit) || 0;
    data.active = true;
    if (supplierId) { 
      data.id = supplierId; 
      await window.db.put('suppliers', data); 
      Toast.show(t('saved'), 'success');
    } else { 
      const limitExceeded = await this._checkLimitExceeded('suppliers', 5);
      if (limitExceeded) {
        Toast.show('لقد تجاوزت الحد المسموح به للموردين لهذه الباقة (5 موردين)، يرجى ترقية الحساب للباقة الاحترافية!', 'warning', 6000);
        return;
      }
      await window.db.add('suppliers', data); 
      Toast.show(t('saved'), 'success');
    }
    Modal.close('supplier-form');
    this.suppliers();
  },

  async _deleteSupplier(id) {
    const t = window.t || (k => k);
    Modal.confirm(t('delete_supplier'), t('are_you_sure'), async () => {
      await window.db.delete('suppliers', id);
      Toast.show(t('deleted_successfully'), 'success');
      this.suppliers();
    });
  },

  // ══════════════════════════════════════════
  //  WAREHOUSES
  // ══════════════════════════════════════════
  async warehouses() {
    const tenantId = App.state.tenant.id;
    const warehouses = await window.db.getTenantData('warehouses', tenantId);
    document.getElementById('page-content').innerHTML = `
      <div class="fade-in">
        <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
          <button class="btn btn-primary" onclick="Pages.warehouseForm()"><i class="fa fa-plus"></i> مخزن جديد</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">
          ${warehouses.map(w => `
            <div class="card">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
                <div style="width:48px;height:48px;background:linear-gradient(135deg,var(--primary),var(--secondary));border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px">🏭</div>
                <div>
                  <div style="font-weight:700;font-size:15px">${w.name}</div>
                  <div style="font-size:12px;color:var(--text-muted)"><i class="fa fa-map-marker-alt"></i> ${w.location||'—'}</div>
                </div>
              </div>
              <div style="display:flex;gap:8px;margin-top:12px">
                <button class="btn btn-secondary btn-sm" onclick="Pages.warehouseForm('${w.id}')"><i class="fa fa-edit"></i> تعديل</button>
                <span class="badge ${w.active?'badge-success':'badge-secondary'}">${w.active?'نشط':'معطل'}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  async warehouseForm(warehouseId = null) {
    const wh = warehouseId ? await window.db.get('warehouses', warehouseId) : null;
    const v = wh || {};
    Modal.open('wh-form', wh ? 'تعديل مخزن' : 'مخزن جديد', `
      <form onsubmit="Pages._saveWarehouse(event,'${warehouseId||''}')">
        <div class="form-group"><label class="form-label required">اسم المخزن</label><input type="text" class="form-control" name="name" value="${v.name||''}" required></div>
        <div class="form-group"><label class="form-label">الموقع</label><input type="text" class="form-control" name="location" value="${v.location||''}"></div>
        <div class="modal-footer" style="padding:0;margin-top:16px">
          <button type="button" class="btn btn-secondary" onclick="Modal.close('wh-form')">إلغاء</button>
          <button type="submit" class="btn btn-primary"><i class="fa fa-save"></i> حفظ</button>
        </div>
      </form>
    `, 'modal-sm');
  },

  async _saveWarehouse(e, whId) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    data.tenantId = App.state.tenant.id;
    data.active = true;
    if (whId) { data.id = whId; await window.db.put('warehouses', data); }
    else { await window.db.add('warehouses', data); }
    Toast.show('تم حفظ المخزن', 'success');
    Modal.close('wh-form');
    this.warehouses();
  },

  // ══════════════════════════════════════════
  //  CATEGORIES
  // ══════════════════════════════════════════
  async categories() {
    const t = window.t || (k => k);
    const tenantId = App.state.tenant.id;
    const categories = await window.db.getTenantData('categories', tenantId);
    document.getElementById('page-content').innerHTML = `
      <div class="fade-in">
        <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
          <button class="btn btn-primary" onclick="Pages.categoryForm()"><i class="fa fa-plus"></i> ${t('new_category')}</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">
          ${categories.map(c => `
            <div class="card" style="text-align:center;cursor:pointer" onclick="Pages.categoryForm('${c.id}')">
              <div style="font-size:40px;margin-bottom:8px">${c.icon||'📁'}</div>
              <div style="font-weight:700;font-size:14px">${c.name}</div>
              <div style="width:32px;height:4px;background:${c.color||'var(--primary)'};border-radius:99px;margin:8px auto 0"></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  async categoryForm(catId = null) {
    const t = window.t || (k => k);
    const cat = catId ? await window.db.get('categories', catId) : null;
    const v = cat || {};
    Modal.open('cat-form', cat ? t('edit_category') : t('new_category'), `
      <form onsubmit="Pages._saveCategory(event,'${catId||''}')">
        <div class="form-row cols-2">
          <div class="form-group"><label class="form-label required">${t('category_name')}</label><input type="text" class="form-control" name="name" value="${v.name||''}" required></div>
          <div class="form-group"><label class="form-label">${t('icon')}</label><input type="text" class="form-control" name="icon" value="${v.icon||'📁'}" placeholder="📁"></div>
        </div>
        <div class="form-group"><label class="form-label">${t('color')}</label><input type="color" name="color" value="${v.color||'#6366f1'}" style="width:100%;height:44px;border:1px solid var(--border);border-radius:8px;background:var(--bg-elevated);cursor:pointer"></div>
        <div class="modal-footer" style="padding:0;margin-top:16px">
          <button type="button" class="btn btn-secondary" onclick="Modal.close('cat-form')">${t('cancel')}</button>
          <button type="submit" class="btn btn-primary"><i class="fa fa-save"></i> ${t('save')}</button>
        </div>
      </form>
    `, 'modal-sm');
  },

  async _saveCategory(e, catId) {
    const t = window.t || (k => k);
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    data.tenantId = App.state.tenant.id;
    if (catId) { data.id = catId; await window.db.put('categories', data); }
    else { await window.db.add('categories', data); }
    Toast.show(t('saved'), 'success');
    Modal.close('cat-form');
    this.categories();
  },

  // ══════════════════════════════════════════
  //  REPORTS
  // ══════════════════════════════════════════
  async reports() {
    const t = window.t || (k => k);
    const pc = document.getElementById('page-content');
    pc.innerHTML = `
      <div class="fade-in">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h2>${t('reports')}</h2>
        </div>
        
        <div class="table-toolbar" style="margin-bottom:20px;display:flex;gap:12px;background:var(--bg-elevated);padding:16px;border-radius:12px">
          <div style="flex:1">
            <label class="form-label">${t('report_type')}</label>
            <select id="report-type" class="form-control" onchange="Pages._loadReport()">
              <option value="dashboard">${t('rep_dashboard')}</option>
              <option value="sales">${t('rep_sales')}</option>
              <option value="purchases">${t('rep_purchases')}</option>
              <option value="inventory">${t('rep_inventory')}</option>
              <option value="pl">${t('rep_pl')}</option>
              <option value="customers">${t('rep_customers')}</option>
              <option value="suppliers">${t('rep_suppliers')}</option>
              <option value="expenses">${t('rep_expenses')}</option>
            </select>
          </div>
          <div style="flex:1">
            <label class="form-label">${t('date_from')}</label>
            <input type="date" id="report-date-from" class="form-control" onchange="Pages._loadReport()">
          </div>
          <div style="flex:1">
            <label class="form-label">${t('date_to')}</label>
            <input type="date" id="report-date-to" class="form-control" onchange="Pages._loadReport()">
          </div>
          <div style="display:flex;align-items:flex-end">
            <button class="btn btn-primary" onclick="Pages._loadReport()"><i class="fa fa-sync"></i> ${t('update')}</button>
            <button class="btn btn-success" style="margin-right:8px;margin-left:8px;" onclick="Pages._exportCurrentReport('excel')"><i class="fa fa-file-excel"></i> ${t('export_excel')}</button>
            <button class="btn btn-danger" onclick="Pages._exportCurrentReport('pdf')"><i class="fa fa-file-pdf"></i> ${t('export_pdf')}</button>
          </div>
        </div>

        <div id="report-container"></div>
      </div>
    `;
    
    // Set default dates to current month
    const now = new Date();
    document.getElementById('report-date-from').value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    document.getElementById('report-date-to').value = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    this._loadReport();
  },

  async _loadReport() {
// ... [No changes needed in _loadReport internals, skipping replacing all of it by using a precise chunk]
    const type = document.getElementById('report-type').value;
    const fromDate = new Date(document.getElementById('report-date-from').value);
    const toDate = new Date(document.getElementById('report-date-to').value);
    toDate.setHours(23, 59, 59, 999); // End of day

    const container = document.getElementById('report-container');
    container.innerHTML = '<div style="text-align:center;padding:40px"><i class="fa fa-spinner fa-spin fa-2x"></i> جاري إعداد التقرير...</div>';
    
    const tenantId = App.state.tenant.id;
    let html = '';
    window._currentReportData = null; // Store for export

    try {
      if (type === 'dashboard') {
        const [invoices, products, customers, expenses] = await Promise.all([
          window.db.getTenantData('invoices', tenantId),
          window.db.getTenantData('products', tenantId),
          window.db.getTenantData('customers', tenantId),
          window.db.getTenantData('expenses', tenantId),
        ]);
        
        const fInvoices = invoices.filter(i => new Date(i.date) >= fromDate && new Date(i.date) <= toDate);
        const fExpenses = expenses.filter(e => new Date(e.date) >= fromDate && new Date(e.date) <= toDate);
        
        const sales = fInvoices.filter(i => i.type === 'sale');
        const purchases = fInvoices.filter(i => i.type === 'purchase');
        
        const totalRevenue = sales.reduce((s, i) => s + (i.total || 0), 0);
        const totalCost = purchases.reduce((s, i) => s + (i.total || 0), 0);
        const totalExps = fExpenses.reduce((s, e) => s + (e.amount || 0), 0);
        const profit = totalRevenue - totalCost - totalExps;
        
        const topCustomers = customers.map(c => ({
          ...c, total: sales.filter(i => i.customerId === c.id).reduce((s, i) => s + (i.total || 0), 0)
        })).sort((a, b) => b.total - a.total).slice(0, 5);

        window._currentReportData = {
          name: 'Dashboard',
          headers: [t('report_type'), t('value')],
          rows: [
            [t('total_sales'), totalRevenue],
            [t('total_purchases'), totalCost],
            [t('expenses'), totalExps],
            [t('net_profit'), profit]
          ]
        };

        html = `
          <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap">
            <div class="card" style="flex:1;min-width:160px;text-align:center">
              <div class="kpi-value text-success" style="font-size:22px">${Fmt.currency(totalRevenue)}</div>
              <div class="kpi-label">${t('period_sales')}</div>
            </div>
            <div class="card" style="flex:1;min-width:160px;text-align:center">
              <div class="kpi-value text-danger" style="font-size:22px">${Fmt.currency(totalCost)}</div>
              <div class="kpi-label">${t('period_purchases')}</div>
            </div>
            <div class="card" style="flex:1;min-width:160px;text-align:center">
              <div class="kpi-value text-warning" style="font-size:22px">${Fmt.currency(totalExps)}</div>
              <div class="kpi-label">${t('period_expenses')}</div>
            </div>
            <div class="card" style="flex:1;min-width:160px;text-align:center">
              <div class="kpi-value" style="font-size:22px;color:${profit>=0?'var(--success)':'var(--danger)'}">${Fmt.currency(profit)}</div>
              <div class="kpi-label">${t('net_profit')}</div>
            </div>
          </div>
          <div class="card">
            <div class="card-title mb-16">${t('top_customers')}</div>
            ${topCustomers.length === 0 ? `<p class="text-muted">${t('no_sales_period')}</p>` : ''}
            ${topCustomers.map((c, i) => `
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
                <div style="width:28px;height:28px;background:var(--primary);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white">${i+1}</div>
                <div style="flex:1">
                  <div style="font-size:13px;font-weight:600">${c.name}</div>
                  <div class="progress" style="margin-top:4px">
                    <div class="progress-bar" style="width:${topCustomers[0].total>0?(c.total/topCustomers[0].total*100):0}%"></div>
                  </div>
                </div>
                <div style="font-weight:700;color:var(--success)">${Fmt.currency(c.total)}</div>
              </div>
            `).join('')}
          </div>
        `;
      } else if (type === 'sales' || type === 'purchases') {
        const invoices = await window.db.getTenantData('invoices', tenantId);
        const fInvoices = invoices.filter(i => i.type === (type==='sales'?'sale':'purchase') && new Date(i.date) >= fromDate && new Date(i.date) <= toDate);
        const parties = await window.db.getTenantData(type==='sales'?'customers':'suppliers', tenantId);
        const partyMap = {};
        parties.forEach(p => partyMap[p.id] = p.name);
        
        window._currentReportData = {
          name: type === 'sales' ? 'Sales_Report' : 'Purchases_Report',
          headers: [t('number'), t('date'), t('cust_supp'), t('total'), t('tax'), t('status')],
          rows: fInvoices.map(inv => [inv.number||'', new Date(inv.date).toLocaleDateString(), partyMap[inv.customerId]||t('cash_customer'), inv.total, inv.tax, inv.status])
        };

        html = `
          <div class="card">
            <div class="card-title mb-16">${type==='sales'?t('rep_sales'):t('rep_purchases')}</div>
            <table class="table">
              <thead><tr><th>${t('number')}</th><th>${t('date')}</th><th>${t('cust_supp')}</th><th>${t('tax')}</th><th>${t('total')}</th><th>${t('status')}</th></tr></thead>
              <tbody>
                ${fInvoices.map(inv => `
                  <tr>
                    <td>${inv.number || inv.id.substring(0,8)}</td>
                    <td><span dir="ltr">${Fmt.date(inv.date)}</span></td>
                    <td>${partyMap[inv.customerId] || t('cash_customer')}</td>
                    <td>${Fmt.currency(inv.tax)}</td>
                    <td>${Fmt.currency(inv.total)}</td>
                    <td>${inv.status==='completed'?t('completed'):inv.status==='pending'?t('pending'):t('cancelled')}</td>
                  </tr>
                `).join('')}
                ${fInvoices.length===0?`<tr><td colspan="6" style="text-align:center">${t('no_data')}</td></tr>`:''}
              </tbody>
            </table>
          </div>
        `;
      } else if (type === 'inventory') {
        const products = await window.db.getTenantData('products', tenantId);
        const cats = await window.db.getTenantData('categories', tenantId);
        const catMap = {}; cats.forEach(c => catMap[c.id] = c.name);
        
        let totalVal = 0;
        window._currentReportData = {
          name: 'Inventory_Report',
          headers: [t('code'), t('item'), t('category'), t('qty'), t('cost'), t('value')],
          rows: products.map(p => {
            const val = (parseFloat(p.stock)||0) * (parseFloat(p.buyPrice)||0);
            totalVal += val;
            return [p.barcode||'', p.name, catMap[p.categoryId]||'', p.stock||0, p.buyPrice||0, val];
          })
        };

        html = `
          <div style="display:flex;gap:12px;margin-bottom:20px">
            <div class="card" style="flex:1;text-align:center">
              <div class="kpi-value text-primary" style="font-size:24px">${products.length}</div>
              <div class="kpi-label">${t('registered_items')}</div>
            </div>
            <div class="card" style="flex:1;text-align:center">
              <div class="kpi-value text-success" style="font-size:24px">${Fmt.currency(totalVal)}</div>
              <div class="kpi-label">${t('total_inventory_value')}</div>
            </div>
          </div>
          <div class="card">
            <div class="card-title mb-16">${t('current_inventory')}</div>
            <div class="table-wrapper">
              <table class="table">
                <thead><tr><th>${t('code')}</th><th>${t('item')}</th><th>${t('qty')}</th><th>${t('unit_cost')}</th><th>${t('inventory_value')}</th></tr></thead>
                <tbody>
                  ${products.map(p => `
                    <tr>
                      <td>${p.barcode || '—'}</td>
                      <td>${p.name}</td>
                      <td><span style="font-weight:bold;color:${(p.stock||0)<=(p.minStock||0)?'var(--danger)':'inherit'}">${p.stock || 0}</span></td>
                      <td>${Fmt.currency(p.buyPrice)}</td>
                      <td>${Fmt.currency((parseFloat(p.stock)||0)*(parseFloat(p.buyPrice)||0))}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } else if (type === 'pl') {
        const invoices = await window.db.getTenantData('invoices', tenantId);
        const invItems = await window.db.getTenantData('invoiceItems', tenantId);
        const products = await window.db.getTenantData('products', tenantId);
        const expenses = await window.db.getTenantData('expenses', tenantId);
        
        const fInvoices = invoices.filter(i => new Date(i.date) >= fromDate && new Date(i.date) <= toDate);
        const fExpenses = expenses.filter(e => new Date(e.date) >= fromDate && new Date(e.date) <= toDate);
        
        const sales = fInvoices.filter(i => i.type === 'sale' && i.status === 'completed');
        let totalSales = 0;
        let cogs = 0; // Cost of Goods Sold
        
        const prodCostMap = {};
        products.forEach(p => prodCostMap[p.id] = parseFloat(p.buyPrice) || 0);

        for (const s of sales) {
          totalSales += (s.subtotal - (s.discount||0)); // Net sales excluding VAT
          const items = invItems.filter(itm => itm.invoiceId === s.id);
          items.forEach(itm => {
            cogs += (itm.qty * (prodCostMap[itm.productId] || 0));
          });
        }
        
        const totalExps = fExpenses.reduce((s, e) => s + (e.amount || 0), 0);
        const grossProfit = totalSales - cogs;
        const netProfit = grossProfit - totalExps;

        window._currentReportData = {
          name: 'Profit_Loss',
          headers: [t('item_name'), t('amount')],
          rows: [
            [t('sales_revenue'), totalSales],
            [t('cogs'), cogs],
            [t('gross_profit'), grossProfit],
            [t('expenses'), totalExps],
            [t('net_profit'), netProfit]
          ]
        };

        html = `
          <div class="card" style="max-width:600px;margin:0 auto">
            <h3 style="text-align:center;margin-bottom:20px;color:var(--primary)">${t('rep_pl')}</h3>
            <table class="table">
              <tbody>
                <tr>
                  <td>${t('sales_revenue_no_tax')}</td>
                  <td style="text-align:left;font-weight:bold">${Fmt.currency(totalSales)}</td>
                </tr>
                <tr>
                  <td>${t('deduct_cogs')}</td>
                  <td style="text-align:left;color:var(--danger)">(${Fmt.currency(cogs)})</td>
                </tr>
                <tr style="background:var(--bg-elevated)">
                  <td><strong>${t('gross_profit')}</strong></td>
                  <td style="text-align:left;font-weight:bold;color:var(--primary)">${Fmt.currency(grossProfit)}</td>
                </tr>
                <tr>
                  <td>${t('deduct_expenses')}</td>
                  <td style="text-align:left;color:var(--warning)">(${Fmt.currency(totalExps)})</td>
                </tr>
                <tr style="border-top:2px solid var(--border)">
                  <td style="font-size:18px"><strong>${t('net_profit_loss')}</strong></td>
                  <td style="text-align:left;font-size:18px;font-weight:bold;color:${netProfit>=0?'var(--success)':'var(--danger)'}">${Fmt.currency(netProfit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      } else if (type === 'customers' || type === 'suppliers') {
        const parties = await window.db.getTenantData(type, tenantId);
        let totalDebt = 0;
        
        window._currentReportData = {
          name: type === 'customers' ? 'Customers_Balances' : 'Suppliers_Balances',
          headers: [t('name'), t('phone'), t('balance_debt')],
          rows: parties.map(p => {
            const bal = parseFloat(p.balance)||0;
            totalDebt += bal;
            return [p.name, p.phone||'', bal];
          })
        };

        html = `
          <div class="card mb-16 text-center">
            <div class="kpi-value ${type==='customers'?'text-success':'text-danger'}" style="font-size:24px">${Fmt.currency(totalDebt)}</div>
            <div class="kpi-label">${type==='customers'?t('total_debts_customers'):t('total_debts_suppliers')}</div>
          </div>
          <div class="card">
            <div class="card-title mb-16">${type==='customers'?t('rep_customers'):t('rep_suppliers')}</div>
            <table class="table">
              <thead><tr><th>${t('name')}</th><th>${t('phone')}</th><th>${t('balance_debt')}</th></tr></thead>
              <tbody>
                ${parties.map(p => `
                  <tr>
                    <td>${p.name}</td>
                    <td dir="ltr">${p.phone||'—'}</td>
                    <td style="font-weight:bold;color:${(p.balance||0)>0?'var(--danger)':(p.balance||0)<0?'var(--success)':'inherit'}">${Fmt.currency(p.balance||0)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      } else if (type === 'expenses') {
        const expenses = await window.db.getTenantData('expenses', tenantId);
        const fExpenses = expenses.filter(e => new Date(e.date) >= fromDate && new Date(e.date) <= toDate);
        
        window._currentReportData = {
          name: 'Expenses_Report',
          headers: [t('date'), t('category'), t('amount'), t('description')],
          rows: fExpenses.map(e => [new Date(e.date).toLocaleDateString(), e.category, e.amount, e.description])
        };

        html = `
          <div class="card">
            <div class="card-title mb-16">${t('expense_record')}</div>
            <table class="table">
              <thead><tr><th>${t('date')}</th><th>${t('category')}</th><th>${t('description')}</th><th>${t('amount')}</th></tr></thead>
              <tbody>
                ${fExpenses.map(e => `
                  <tr>
                    <td><span dir="ltr">${Fmt.date(e.date)}</span></td>
                    <td>${e.category}</td>
                    <td>${e.description||'—'}</td>
                    <td style="color:var(--danger);font-weight:bold">${Fmt.currency(e.amount)}</td>
                  </tr>
                `).join('')}
                ${fExpenses.length===0?`<tr><td colspan="4" style="text-align:center">${t('no_expenses')}</td></tr>`:''}
              </tbody>
            </table>
          </div>
        `;
      }
    } catch (err) {
      console.error(err);
      html = `<div class="alert alert-danger">حدث خطأ أثناء إعداد التقرير: ${err.message}</div>`;
    }
    
    container.innerHTML = html;
  },

  _exportCurrentReport(format = 'excel') {
    const data = window._currentReportData;
    if (!data) {
      Toast.show('لا يوجد بيانات لتصديرها', 'warning');
      return;
    }
    
    const tenant = App.state.tenant || {};
    
    if (format === 'excel') {
      Export.toExcel(data.headers, data.rows, `${data.name}_${new Date().toISOString().slice(0,10)}`, tenant);
      Toast.show('تم التصدير بصيغة إكسيل بنجاح', 'success');
    } else if (format === 'pdf') {
      Export.toPDF(data.headers, data.rows, data.name, tenant);
      Toast.show('جاري التجهيز للطباعة (PDF)...', 'info');
    }
  },

  // ══════════════════════════════════════════
  //  FINANCE / EXPENSES / PAYMENTS
  // ══════════════════════════════════════════
  async finance() {
    const t = window.t || (k => k);
    const tenantId = App.state.tenant.id;
    const [invoices, expenses, payments] = await Promise.all([
      window.db.getTenantData('invoices', tenantId),
      window.db.getTenantData('expenses', tenantId),
      window.db.getTenantData('payments', tenantId),
    ]);
    const sales = invoices.filter(i => i.type === 'sale').reduce((s, i) => s + (i.total || 0), 0);
    const purchases = invoices.filter(i => i.type === 'purchase').reduce((s, i) => s + (i.total || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    document.getElementById('page-content').innerHTML = `
      <div class="fade-in">
        <div class="kpi-grid">
          <div class="kpi-card green"><div class="kpi-header"><div class="kpi-icon green"><i class="fa fa-arrow-down"></i></div></div><div class="kpi-value">${Fmt.currency(sales)}</div><div class="kpi-label">${t('total_revenues')}</div></div>
          <div class="kpi-card red"><div class="kpi-header"><div class="kpi-icon red"><i class="fa fa-arrow-up"></i></div></div><div class="kpi-value">${Fmt.currency(purchases)}</div><div class="kpi-label">${t('total_purchases')}</div></div>
          <div class="kpi-card orange"><div class="kpi-header"><div class="kpi-icon orange"><i class="fa fa-wallet"></i></div></div><div class="kpi-value">${Fmt.currency(totalExpenses)}</div><div class="kpi-label">${t('expenses')}</div></div>
          <div class="kpi-card blue"><div class="kpi-header"><div class="kpi-icon blue"><i class="fa fa-chart-line"></i></div></div><div class="kpi-value">${Fmt.currency(sales-purchases-totalExpenses)}</div><div class="kpi-label">${t('net_profit')}</div></div>
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">${t('expenses')}</div>
            <button class="btn btn-primary btn-sm" onclick="Pages.expenseForm()"><i class="fa fa-plus"></i> ${t('new_expense')}</button>
          </div>
          <div class="table-wrapper">
            <table class="table">
              <thead><tr><th>${t('date')}</th><th>${t('description')}</th><th>${t('category')}</th><th>${t('amount')}</th></tr></thead>
              <tbody>
                ${expenses.sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,10).map(e => `
                  <tr><td><span dir="ltr">${Fmt.date(e.date)}</span></td><td>${e.description||'—'}</td><td><span class="badge badge-secondary">${e.category||t('exp_general')}</span></td><td class="text-danger">${Fmt.currency(e.amount)}</td></tr>
                `).join('')||`<tr><td colspan="4" class="text-center text-muted">${t('no_expenses')}</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async expenseForm() {
    const t = window.t || (k => k);
    Modal.open('expense-form', t('new_expense'), `
      <form onsubmit="Pages._saveExpense(event)">
        <div class="form-group"><label class="form-label required">${t('description')}</label><input type="text" class="form-control" name="description" required></div>
        <div class="form-row cols-2">
          <div class="form-group">
            <label class="form-label">${t('category')}</label>
            <select class="form-control" name="category">
              <option value="${t('rent')}">${t('rent')}</option>
              <option value="${t('salaries')}">${t('salaries')}</option>
              <option value="${t('electricity')}">${t('electricity')}</option>
              <option value="${t('water')}">${t('water')}</option>
              <option value="${t('maintenance')}">${t('maintenance')}</option>
              <option value="${t('transportation')}">${t('transportation')}</option>
              <option value="${t('exp_general')}">${t('exp_general')}</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label required">${t('amount')}</label><input type="number" class="form-control" name="amount" min="0" step="0.01" required></div>
        </div>
        <div class="form-group"><label class="form-label">${t('date')}</label><input type="date" class="form-control" name="date" value="${new Date().toISOString().slice(0,10)}"></div>
        <div class="modal-footer" style="padding:0;margin-top:16px">
          <button type="button" class="btn btn-secondary" onclick="Modal.close('expense-form')">${t('cancel')}</button>
          <button type="submit" class="btn btn-primary"><i class="fa fa-save"></i> ${t('save')}</button>
        </div>
      </form>
    `, 'modal-sm');
  },

  async _saveExpense(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    data.tenantId = App.state.tenant.id;
    data.amount = parseFloat(data.amount) || 0;
    data.date = data.date || new Date().toISOString();
    await window.db.add('expenses', data);
    Toast.show('تم حفظ المصروف', 'success');
    Modal.close('expense-form');
    this.finance();
  },

  expenses() { this.finance(); },
  payments() { this.finance(); },

  // ══════════════════════════════════════════
  //  STOCK MOVES
  // ══════════════════════════════════════════
  async stockMoves() {
    const t = window.t || (k => k);
    const tenantId = App.state.tenant.id;
    const [moves, products] = await Promise.all([
      window.db.getStockMoves(tenantId),
      window.db.getTenantData('products', tenantId),
    ]);
    const prodMap = {};
    products.forEach(p => prodMap[p.id] = p);
    document.getElementById('page-content').innerHTML = `
      <div class="fade-in">
        <div class="table-wrapper">
          <table class="table">
            <thead><tr><th>${t('date')}</th><th>${t('item')}</th><th>${t('qty')}</th><th>${t('direction')}</th><th>${t('type')}</th><th>${t('reference')}</th></tr></thead>
            <tbody>
              ${moves.sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,100).map(m => {
                const p = prodMap[m.productId];
                return `<tr>
                  <td><span dir="ltr">${Fmt.dateTime(m.date)}</span></td>
                  <td>${p?.icon||'📦'} ${p?.name||m.productId}</td>
                  <td><strong>${m.qty} ${p?.unit||''}</strong></td>
                  <td><span class="badge ${m.direction==='in'?'badge-success':'badge-danger'}">${m.direction==='in'?t('inbound'):t('outbound')}</span></td>
                  <td><span class="badge badge-secondary">${m.type||'—'}</span></td>
                  <td><code style="font-size:11px">${m.ref||'—'}</code></td>
                </tr>`;
              }).join('')||`<tr><td colspan="6" class="text-center text-muted">${t('no_moves')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // ══════════════════════════════════════════
  //  USERS
  // ══════════════════════════════════════════
  async users() {
    const t = window.t || (k => k);
    if (App.state.user.role !== 'admin') {
      document.getElementById('page-content').innerHTML = `<div class="empty-state"><i class="fa fa-lock"></i><h3>${t('unauthorized')}</h3><p>${t('admins_only')}</p></div>`;
      return;
    }
    const users = await window.db.getByIndex('users', 'tenantId', App.state.tenant.id);
    const roleLabels = { admin: t('role_admin'), cashier: t('role_cashier'), storekeeper: t('role_storekeeper'), accountant: t('role_accountant'), sales: t('role_sales') };
    document.getElementById('page-content').innerHTML = `
      <div class="fade-in">
        <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
          <button class="btn btn-primary" onclick="Pages.userForm()"><i class="fa fa-plus"></i> ${t('new_user')}</button>
        </div>
        <div class="table-wrapper">
          <table class="table">
            <thead><tr><th>${t('name')}</th><th>${t('username')}</th><th>${t('role')}</th><th>${t('status')}</th><th>${t('actions')}</th></tr></thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td><div style="display:flex;align-items:center;gap:10px"><div class="user-avatar" style="width:32px;height:32px;font-size:13px">${u.name[0]}</div><strong>${u.name}</strong></div></td>
                  <td><code>${u.username}</code></td>
                  <td><span class="badge ${u.role==='admin'?'badge-danger':u.role==='cashier'?'badge-info':'badge-secondary'}">${roleLabels[u.role]||u.role}</span></td>
                  <td><span class="badge ${u.active?'badge-success':'badge-secondary'}">${u.active?t('active_user'):t('inactive_user')}</span></td>
                  <td><div class="actions">
                    <button class="btn btn-secondary btn-sm" onclick="Pages.userForm('${u.id}')"><i class="fa fa-edit"></i></button>
                    ${u.id!==App.state.user.id?`<button class="btn btn-danger btn-sm" onclick="Pages._deleteUser('${u.id}')"><i class="fa fa-trash"></i></button>`:''}
                  </div></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async userForm(userId = null) {
    const t = window.t || (k => k);
    const user = userId ? await window.db.get('users', userId) : null;
    const v = user || {};
    Modal.open('user-form', user ? t('edit_user') : t('new_user'), `
      <form onsubmit="Pages._saveUser(event,'${userId||''}')">
        <div class="form-row cols-2">
          <div class="form-group"><label class="form-label required">${t('full_name')}</label><input type="text" class="form-control" name="name" value="${v.name||''}" required></div>
          <div class="form-group"><label class="form-label required">${t('username')}</label><input type="text" class="form-control" name="username" value="${v.username||''}" required></div>
        </div>
        <div class="form-row cols-2">
          <div class="form-group"><label class="form-label ${userId?'':'required'}">${t('password')} ${userId?t('password_leave_blank'):''}</label><input type="password" class="form-control" name="password" ${userId?'':'required'}></div>
          <div class="form-group"><label class="form-label required">${t('role')}</label>
            <select class="form-control" name="role">
              <option value="admin" ${v.role==='admin'?'selected':''}>${t('role_admin')}</option>
              <option value="cashier" ${v.role==='cashier'?'selected':''}>${t('role_cashier')}</option>
              <option value="storekeeper" ${v.role==='storekeeper'?'selected':''}>${t('role_storekeeper')}</option>
              <option value="accountant" ${v.role==='accountant'?'selected':''}>${t('role_accountant')}</option>
              <option value="sales" ${v.role==='sales'?'selected':''}>${t('role_sales')}</option>
            </select>
          </div>
        </div>
        <div class="modal-footer" style="padding:0;margin-top:16px">
          <button type="button" class="btn btn-secondary" onclick="Modal.close('user-form')">${t('cancel')}</button>
          <button type="submit" class="btn btn-primary"><i class="fa fa-save"></i> ${t('save')}</button>
        </div>
      </form>
    `);
  },

  async _saveUser(e, userId) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    data.tenantId = App.state.tenant.id;
    data.active = true;
    if (userId) {
      const existing = await window.db.get('users', userId);
      if (!data.password) delete data.password;
      await window.db.put('users', { ...existing, ...data, id: userId });
      Toast.show('تم حفظ المستخدم', 'success');
      Modal.close('user-form');
      this.users();
    } else {
      const btn = e.target.querySelector('button[type="submit"]');
      const originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> جاري الحفظ...';

      try {
        const email = data.username.includes('@') ? data.username : `${data.username}@${App.state.tenant.code || 'hamd'}.com`;
        const res = await fetch('/api/create-user', {
          method: 'POST',
          body: JSON.stringify({
            email,
            password: data.password,
            username: data.username,
            name: data.name,
            role: data.role,
            tenantId: data.tenantId
          })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'حدث خطأ أثناء إنشاء المستخدم');
        Toast.show('تم إنشاء المستخدم وتأمينه بنجاح', 'success');
        Modal.close('user-form');
        this.users();
      } catch (err) {
        console.error(err);
        Toast.show(err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    }
  },

  async _deleteUser(id) {
    Modal.confirm('حذف مستخدم', 'هل أنت متأكد؟', async () => {
      try {
        const res = await fetch('/api/delete-user', {
          method: 'POST',
          body: JSON.stringify({ userId: id })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'حدث خطأ أثناء حذف المستخدم');
        Toast.show('تم حذف المستخدم بنجاح', 'success');
        this.users();
      } catch (err) {
        console.error(err);
        Toast.show(err.message, 'error');
      }
    });
  },

  // ══════════════════════════════════════════
  //  SETTINGS
  // ══════════════════════════════════════════
  async settings() {
    const t = window.t || (k => k);
    const tenant = App.state.tenant;

    const urlParams = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '');
    if (urlParams.get('success') === 'true') {
      // SECURITY FIX: this block used to trust mock_payment=true in the URL
      // and write plan:'pro' directly to Firestore for whatever tenant_id
      // was in the URL - anyone could type this URL by hand and grant ANY
      // tenant a free upgrade, bypassing Stripe entirely. Client-side code
      // must never grant itself a paid plan. The dev-only mock checkout
      // still redirects here to show the toast, but no longer writes to
      // Firestore - real upgrades only happen server-side in
      // api/stripe-webhook.js after Stripe verifies an actual payment.
      setTimeout(() => {
        Toast.show('تمت ترقية الحساب للباقة الاحترافية بنجاح! شكراً لك ✓', 'success', 5000);
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash.split('?')[0]);
        App.renderLayout();
        Pages.settings();
      }, 500);
    } else if (urlParams.get('success') === 'false') {
      setTimeout(() => {
        Toast.show('تم إلغاء عملية الدفع، لم يتم ترقية الاشتراك.', 'warning', 5000);
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash.split('?')[0]);
      }, 500);
    }

    document.getElementById('page-content').innerHTML = `
      <div class="fade-in" style="max-width:700px">
        <div class="card mb-16">
          <div class="card-title mb-16">⚙️ ${t('settings_company')}</div>
          <form onsubmit="Pages._saveSettings(event)">
            <div class="form-row cols-2">
              <div class="form-group"><label class="form-label">${t('company_name')}</label><input type="text" class="form-control" name="companyName" value="${tenant.name||''}"></div>
              <div class="form-group"><label class="form-label">${t('phone')}</label><input type="tel" class="form-control" name="phone" value="${tenant.phone||''}" dir="ltr"></div>
            </div>
            <div class="form-group"><label class="form-label">${t('address')}</label><input type="text" class="form-control" name="address" value="${tenant.address||''}"></div>
            <div class="form-row cols-2">
              <div class="form-group">
                <label class="form-label">${t('currency')}</label>
                <select class="form-control" name="currency">
                  <option value="EGP" ${tenant.currency==='EGP'?'selected':''}>EGP</option>
                  <option value="SAR" ${tenant.currency==='SAR'?'selected':''}>SAR</option>
                  <option value="AED" ${tenant.currency==='AED'?'selected':''}>AED</option>
                  <option value="USD" ${tenant.currency==='USD'?'selected':''}>USD</option>
                </select>
              </div>
              <div class="form-group"><label class="form-label">${t('tax_rate')}</label><input type="number" class="form-control" name="taxRate" value="${tenant.taxRate||14}" min="0" max="100"></div>
            </div>
            <button type="submit" class="btn btn-primary"><i class="fa fa-save"></i> ${t('save_settings')}</button>
          </form>
        </div>

        <div class="card mb-16">
          <div class="card-title mb-16">📱 ${t('install_app')}</div>
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">${t('install_desc')}</p>
          <button class="btn btn-primary" id="install-btn" onclick="Pages._installPWA()"><i class="fa fa-download"></i> ${t('install_app')}</button>
        </div>

        <div class="card mb-16">
          <div class="card-title mb-16">💾 ${t('backup')}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-secondary" onclick="Pages._exportBackup()"><i class="fa fa-download"></i> ${t('export_backup')}</button>
            <button class="btn btn-warning" onclick="Pages._importBackup()"><i class="fa fa-upload"></i> ${t('import_backup')}</button>
          </div>
        </div>

        <div class="card mb-16">
          <div class="card-title mb-16">📊 استيراد البيانات من إكسيل (Excel)</div>
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">يمكنك رفع ملف إكسيل يحتوي على الأصناف، الموردين، والعملاء لاستيرادهم دفعة واحدة.</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <button class="btn btn-primary" onclick="Pages._downloadExcelTemplate()"><i class="fa fa-download"></i> تحميل النموذج المرجعي</button>
            <button class="btn btn-secondary" onclick="document.getElementById('excel-import-file').click()"><i class="fa fa-file-excel"></i> اختيار ملف الإكسيل</button>
            <input type="file" id="excel-import-file" style="display:none" accept=".xlsx, .xls" onchange="Pages._importExcelData(event)">
          </div>
        </div>

        <div class="card">
          <div class="card-title mb-16">ℹ️ ${t('system_info')}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
            <div><span class="text-muted">${t('system_version')}</span> <strong>H.A.M.D v2.0</strong></div>
            <div><span class="text-muted">${t('account')}</span> <strong>${tenant.code}</strong></div>
            <div><span class="text-muted">${t('plan')}</span> 
              <strong>${tenant.plan === 'pro' ? '⭐ Pro' : 'Basic'}</strong>
              ${tenant.plan !== 'pro' ? `<button class="btn btn-primary btn-sm" onclick="Pages._upgradeTenantSubscription(event)" style="margin-right:10px;padding:3px 8px;font-size:11px"><i class="fa fa-arrow-up"></i> ترقية لـ Pro</button>` : ''}
            </div>
            <div><span class="text-muted">${t('state')}</span> <span class="badge ${navigator.onLine?'badge-success':'badge-warning'}">${navigator.onLine?t('online'):t('offline')}</span></div>
          </div>
        </div>
      </div>
    `;
    // PWA Install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      window._deferredPrompt = e;
    });
  },

  async _saveSettings(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const tenant = { ...App.state.tenant };
    tenant.name = fd.get('companyName') || tenant.name;
    tenant.phone = fd.get('phone') || tenant.phone;
    tenant.address = fd.get('address') || tenant.address;
    tenant.currency = fd.get('currency') || tenant.currency;
    tenant.taxRate = parseFloat(fd.get('taxRate')) || tenant.taxRate;
    await window.db.put('tenants', tenant);
    App.state.tenant = tenant;
    Toast.show('تم حفظ الإعدادات بنجاح', 'success');
  },

  async _installPWA() {
    if (window._deferredPrompt) {
      window._deferredPrompt.prompt();
      const result = await window._deferredPrompt.userChoice;
      if (result.outcome === 'accepted') Toast.show('تم تثبيت التطبيق بنجاح!', 'success');
      window._deferredPrompt = null;
    } else {
      Toast.show('لإضافة التطبيق: انقر على "إضافة إلى الشاشة الرئيسية" في متصفحك', 'info', 5000);
    }
  },

  async _exportBackup() {
    const tenantId = App.state.tenant.id;
    const backup = {};
    for (const store of ['products','categories','customers','suppliers','invoices','invoiceItems','stockMoves','expenses','payments','warehouses','users']) {
      backup[store] = await window.db.getByIndex(store, 'tenantId', tenantId).catch(() => window.db.getAll(store));
    }
    Export.toJSON(backup, `hamd-backup-${new Date().toISOString().slice(0,10)}`);
    Toast.show('تم تصدير النسخة الاحتياطية', 'success');
  },

  _importBackup() {
    Toast.show('ميزة الاستيراد قيد التطوير', 'info');
  },

  _downloadExcelTemplate() {
    try {
      const wb = XLSX.utils.book_new();
      
      // Products Sheet
      const productsData = [
        ["الاسم", "الباركود", "اسم الفئة", "سعر البيع", "سعر الشراء", "رصيد المخزون الحالي", "الحد الأدنى للمخزون"],
        ["صنف تجريبي 1", "6221000112233", "إلكترونيات", 150, 100, 20, 5],
        ["صنف تجريبي 2", "6221000112244", "غذائيات", 10, 7.5, 100, 10]
      ];
      const wsProducts = XLSX.utils.aoa_to_sheet(productsData);
      XLSX.utils.book_append_sheet(wb, wsProducts, "الأصناف");

      // Suppliers Sheet
      const suppliersData = [
        ["الاسم", "الهاتف", "العنوان", "الرقم الضريبي", "الرصيد الافتتاحي", "الحد الائتماني"],
        ["شركة التوريد العالمية", "0123456789", "العنوان التجاري 1", "123456789", 5000, 20000]
      ];
      const wsSuppliers = XLSX.utils.aoa_to_sheet(suppliersData);
      XLSX.utils.book_append_sheet(wb, wsSuppliers, "الموردين");

      // Customers Sheet
      const customersData = [
        ["الاسم", "الهاتف", "العنوان", "الرصيد الافتتاحي", "الحد الائتماني"],
        ["العميل المثالي", "0987654321", "العنوان السكني 1", 1500, 10000]
      ];
      const wsCustomers = XLSX.utils.aoa_to_sheet(customersData);
      XLSX.utils.book_append_sheet(wb, wsCustomers, "العملاء");

      XLSX.writeFile(wb, "H.A.M.D_Import_Template.xlsx");
      Toast.show('تم تحميل النموذج المرجعي بنجاح', 'success');
    } catch (err) {
      console.error("Excel Template Generation Error:", err);
      Toast.show('حدث خطأ أثناء تحميل النموذج المرجعي', 'error');
    }
  },

  async _importExcelData(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const tenantId = App.state.tenant.id;
        let productsCount = 0;
        let suppliersCount = 0;
        let customersCount = 0;

        // 1. Process Customers
        const customersSheet = workbook.Sheets["العملاء"];
        if (customersSheet) {
          const customersJson = XLSX.utils.sheet_to_json(customersSheet);
          for (const row of customersJson) {
            const name = row["الاسم"]?.toString().trim();
            if (!name) continue;
            
            const customer = {
              tenantId,
              name,
              phone: row["الهاتف"]?.toString().trim() || '',
              address: row["العنوان"]?.toString().trim() || '',
              balance: parseFloat(row["الرصيد الافتتاحي"]) || 0,
              creditLimit: parseFloat(row["الحد الائتماني"]) || 0,
              active: true,
              date: new Date().toISOString()
            };
            await window.db.add('customers', customer);
            customersCount++;
          }
        }

        // 2. Process Suppliers
        const suppliersSheet = workbook.Sheets["الموردين"];
        if (suppliersSheet) {
          const suppliersJson = XLSX.utils.sheet_to_json(suppliersSheet);
          for (const row of suppliersJson) {
            const name = row["الاسم"]?.toString().trim();
            if (!name) continue;
            
            const supplier = {
              tenantId,
              name,
              phone: row["الهاتف"]?.toString().trim() || '',
              address: row["العنوان"]?.toString().trim() || '',
              taxNumber: row["الرقم الضريبي"]?.toString().trim() || '',
              balance: parseFloat(row["الرصيد الافتتاحي"]) || 0,
              creditLimit: parseFloat(row["الحد الائتماني"]) || 0,
              active: true,
              date: new Date().toISOString()
            };
            await window.db.add('suppliers', supplier);
            suppliersCount++;
          }
        }

        // 3. Process Categories and Products
        const productsSheet = workbook.Sheets["الأصناف"];
        if (productsSheet) {
          const productsJson = XLSX.utils.sheet_to_json(productsSheet);
          
          // Get existing categories
          const existingCategories = await window.db.getTenantData('categories', tenantId);
          const categoryMap = {};
          existingCategories.forEach(cat => categoryMap[cat.name.toLowerCase()] = cat.id);

          for (const row of productsJson) {
            const name = row["الاسم"]?.toString().trim();
            if (!name) continue;

            const categoryName = row["اسم الفئة"]?.toString().trim() || 'عام';
            let categoryId = categoryMap[categoryName.toLowerCase()];
            if (!categoryId) {
              const newCat = {
                id: window.db._uid(),
                tenantId,
                name: categoryName,
                date: new Date().toISOString()
              };
              await window.db.put('categories', newCat);
              categoryId = newCat.id;
              categoryMap[categoryName.toLowerCase()] = categoryId;
            }

            const stockInit = parseFloat(row["رصيد المخزون الحالي"]) || 0;

            const product = {
              tenantId,
              name,
              barcode: row["الباركود"]?.toString().trim() || '',
              categoryId,
              price: parseFloat(row["سعر البيع"]) || 0,
              cost: parseFloat(row["سعر الشراء"]) || 0,
              stock: 0,
              minStock: parseFloat(row["الحد الأدنى للمخزون"]) || 5,
              unit: 'pcs',
              date: new Date().toISOString()
            };

            const productId = await window.db.add('products', product);
            productsCount++;

            if (stockInit > 0) {
              await window.db.updateProductStock(tenantId, productId, stockInit, 'in', 'adjustment', 'رصيد افتتاحي (استيراد إكسيل)');
            }
          }
        }

        Toast.show(`تم الاستيراد بنجاح! الأصناف: ${productsCount} | الموردين: ${suppliersCount} | العملاء: ${customersCount}`, 'success', 5000);
        e.target.value = '';
      } catch (err) {
        console.error("Excel Import Error:", err);
        Toast.show("حدث خطأ أثناء قراءة ملف الإكسيل، يرجى التأكد من صحة الملف والبيانات", "error");
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  },

  // ══════════════════════════════════════════
  //  STUB PAGES
  // ══════════════════════════════════════════
  async purchases() {
    const t = window.t || (k => k);
    const pc = document.getElementById('page-content');
    const tenantId = App.state.tenant.id;
    const [invoices, suppliers] = await Promise.all([
      window.db.getInvoicesByType(tenantId, 'purchase'),
      window.db.getTenantData('suppliers', tenantId),
    ]);
    const suppMap = {};
    suppliers.forEach(s => suppMap[s.id] = s);
    const sorted = invoices.sort((a, b) => new Date(b.date) - new Date(a.date));
    pc.innerHTML = `
      <div class="fade-in">
        <div class="table-toolbar">
          <div class="search-box">
            <input type="text" placeholder="${t('search_purchases') || 'بحث برقم الفاتورة أو المورد...'}" oninput="Pages._filterTable('purchases-table',this.value,['number','supplierName'])">
            <i class="fa fa-search"></i>
          </div>
          <button class="btn btn-secondary" onclick="Export.toCSV(['number','date','supplierName','total','paid','remaining','status'], ${JSON.stringify(sorted.map(i=>({...i,supplierName:suppMap[i.customerId]?.name||t('cash_supplier')}))).replace(/"/g,"'")}, 'purchases')"><i class="fa fa-file-excel"></i> ${t('export')}</button>
          <button class="btn btn-primary" onclick="Pages.invoiceForm('purchase')"><i class="fa fa-plus"></i> ${t('new_purchase')}</button>
        </div>
        <div class="table-wrapper">
          <table class="table" id="purchases-table">
            <thead><tr><th>${t('number')}</th><th>${t('date')}</th><th>${t('supplier')}</th><th>${t('total')}</th><th>${t('paid')}</th><th>${t('remaining')}</th><th>${t('payment_method')}</th><th>${t('status')}</th><th>${t('actions')}</th></tr></thead>
            <tbody>
              ${sorted.map(inv => `
                <tr data-number="${inv.number||''}" data-suppliername="${suppMap[inv.customerId]?.name||t('cash_supplier')}">
                  <td><strong>${inv.number||inv.id.substring(0,8)}</strong></td>
                  <td><span dir="ltr">${Fmt.date(inv.date)}</span></td>
                  <td>${suppMap[inv.customerId]?.name || `<span class="text-muted">${t('cash_supplier')}</span>`}</td>
                  <td>${Fmt.currency(inv.total)}</td>
                  <td class="text-success">${Fmt.currency(inv.paid)}</td>
                  <td class="${(inv.remaining||0)>0?'text-danger':''}">${Fmt.currency(inv.remaining||0)}</td>
                  <td>${inv.paymentMethod==='cash'?t('pay_cash'):inv.paymentMethod==='card'?t('pay_card'):t('pay_transfer')}</td>
                  <td><span class="badge ${inv.status==='completed'?'badge-success':inv.status==='pending'?'badge-warning':'badge-danger'}">${inv.status==='completed'?t('completed'):inv.status==='pending'?t('pending'):t('cancelled')}</span></td>
                  <td>
                    <div class="actions">
                      <button class="btn btn-secondary btn-sm" onclick="Pages.viewInvoice('${inv.id}')" title="${t('view')}"><i class="fa fa-eye"></i></button>
                      <button class="btn btn-secondary btn-sm" onclick="Pages._printInvoice('${inv.id}', 'a4')" title="${t('print_a4')}"><i class="fa fa-file-pdf"></i></button>
                      <button class="btn btn-secondary btn-sm" onclick="Pages._printInvoice('${inv.id}', 'thermal')" title="${t('print_thermal')}"><i class="fa fa-receipt"></i></button>
                      <button class="btn btn-danger btn-sm" onclick="Pages._deleteInvoice('${inv.id}')" title="${t('delete')}"><i class="fa fa-trash"></i></button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  stockAdjust() {
    document.getElementById('page-content').innerHTML = `
      <div class="fade-in">
        <div style="display:flex;justify-content:space-between;margin-bottom:16px;align-items:center">
          <h3 style="margin:0">تسوية ونقل المخزون</h3>
          <button class="btn btn-primary" onclick="Pages._newStockTransfer()"><i class="fa fa-exchange-alt"></i> عملية نقل / تسوية جديدة</button>
        </div>
        <div class="empty-state">
          <i class="fa fa-sliders-h"></i>
          <h3>سجل الحركات</h3>
          <p>لم يتم إجراء أي تسويات أو تحويلات مخزنية حتى الآن.</p>
        </div>
      </div>
    `;
  },
  
  _newStockTransfer() {
    Modal.open('stock-transfer', 'نقل وتسوية مخزون', `
      <div style="padding:20px;text-align:center">
        <i class="fa fa-cogs" style="font-size:48px;color:var(--text-muted);margin-bottom:16px"></i>
        <h4>قريباً</h4>
        <p class="text-muted">شاشة نقل المخزون بين المستودعات قيد التطوير.</p>
      </div>
    `);
  },

  invoiceForm(type) {
    if (type === 'purchase') {
      Modal.open('purchase-form', 'فاتورة شراء جديدة', `
        <div style="padding:20px;text-align:center">
          <i class="fa fa-shopping-cart" style="font-size:48px;color:var(--text-muted);margin-bottom:16px"></i>
          <h4>قريباً</h4>
          <p class="text-muted">شاشة إدخال المشتريات المبسطة قيد التطوير.</p>
        </div>
      `);
    }
  },

  quotations() { this._stubPage('عروض الأسعار', 'fa-file-alt', 'quotation'); },
  purchaseOrders() { this._stubPage('أوامر الشراء', 'fa-clipboard-list', 'po'); },
  audit() { this._stubPage('سجل العمليات', 'fa-history', 'audit'); },

  _stubPage(title, icon, type) {
    document.getElementById('page-content').innerHTML = `
      <div class="fade-in">
        <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
          <button class="btn btn-primary" onclick="Toast.show('قيد التطوير','info')"><i class="fa fa-plus"></i> جديد</button>
        </div>
        <div class="empty-state">
          <i class="fa ${icon}"></i>
          <h3>${title}</h3>
          <p>الصفحة كاملة قيد الإنشاء — البيانات ستظهر هنا</p>
        </div>
      </div>
    `;
  },

  // ══════════════════════════════════════════
  //  SUPER ADMIN PAGES
  // ══════════════════════════════════════════
  async superAdmin() {
    const pc = document.getElementById('page-content');
    pc.innerHTML = '<div class="skeleton" style="height:150px;margin-bottom:16px"></div>' + '<div class="skeleton" style="height:300px"></div>';

    try {
      const tenants = await window.db.getAll('tenants');
      const users = await window.db.getAll('users');
      const products = await window.db.getAll('products');
      const invoices = await window.db.getAll('invoices');

      const activeTenants = tenants.filter(t => t.status !== 'suspended').length;
      const totalRevenue = tenants.reduce((acc, t) => acc + (t.plan === 'pro' ? 299 : 0), 0);

      pc.innerHTML = `
        <div class="fade-in">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px">
            <h2 style="font-size:20px;font-weight:800">لوحة التحكم العامة للمنصة</h2>
            <a href="tests.html" target="_blank" class="btn btn-secondary btn-sm" style="display:inline-flex;align-items:center;gap:6px;text-decoration:none;font-size:12px;padding:6px 12px"><i class="fa fa-vial"></i> تشغيل اختبارات الجودة والأمان</a>
          </div>
          <div class="kpi-grid mb-24">
            <div class="kpi-card">
              <div class="kpi-value">${tenants.length}</div>
              <div class="kpi-label">إجمالي الشركات (Tenants)</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-value">${activeTenants}</div>
              <div class="kpi-label">الشركات النشطة</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-value">${users.length}</div>
              <div class="kpi-label">إجمالي المستخدمين</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-value">${Fmt.currency(totalRevenue)} / شهرياً</div>
              <div class="kpi-label">العائد الشهري المتوقع (MRR)</div>
            </div>
          </div>

          <div class="card mb-16">
            <div class="card-title">📊 إحصائيات الاستخدام العام</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
              <div>
                <p>إجمالي المنتجات المضافة في النظام: <strong>${products.length} صنف</strong></p>
                <p>إجمالي الفواتير الصادرة: <strong>${invoices.length} فاتورة</strong></p>
              </div>
              <div>
                <p>متوسط المنتجات لكل شركة: <strong>${(products.length / (tenants.length || 1)).toFixed(1)} صنف</strong></p>
                <p>متوسط الفواتير لكل شركة: <strong>${(invoices.length / (tenants.length || 1)).toFixed(1)} فاتورة</strong></p>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      console.error(err);
      pc.innerHTML = `<div class="alert alert-danger">حدث خطأ أثناء تحميل بيانات المنصة</div>`;
    }
  },

  async tenantsList() {
    const pc = document.getElementById('page-content');
    pc.innerHTML = '<div class="skeleton" style="height:300px"></div>';

    try {
      const tenants = await window.db.getAll('tenants');

      pc.innerHTML = `
        <div class="fade-in">
          <div class="table-toolbar">
            <div class="search-box">
              <input type="text" placeholder="بحث باسم الشركة أو الرمز..." oninput="Pages._filterTable('tenants-table',this.value,['name','code'])">
              <i class="fa fa-search"></i>
            </div>
            <button class="btn btn-primary" onclick="Pages._tenantForm()"><i class="fa fa-plus"></i> إضافة شركة جديدة</button>
          </div>
          <div class="table-wrapper">
            <table class="table" id="tenants-table">
              <thead>
                <tr>
                  <th>الرمز</th>
                  <th>اسم الشركة</th>
                  <th>العنوان</th>
                  <th>الهاتف</th>
                  <th>الباقة</th>
                  <th>الحالة</th>
                  <th>العمليات</th>
                </tr>
              </thead>
              <tbody>
                ${tenants.map(t => `
                  <tr data-name="${t.name}" data-code="${t.code}">
                    <td><code>${t.code}</code></td>
                    <td><strong>${t.name}</strong></td>
                    <td>${t.address || '—'}</td>
                    <td dir="ltr">${t.phone || '—'}</td>
                    <td><span class="badge ${t.plan === 'pro' ? 'badge-success' : 'badge-secondary'}">${t.plan === 'pro' ? 'Pro ⭐' : 'Basic'}</span></td>
                    <td><span class="badge ${t.status !== 'suspended' ? 'badge-success' : 'badge-danger'}">${t.status !== 'suspended' ? 'نشط' : 'موقوف'}</span></td>
                    <td>
                      <div class="actions">
                        <button class="btn btn-secondary btn-sm" onclick="Pages._toggleTenantStatus('${t.id}', '${t.status || 'active'}')" title="${t.status !== 'suspended' ? 'إيقاف' : 'تفعيل'}">
                          <i class="fa ${t.status !== 'suspended' ? 'fa-ban' : 'fa-check'}"></i>
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="Pages._changeTenantPlan('${t.id}', '${t.plan}')" title="تغيير الباقة">
                          <i class="fa fa-arrow-up"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      console.error(err);
      pc.innerHTML = `<div class="alert alert-danger">حدث خطأ أثناء تحميل الشركات</div>`;
    }
  },

  async _tenantForm() {
    Modal.open('tenant-form', 'إضافة مستأجر/شركة جديدة', `
      <form onsubmit="Pages._saveTenant(event)">
        <div class="form-row cols-2">
          <div class="form-group"><label class="form-label required">اسم الشركة</label><input type="text" class="form-control" name="name" required></div>
          <div class="form-group"><label class="form-label required">رمز الشركة (Code)</label><input type="text" class="form-control" name="code" placeholder="مثال: delta-store" required></div>
        </div>
        <div class="form-row cols-2">
          <div class="form-group"><label class="form-label">الهاتف</label><input type="tel" class="form-control" name="phone" dir="ltr"></div>
          <div class="form-group"><label class="form-label">الباقة</label>
            <select class="form-control" name="plan">
              <option value="basic">Basic (أساسية)</option>
              <option value="pro">Pro (احترافية)</option>
            </select>
          </div>
        </div>
        <div class="form-group"><label class="form-label">العنوان</label><input type="text" class="form-control" name="address"></div>
        <div class="modal-footer" style="padding:0;margin-top:16px">
          <button type="button" class="btn btn-secondary" onclick="Modal.close('tenant-form')">إلغاء</button>
          <button type="submit" class="btn btn-primary"><i class="fa fa-save"></i> حفظ الشركة</button>
        </div>
      </form>
    `);
  },

  async _saveTenant(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    data.id = 'T' + Date.now().toString().slice(-4);
    data.status = 'active';
    data.currency = 'EGP';
    data.taxRate = 14;
    data.createdAt = new Date().toISOString();

    try {
      await window.db.put('tenants', data);
      Toast.show('تم إضافة الشركة بنجاح', 'success');
      Modal.close('tenant-form');
      this.tenantsList();
    } catch (err) {
      console.error(err);
      Toast.show('حدث خطأ أثناء حفظ الشركة', 'error');
    }
  },

  async _toggleTenantStatus(id, currentStatus) {
    const nextStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    Modal.confirm(
      nextStatus === 'suspended' ? 'إيقاف الشركة' : 'تفعيل الشركة',
      `هل أنت متأكد من تغيير حالة الشركة؟`,
      async () => {
        try {
          const tenant = await window.db.get('tenants', id);
          tenant.status = nextStatus;
          await window.db.put('tenants', tenant);
          Toast.show('تم تحديث حالة الشركة بنجاح', 'success');
          this.tenantsList();
        } catch (err) {
          console.error(err);
          Toast.show('حدث خطأ أثناء تحديث حالة الشركة', 'error');
        }
      }
    );
  },

  async _changeTenantPlan(id, currentPlan) {
    const nextPlan = currentPlan === 'pro' ? 'basic' : 'pro';
    Modal.confirm(
      'تغيير الباقة',
      `هل تريد تحويل باقة الشركة إلى الباقة ${nextPlan === 'pro' ? 'الاحترافية (Pro)' : 'الأساسية (Basic)'}؟`,
      async () => {
        try {
          const tenant = await window.db.get('tenants', id);
          tenant.plan = nextPlan;
          await window.db.put('tenants', tenant);
          Toast.show('تم ترقية/تخفيض الباقة بنجاح', 'success');
          this.tenantsList();
        } catch (err) {
          console.error(err);
          Toast.show('حدث خطأ أثناء تغيير الباقة', 'error');
        }
      }
    );
  },

  async _checkLimitExceeded(store, maxLimit) {
    const tenantId = App.state.tenant.id;
    const plan = App.state.tenant.plan || 'basic';
    if (plan === 'pro') return false;
    const data = await window.db.getTenantData(store, tenantId);
    return data.length >= maxLimit;
  },

  async _upgradeTenantSubscription(e) {
    const btn = e.currentTarget || e.target;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> جاري التحويل...';
    
    try {
      const res = await fetch('/api/stripe-checkout', {
        method: 'POST',
        body: JSON.stringify({
          tenantId: App.state.tenant.id,
          tenantCode: App.state.tenant.code,
          hostUrl: window.location.origin
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'حدث خطأ أثناء الاتصال ببوابة الدفع');
      
      window.location.href = result.url;
    } catch (err) {
      console.error(err);
      Toast.show(err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  },

  // ══════════════════════════════════════════
  //  TABLE HELPERS
  // ══════════════════════════════════════════
  _filterTable(tableId, q, fields) {
    const lower = q.toLowerCase();
    document.querySelectorAll(`#${tableId} tbody tr`).forEach(row => {
      const match = !q || fields.some(f => (row.dataset[f.toLowerCase()]||'').toLowerCase().includes(lower));
      row.style.display = match ? '' : 'none';
    });
  },

  _filterTableByField(tableId, field, value) {
    const f = field.toLowerCase();
    document.querySelectorAll(`#${tableId} tbody tr`).forEach(row => {
      row.style.display = (!value || row.dataset[f] === value) ? '' : 'none';
    });
  },
};

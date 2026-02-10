(function () {
  const ADMIN_ROUTES = ['/dashboard', '/licenses', '/users', '/billing', '/promos'];
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (!ADMIN_ROUTES.includes(path)) return;

  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (!token) { location.href = '/login'; return; }
  if (user && user.role && user.role !== 'admin') { alert('Access denied. Admin only.'); location.href = '/'; return; }

  // Hide React root and prevent React from interfering
  function killReact() {
    var root = document.getElementById('root');
    if (root) {
      root.style.display = 'none';
      root.innerHTML = '';
    }
    // Also remove React's Tailwind CSS that interferes with our styles
    var reactCSS = document.querySelector('link[href*="index-"]');
    if (reactCSS) reactCSS.remove();
  }
  killReact();
  // Kill React again after it might have initialized (module scripts are async)
  setTimeout(killReact, 100);
  setTimeout(killReact, 500);

  const adminRoot = document.createElement('div');
  adminRoot.id = 'sf-admin';
  adminRoot.className = 'sf-admin-root';
  document.body.appendChild(adminRoot);

  const API = 'https://api-ru.seo-fury.com/api/v1';

  // ─── Helpers ───────────────────────────────────────────────

  async function api(path, opts = {}) {
    const headers = Object.assign({}, opts.headers || {}, {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
    const res = await fetch(API + path, { ...opts, headers });
    const data = await res.json();
    if (!res.ok || data.success === false) throw new Error(data.error || 'Request failed');
    return data;
  }

  function getQuery() {
    const p = new URLSearchParams(location.search);
    return {
      search: p.get('search') || '',
      status: p.get('status') || '',
      plan: p.get('plan') || '',
      page: parseInt(p.get('page') || '1', 10),
      limit: parseInt(p.get('limit') || '20', 10),

      userSearch: p.get('userSearch') || '',
      userPage: parseInt(p.get('userPage') || '1', 10),
      userLimit: parseInt(p.get('userLimit') || '20', 10),

      invSearch: p.get('invSearch') || '',
      invStatus: p.get('invStatus') || '',
      invPage: parseInt(p.get('invPage') || '1', 10),
      invLimit: parseInt(p.get('invLimit') || '20', 10)
    };
  }

  function setQuery(params) {
    const p = new URLSearchParams(location.search);
    Object.entries(params).forEach(([k, v]) => {
      if (v === '' || v === null || v === undefined) p.delete(k);
      else p.set(k, String(v));
    });
    history.replaceState(null, '', `${location.pathname}?${p.toString()}`);
  }

  function showToast(msg, type) {
    if (type === undefined) type = 'success';
    var t = document.createElement('div');
    t.className = 'sf-toast ' + type;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3000);
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(function () { showToast('Copied!'); });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatCurrency(amount) {
    return '$' + Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateShort(d) {
    if (!d) return '-';
    var dt = new Date(d);
    return (dt.getMonth() + 1) + '/' + dt.getDate();
  }

  function avatarInitials(email) {
    if (!email) return '?';
    var parts = email.split('@')[0].split(/[._-]/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return email.substring(0, 2).toUpperCase();
  }

  function planBadgeClass(plan) {
    var map = {
      free: 'free',
      pro_starter: 'pro_starter',
      pro_business: 'pro_business',
      pro_agency: 'pro_agency',
      lifetime: 'lifetime'
    };
    return map[plan] || 'free';
  }

  function planLabel(plan) {
    var map = {
      free: 'Free',
      pro_starter: 'Pro Starter',
      pro_business: 'Pro Business',
      pro_agency: 'Pro Agency',
      lifetime: 'Lifetime'
    };
    return map[plan] || plan || 'Free';
  }

  function loadingHtml() {
    return '<div class="sf-admin-card" style="display:flex;justify-content:center;padding:48px"><div class="sf-spinner"></div></div>';
  }

  function errorCard(message) {
    return `<div class="sf-admin-card sf-error-card"><strong>Error:</strong> ${escapeHtml(message)}</div>`;
  }

  // ─── Shell ─────────────────────────────────────────────────

  var routeMap = {
    '/dashboard': function() { renderDashboard(); },
    '/licenses': function() { renderLicenses(); },
    '/users': function() { renderUsers(); },
    '/billing': function() { renderBilling(); },
    '/promos': function() { renderPromos(); }
  };

  function navigateTo(route) {
    history.pushState(null, '', route);
    if (routeMap[route]) routeMap[route]();
  }

  function renderShell(active) {
    adminRoot.innerHTML = `
      <div class="sf-admin-header">
        <div class="sf-logo">&#9889; SEO Fury</div>
        <nav class="sf-admin-nav">
          <a href="/dashboard" data-route="/dashboard" class="${active === 'dashboard' ? 'active' : ''}">Dashboard</a>
          <a href="/licenses" data-route="/licenses" class="${active === 'licenses' ? 'active' : ''}">Licenses</a>
          <a href="/users" data-route="/users" class="${active === 'users' ? 'active' : ''}">Users</a>
          <a href="/billing" data-route="/billing" class="${active === 'billing' ? 'active' : ''}">Billing</a>
          <a href="/promos" data-route="/promos" class="${active === 'promos' ? 'active' : ''}">Promo Codes</a>
        </nav>
        <div class="sf-header-right">
          <span class="sf-muted">${escapeHtml(user?.email || '')}</span>
          <button class="sf-btn secondary" id="sf-logout">Logout</button>
        </div>
      </div>
      <div class="sf-admin-container">
        <div id="sf-admin-view"></div>
      </div>
    `;

    // Intercept nav clicks — prevent React Router and full page reload
    adminRoot.querySelectorAll('[data-route]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        navigateTo(link.dataset.route);
      });
    });

    document.getElementById('sf-logout').onclick = function () {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      location.href = '/login';
    };
    return document.getElementById('sf-admin-view');
  }

  // Handle browser back/forward
  window.addEventListener('popstate', function () {
    var p = location.pathname.replace(/\/+$/, '') || '/';
    if (routeMap[p]) routeMap[p]();
  });

  // ─── Dashboard ─────────────────────────────────────────────

  async function renderDashboard() {
    var view = renderShell('dashboard');
    view.innerHTML = loadingHtml();

    try {
      var resp = await api('/admin/stats');
      var data = resp.data;

      // compute total revenue
      var totalRevenue = 0;
      (data.revenue || []).forEach(function (r) { totalRevenue += r.total || 0; });

      // KPI cards
      var kpiHtml = `
        <div class="sf-kpi-grid">
          <div class="sf-kpi-card sf-kpi-blue">
            <div class="sf-kpi-label">Total Users</div>
            <div class="sf-kpi-value">${data.totalUsers}</div>
            <div class="sf-kpi-sub">${data.activeUsers} active</div>
          </div>
          <div class="sf-kpi-card sf-kpi-green">
            <div class="sf-kpi-label">Active Licenses</div>
            <div class="sf-kpi-value">${data.activeLicenses}</div>
            <div class="sf-kpi-sub">of ${data.totalLicenses} total</div>
          </div>
          <div class="sf-kpi-card sf-kpi-purple">
            <div class="sf-kpi-label">Connected Domains</div>
            <div class="sf-kpi-value">${data.totalDomains}</div>
            <div class="sf-kpi-sub">&nbsp;</div>
          </div>
          <div class="sf-kpi-card sf-kpi-amber">
            <div class="sf-kpi-label">Revenue</div>
            <div class="sf-kpi-value">${formatCurrency(totalRevenue)}</div>
            <div class="sf-kpi-sub">${(data.revenue || []).map(function (r) { return r.count + ' paid'; }).join(', ') || 'No invoices'}</div>
          </div>
        </div>
      `;

      // Charts row
      var chartsHtml = `
        <div class="sf-charts-grid">
          <div class="sf-admin-card">
            <h3>Registrations (30 days)</h3>
            <canvas id="sf-chart-registrations" height="220"></canvas>
          </div>
          <div class="sf-admin-card">
            <h3>License Distribution</h3>
            <canvas id="sf-chart-distribution" height="220"></canvas>
          </div>
        </div>
      `;

      // Tables row
      var activationsRows = (data.recentActivations || []).map(function (r) {
        return `<tr>
          <td>${escapeHtml(r.domain)}</td>
          <td><span class="sf-badge ${planBadgeClass(r.plan)}">${planLabel(r.plan)}</span></td>
          <td>
            <span class="sf-license-key">${escapeHtml(r.licenseKey)}</span>
            <button class="sf-copy-btn" data-copy="${escapeHtml(r.licenseKey)}" title="Copy">&#128203;</button>
          </td>
          <td>${formatDate(r.activatedAt)}</td>
        </tr>`;
      }).join('');

      var recentUsersRows = (data.recentUsers || []).map(function (u) {
        var name = [u.firstName, u.lastName].filter(Boolean).join(' ') || '-';
        var flag = u.countryCode ? String.fromCodePoint(...[...u.countryCode.toUpperCase()].map(ch => 127397 + ch.charCodeAt(0))) : '';
        var countryDisplay = u.country ? (flag + ' ' + u.country) : '<span class="sf-muted">-</span>';
        return `<tr>
          <td>${escapeHtml(u.email)}</td>
          <td>${escapeHtml(name)}</td>
          <td>${countryDisplay}</td>
          <td>${u.isEmailVerified ? '<span class="sf-verified">&#10003;</span>' : '<span class="sf-unverified">&#10007;</span>'}</td>
          <td>${formatDate(u.createdAt)}</td>
        </tr>`;
      }).join('');

      var tablesHtml = `
        <div class="sf-tables-grid">
          <div class="sf-admin-card">
            <h3>Recent Activations</h3>
            <table class="sf-admin-table">
              <thead><tr><th>Domain</th><th>Plan</th><th>License Key</th><th>Date</th></tr></thead>
              <tbody>${activationsRows || '<tr><td colspan="4" class="sf-empty">No recent activations</td></tr>'}</tbody>
            </table>
          </div>
          <div class="sf-admin-card">
            <h3>Recent Users</h3>
            <table class="sf-admin-table">
              <thead><tr><th>Email</th><th>Name</th><th>Country</th><th>Verified</th><th>Joined</th></tr></thead>
              <tbody>${recentUsersRows || '<tr><td colspan="5" class="sf-empty">No recent users</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      `;

      // Country stats section
      var countryRows = (data.usersByCountry || []).map(function (c, idx) {
        var flag = c.countryCode ? String.fromCodePoint(...[...c.countryCode.toUpperCase()].map(ch => 127397 + ch.charCodeAt(0))) : '';
        var pct = data.totalUsers > 0 ? ((c.count / data.totalUsers) * 100).toFixed(1) : 0;
        return '<tr>' +
          '<td>' + (idx + 1) + '</td>' +
          '<td><span style="font-size:18px;margin-right:6px">' + flag + '</span> ' + escapeHtml(c.country) + '</td>' +
          '<td><strong>' + c.count + '</strong></td>' +
          '<td>' +
            '<div class="sf-progress-wrap">' +
              '<div class="sf-progress" style="min-width:80px">' +
                '<div class="sf-progress-bar" style="width:' + pct + '%"></div>' +
              '</div>' +
              '<span class="sf-muted">' + pct + '%</span>' +
            '</div>' +
          '</td>' +
        '</tr>';
      }).join('');

      var unknownCount = data.totalUsers - (data.usersWithCountry || 0);
      var countryHtml = '';
      if (data.usersByCountry && data.usersByCountry.length > 0) {
        countryHtml = `
          <div class="sf-charts-grid">
            <div class="sf-admin-card">
              <h3>Users by Country</h3>
              <canvas id="sf-chart-countries" height="220"></canvas>
            </div>
            <div class="sf-admin-card" style="max-height:340px;overflow-y:auto">
              <h3>Country Breakdown <span class="sf-muted" style="font-weight:400;font-size:12px">(${data.usersWithCountry || 0} identified${unknownCount > 0 ? ', ' + unknownCount + ' unknown' : ''})</span></h3>
              <table class="sf-admin-table">
                <thead><tr><th>#</th><th>Country</th><th>Users</th><th>Share</th></tr></thead>
                <tbody>${countryRows}</tbody>
              </table>
            </div>
          </div>
        `;
      }

      view.innerHTML = kpiHtml + chartsHtml + countryHtml + tablesHtml;

      // Copy buttons
      view.querySelectorAll('[data-copy]').forEach(function (btn) {
        btn.onclick = function () { copyToClipboard(btn.dataset.copy); };
      });

      // ─── Charts (Chart.js) ───
      if (typeof Chart !== 'undefined') {
        // Registration line chart
        var regLabels = (data.registrationsByDay || []).map(function (d) { return d._id; });
        var regData = (data.registrationsByDay || []).map(function (d) { return d.count; });
        var regCtx = document.getElementById('sf-chart-registrations');
        if (regCtx) {
          var regGradient = regCtx.getContext('2d').createLinearGradient(0, 0, 0, 220);
          regGradient.addColorStop(0, 'rgba(59,130,246,0.25)');
          regGradient.addColorStop(1, 'rgba(59,130,246,0.01)');
          new Chart(regCtx, {
            type: 'line',
            data: {
              labels: regLabels,
              datasets: [{
                label: 'Registrations',
                data: regData,
                borderColor: '#3b82f6',
                backgroundColor: regGradient,
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: '#3b82f6'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 10, font: { size: 11 } } },
                y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: '#f3f4f6' } }
              }
            }
          });
        }

        // License distribution doughnut
        var planColors = {
          free: '#94a3b8',
          pro_starter: '#3b82f6',
          pro_business: '#8b5cf6',
          pro_agency: '#a855f7',
          lifetime: '#f59e0b'
        };
        var distLabels = (data.licensesByPlan || []).map(function (d) { return planLabel(d._id); });
        var distData = (data.licensesByPlan || []).map(function (d) { return d.count; });
        var distColors = (data.licensesByPlan || []).map(function (d) { return planColors[d._id] || '#94a3b8'; });
        var distCtx = document.getElementById('sf-chart-distribution');
        if (distCtx) {
          new Chart(distCtx, {
            type: 'doughnut',
            data: {
              labels: distLabels,
              datasets: [{
                data: distData,
                backgroundColor: distColors,
                borderWidth: 2,
                borderColor: '#fff'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom', labels: { padding: 16, font: { size: 12 } } }
              },
              cutout: '60%'
            }
          });
        }
        // Country horizontal bar chart
        var countryCtx = document.getElementById('sf-chart-countries');
        if (countryCtx && data.usersByCountry && data.usersByCountry.length > 0) {
          var top10 = data.usersByCountry.slice(0, 10);
          var cLabels = top10.map(function (c) {
            var flag = c.countryCode ? String.fromCodePoint(...[...c.countryCode.toUpperCase()].map(ch => 127397 + ch.charCodeAt(0))) : '';
            return flag + ' ' + c.country;
          });
          var cData = top10.map(function (c) { return c.count; });
          var cColors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#6366f1'];
          new Chart(countryCtx, {
            type: 'bar',
            data: {
              labels: cLabels,
              datasets: [{
                label: 'Users',
                data: cData,
                backgroundColor: cColors.slice(0, cData.length),
                borderRadius: 4,
                barThickness: 18
              }]
            },
            options: {
              indexAxis: 'y',
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                x: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: '#f3f4f6' } },
                y: { grid: { display: false }, ticks: { font: { size: 12 } } }
              }
            }
          });
        }
      }

    } catch (e) {
      view.innerHTML = errorCard(e.message);
      showToast(e.message, 'error');
    }
  }

  // ─── Licenses ──────────────────────────────────────────────

  async function renderLicenses() {
    var view = renderShell('licenses');
    var q = getQuery();
    view.innerHTML = loadingHtml();

    try {
      var resp = await api(`/admin/licenses?limit=${q.limit}&page=${q.page}&search=${encodeURIComponent(q.search)}&status=${q.status}&plan=${q.plan}`);
      var data = resp.data;
      var pagination = resp.pagination;

      var rows = data.map(function (l) {
        var domainPills = (l.activeDomains || []).map(function (d) {
          return `<span class="sf-domain">
            ${escapeHtml(d.domain)}
            <button data-domain="${escapeHtml(d.domain)}" data-license="${l._id}" title="Remove domain">&times;</button>
          </span>`;
        }).join('') || '<span class="sf-muted">-</span>';

        return `<tr>
          <td>
            <span class="sf-license-key">${escapeHtml(l.licenseKey)}</span>
            <button class="sf-copy-btn" data-copy="${escapeHtml(l.licenseKey)}" title="Copy">&#128203;</button>
          </td>
          <td><span class="sf-badge ${planBadgeClass(l.plan)}">${planLabel(l.plan)}</span></td>
          <td><span class="sf-badge ${l.status === 'active' ? 'active' : 'inactive'}">${l.status}</span></td>
          <td>${domainPills}</td>
          <td>${escapeHtml(l.userId?.email || '-')}</td>
          <td>${formatDate(l.createdAt)}</td>
          <td>
            <select class="sf-select sf-select-sm" data-plan="${l._id}">
              <option value="free" ${l.plan === 'free' ? 'selected' : ''}>Free</option>
              <option value="pro_starter" ${l.plan === 'pro_starter' ? 'selected' : ''}>Pro Starter</option>
              <option value="pro_business" ${l.plan === 'pro_business' ? 'selected' : ''}>Pro Business</option>
              <option value="pro_agency" ${l.plan === 'pro_agency' ? 'selected' : ''}>Pro Agency</option>
              <option value="lifetime" ${l.plan === 'lifetime' ? 'selected' : ''}>Lifetime</option>
            </select>
          </td>
          <td class="sf-actions">
            <button class="sf-btn secondary sf-btn-sm" data-update-plan="${l._id}">Save</button>
            <button class="sf-btn danger sf-btn-sm" data-del="${l._id}">Delete</button>
          </td>
        </tr>`;
      }).join('');

      view.innerHTML = `
        <div class="sf-toggle-section sf-admin-card">
          <div class="sf-toggle-header" id="toggleCreateLicense">
            <span>&#10133; Create License</span>
          </div>
          <div class="sf-toggle-body" id="createLicenseBody">
            <div class="sf-row">
              <input class="sf-input" id="createEmail" placeholder="User email" />
              <select class="sf-select" id="createPlan">
                <option value="free">Free</option>
                <option value="pro_starter">Pro Starter</option>
                <option value="pro_business">Pro Business</option>
                <option value="pro_agency">Pro Agency</option>
                <option value="lifetime">Lifetime</option>
              </select>
              <select class="sf-select" id="createInterval">
                <option value="month">Month</option>
                <option value="year">Year</option>
                <option value="lifetime">Lifetime</option>
              </select>
              <button class="sf-btn" id="createLicense">Create</button>
            </div>
          </div>
        </div>

        <div class="sf-admin-card">
          <h3>Licenses</h3>
          <div class="sf-row">
            <input class="sf-input" id="licenseSearch" placeholder="Search key or domain" value="${escapeHtml(q.search)}"/>
            <select class="sf-select" id="licenseStatus">
              <option value="">All statuses</option>
              <option value="active" ${q.status === 'active' ? 'selected' : ''}>Active</option>
              <option value="inactive" ${q.status === 'inactive' ? 'selected' : ''}>Inactive</option>
              <option value="expired" ${q.status === 'expired' ? 'selected' : ''}>Expired</option>
              <option value="suspended" ${q.status === 'suspended' ? 'selected' : ''}>Suspended</option>
            </select>
            <select class="sf-select" id="licensePlan">
              <option value="">All plans</option>
              <option value="free" ${q.plan === 'free' ? 'selected' : ''}>Free</option>
              <option value="pro_starter" ${q.plan === 'pro_starter' ? 'selected' : ''}>Pro Starter</option>
              <option value="pro_business" ${q.plan === 'pro_business' ? 'selected' : ''}>Pro Business</option>
              <option value="pro_agency" ${q.plan === 'pro_agency' ? 'selected' : ''}>Pro Agency</option>
              <option value="lifetime" ${q.plan === 'lifetime' ? 'selected' : ''}>Lifetime</option>
            </select>
            <button class="sf-btn secondary" id="applyFilters">Apply</button>
          </div>
          <table class="sf-admin-table">
            <thead><tr>
              <th>Key</th><th>Plan</th><th>Status</th><th>Domains</th><th>User</th><th>Created</th><th>Change Plan</th><th></th>
            </tr></thead>
            <tbody>
              ${rows || '<tr><td colspan="8" class="sf-empty">No licenses found</td></tr>'}
            </tbody>
          </table>
          <div class="sf-pagination">
            <button class="sf-btn secondary sf-btn-sm" id="prevPage" ${q.page <= 1 ? 'disabled' : ''}>Prev</button>
            <span class="sf-muted">Page ${q.page} of ${pagination?.pages || 1}</span>
            <button class="sf-btn secondary sf-btn-sm" id="nextPage" ${(pagination?.pages || 1) <= q.page ? 'disabled' : ''}>Next</button>
          </div>
        </div>
      `;

      // Toggle create section
      document.getElementById('toggleCreateLicense').onclick = function () {
        var body = document.getElementById('createLicenseBody');
        this.classList.toggle('open');
        body.classList.toggle('open');
      };

      // Create license
      document.getElementById('createLicense').onclick = async function () {
        var email = document.getElementById('createEmail').value.trim();
        var plan = document.getElementById('createPlan').value;
        var interval = document.getElementById('createInterval').value;
        if (!email) { showToast('Email is required', 'error'); return; }
        try {
          await api('/admin/licenses', { method: 'POST', body: JSON.stringify({ email: email, plan: plan, interval: interval }) });
          showToast('License created successfully');
          renderLicenses();
        } catch (e) {
          showToast(e.message, 'error');
        }
      };

      // Copy buttons
      view.querySelectorAll('[data-copy]').forEach(function (btn) {
        btn.onclick = function () { copyToClipboard(btn.dataset.copy); };
      });

      // Filters
      document.getElementById('applyFilters').onclick = function () {
        setQuery({
          search: document.getElementById('licenseSearch').value.trim(),
          status: document.getElementById('licenseStatus').value,
          plan: document.getElementById('licensePlan').value,
          page: 1
        });
        renderLicenses();
      };

      // Pagination
      document.getElementById('prevPage').onclick = function () { setQuery({ page: q.page - 1 }); renderLicenses(); };
      document.getElementById('nextPage').onclick = function () { setQuery({ page: q.page + 1 }); renderLicenses(); };

      // Delete license
      view.querySelectorAll('[data-del]').forEach(function (btn) {
        btn.onclick = async function () {
          if (!confirm('Delete this license?')) return;
          try {
            await api('/admin/licenses/' + btn.dataset.del, { method: 'DELETE' });
            showToast('License deleted');
            renderLicenses();
          } catch (e) {
            showToast(e.message, 'error');
          }
        };
      });

      // Remove domain
      view.querySelectorAll('[data-domain]').forEach(function (btn) {
        btn.onclick = async function () {
          if (!confirm('Remove domain from license?')) return;
          try {
            await api('/admin/licenses/' + btn.dataset.license + '/domains/' + btn.dataset.domain, { method: 'DELETE' });
            showToast('Domain removed');
            renderLicenses();
          } catch (e) {
            showToast(e.message, 'error');
          }
        };
      });

      // Update plan
      view.querySelectorAll('[data-update-plan]').forEach(function (btn) {
        btn.onclick = async function () {
          var select = document.querySelector('[data-plan="' + btn.dataset.updatePlan + '"]');
          try {
            await api('/admin/licenses/' + btn.dataset.updatePlan + '/plan', {
              method: 'PUT',
              body: JSON.stringify({ plan: select.value })
            });
            showToast('Plan updated');
            renderLicenses();
          } catch (e) {
            showToast(e.message, 'error');
          }
        };
      });

    } catch (e) {
      view.innerHTML = errorCard(e.message);
      showToast(e.message, 'error');
    }
  }

  // ─── Users ─────────────────────────────────────────────────

  async function renderUsers() {
    var view = renderShell('users');
    var q = getQuery();
    view.innerHTML = loadingHtml();

    try {
      var resp = await api(`/admin/users?limit=${q.userLimit}&page=${q.userPage}&search=${encodeURIComponent(q.userSearch)}`);
      var data = resp.data;
      var pagination = resp.pagination;

      var rows = data.map(function (u) {
        var initials = avatarInitials(u.email);
        var displayName = u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || '-';
        var flag = u.countryCode ? String.fromCodePoint(...[...u.countryCode.toUpperCase()].map(ch => 127397 + ch.charCodeAt(0))) : '';
        var countryDisplay = u.country ? (flag + ' ' + escapeHtml(u.country)) : '<span class="sf-muted">-</span>';
        return `<tr>
          <td>
            <div class="sf-user-cell">
              <span class="sf-avatar">${escapeHtml(initials)}</span>
              <span>${escapeHtml(u.email)}</span>
            </div>
          </td>
          <td>${escapeHtml(displayName)}</td>
          <td>${countryDisplay}</td>
          <td><span class="sf-badge ${u.role === 'admin' ? 'admin' : 'user-role'}">${u.role}</span></td>
          <td>${u.isActive
            ? '<span class="sf-status-dot sf-dot-green"></span> Active'
            : '<span class="sf-status-dot sf-dot-red"></span> Inactive'}</td>
          <td>${u.isEmailVerified
            ? '<span class="sf-verified">&#10003;</span>'
            : '<span class="sf-unverified">&#10007;</span>'}</td>
          <td>${formatDate(u.createdAt)}</td>
          <td>
            <button class="sf-btn ${u.isActive ? 'danger' : 'secondary'} sf-btn-sm" data-toggle-user="${u._id}" data-active="${u.isActive}">
              ${u.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </td>
        </tr>`;
      }).join('');

      view.innerHTML = `
        <div class="sf-admin-card">
          <h3>Users</h3>
          <div class="sf-row">
            <input class="sf-input" id="userSearch" placeholder="Search email or name" value="${escapeHtml(q.userSearch)}"/>
            <button class="sf-btn secondary" id="applyUserFilters">Search</button>
          </div>
          <table class="sf-admin-table">
            <thead><tr><th>Email</th><th>Name</th><th>Country</th><th>Role</th><th>Status</th><th>Verified</th><th>Joined</th><th></th></tr></thead>
            <tbody>
              ${rows || '<tr><td colspan="8" class="sf-empty">No users found</td></tr>'}
            </tbody>
          </table>
          <div class="sf-pagination">
            <button class="sf-btn secondary sf-btn-sm" id="prevUserPage" ${q.userPage <= 1 ? 'disabled' : ''}>Prev</button>
            <span class="sf-muted">Page ${q.userPage} of ${pagination?.pages || 1}</span>
            <button class="sf-btn secondary sf-btn-sm" id="nextUserPage" ${(pagination?.pages || 1) <= q.userPage ? 'disabled' : ''}>Next</button>
          </div>
        </div>
      `;

      // Search on Enter key
      document.getElementById('userSearch').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          setQuery({ userSearch: this.value.trim(), userPage: 1 });
          renderUsers();
        }
      });

      document.getElementById('applyUserFilters').onclick = function () {
        setQuery({ userSearch: document.getElementById('userSearch').value.trim(), userPage: 1 });
        renderUsers();
      };

      document.getElementById('prevUserPage').onclick = function () { setQuery({ userPage: q.userPage - 1 }); renderUsers(); };
      document.getElementById('nextUserPage').onclick = function () { setQuery({ userPage: q.userPage + 1 }); renderUsers(); };

      view.querySelectorAll('[data-toggle-user]').forEach(function (btn) {
        btn.onclick = async function () {
          var isActive = btn.dataset.active === 'true';
          try {
            await api('/admin/users/' + btn.dataset.toggleUser + '/status', {
              method: 'PUT',
              body: JSON.stringify({ isActive: !isActive })
            });
            showToast(isActive ? 'User deactivated' : 'User activated');
            renderUsers();
          } catch (e) {
            showToast(e.message, 'error');
          }
        };
      });

    } catch (e) {
      view.innerHTML = errorCard(e.message);
      showToast(e.message, 'error');
    }
  }

  // ─── Billing ───────────────────────────────────────────────

  async function renderBilling() {
    var view = renderShell('billing');
    var q = getQuery();
    view.innerHTML = loadingHtml();

    try {
      var resp = await api(`/admin/invoices?limit=${q.invLimit}&page=${q.invPage}&search=${encodeURIComponent(q.invSearch)}&status=${q.invStatus}`);
      var data = resp.data;
      var pagination = resp.pagination;

      var statusBadgeClass = function (s) {
        if (s === 'paid') return 'active';
        if (s === 'unpaid') return 'amber';
        return 'void';
      };

      var rows = data.map(function (i) {
        return `<tr>
          <td>${escapeHtml(i.userId?.email || '-')}</td>
          <td>${escapeHtml(i.licenseId?.licenseKey || '-')}</td>
          <td><strong>${formatCurrency(i.amount)}</strong> <span class="sf-muted">${escapeHtml(i.currency)}</span></td>
          <td>
            <select class="sf-select sf-select-sm" data-inv-status="${i._id}">
              <option value="unpaid" ${i.status === 'unpaid' ? 'selected' : ''}>Unpaid</option>
              <option value="paid" ${i.status === 'paid' ? 'selected' : ''}>Paid</option>
              <option value="void" ${i.status === 'void' ? 'selected' : ''}>Void</option>
            </select>
          </td>
          <td>${formatDate(i.dueAt)}</td>
          <td>${formatDate(i.createdAt)}</td>
          <td class="sf-actions">
            <button class="sf-btn secondary sf-btn-sm" data-inv-save="${i._id}">Save</button>
            <button class="sf-btn danger sf-btn-sm" data-inv-del="${i._id}">Delete</button>
          </td>
        </tr>`;
      }).join('');

      view.innerHTML = `
        <div class="sf-toggle-section sf-admin-card">
          <div class="sf-toggle-header" id="toggleCreateInvoice">
            <span>&#10133; Create Invoice</span>
          </div>
          <div class="sf-toggle-body" id="createInvoiceBody">
            <div class="sf-row">
              <input class="sf-input" id="invEmail" placeholder="User email" />
              <input class="sf-input" id="invLicense" placeholder="License key (optional)" />
              <input class="sf-input" id="invAmount" type="number" placeholder="Amount" min="0" step="0.01" />
              <select class="sf-select" id="invCurrency">
                <option>USD</option><option>EUR</option><option>GBP</option>
              </select>
              <select class="sf-select" id="invStatusCreate">
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="void">Void</option>
              </select>
              <input class="sf-input" id="invDue" type="date" />
              <button class="sf-btn" id="createInvoice">Create</button>
            </div>
          </div>
        </div>

        <div class="sf-admin-card">
          <h3>Invoices</h3>
          <div class="sf-row">
            <input class="sf-input" id="invSearch" placeholder="Search description" value="${escapeHtml(q.invSearch)}"/>
            <select class="sf-select" id="invStatusFilter">
              <option value="">All statuses</option>
              <option value="unpaid" ${q.invStatus === 'unpaid' ? 'selected' : ''}>Unpaid</option>
              <option value="paid" ${q.invStatus === 'paid' ? 'selected' : ''}>Paid</option>
              <option value="void" ${q.invStatus === 'void' ? 'selected' : ''}>Void</option>
            </select>
            <button class="sf-btn secondary" id="applyInvFilters">Apply</button>
          </div>
          <table class="sf-admin-table">
            <thead><tr>
              <th>User</th><th>License</th><th>Amount</th><th>Status</th><th>Due</th><th>Created</th><th></th>
            </tr></thead>
            <tbody>
              ${rows || '<tr><td colspan="7" class="sf-empty">No invoices found</td></tr>'}
            </tbody>
          </table>
          <div class="sf-pagination">
            <button class="sf-btn secondary sf-btn-sm" id="prevInvPage" ${q.invPage <= 1 ? 'disabled' : ''}>Prev</button>
            <span class="sf-muted">Page ${q.invPage} of ${pagination?.pages || 1}</span>
            <button class="sf-btn secondary sf-btn-sm" id="nextInvPage" ${(pagination?.pages || 1) <= q.invPage ? 'disabled' : ''}>Next</button>
          </div>
        </div>
      `;

      // Toggle create section
      document.getElementById('toggleCreateInvoice').onclick = function () {
        var body = document.getElementById('createInvoiceBody');
        this.classList.toggle('open');
        body.classList.toggle('open');
      };

      // Create invoice
      document.getElementById('createInvoice').onclick = async function () {
        var email = document.getElementById('invEmail').value.trim();
        var licenseKey = document.getElementById('invLicense').value.trim();
        var amount = Number(document.getElementById('invAmount').value);
        var currency = document.getElementById('invCurrency').value;
        var status = document.getElementById('invStatusCreate').value;
        var dueAt = document.getElementById('invDue').value;
        if (!email || !amount) { showToast('Email and amount are required', 'error'); return; }
        try {
          await api('/admin/invoices', {
            method: 'POST',
            body: JSON.stringify({ email: email, licenseKey: licenseKey, amount: amount, currency: currency, status: status, dueAt: dueAt })
          });
          showToast('Invoice created successfully');
          renderBilling();
        } catch (e) {
          showToast(e.message, 'error');
        }
      };

      // Filters
      document.getElementById('applyInvFilters').onclick = function () {
        setQuery({
          invSearch: document.getElementById('invSearch').value.trim(),
          invStatus: document.getElementById('invStatusFilter').value,
          invPage: 1
        });
        renderBilling();
      };

      // Pagination
      document.getElementById('prevInvPage').onclick = function () { setQuery({ invPage: q.invPage - 1 }); renderBilling(); };
      document.getElementById('nextInvPage').onclick = function () { setQuery({ invPage: q.invPage + 1 }); renderBilling(); };

      // Save status
      view.querySelectorAll('[data-inv-save]').forEach(function (btn) {
        btn.onclick = async function () {
          var select = document.querySelector('[data-inv-status="' + btn.dataset.invSave + '"]');
          try {
            await api('/admin/invoices/' + btn.dataset.invSave + '/status', {
              method: 'PUT',
              body: JSON.stringify({ status: select.value })
            });
            showToast('Invoice status updated');
            renderBilling();
          } catch (e) {
            showToast(e.message, 'error');
          }
        };
      });

      // Delete invoice
      view.querySelectorAll('[data-inv-del]').forEach(function (btn) {
        btn.onclick = async function () {
          if (!confirm('Delete this invoice?')) return;
          try {
            await api('/admin/invoices/' + btn.dataset.invDel, { method: 'DELETE' });
            showToast('Invoice deleted');
            renderBilling();
          } catch (e) {
            showToast(e.message, 'error');
          }
        };
      });

    } catch (e) {
      view.innerHTML = errorCard(e.message);
      showToast(e.message, 'error');
    }
  }

  // ─── Promo Codes ───────────────────────────────────────────

  async function renderPromos() {
    var view = renderShell('promos');
    var q = getQuery();
    view.innerHTML = loadingHtml();

    try {
      var resp = await api('/admin/promo-codes?limit=20&page=' + (q.page || 1) + '&search=' + encodeURIComponent(q.search || ''));
      var data = resp.data;
      var pagination = resp.pagination;

      var rows = data.map(function (p) {
        var maxLabel = p.maxUses > 0 ? p.maxUses : '\u221e';
        var pct = p.maxUses > 0 ? Math.min(100, Math.round((p.currentUses / p.maxUses) * 100)) : 0;
        var progressHtml = `
          <div class="sf-progress-wrap">
            <div class="sf-progress">
              <div class="sf-progress-bar" style="width:${pct}%"></div>
            </div>
            <span class="sf-muted">${p.currentUses} / ${maxLabel}</span>
          </div>
        `;

        return `<tr>
          <td><strong>${escapeHtml(p.code)}</strong></td>
          <td>${p.discount}%</td>
          <td>${(p.applicablePlans || []).map(function (pl) { return '<span class="sf-badge ' + planBadgeClass(pl) + '">' + planLabel(pl) + '</span>'; }).join(' ')}</td>
          <td>${progressHtml}</td>
          <td>${p.expiresAt ? formatDate(p.expiresAt) : 'Never'}</td>
          <td><span class="sf-badge ${p.isActive ? 'active' : 'inactive'}">${p.isActive ? 'Active' : 'Inactive'}</span></td>
          <td>${formatDate(p.createdAt)}</td>
          <td class="sf-actions">
            <button class="sf-btn ${p.isActive ? 'secondary' : ''} sf-btn-sm" data-toggle-promo="${p._id}" data-active="${p.isActive}">
              ${p.isActive ? 'Disable' : 'Enable'}
            </button>
            <button class="sf-btn danger sf-btn-sm" data-del-promo="${p._id}">Delete</button>
          </td>
        </tr>`;
      }).join('');

      view.innerHTML = `
        <div class="sf-toggle-section sf-admin-card">
          <div class="sf-toggle-header" id="toggleCreatePromo">
            <span>&#10133; Create Promo Code</span>
          </div>
          <div class="sf-toggle-body" id="createPromoBody">
            <div class="sf-row">
              <input class="sf-input" id="promoCode" placeholder="CODE (e.g. SUMMER2026)" style="text-transform:uppercase" />
              <input class="sf-input" id="promoDiscount" type="number" placeholder="Discount %" min="1" max="100" style="width:110px" />
              <select class="sf-select" id="promoPlans">
                <option value="all">All plans</option>
                <option value="pro_starter">Pro Starter</option>
                <option value="pro_business">Pro Business</option>
                <option value="pro_agency">Pro Agency</option>
                <option value="lifetime">Lifetime</option>
              </select>
              <input class="sf-input" id="promoMaxUses" type="number" placeholder="Max uses (0=unlimited)" min="0" style="width:150px" />
              <input class="sf-input" id="promoExpires" type="date" />
              <button class="sf-btn" id="createPromo">Create</button>
            </div>
          </div>
        </div>

        <div class="sf-admin-card">
          <h3>Promo Codes</h3>
          <div class="sf-row">
            <input class="sf-input" id="promoSearch" placeholder="Search code..." value="${escapeHtml(q.search || '')}" />
            <button class="sf-btn secondary" id="applyPromoFilters">Search</button>
          </div>
          <table class="sf-admin-table">
            <thead><tr>
              <th>Code</th><th>Discount</th><th>Plans</th><th>Usage</th><th>Expires</th><th>Status</th><th>Created</th><th></th>
            </tr></thead>
            <tbody>
              ${rows || '<tr><td colspan="8" class="sf-empty">No promo codes yet</td></tr>'}
            </tbody>
          </table>
          <div class="sf-pagination">
            <button class="sf-btn secondary sf-btn-sm" id="prevPromoPage" ${(q.page || 1) <= 1 ? 'disabled' : ''}>Prev</button>
            <span class="sf-muted">Page ${q.page || 1} of ${pagination?.pages || 1}</span>
            <button class="sf-btn secondary sf-btn-sm" id="nextPromoPage" ${(pagination?.pages || 1) <= (q.page || 1) ? 'disabled' : ''}>Next</button>
          </div>
        </div>
      `;

      // Toggle create section
      document.getElementById('toggleCreatePromo').onclick = function () {
        var body = document.getElementById('createPromoBody');
        this.classList.toggle('open');
        body.classList.toggle('open');
      };

      // Create promo
      document.getElementById('createPromo').onclick = async function () {
        var code = document.getElementById('promoCode').value.trim();
        var discount = Number(document.getElementById('promoDiscount').value);
        var plans = document.getElementById('promoPlans').value;
        var maxUses = Number(document.getElementById('promoMaxUses').value) || 0;
        var expiresAt = document.getElementById('promoExpires').value || null;
        if (!code || !discount) { showToast('Code and discount % are required', 'error'); return; }
        if (discount < 1 || discount > 100) { showToast('Discount must be 1-100%', 'error'); return; }
        try {
          await api('/admin/promo-codes', {
            method: 'POST',
            body: JSON.stringify({ code: code, discount: discount, applicablePlans: [plans], maxUses: maxUses, expiresAt: expiresAt })
          });
          showToast('Promo code created successfully');
          renderPromos();
        } catch (e) {
          showToast(e.message, 'error');
        }
      };

      // Search
      document.getElementById('applyPromoFilters').onclick = function () {
        setQuery({ search: document.getElementById('promoSearch').value.trim(), page: 1 });
        renderPromos();
      };

      document.getElementById('promoSearch').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          setQuery({ search: this.value.trim(), page: 1 });
          renderPromos();
        }
      });

      // Pagination
      document.getElementById('prevPromoPage').onclick = function () { setQuery({ page: (q.page || 1) - 1 }); renderPromos(); };
      document.getElementById('nextPromoPage').onclick = function () { setQuery({ page: (q.page || 1) + 1 }); renderPromos(); };

      // Toggle active
      view.querySelectorAll('[data-toggle-promo]').forEach(function (btn) {
        btn.onclick = async function () {
          var isActive = btn.dataset.active === 'true';
          try {
            await api('/admin/promo-codes/' + btn.dataset.togglePromo, {
              method: 'PUT',
              body: JSON.stringify({ isActive: !isActive })
            });
            showToast(isActive ? 'Promo code disabled' : 'Promo code enabled');
            renderPromos();
          } catch (e) {
            showToast(e.message, 'error');
          }
        };
      });

      // Delete promo
      view.querySelectorAll('[data-del-promo]').forEach(function (btn) {
        btn.onclick = async function () {
          if (!confirm('Delete this promo code?')) return;
          try {
            await api('/admin/promo-codes/' + btn.dataset.delPromo, { method: 'DELETE' });
            showToast('Promo code deleted');
            renderPromos();
          } catch (e) {
            showToast(e.message, 'error');
          }
        };
      });

    } catch (e) {
      view.innerHTML = errorCard(e.message);
      showToast(e.message, 'error');
    }
  }

  // ─── Router ────────────────────────────────────────────────

  if (path === '/dashboard') renderDashboard();
  else if (path === '/licenses') renderLicenses();
  else if (path === '/users') renderUsers();
  else if (path === '/billing') renderBilling();
  else if (path === '/promos') renderPromos();
})();

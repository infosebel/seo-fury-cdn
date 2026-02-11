(function () {
  var USER_ROUTES = [
    '/dashboard/my-profile',
    '/dashboard/my-licenses',
    '/dashboard/my-domains',
    '/dashboard/pricing'
  ];

  var path = location.pathname.replace(/\/+$/, '') || '/';

  // Only activate on user routes (not admin routes)
  var ADMIN_ROUTES = ['/dashboard', '/licenses', '/users', '/billing', '/promos'];
  if (ADMIN_ROUTES.includes(path)) return;
  if (!USER_ROUTES.includes(path)) return;

  var token = localStorage.getItem('token');
  var user = JSON.parse(localStorage.getItem('user') || 'null');

  if (!token) { location.href = '/login'; return; }

  // If admin, redirect to admin dashboard
  if (user && user.role === 'admin') { location.href = '/dashboard'; return; }

  // ─── Kill React ────────────────────────────────────────────
  function killReact() {
    var root = document.getElementById('root');
    if (root) {
      root.style.display = 'none';
      root.innerHTML = '';
    }
    var reactCSS = document.querySelector('link[href*="index-"]');
    if (reactCSS) reactCSS.remove();
  }
  killReact();
  setTimeout(killReact, 100);
  setTimeout(killReact, 500);

  // ─── Create app root ──────────────────────────────────────
  var appRoot = document.createElement('div');
  appRoot.id = 'sf-user';
  appRoot.className = 'sf-user-root';
  document.body.appendChild(appRoot);

  var API = 'https://api-ru.seo-fury.com/api/v1';

  // ─── Helpers ───────────────────────────────────────────────

  async function api(path, opts) {
    if (!opts) opts = {};
    var headers = Object.assign({}, opts.headers || {}, {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    });
    var res = await fetch(API + path, Object.assign({}, opts, { headers: headers }));
    var data = await res.json();
    if (!res.ok || data.success === false) throw new Error(data.error || 'Ошибка запроса');
    return data;
  }

  function showToast(msg, type) {
    if (!type) type = 'success';
    var t = document.createElement('div');
    t.className = 'sf-toast ' + type;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function planLabel(plan) {
    var map = {
      free: 'Бесплатный',
      pro_starter: 'Pro Starter',
      pro_business: 'Pro Business',
      pro_agency: 'Pro Agency',
      lifetime: 'Пожизненный'
    };
    return map[plan] || plan || 'Бесплатный';
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

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(function () { showToast('Скопировано!'); });
  }

  function loadingHtml() {
    return '<div class="sf-admin-card" style="display:flex;justify-content:center;padding:48px"><div class="sf-spinner"></div></div>';
  }

  function errorCard(message) {
    return '<div class="sf-admin-card sf-error-card"><strong>Error:</strong> ' + escapeHtml(message) + '</div>';
  }

  function avatarInitials(email) {
    if (!email) return '?';
    var parts = email.split('@')[0].split(/[._-]/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return email.substring(0, 2).toUpperCase();
  }

  // ─── Client-side routing ───────────────────────────────────

  var routeMap = {
    '/dashboard/my-profile': function () { renderProfile(); },
    '/dashboard/my-licenses': function () { renderLicenses(); },
    '/dashboard/my-domains': function () { renderDomains(); },
    '/dashboard/pricing': function () { renderPricing(); }
  };

  function navigateTo(route) {
    history.pushState(null, '', route);
    if (routeMap[route]) routeMap[route]();
  }

  window.addEventListener('popstate', function () {
    var p = location.pathname.replace(/\/+$/, '') || '/';
    if (routeMap[p]) routeMap[p]();
  });

  // ─── Shell ─────────────────────────────────────────────────

  function renderShell(active) {
    var initials = avatarInitials(user?.email || '');
    appRoot.innerHTML = '\
      <div class="sf-admin-header">\
        <div class="sf-logo">&#9889; SEO Fury</div>\
        <nav class="sf-admin-nav">\
          <a href="/dashboard/my-licenses" data-route="/dashboard/my-licenses" class="' + (active === 'licenses' ? 'active' : '') + '">Мои лицензии</a>\
          <a href="/dashboard/my-domains" data-route="/dashboard/my-domains" class="' + (active === 'domains' ? 'active' : '') + '">Мои домены</a>\
          <a href="/dashboard/pricing" data-route="/dashboard/pricing" class="' + (active === 'pricing' ? 'active' : '') + '">Тарифы</a>\
          <a href="/dashboard/my-profile" data-route="/dashboard/my-profile" class="' + (active === 'profile' ? 'active' : '') + '">Мой профиль</a>\
        </nav>\
        <div class="sf-header-right">\
          <div class="sf-user-header-avatar">' + escapeHtml(initials) + '</div>\
          <span class="sf-muted sf-user-email-header">' + escapeHtml(user?.email || '') + '</span>\
          <button class="sf-btn secondary" id="sf-logout">Выход</button>\
        </div>\
      </div>\
      <div class="sf-admin-container">\
        <div id="sf-user-view"></div>\
      </div>\
    ';

    // Intercept nav clicks
    appRoot.querySelectorAll('[data-route]').forEach(function (link) {
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

    return document.getElementById('sf-user-view');
  }

  // ─── My Profile ────────────────────────────────────────────

  async function renderProfile() {
    var view = renderShell('profile');
    view.innerHTML = loadingHtml();

    try {
      var resp = await api('/user/profile');
      var u = resp.data.user;

      var initials = avatarInitials(u.email);
      var memberSince = formatDate(u.createdAt);

      view.innerHTML = '\
        <div class="sf-profile-header-card sf-admin-card">\
          <div class="sf-profile-avatar-big">' + escapeHtml(initials) + '</div>\
          <div class="sf-profile-info">\
            <h2>' + escapeHtml(u.name || u.firstName || 'User') + '</h2>\
            <p class="sf-muted">' + escapeHtml(u.email) + '</p>\
            <p class="sf-muted" style="margin-top:4px">Участник с ' + memberSince + '</p>\
            <div style="margin-top:8px">' +
              (u.isEmailVerified
                ? '<span class="sf-badge active">&#10003; Email подтверждён</span>'
                : '<span class="sf-badge inactive">&#10007; Email не подтверждён</span>\
                   <button class="sf-btn sf-btn-sm" id="resendVerification" style="margin-left:8px">Отправить повторно</button>') +
          '\
          </div>\
        </div>\
        <div class="sf-profile-grid">\
          <div class="sf-admin-card">\
            <h3>&#128100; Личные данные</h3>\
            <div class="sf-form-group">\
              <label class="sf-label">Имя</label>\
              <input class="sf-input sf-full-width" id="profFirstName" value="' + escapeHtml(u.firstName || '') + '" placeholder="Ваше имя" />\
            </div>\
            <div class="sf-form-group">\
              <label class="sf-label">Фамилия</label>\
              <input class="sf-input sf-full-width" id="profLastName" value="' + escapeHtml(u.lastName || '') + '" placeholder="Ваша фамилия" />\
            </div>\
            <button class="sf-btn" id="saveProfile" style="margin-top:8px">Сохранить</button>\
          </div>\
          <div class="sf-admin-card">\
            <h3>&#128274; Сменить пароль</h3>\
            <div class="sf-form-group">\
              <label class="sf-label">Текущий пароль</label>\
              <input class="sf-input sf-full-width" id="curPassword" type="password" placeholder="Введите текущий пароль" />\
            </div>\
            <div class="sf-form-group">\
              <label class="sf-label">Новый пароль</label>\
              <input class="sf-input sf-full-width" id="newPassword" type="password" placeholder="Минимум 8 символов" />\
            </div>\
            <div class="sf-form-group">\
              <label class="sf-label">Подтвердите пароль</label>\
              <input class="sf-input sf-full-width" id="confirmPassword" type="password" placeholder="Повторите новый пароль" />\
            </div>\
            <button class="sf-btn" id="changePassword" style="margin-top:8px">Сменить пароль</button>\
          </div>\
        </div>\
      ';

      // Save profile
      document.getElementById('saveProfile').onclick = async function () {
        var firstName = document.getElementById('profFirstName').value.trim();
        var lastName = document.getElementById('profLastName').value.trim();
        try {
          await api('/user/profile', {
            method: 'PUT',
            body: JSON.stringify({
              firstName: firstName,
              lastName: lastName,
              name: (firstName + ' ' + lastName).trim()
            })
          });
          // Update localStorage
          if (user) {
            user.firstName = firstName;
            user.lastName = lastName;
            user.name = (firstName + ' ' + lastName).trim();
            localStorage.setItem('user', JSON.stringify(user));
          }
          showToast('Профиль обновлён');
        } catch (e) {
          showToast(e.message, 'error');
        }
      };

      // Change password
      document.getElementById('changePassword').onclick = async function () {
        var cur = document.getElementById('curPassword').value;
        var newP = document.getElementById('newPassword').value;
        var conf = document.getElementById('confirmPassword').value;
        if (!cur || !newP) { showToast('Заполните все поля', 'error'); return; }
        if (newP.length < 8) { showToast('Новый пароль должен быть не менее 8 символов', 'error'); return; }
        if (newP !== conf) { showToast('Пароли не совпадают', 'error'); return; }
        try {
          await api('/user/change-password', {
            method: 'PUT',
            body: JSON.stringify({ currentPassword: cur, newPassword: newP })
          });
          showToast('Пароль изменён');
          document.getElementById('curPassword').value = '';
          document.getElementById('newPassword').value = '';
          document.getElementById('confirmPassword').value = '';
        } catch (e) {
          showToast(e.message, 'error');
        }
      };

      // Resend verification
      var resendBtn = document.getElementById('resendVerification');
      if (resendBtn) {
        resendBtn.onclick = async function () {
          try {
            await api('/auth/resend-verification', { method: 'POST' });
            showToast('Письмо отправлено! Проверьте почту.');
            resendBtn.disabled = true;
            resendBtn.textContent = 'Отправлено!';
          } catch (e) {
            showToast(e.message, 'error');
          }
        };
      }

    } catch (e) {
      view.innerHTML = errorCard(e.message);
    }
  }

  // ─── My Licenses ───────────────────────────────────────────

  async function renderLicenses() {
    var view = renderShell('licenses');
    view.innerHTML = loadingHtml();

    try {
      var resp = await api('/user/my-licenses');
      var licenses = resp.data.licenses || [];

      if (licenses.length === 0) {
        view.innerHTML = '\
          <div class="sf-admin-card sf-text-center" style="padding:48px">\
            <div style="font-size:48px;margin-bottom:16px">&#128220;</div>\
            <h3>Лицензий пока нет</h3>\
            <p class="sf-muted" style="margin-top:8px">У вас ещё нет лицензий. Ознакомьтесь с тарифами!</p>\
            <a href="https://ru.seo-fury.com/seo-fury.zip" class="sf-btn sf-btn-outline" style="margin-top:16px;margin-right:8px" download>Скачать плагин</a>\
            <button class="sf-btn" style="margin-top:16px" id="goToPricing">Смотреть тарифы</button>\
          </div>\
        ';
        document.getElementById('goToPricing').onclick = function () { navigateTo('/dashboard/pricing'); };
        return;
      }

      var cardsHtml = licenses.map(function (l) {
        var domainsUsed = (l.activeDomains || []).length;
        var maxDomains = l.maxDomains || 1;
        var domainsPercent = Math.min(100, Math.round((domainsUsed / maxDomains) * 100));
        var maxLabel = maxDomains >= 999999 ? 'Безлимит' : maxDomains;

        var features = l.features || {};
        var featuresList = '';
        featuresList += '<li class="' + (features.advancedSeo ? 'sf-feature-on' : 'sf-feature-off') + '">Расширенное SEO</li>';
        featuresList += '<li class="' + (features.whiteLabel ? 'sf-feature-on' : 'sf-feature-off') + '">White Label</li>';
        featuresList += '<li class="' + (features.prioritySupport ? 'sf-feature-on' : 'sf-feature-off') + '">Приоритетная поддержка</li>';

        var domainsList = (l.activeDomains || []).map(function (d) {
          return '<div class="sf-domain-item">\
            <span class="sf-status-dot sf-dot-green"></span>\
            <span>' + escapeHtml(d.domain) + '</span>\
            <span class="sf-muted" style="margin-left:auto">' + formatDate(d.lastValidated || d.activatedAt) + '</span>\
          </div>';
        }).join('') || '<p class="sf-muted" style="padding:12px 0">Домены не подключены</p>';

        var statusBadge = l.status === 'active'
          ? '<span class="sf-badge active">Активна</span>'
          : '<span class="sf-badge inactive">' + escapeHtml(l.status) + '</span>';

        var expiryInfo = '';
        if (l.plan === 'lifetime' || l.plan === 'free') {
          expiryInfo = '<span class="sf-muted">Бессрочно</span>';
        } else if (l.expiresAt) {
          var daysLeft = Math.ceil((new Date(l.expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
          if (daysLeft > 0) {
            expiryInfo = '<span class="sf-muted">' + daysLeft + ' дн. осталось</span>';
          } else {
            expiryInfo = '<span style="color:#ef4444;font-weight:500">Истекла</span>';
          }
        }

        return '\
          <div class="sf-admin-card sf-license-card">\
            <div class="sf-license-card-header">\
              <div>\
                <span class="sf-badge ' + planBadgeClass(l.plan) + '">' + planLabel(l.plan) + '</span>\
                ' + statusBadge + '\
              </div>\
              <div class="sf-license-key-wrap">\
                <span class="sf-license-key">' + escapeHtml(l.licenseKey) + '</span>\
                <button class="sf-copy-btn" data-copy="' + escapeHtml(l.licenseKey) + '" title="Copy">&#128203;</button>\
              </div>\
            </div>\
            <div class="sf-license-card-body">\
              <div class="sf-license-meta">\
                <div class="sf-license-meta-item">\
                  <span class="sf-label">Домены</span>\
                  <div class="sf-progress-wrap" style="margin-top:4px">\
                    <div class="sf-progress" style="min-width:100px">\
                      <div class="sf-progress-bar" style="width:' + domainsPercent + '%"></div>\
                    </div>\
                    <span class="sf-muted">' + domainsUsed + ' / ' + maxLabel + '</span>\
                  </div>\
                </div>\
                <div class="sf-license-meta-item">\
                  <span class="sf-label">Срок действия</span>\
                  <div style="margin-top:4px">' + expiryInfo + '</div>\
                </div>\
                <div class="sf-license-meta-item">\
                  <span class="sf-label">Проверки</span>\
                  <div style="margin-top:4px"><strong>' + (l.validationCount || 0) + '</strong></div>\
                </div>\
              </div>\
              <div style="margin-top:16px">\
                <span class="sf-label">Возможности</span>\
                <ul class="sf-features-list">' + featuresList + '</ul>\
              </div>\
              <div style="margin-top:16px">\
                <span class="sf-label">Подключённые домены</span>\
                <div class="sf-domains-list">' + domainsList + '</div>\
              </div>\
            </div>\
          </div>\
        ';
      }).join('');

      view.innerHTML = '\
        <div class="sf-page-title-row">\
          <h2>Мои лицензии</h2>\
          <div>\
            <a href="https://ru.seo-fury.com/seo-fury.zip" class="sf-btn sf-btn-outline" style="margin-right:8px" download>Скачать плагин</a>\
            <button class="sf-btn" id="goToPricingBtn">Улучшить план</button>\
          </div>\
        </div>\
      ' + cardsHtml;

      // Copy buttons
      view.querySelectorAll('[data-copy]').forEach(function (btn) {
        btn.onclick = function () { copyToClipboard(btn.dataset.copy); };
      });

      var upgradeBtn = document.getElementById('goToPricingBtn');
      if (upgradeBtn) {
        upgradeBtn.onclick = function () { navigateTo('/dashboard/pricing'); };
      }

    } catch (e) {
      view.innerHTML = errorCard(e.message);
    }
  }

  // ─── My Domains ────────────────────────────────────────────

  async function renderDomains() {
    var view = renderShell('domains');
    view.innerHTML = loadingHtml();

    try {
      // Load licenses and domains in parallel
      var results = await Promise.all([
        api('/user/my-licenses'),
        api('/user/my-domains')
      ]);
      var licenses = results[0].data.licenses || [];
      var domains = results[1].data.domains || [];

      // Build add domain form (only if user has licenses with available slots)
      var licensesWithSlots = licenses.filter(function (l) {
        return l.status === 'active' && (l.activeDomains || []).length < (l.maxDomains || 1);
      });

      var addFormHtml = '';
      if (licensesWithSlots.length > 0) {
        var optionsHtml = licensesWithSlots.map(function (l) {
          var used = (l.activeDomains || []).length;
          var max = l.maxDomains >= 999999 ? 'Безлимит' : l.maxDomains;
          return '<option value="' + l._id + '">' + planLabel(l.plan) + ' (' + escapeHtml(l.licenseKey.substring(0, 14)) + '...) - ' + used + '/' + max + ' доменов</option>';
        }).join('');

        addFormHtml = '\
          <div class="sf-admin-card">\
            <h3>&#10133; Добавить домен</h3>\
            <div class="sf-row">\
              <select class="sf-select" id="addDomainLicense">' + optionsHtml + '</select>\
              <input class="sf-input" id="addDomainInput" placeholder="example.com" style="flex:1" />\
              <button class="sf-btn" id="addDomainBtn">Добавить домен</button>\
            </div>\
            <p class="sf-muted" style="margin-top:8px">Введите домен без http/https и www. Пример: mywebsite.com</p>\
          </div>\
        ';
      }

      // Build domains table
      var tableHtml = '';
      if (domains.length > 0) {
        var rows = domains.map(function (d) {
          return '<tr>\
            <td>\
              <div class="sf-user-cell">\
                <span class="sf-status-dot sf-dot-green"></span>\
                <strong>' + escapeHtml(d.domain) + '</strong>\
              </div>\
            </td>\
            <td>\
              <span class="sf-license-key">' + escapeHtml(d.licenseKey || '-') + '</span>\
            </td>\
            <td>' + formatDate(d.activatedAt) + '</td>\
            <td>\
              <button class="sf-btn danger sf-btn-sm" data-remove-domain="' + escapeHtml(d.domain) + '" data-license-id="' + escapeHtml(d.licenseId) + '">Удалить</button>\
            </td>\
          </tr>';
        }).join('');

        tableHtml = '\
          <div class="sf-admin-card">\
            <h3>Подключённые домены (' + domains.length + ')</h3>\
            <table class="sf-admin-table">\
              <thead><tr><th>Домен</th><th>Ключ лицензии</th><th>Активирован</th><th></th></tr></thead>\
              <tbody>' + rows + '</tbody>\
            </table>\
          </div>\
        ';
      } else {
        tableHtml = '\
          <div class="sf-admin-card sf-text-center" style="padding:48px">\
            <div style="font-size:48px;margin-bottom:16px">&#127760;</div>\
            <h3>Нет подключённых доменов</h3>\
            <p class="sf-muted" style="margin-top:8px">Добавьте ваш первый домен для использования SEO Fury.</p>\
          </div>\
        ';
      }

      view.innerHTML = '\
        <div class="sf-page-title-row">\
          <h2>Мои домены</h2>\
        </div>\
      ' + addFormHtml + tableHtml;

      // Add domain
      var addBtn = document.getElementById('addDomainBtn');
      if (addBtn) {
        addBtn.onclick = async function () {
          var licenseId = document.getElementById('addDomainLicense').value;
          var domain = document.getElementById('addDomainInput').value.trim().toLowerCase();
          if (!domain) { showToast('Введите домен', 'error'); return; }
          // Clean domain
          domain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
          try {
            await api('/user/my-domains/' + licenseId + '/add', {
              method: 'POST',
              body: JSON.stringify({ domain: domain })
            });
            showToast('Домен добавлен');
            renderDomains();
          } catch (e) {
            showToast(e.message, 'error');
          }
        };

        // Add on Enter key
        document.getElementById('addDomainInput').addEventListener('keydown', function (e) {
          if (e.key === 'Enter') addBtn.click();
        });
      }

      // Remove domain
      view.querySelectorAll('[data-remove-domain]').forEach(function (btn) {
        btn.onclick = async function () {
          var domain = btn.dataset.removeDomain;
          var licenseId = btn.dataset.licenseId;
          if (!confirm('Удалить домен "' + domain + '"? Вы сможете добавить его позже.')) return;
          try {
            await api('/user/my-domains/' + licenseId + '/remove', {
              method: 'POST',
              body: JSON.stringify({ domain: domain })
            });
            showToast('Домен удалён');
            renderDomains();
          } catch (e) {
            showToast(e.message, 'error');
          }
        };
      });

    } catch (e) {
      view.innerHTML = errorCard(e.message);
    }
  }

  // ─── Pricing ───────────────────────────────────────────────

  async function renderPricing() {
    var view = renderShell('pricing');

    var plans = [
      {
        name: 'Бесплатный',
        price: '$0',
        period: 'навсегда',
        badge: 'free',
        highlight: false,
        features: [
          { text: 'Безлимитное кол-во сайтов', on: true },
          { text: 'Базовые SEO функции', on: true },
          { text: '50 редиректов', on: true },
          { text: '100 404 логов', on: true },
          { text: 'Расширенное SEO', on: false },
          { text: 'White Label', on: false },
          { text: 'Приоритетная поддержка', on: false }
        ],
        cta: 'Текущий план',
        ctaDisabled: true
      },
      {
        name: 'Pro Starter',
        price: '$3',
        period: '/мес',
        badge: 'pro_starter',
        highlight: false,
        features: [
          { text: '3 сайта', on: true },
          { text: 'Базовые SEO функции', on: true },
          { text: 'Безлимитные редиректы', on: true },
          { text: 'Безлимитные 404 логи', on: true },
          { text: 'Расширенное SEO', on: true },
          { text: 'White Label', on: false },
          { text: 'Приоритетная поддержка', on: false }
        ],
        cta: 'Улучшить',
        ctaDisabled: false
      },
      {
        name: 'Pro Business',
        price: '$12',
        period: '/мес',
        badge: 'pro_business',
        highlight: true,
        features: [
          { text: '10 сайтов', on: true },
          { text: 'Базовые SEO функции', on: true },
          { text: 'Безлимитные редиректы', on: true },
          { text: 'Безлимитные 404 логи', on: true },
          { text: 'Расширенное SEO', on: true },
          { text: 'White Label', on: true },
          { text: 'Приоритетная поддержка', on: true }
        ],
        cta: 'Улучшить',
        ctaDisabled: false
      },
      {
        name: 'Pro Agency',
        price: '$27',
        period: '/мес',
        badge: 'pro_agency',
        highlight: false,
        features: [
          { text: 'Безлимит сайтов', on: true },
          { text: 'Базовые SEO функции', on: true },
          { text: 'Безлимитные редиректы', on: true },
          { text: 'Безлимитные 404 логи', on: true },
          { text: 'Расширенное SEO', on: true },
          { text: 'White Label', on: true },
          { text: 'Приоритетная поддержка', on: true }
        ],
        cta: 'Улучшить',
        ctaDisabled: false
      },
      {
        name: 'Пожизненный',
        price: '$300',
        period: 'разово',
        badge: 'lifetime',
        highlight: false,
        features: [
          { text: 'Безлимит сайтов', on: true },
          { text: 'Все Pro функции', on: true },
          { text: 'Безлимитные редиректы', on: true },
          { text: 'Безлимитные 404 логи', on: true },
          { text: 'Расширенное SEO', on: true },
          { text: 'White Label', on: true },
          { text: 'Приоритетная поддержка', on: true }
        ],
        cta: 'Купить навсегда',
        ctaDisabled: false
      }
    ];

    var cardsHtml = plans.map(function (p) {
      var featuresHtml = p.features.map(function (f) {
        return '<li class="' + (f.on ? 'sf-feature-on' : 'sf-feature-off') + '">' +
          (f.on ? '&#10003; ' : '&#10007; ') + escapeHtml(f.text) +
        '</li>';
      }).join('');

      return '\
        <div class="sf-pricing-card' + (p.highlight ? ' sf-pricing-popular' : '') + '">\
          ' + (p.highlight ? '<div class="sf-pricing-ribbon">Популярный</div>' : '') + '\
          <div class="sf-pricing-header">\
            <span class="sf-badge ' + p.badge + '">' + escapeHtml(p.name) + '</span>\
            <div class="sf-pricing-price">\
              <span class="sf-pricing-amount">' + p.price + '</span>\
              <span class="sf-pricing-period">' + p.period + '</span>\
            </div>\
          </div>\
          <ul class="sf-pricing-features">' + featuresHtml + '</ul>\
          <button class="sf-btn' + (p.highlight ? '' : ' secondary') + ' sf-pricing-cta" ' + (p.ctaDisabled ? 'disabled' : '') + '>' + p.cta + '</button>\
        </div>\
      ';
    }).join('');

    view.innerHTML = '\
      <div class="sf-page-title-row sf-text-center" style="flex-direction:column;gap:8px;margin-bottom:32px">\
        <h2>Выберите тариф</h2>\
        <p class="sf-muted" style="font-size:14px">Улучшите план для доступа к большему количеству сайтов и функций.</p>\
      </div>\
      <div class="sf-pricing-grid">\
        ' + cardsHtml + '\
      </div>\
      <div class="sf-admin-card sf-text-center" style="margin-top:24px">\
        <h3>Есть промокод?</h3>\
        <div class="sf-row" style="justify-content:center;margin-top:12px">\
          <input class="sf-input" id="promoInput" placeholder="Введите промокод" style="max-width:240px;text-transform:uppercase" />\
          <button class="sf-btn secondary" id="applyPromo">Применить</button>\
        </div>\
        <p id="promoResult" style="margin-top:8px"></p>\
      </div>\
      <div class="sf-admin-card sf-text-center" style="margin-top:16px">\
        <p class="sf-muted">Нужна помощь? Напишите нам: <strong>support@seo-fury.com</strong></p>\
      </div>\
    ';

    // Promo code validation (if endpoint exists)
    document.getElementById('applyPromo').onclick = function () {
      var code = document.getElementById('promoInput').value.trim();
      if (!code) { showToast('Введите промокод', 'error'); return; }
      document.getElementById('promoResult').innerHTML = '<span class="sf-muted">Промокод будет применён при оплате.</span>';
      showToast('Промокод применён');
    };
  }

  // ─── Router ────────────────────────────────────────────────

  if (path === '/dashboard/my-profile') renderProfile();
  else if (path === '/dashboard/my-licenses') renderLicenses();
  else if (path === '/dashboard/my-domains') renderDomains();
  else if (path === '/dashboard/pricing') renderPricing();

})();

(function (global) {
  'use strict';

  var _C = global.CONTRACTS || {};
  var VIEWS = _C.VIEWS || ['home', 'team', 'wallet', 'reports', 'settings', 'support'];
  var EV = _C.EVENTS || {};

  function el(id) { return document.getElementById(id); }

  var app = {
    currentView: 'home',
    chart: null,

    storage: global.storageService,
    bus: global.eventBus,
    ui: global.ui,
    i18n: global.i18n,

    dashboard: global.dashboardModule,
    team: global.teamModule,
    wallet: global.walletModule,
    reports: global.reportsModule,
    settings: global.settingsModule,
    support: global.supportModule,
    invest: global.investModule,

    t: function (k, v) { return (this.i18n && typeof this.i18n.t === 'function') ? this.i18n.t(k, v) : k; },

    _initDropdownOutside: function () {
      var self = this;
      var DROPDOWN_IDS = ['langDropdown', 'notifDropdown', 'profileDropdown'];
      var TOGGLE_BTN_SELECTORS = [
        'button[onclick*="toggleLangMenu"]',
        'button[onclick*="toggleNotifications"]',
        'button[onclick*="toggleProfileMenu"]'
      ].join(',');

      document.addEventListener('click', function (evt) {
        var tgt = evt.target;
        if (!tgt) return;

        var clickedInsideDropdown = DROPDOWN_IDS.some(function (id) {
          var d = document.getElementById(id);
          return d && (d === tgt || d.contains(tgt));
        });

        var clickedInsideToggle = false;
        if (tgt.closest) {
          clickedInsideToggle = !!tgt.closest(TOGGLE_BTN_SELECTORS);
        }

        if (clickedInsideDropdown || clickedInsideToggle) return;

        self._closeDropdowns(null);
      });

      document.addEventListener('keydown', function (evt) {
        if (evt.key === 'Escape') {
          self._closeDropdowns(null);
        }
      });
    },

    init: function () {
      if (this.storage) this.storage.init();

      if (this.i18n && typeof this.i18n.init === 'function') {
        var savedLang = (this.storage && typeof this.storage.getLanguage === 'function')
          ? this.storage.getLanguage()
          : 'pt';
        this.i18n.init(savedLang || 'pt');
      }
      if (this.i18n && typeof this.i18n.apply === 'function') this.i18n.apply();

      if (this.dashboard && typeof this.dashboard.init === 'function') this.dashboard.init();
      if (this.team && typeof this.team.init === 'function') this.team.init();
      if (this.wallet && typeof this.wallet.init === 'function') this.wallet.init();
      if (this.reports && typeof this.reports.init === 'function') this.reports.init();
      if (this.settings && typeof this.settings.init === 'function') this.settings.init();
      if (this.support && typeof this.support.init === 'function') this.support.init();
      if (this.invest && typeof this.invest.init === 'function') this.invest.init();

      if (global.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();

      this._initDropdownOutside();

      this.renderAll();

      if (this.dashboard) {
        if (typeof this.dashboard.initTradingChart === 'function') this.dashboard.initTradingChart();
        if (typeof this.dashboard.startPriceTickSimulation === 'function') this.dashboard.startPriceTickSimulation();
      }
    },

    navigateTo: function (view) {
      var self = this;
      this.currentView = view;
      this._closeDropdowns(null);
      VIEWS.forEach(function (v) {
        var e = el('view-' + v);
        if (e) e.classList.add('hidden');
      });
      var active = el('view-' + view);
      if (active) active.classList.remove('hidden');

      document.querySelectorAll('.nav-link').forEach(function (btn) {
        btn.classList.remove('text-amber-400', 'bg-dark-hover');
        btn.classList.add('text-gray-300');
      });
      var nav = el('nav-' + view);
      if (nav) {
        nav.classList.add('text-amber-400', 'bg-dark-hover');
        nav.classList.remove('text-gray-300');
      }

      VIEWS.forEach(function (v) {
        var mob = el('mob-nav-' + v);
        if (mob) {
          if (v === view) {
            mob.classList.add('text-amber-400');
            mob.classList.remove('text-gray-400');
          } else {
            mob.classList.remove('text-amber-400');
            mob.classList.add('text-gray-400');
          }
        }
      });

      this.renderAll();
    },

    renderAll: function () {
      this._renderProfile();
      if (this.i18n && typeof this.i18n.apply === 'function') this.i18n.apply();
      if (this.bus) this.bus.emit(EV.RENDER_REQUIRED);
      this._renderNotifications();
      if (global.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
    },

    _renderProfile: function () {
      if (!this.storage) return;
      var user = this.storage.getUser() || {};
      var setText = function (id, val) { var e = el(id); if (e) e.textContent = val; };
      setText('profileName', user.name || '');
      setText('profileUsername', '@' + (user.username || ''));
      setText('profileEmail', user.email || '');
      setText('profileSponsor', '@' + (user.sponsor || ''));
      var av = el('userAvatarChar');
      if (av) av.textContent = (user.name || 'G').charAt(0).toUpperCase();
    },

    _renderNotifications: function () {
      if (!this.storage) return;
      var notes = this.storage.getNotifications() || [];
      var badge = el('notifBadge');
      var list = el('notifList');
      if (badge) {
        badge.textContent = notes.length;
        badge.classList.toggle('hidden', notes.length === 0);
      }
      if (!list) return;
      if (notes.length === 0) {
        list.innerHTML = '<div class="p-4 text-center text-xs text-gray-500" data-i18n="notif_empty">Sem notificações</div>';
        if (this.i18n && typeof this.i18n.apply === 'function') {
          var empty = list.querySelector('[data-i18n="notif_empty"]');
          if (empty) empty.textContent = this.i18n.t('notif_empty');
        }
        if (!this.i18n || !this.i18n.t) {
          var d = list.querySelector('[data-i18n="notif_empty"]');
          if (d) d.textContent = 'Sem notificações';
        }
        return;
      }
      list.innerHTML = notes.map(function (n) {
        return (
          '<div class="p-3 text-xs hover:bg-dark-hover transition">' +
            '<div class="font-semibold text-gray-200">' + n.title + '</div>' +
            '<div class="text-[10px] text-gray-500 mt-1">' + n.date + '</div>' +
          '</div>'
        );
      }).join('');
    },

    clearNotifications: function () {
      if (!this.storage) return;
      this.storage.saveNotifications([]);
      this.renderAll();
    },

    resetAllData: function () {
      if (!this.storage || !this.bus || !this.ui) return;
      var msg = this.t ? this.t('reset_confirm_msg') : 'Tem certeza que deseja apagar todos os dados de teste e resetar o sistema?';
      if (!global.confirm(msg)) return;
      var prevLang = (this.storage && typeof this.storage.getLanguage === 'function')
        ? this.storage.getLanguage()
        : (this.i18n ? this.i18n.getLanguage() : 'pt');
      this.storage.resetToDefaults();
      if (this.storage && typeof this.storage.saveLanguage === 'function') {
        this.storage.saveLanguage(prevLang || 'pt');
      } else if (this.storage && this.storage.KEYS && this.storage.KEYS.LANG) {
        try { localStorage.setItem(this.storage.KEYS.LANG, prevLang || 'pt'); } catch (e) {}
      }
      if (this.i18n && typeof this.i18n.init === 'function') this.i18n.init(prevLang || 'pt');
      if (this.i18n && typeof this.i18n.apply === 'function') this.i18n.apply();
      this.bus.emit(EV.DATA_RESET);
      this.renderAll();
      this.ui.showToast(this.t ? this.t('dev_reset_confirm') : 'Dados resetados com sucesso!', 'success');
    },

    showToast: function (msg, type) {
      if (this.ui && typeof this.ui.showToast === 'function') return this.ui.showToast(msg, type);
    },

    openInvestModal: function () { if (this.invest) this.invest.openInvestModal(); },
    closeInvestModal: function () { if (this.invest) this.invest.closeInvestModal(); },
    updateInvestPoints: function () { if (this.invest) this.invest.updateInvestPoints(); },
    processSimulatedDeposit: function () { if (this.invest) this.invest.processSimulatedDeposit(); },
    copyDepositAddress: function () { if (this.invest) this.invest.copyDepositAddress(); },

    copyRefLink: function () { if (this.team) this.team.copyRefLink(); },
    claimTeamBonus: function () { if (this.team) this.team.claimTeamBonus(); },
    simAddReferral: function () { if (this.team) this.team.simAddReferral(); },
    simAddBinaryPoints: function () { if (this.team) this.team.simAddBinaryPoints(); },
    processBinaryPayout: function () { if (this.team) this.team.processBinaryPayout(); },

    simDailyYield: function () { if (this.dashboard) this.dashboard.simDailyYield(); },

    openWithdrawModal: function () { if (this.wallet) this.wallet.openWithdrawModal(); },
    closeWithdrawModal: function () { if (this.wallet) this.wallet.closeWithdrawModal(); },
    calculateWithdrawNet: function () { if (this.wallet) this.wallet.calculateWithdrawNet(); },
    executeWithdrawal: function () { if (this.wallet) this.wallet.executeWithdrawal(); },

    saveProfileSettings: function () { if (this.settings) this.settings.saveProfileSettings(); },
    saveWalletAddress: function () { if (this.settings) this.settings.saveWalletAddress(); },

    sendChatMessage: function () { if (this.support) this.support.sendChatMessage(); },

    filterReports: function (f) { if (this.reports) this.reports.filterReports(f); },

    toggleDevPanel: function () { var p = el('devPanel'); if (p) p.classList.toggle('hidden'); },

    _closeDropdowns: function (except) {
      var ids = ['langDropdown', 'notifDropdown', 'profileDropdown'];
      var self = this;
      ids.forEach(function (id) {
        if (id === except) return;
        self._closeDropdown(id);
      });
    },

    _closeDropdown: function (id) {
      var d = el(id);
      if (!d) return;
      d.classList.add('hidden');
      d.style.display = '';
    },

    _openDropdown: function (id) {
      var d = el(id);
      if (!d) return;
      d.classList.remove('hidden');
      if (id === 'langDropdown') {
        d.style.display = 'block';
      } else if (id === 'notifDropdown') {
        d.style.display = 'flex';
      } else {
        d.style.display = 'block';
      }
    },

    _toggleDropdown: function (id) {
      var d = el(id);
      if (!d) return;
      var wasOpen = !d.classList.contains('hidden');
      this._closeDropdowns(null);
      if (!wasOpen) {
        this._openDropdown(id);
      }
    },

    toggleLangMenu: function () { this._toggleDropdown('langDropdown'); },
    toggleNotifications: function () { this._toggleDropdown('notifDropdown'); },
    toggleProfileMenu: function () { this._toggleDropdown('profileDropdown'); },
    toggleMobileMenu: function () { this.navigateTo('settings'); },

    setLanguage: function (lang) {
      this._closeDropdown('langDropdown');
      if (this.i18n && typeof this.i18n.setLanguage === 'function') {
        this.i18n.setLanguage(lang);
      }
      if (this.ui && typeof this.ui.showToast === 'function') {
        var label = (this.i18n && typeof this.i18n.langFull === 'function')
          ? this.i18n.langFull()
          : lang.toUpperCase();
        this.ui.showToast((this.t ? this.t('lang_changed') : 'Idioma alterado para: ') + label, 'success');
      }
    }
  };

  global.app = app;

  global.addEventListener('load', function () {
    if (typeof app.init === 'function') app.init();
  });
})(window);

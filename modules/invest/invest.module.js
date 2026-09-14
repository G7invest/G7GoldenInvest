(function (global) {
  'use strict';

  var _i18n = global.i18n;
  var _t = function(k,v){ return _i18n && typeof _i18n.t==='function' ? _i18n.t(k,v) : k; };

  var _C = global.CONTRACTS || {};
  var EV = _C.EVENTS || {};
  var WL = _C.WALLET || { INVEST_MIN: 100 };

  function el(id) { return document.getElementById(id); }

  var investModule = {
    storage: global.storageService || null,
    bus: global.eventBus || null,
    ui: global.ui || null,
    sb: global.sb || global.SupabaseService || null,
    _pollTimer: null,

    init: function () {
      this._startAppsPolling();
    },

    _startAppsPolling: function () {
      var self = this;
      if (self._pollTimer) return;
      self._pollTimer = setInterval(function () {
        self._hydrateAppsIfAuthenticated();
      }, 15000);
    },

    _hydrateAppsIfAuthenticated: function () {
      var self = this;
      if (!this.sb || !this.sb.client || !this.sb.currentUser || !this.sb.currentUser.id) return;
      var uid = this.sb.currentUser.id;
      this.sb.client.from('apps')
        .select('id, user_id, amount, asset, plan, roi_expected, status, start_date, end_date, created_at, np_order_id, np_payment_id, np_status, pay_amount, pay_currency')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(30)
        .then(function (r) {
          if (!r || r.error) return;
          if (!r.data || !r.data.length) return;
          var apps = r.data.map(function (a) {
            return {
              id: a.id,
              amount: Number(a.amount || 0),
              asset: a.asset || 'XAU/USD',
              plan: a.plan || 'Standard',
              dailyRate: Number(a.roi_expected || 0),
              accumulatedGains: 0,
              date: a.created_at ? new Date(a.created_at).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
              status: a.status || 'Em Progresso',
              npOrderId: a.np_order_id || null,
              npStatus: a.np_status || null
            };
          });
          if (self.storage) self.storage.saveApplications(apps);
          if (self.bus) self.bus.emit(EV.RENDER_REQUIRED);
        })
        .catch(function () { /* noop */ });
    },

    openInvestModal: function () {
      var m = el('investModal');
      if (m) m.classList.remove('hidden');
      this.updateInvestPoints();
    },
    closeInvestModal: function () {
      var m = el('investModal');
      if (m) m.classList.add('hidden');
    },

    updateInvestPoints: function () {
      var inp = el('investAmountInput');
      var out = el('investPointsCalc');
      if (!inp || !out) return;
      var val = parseFloat(inp.value) || 0;
      out.textContent = _t('invest_points_label') + ' ' + val + ' Pontos (1 USD = 1 Pt)';
    },

    copyDepositAddress: function () {
      var addrEl = el('simulatedDepositAddress');
      if (!addrEl || !this.ui) return;
      var addr = (addrEl.textContent || '').trim();
      this.ui.copyToClipboard(addr);
      this.ui.showToast(_t('team_copy_ok'), 'success');
    },

    processSimulatedDeposit: function () {
      if (!this.storage || !this.bus || !this.ui) return;
      var input = el('investAmountInput');
      if (!input) return;
      var amount = parseFloat(input.value) || 0;
      if (amount < (WL.INVEST_MIN || 100)) {
        this.ui.showToast('invest_min_error' in (_i18n && _i18n.getDictionary ? (_i18n.getDictionary() || {}) : {}) ? _t('invest_min_error', {min: WL.INVEST_MIN || 100}) : 'Valor mínimo de aplicação é de $100 USD.', 'error');
        return;
      }

      var assetSel = el('investAssetSelect');
      var assetCode = assetSel ? (assetSel.value || 'usdttrc20') : 'usdttrc20';

      var NP = _C.NOWPAYMENTS || {};
      if (NP.ENABLED === true && this.sb && this.sb.currentUser && this.sb.currentUser.id) {
        this._processRealDepositNowPayments(amount, assetCode);
      } else {
        this._processFallbackDeposit(amount);
      }
    },

    _processFallbackDeposit: function (amount) {
      var self = this;
      if (!this.storage || !this.bus || !this.ui) return;
      var apps = this.storage.getApplications() || [];
      var txs = this.storage.getTransactions() || [];
      var notes = this.storage.getNotifications() || [];

      var newApp = {
        id: '#G7-' + String(apps.length + 1).padStart(4, '0'),
        amount: amount,
        points: amount,
        dailyRate: +(0.33 + Math.random() * 0.17).toFixed(2),
        accumulatedGains: 0,
        date: new Date().toLocaleDateString('pt-BR'),
        status: 'Ativa'
      };

      apps.unshift(newApp);
      this.storage.saveApplications(apps);

      txs.unshift({
        id: (this.ui && this.ui.generateTxId) ? this.ui.generateTxId() : ('tx-' + Date.now()),
        type: 'Depósito / Aplicação',
        date: new Date().toLocaleString('pt-BR'),
        amount: amount,
        status: 'Confirmado'
      });
      this.storage.saveTransactions(txs);

      notes.unshift({
        id: Date.now(),
        title: 'Aplicação de $' + amount + ' em XAU/USD confirmada!',
        date: new Date().toLocaleTimeString('pt-BR'),
        read: false
      });
      this.storage.saveNotifications(notes);

      this.closeInvestModal();
      this.bus.emit(EV.APPLICATION_CREATED, newApp);
      this.bus.emit(EV.TRANSACTION_ADDED);
      this.bus.emit(EV.NOTIFICATION_ADDED);
      this.bus.emit(EV.RENDER_REQUIRED);
      this.ui.showToast(_t('invest_ok'), 'success');
    },

    _processRealDepositNowPayments: function (amount, assetCode) {
      var self = this;
      if (!this.ui) return;
      var NP = _C.NOWPAYMENTS || {};
      var endpoint = NP.CREATE_ORDER_ENDPOINT || '';
      if (!endpoint) {
        this.ui.showToast('Configuração NowPayments ausente: CREATE_ORDER_ENDPOINT indefinido.', 'error');
        return;
      }
      var uid = self.sb && self.sb.currentUser && self.sb.currentUser.id ? self.sb.currentUser.id : null;
      if (!uid) {
        this.ui.showToast('Sessão expirada. Faça login novamente para depositar.', 'error');
        return;
      }
      self.ui.showToast('Gerando fatura de pagamento...', 'info');

      var body = {
        user_id: uid,
        amount_usd: Number(amount),
        asset_code: assetCode || 'usdttrc20',
        product_name: 'Aplicação XAU/USD G7 Gold Invest',
        success_url: (NP.RETURN_URLS && NP.RETURN_URLS.success) || (location.origin + '/index.html'),
        cancel_url:  (NP.RETURN_URLS && NP.RETURN_URLS.cancel)  || (location.origin + '/index.html')
      };

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); })
        .then(function (r) {
          if (!r.ok || !r.data || !r.data.appId || !r.data.invoiceUrl) {
          var errMsg = (r.data && (r.data.error || r.data.msg)) || ('NowPayments: falha ao criar fatura (' + r.status + ')');
          self.ui.showToast(errMsg, 'error');
          return;
        }
        if (self.ui) self.ui.showToast('Fatura NowPayments gerada. Redirecionando para pagamento...', 'success');
        setTimeout(function () {
          try { window.open(r.data.invoiceUrl, '_blank', 'noopener,noreferrer'); } catch (e) {}
        }, 250);
        self.closeInvestModal();
        if (self.bus) self.bus.emit(EV.APPLICATION_CREATED, { id: r.data.appId, amount: amount });
        if (self.bus) self.bus.emit(EV.RENDER_REQUIRED);
      })
      .catch(function (e) {
        if (self.ui) self.ui.showToast('Falha na conexão com NowPayments. Tente novamente.', 'error');
      });
    }
  };

  global.investModule = investModule;
})(window);

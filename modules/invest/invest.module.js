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
    sb: null,
    _pollTimer: null,
    _lastNowPayments: null,

    _refreshGlobals: function () {
      // Resolve refs DINAMICAMENTE (na hora da criação do objeto, global.sb ainda NÃO existia!)
      this.storage = global.storageService || this.storage || null;
      this.bus     = global.eventBus        || this.bus     || null;
      this.ui      = global.ui              || this.ui      || null;
      this.sb      = global.sb              || global.SupabaseService || this.sb || null;
    },

    init: function () {
      this._refreshGlobals();
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
      self._refreshGlobals();
      if (!self.sb || !self.sb.client || !self.sb.currentUser || !self.sb.currentUser.id) return;
      var uid = self.sb.currentUser.id;
      self.sb.client.from('apps')
        .select('id, user_id, amount, asset, plan, roi_expected, status, start_date, end_date, created_at, np_order_id, np_payment_id, np_status, pay_amount, pay_currency, np_invoice_url')
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
              npStatus: a.np_status || null,
              npPaymentId: a.np_payment_id || null,
              npInvoiceUrl: a.np_invoice_url || null,
              payAmount: a.pay_amount ? Number(a.pay_amount) : null,
              payCurrency: a.pay_currency || null
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
      this.clearNowPaymentsPanel();
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
      out.textContent = val + ' Pontos (1 USD = 1 Pt)';
    },

    copyDepositAddress: function () {
      var addrEl = el('npDepositAddress');
      if (!addrEl || !this.ui) return;
      var raw = (addrEl.textContent || '').trim();
      if (!raw || raw.indexOf('Clique') === 0 || raw.indexOf('⚡') === 0) {
        this.ui.showToast('Nenhum endereço gerado ainda. Clique no botão dourado "Gerar Pagamento NowPayments".', 'error');
        return;
      }
      this.ui.copyToClipboard(raw);
      this.ui.showToast(_t('team_copy_ok') || 'Endereço copiado para a área de transferência.', 'success');
    },

    clearNowPaymentsPanel: function () {
      this._lastNowPayments = null;
      var setText = function (id, txt) { var e = el(id); if (e) e.textContent = txt; };
      setText('npStatusBadge', 'Aguardando clique — gere a fatura');
      setText('npAmountUsd', '$ --');
      setText('npAmountCrypto', '--');
      setText('npOrderId', '--');
      setText('npDepositAddress', 'Clique no botão dourado abaixo para gerar endereço de pagamento.');
      var cls = ['bg-gray-500/20','text-gray-300','border-gray-500/30'];
      var bad = el('npStatusBadge');
      if (bad) { bad.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full ' + cls.join(' '); }
      var btn = el('btnInvestPrimaryLabel');
      if (btn) btn.textContent = 'Gerar Pagamento NowPayments';
      var icon = el('btnInvestPrimaryIcon');
      if (icon) icon.setAttribute('data-lucide', 'zap');
      var btnOpen = el('btnOpenNowPaymentsInvoice');
      if (btnOpen) btnOpen.classList.add('hidden');
      if (global.lucide && typeof global.lucide.createIcons === 'function') {
        try { global.lucide.createIcons(); } catch (e) {}
      }
    },

    _setStatusBadge: function (label, tone) {
      var bad = el('npStatusBadge');
      if (!bad) return;
      var toneMap = {
        gray:   'bg-gray-500/20 text-gray-300 border-gray-500/30',
        amber:  'bg-amber-500/20 text-amber-300 border-amber-500/40',
        blue:   'bg-blue-500/20 text-blue-300 border-blue-500/40',
        emerald:'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        red:    'bg-red-500/20 text-red-300 border-red-500/40'
      };
      bad.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full ' + (toneMap[tone] || toneMap.gray);
      bad.textContent = label;
    },

    _setPrimaryButton: function (label, iconName, disabled) {
      var l = el('btnInvestPrimaryLabel');
      var i = el('btnInvestPrimaryIcon');
      var b = el('btnInvestPrimary');
      if (l) l.textContent = label;
      if (i) { i.setAttribute('data-lucide', iconName || 'zap'); }
      if (b) { b.disabled = !!disabled; b.style.opacity = disabled ? '0.7' : '1'; b.style.cursor = disabled ? 'not-allowed' : 'pointer'; }
      if (global.lucide && typeof global.lucide.createIcons === 'function') {
        try { global.lucide.createIcons(); } catch (e) {}
      }
    },

    _renderNowPaymentsResult: function (npData) {
      if (!npData) return;
      this._lastNowPayments = npData;
      var setText = function (id, txt) { var e = el(id); if (e) e.textContent = txt; };
      setText('npAmountUsd', '$ ' + Number(npData.amountUsd || npData.amount_usd || 0).toFixed(2));
      var payCur  = (npData.payCurrency || npData.pay_currency || 'usdt').toUpperCase();
      var payAmt  = Number(npData.payAmount || npData.pay_amount || 0);
      setText('npAmountCrypto', (payAmt ? payAmt.toFixed(6) : '--') + ' ' + payCur);
      setText('npOrderId', npData.orderId || npData.np_order_id || npData.paymentId || '--');
      var address = npData.address || npData.payAddress || npData.walletAddress || '';
      var addrEl = el('npDepositAddress');
      if (address && addrEl) { addrEl.textContent = address; addrEl.classList.remove('justify-center','text-center'); addrEl.classList.add('text-left'); }
      var statusLabel = npData.statusLabel || npData.status || npData.npStatus || 'waiting';
      var tone = 'amber';
      if (/waiting|pending|confirm/i.test(statusLabel))          { tone = 'amber'; }
      else if (/confirming|confirmado|sending/i.test(statusLabel)){ tone = 'blue';  }
      else if (/finished|paid|paid_out|aprov/i.test(statusLabel)) { tone = 'emerald'; }
      else if (/fail|cancel|expired|rejected/i.test(statusLabel)) { tone = 'red';   }
      this._setStatusBadge('Pagamento NowPayments: ' + statusLabel, tone);
      var btnOpen = el('btnOpenNowPaymentsInvoice');
      if (btnOpen) {
        var inv = npData.invoiceUrl || npData.invoice_url || npData.npInvoiceUrl || '';
        if (inv) btnOpen.classList.remove('hidden'); else btnOpen.classList.add('hidden');
      }
      this._setPrimaryButton('Gerar NOVO endereço (alterar valor)', 'refresh-cw', false);
    },

    openNowPaymentsInvoice: function () {
      var d = this._lastNowPayments || {};
      var url = d.invoiceUrl || d.invoice_url || d.npInvoiceUrl || '';
      if (!url) {
        if (this.ui) this.ui.showToast('Nenhuma fatura aberta. Gere o pagamento primeiro.', 'error');
        return;
      }
      try { window.open(url, '_blank', 'noopener,noreferrer'); } catch (e) {}
    },

    processSimulatedDeposit: function () {
      this._refreshGlobals();
      if (!this.storage || !this.bus || !this.ui) return;
      var input = el('investAmountInput');
      if (!input) return;
      var amount = parseFloat(input.value) || 0;
      if (amount < (WL.INVEST_MIN || 100)) {
        this.ui.showToast('Valor mínimo de aplicação é de $100 USD.', 'error');
        return;
      }

      var assetSel   = el('investCryptoSelect');
      var netSel     = el('investNetworkSelect');
      var assetCode  = netSel ? (netSel.value || 'usdttrc20') : 'usdttrc20';

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
      this._renderNowPaymentsResult({
        amountUsd: amount,
        payAmount: amount,
        payCurrency: 'usdttrc20',
        orderId: 'LOCAL-DEV-' + Date.now(),
        address: 'FallbackDev: gere um ambiente real para usar NowPayments.',
        statusLabel: 'MODO LOCAL (fallback)',
        invoiceUrl: ''
      });
      this._setStatusBadge('⚠️ MODO FALLBACK LOCAL (desativar ENABLED=false liga NowPayments)', 'red');
    },

    _processRealDepositNowPayments: function (amount, assetCode) {
      var self = this;
      self._refreshGlobals();
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
      self._setStatusBadge('Gerando fatura NowPayments...', 'amber');
      self._setPrimaryButton('Aguarde — gerando endereço de pagamento...', 'loader-2', true);
      self.ui.showToast('Gerando fatura NowPayments via Edge Function...', 'info');

      var body = {
        user_id: uid,
        amount_usd: Number(amount),
        asset_code: assetCode || 'usdttrc20',
        product_name: 'Aplicação XAU/USD G7 Gold Invest',
        success_url: (NP.RETURN_URLS && NP.RETURN_URLS.success) || (location.origin + '/index.html'),
        cancel_url:  (NP.RETURN_URLS && NP.RETURN_URLS.cancel)  || (location.origin + '/index.html')
      };

      Promise.resolve().then(function () {
        if (self.sb && self.sb.client && self.sb.client.auth && typeof self.sb.client.auth.getSession === 'function') {
          return self.sb.client.auth.getSession().then(function (res) {
            return (res && res.data && res.data.session && res.data.session.access_token) || null;
          }).catch(function () { return null; });
        }
        return null;
      }).then(function (jwtToken) {
        var headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
        if (jwtToken) headers['Authorization'] = 'Bearer ' + jwtToken;
        return fetch(endpoint, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(body)
        });
      })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); })
        .then(function (r) {
          if (!r.ok || !r.data) {
            var errMsg = (r.data && r.data.msg) || (r.data && r.data.error) || ('NowPayments: falha ao criar fatura (' + r.status + ')');
            self._setStatusBadge('Erro ao gerar pagamento — tente novamente', 'red');
            self._setPrimaryButton('Gerar Pagamento NowPayments', 'zap', false);
            self.ui.showToast(errMsg, 'error');
            return;
          }
          self._renderNowPaymentsResult(r.data);
          self.ui.showToast('Endereço NowPayments gerado com sucesso! Copie o endereço acima ou abra a página oficial.', 'success');
          if (self.bus) self.bus.emit(EV.APPLICATION_CREATED, { id: r.data.appId, amount: amount });
          if (self.bus) self.bus.emit(EV.RENDER_REQUIRED);
        })
        .catch(function (e) {
          self._setStatusBadge('Falha na conexão — confira sua internet', 'red');
          self._setPrimaryButton('Gerar Pagamento NowPayments', 'zap', false);
          if (self.ui) self.ui.showToast('Falha na conexão com NowPayments. Tente novamente.', 'error');
        });
    }
  };

  global.investModule = investModule;
})(window);

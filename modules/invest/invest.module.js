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

    init: function () {},

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
        id: this.ui.generateTxId(),
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
    }
  };

  global.investModule = investModule;
})(window);

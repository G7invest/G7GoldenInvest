(function (global) {
  'use strict';

  var _i18n = global.i18n;
  var _t = function(k,v){ return _i18n && typeof _i18n.t==='function' ? _i18n.t(k,v) : k; };

  var _C = global.CONTRACTS || {};
  var EV = _C.EVENTS || {};
  var WL = _C.WALLET || { WITHDRAW_MIN: 50, WITHDRAW_FEE_PCT: 0.05 };

  function el(id) { return document.getElementById(id); }

  var walletModule = {
    storage: global.storageService || null,
    bus: global.eventBus || null,
    ui: global.ui || null,

    init: function () {
      if (this.bus) {
        this.bus.on(EV.RENDER_REQUIRED, this.render.bind(this));
        this.bus.on(EV.DATA_RESET, this.render.bind(this));
      }
    },

    render: function () {
      if (!this.storage) return;
      var w = this.storage.getWallet() || {};
      var user = this.storage.getUser() || {};

      var setText = function (id, val) { var e = el(id); if (e) e.textContent = val; };

      setText('walletTeamGains', '$' + (w.teamGains || 0).toFixed(2));
      setText('walletDailyGains', '$' + (w.dailyGains || 0).toFixed(2));
      setText('walletBonusGains', '$' + (w.bonusGains || 0).toFixed(2));
      setText('walletTotalGains', '$' + (w.totalGains || 0).toFixed(2));
      setText('walletTotalWithdrawn', '$' + (w.totalWithdrawn || 0).toFixed(2));
      setText('walletAvailable', '$' + (w.availableWithdraw || 0).toFixed(2));
      setText('withdrawWalletDest', user.walletAddress || _t('wallet_not_registered', 'Não cadastrada (Acesse Configurações)'));
    },

    openWithdrawModal: function () {
      var m = el('withdrawModal');
      if (m) m.classList.remove('hidden');
      this.calculateWithdrawNet();
    },
    closeWithdrawModal: function () {
      var m = el('withdrawModal');
      if (m) m.classList.add('hidden');
    },

    calculateWithdrawNet: function () {
      var input = el('withdrawAmountInput');
      if (!input) return;
      var amt = parseFloat(input.value) || 0;
      var fee = amt * (WL.WITHDRAW_FEE_PCT || 0.05);
      var net = Math.max(0, amt - fee);

      var feeEl = el('withdrawFeeDisplay');
      var netEl = el('withdrawNetDisplay');
      if (feeEl) feeEl.textContent = '-$' + fee.toFixed(2);
      if (netEl) netEl.textContent = '$' + net.toFixed(2) + ' USDT';
    },

    executeWithdrawal: function () {
      if (!this.storage || !this.bus || !this.ui) return;
      var user = this.storage.getUser() || {};
      if (!user.walletAddress) {
        this.ui.showToast(_t('wallet_wallet_error', 'Cadastre sua carteira de saque em Configurações antes de solicitar o saque!'), 'error');
        return;
      }

      var amtInput = el('withdrawAmountInput');
      if (!amtInput) return;
      var amt = parseFloat(amtInput.value) || 0;
      var wallet = this.storage.getWallet() || {};

      if (amt < (WL.WITHDRAW_MIN || 50)) {
        this.ui.showToast(_t('wallet_min_error', 'O valor mínimo para saque é de $50 USD.'), 'error');
        return;
      }
      if (amt > (wallet.availableWithdraw || 0)) {
        this.ui.showToast(_t('wallet_balance_error', 'Saldo disponível insuficiente para realizar este saque.'), 'error');
        return;
      }

      wallet.availableWithdraw -= amt;
      wallet.totalWithdrawn += amt;
      this.storage.saveWallet(wallet);

      var txs = this.storage.getTransactions() || [];
      txs.unshift({
        id: this.ui.generateTxId(),
        type: _t('wallet_withdraw_tx_type', 'Solicitação de Saque USDT BEP-20'),
        date: new Date().toLocaleString('pt-BR'),
        amount: -amt,
        status: _t('wallet_status_processing', 'Processando')
      });
      this.storage.saveTransactions(txs);

      this.closeWithdrawModal();
      this.bus.emit(EV.WALLET_UPDATED, wallet);
      this.bus.emit(EV.TRANSACTION_ADDED);
      this.bus.emit(EV.RENDER_REQUIRED);
      this.ui.showToast(_t('wallet_withdraw_ok', 'Saque solicitado com sucesso!'), 'success');
    }
  };

  global.walletModule = walletModule;
})(window);

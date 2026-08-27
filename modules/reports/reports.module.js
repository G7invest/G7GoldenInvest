(function (global) {
  'use strict';

  var _i18n = global.i18n;
  var _t = function(k,v){ return _i18n && typeof _i18n.t==='function' ? _i18n.t(k,v) : k; };

  var _C = global.CONTRACTS || {};
  var EV = _C.EVENTS || {};

  function el(id) { return document.getElementById(id); }

  var _txTypeMap = {
    'Rendimento Diário XAU/USD': 'reports_tx_daily',
    'Depósito / Aplicação': 'reports_tx_app',
    'Comissão Indicação': 'reports_tx_referral',
    'Bônus Binário': 'reports_tx_binary',
    'Bônus Equipe': 'reports_tx_team_bonus',
    'Saque Solicitado': 'reports_tx_withdraw'
  };

  var _txStatusMap = {
    'Creditado': 'reports_status_credited',
    'Confirmado': 'reports_status_confirmed',
    'Pendente': 'reports_status_pending',
    'Processado': 'reports_status_processed'
  };

  function _translateTxType(type) {
    if (!type) return type;
    var key = _txTypeMap[type];
    if (key) return _t(key);
    return type;
  }

  function _translateTxStatus(status) {
    if (!status) return status;
    var key = _txStatusMap[status];
    if (key) return _t(key);
    return status;
  }

  var reportsModule = {
    storage: global.storageService || null,
    bus: global.eventBus || null,
    currentFilter: 'all',

    init: function () {
      if (this.bus) {
        this.bus.on(EV.RENDER_REQUIRED, this.render.bind(this));
        this.bus.on(EV.DATA_RESET, this.render.bind(this));
      }
    },

    filterReports: function (filter) {
      this.currentFilter = filter;
      var buttons = document.querySelectorAll('.report-filter-btn');
      buttons.forEach(function (btn) {
        btn.className = 'report-filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-dark-hover text-gray-400 hover:text-white';
      });
      if (buttons.length) {
        var filterIndex = ['all', 'application', 'daily', 'team', 'withdraw'].indexOf(filter);
        if (filterIndex >= 0 && buttons[filterIndex]) {
          buttons[filterIndex].className = 'report-filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-black';
        }
      }
      this.render();
    },

    _matchFilter: function (tx) {
      var f = this.currentFilter;
      if (f === 'all') return true;
      var type = (tx.type || '').toLowerCase();
      if (f === 'application') return type.indexOf('depósito') >= 0 || type.indexOf('aplica') >= 0;
      if (f === 'daily') return type.indexOf('rendimento') >= 0 || type.indexOf('diário') >= 0 || type.indexOf('daily') >= 0;
      if (f === 'team') return type.indexOf('comissão') >= 0 || type.indexOf('binário') >= 0 || type.indexOf('bônus') >= 0 || type.indexOf('equipe') >= 0;
      if (f === 'withdraw') return type.indexOf('saque') >= 0;
      return true;
    },

    render: function () {
      if (!this.storage) return;
      var body = el('reportsTableBody');
      if (!body) return;

      var txs = (this.storage.getTransactions() || []).filter(this._matchFilter.bind(this));

      if (txs.length === 0) {
        body.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">' + _t('reports_empty') + '</td></tr>';
        return;
      }

      body.innerHTML = txs.map(function (tx) {
        var amtClass = tx.amount < 0 ? 'text-red-400' : 'text-emerald-400';
        var sign = tx.amount < 0 ? '-' : '+';
        var txType = _translateTxType(tx.type);
        var txStatus = _translateTxStatus(tx.status);
        return (
          '<tr class="hover:bg-dark-hover transition">' +
            '<td class="p-4 text-amber-400 font-bold">' + tx.id + '</td>' +
            '<td class="p-4">' + txType + '</td>' +
            '<td class="p-4 text-gray-400">' + tx.date + '</td>' +
            '<td class="p-4 font-bold ' + amtClass + '">' + sign + '$' + Math.abs(tx.amount).toFixed(2) + '</td>' +
            '<td class="p-4"><span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">' + txStatus + '</span></td>' +
          '</tr>'
        );
      }).join('');
    }
  };

  global.reportsModule = reportsModule;
})(window);

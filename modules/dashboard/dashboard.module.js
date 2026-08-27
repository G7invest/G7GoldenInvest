(function (global) {
  'use strict';

  var _i18n = global.i18n;
  var _t = function(k,v){ return _i18n && typeof _i18n.t==='function' ? _i18n.t(k,v) : k; };

  var _C = global.CONTRACTS || {};
  var EV = _C.EVENTS || {};

  function el(id) { return document.getElementById(id); }

  var dashboardModule = {
    storage: global.storageService || null,
    bus: global.eventBus || null,
    ui: global.ui || null,
    chart: null,

    init: function () {
      if (this.bus) {
        this.bus.on(EV.RENDER_REQUIRED, this.render.bind(this));
        this.bus.on(EV.DATA_RESET, this.render.bind(this));
      }
    },

    render: function () {
      if (!this.storage) return;
      var wallet = this.storage.getWallet() || {};
      var todayGains = wallet.dailyGains || 0;

      var setText = function (id, value) {
        var e = el(id);
        if (e) e.textContent = value;
      };

      setText('statTodayGains', '+ $' + todayGains.toFixed(2));
      setText('statTeamGains', '$' + (wallet.teamGains || 0).toFixed(2));
      setText('statTotalGains', '$' + (wallet.totalGains || 0).toFixed(2));
      setText('statAvailableWithdraw', '$' + (wallet.availableWithdraw || 0).toFixed(2));

      this.renderApplications(this.storage.getApplications() || []);
    },

    renderApplications: function (apps) {
      var container = el('applicationsContainer');
      if (!container) return;

      if (apps.length === 0) {
        container.innerHTML =
          '<div class="col-span-full bg-dark-card border border-dark-border rounded-xl p-8 text-center text-gray-400 space-y-3">' +
            '<i data-lucide="inbox" class="w-10 h-10 mx-auto text-amber-500/40"></i>' +
            '<p class="text-sm font-medium">' + _t('apps_empty') + '</p>' +
            '<button onclick="app.openInvestModal()" class="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold inline-flex items-center gap-1">' +
              '<i data-lucide="plus" class="w-4 h-4"></i> ' + _t('apps_first_btn') +
            '</button>' +
          '</div>';
        if (global.lucide) lucide.createIcons();
        return;
      }

      container.innerHTML = apps.map(function (a) {
        var target = a.amount * 2;
        var currentValue = a.amount + a.accumulatedGains;
        var progressPct = Math.min((a.accumulatedGains / a.amount) * 100, 100).toFixed(2);
        var isCompleted = a.accumulatedGains >= a.amount;
        var statusClass = isCompleted
          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
        var statusText = isCompleted ? _t('app_card_status_goal') : _t('app_card_status_active');

        return (
          '<div class="gold-border-card p-4 space-y-3">' +
            '<div class="flex justify-between items-center border-b border-dark-border pb-2">' +
              '<span class="font-mono text-xs text-amber-400 font-bold">' + a.id + '</span>' +
              '<span class="text-[10px] px-2 py-0.5 rounded-full ' + statusClass + ' font-semibold">' + statusText + '</span>' +
            '</div>' +
            '<div class="grid grid-cols-2 gap-2 text-xs">' +
              '<div><span class="text-gray-400 block text-[10px]">' + _t('app_card_value') + '</span><strong class="text-white text-sm">$' + a.amount.toFixed(2) + '</strong></div>' +
              '<div><span class="text-gray-400 block text-[10px]">' + _t('app_card_current') + '</span><strong class="text-white text-sm">$' + currentValue.toFixed(2) + '</strong></div>' +
              '<div><span class="text-gray-400 block text-[10px]">' + _t('app_card_earned') + '</span><strong class="text-emerald-400 text-sm">$' + a.accumulatedGains.toFixed(2) + '</strong></div>' +
              '<div><span class="text-gray-400 block text-[10px]">' + _t('app_card_rate') + '</span><strong class="text-amber-400">' + a.dailyRate + '% / dia</strong></div>' +
              '<div><span class="text-gray-400 block text-[10px]">' + _t('app_card_goal') + '</span><strong class="text-gray-300">$' + target.toFixed(2) + '</strong></div>' +
            '</div>' +
            '<div class="space-y-1 pt-1">' +
              '<div class="flex justify-between text-[11px] text-gray-400 font-mono"><span>Progresso do Ciclo</span><span class="text-amber-400 font-bold">' + progressPct + '%</span></div>' +
              '<div class="w-full h-2.5 bg-dark-bg rounded-full overflow-hidden border border-dark-border">' +
                '<div class="h-full gold-bg-gradient rounded-full shadow-lg" style="width:' + progressPct + '%"></div>' +
              '</div>' +
            '</div>' +
          '</div>'
        );
      }).join('');
      if (global.lucide) lucide.createIcons();
    },

    simDailyYield: function () {
      if (!this.storage || !this.bus || !this.ui) return;
      var apps = this.storage.getApplications() || [];
      if (apps.length === 0) {
        this.ui.showToast('Você precisa ter pelo menos 1 aplicação ativa para gerar rendimento.', 'error');
        return;
      }

      var wallet = this.storage.getWallet() || {};
      var totalGainToday = 0;
      apps.forEach(function (a) {
        if (a.accumulatedGains < a.amount) {
          var gain = a.amount * (a.dailyRate / 100);
          a.accumulatedGains += gain;
          totalGainToday += gain;
        }
      });

      this.storage.saveApplications(apps);
      wallet.dailyGains += totalGainToday;
      wallet.totalGains += totalGainToday;
      wallet.availableWithdraw += totalGainToday;
      this.storage.saveWallet(wallet);

      var txs = this.storage.getTransactions() || [];
      txs.unshift({
        id: this.ui.generateTxId(),
        type: 'Rendimento Diário XAU/USD',
        date: new Date().toLocaleString('pt-BR'),
        amount: totalGainToday,
        status: 'Creditado'
      });
      this.storage.saveTransactions(txs);

      this.bus.emit(EV.WALLET_UPDATED, wallet);
      this.bus.emit(EV.TRANSACTION_ADDED);
      this.bus.emit(EV.RENDER_REQUIRED);
      this.ui.showToast(_t('dev_daily_yield_ok') + ' +$' + totalGainToday.toFixed(2) + ' ' + _t('dev_daily_yield_simulated'), 'success');
    },

    initTradingChart: function () {
      var ctxEl = el('xauChartCanvas');
      if (!ctxEl || !global.Chart) return;
      var ctx = ctxEl.getContext('2d');
      var labels = Array.from({ length: 20 }, function (_, i) { return (i + 1) + 'm'; });
      var dataPoints = [2740, 2742, 2741, 2744, 2743, 2746, 2745, 2747, 2746, 2748, 2747, 2749, 2748, 2750, 2749, 2751, 2750, 2752, 2751, 2753];

      this.chart = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: [{
          label: 'XAU/USD',
          data: dataPoints,
          borderColor: '#EAB308',
          borderWidth: 2,
          tension: 0.3,
          fill: true,
          backgroundColor: function (context) {
            var bgCtx = context.chart.ctx;
            var grad = bgCtx.createLinearGradient(0, 0, 0, 300);
            grad.addColorStop(0, 'rgba(234, 179, 8, 0.3)');
            grad.addColorStop(1, 'rgba(234, 179, 8, 0.0)');
            return grad;
          },
          pointRadius: 2,
          pointHoverRadius: 5
        }]},
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: '#1E2638' }, ticks: { color: '#6B7280' } },
            y: { grid: { color: '#1E2638' }, ticks: { color: '#6B7280' } }
          }
        }
      });
    },

    startPriceTickSimulation: function () {
      var self = this;
      setInterval(function () {
        if (!self.chart) return;
        var ds = self.chart.data.datasets[0];
        var last = ds.data[ds.data.length - 1];
        var delta = (Math.random() - 0.48) * 1.5;
        var np = Math.max(2700, +(last + delta).toFixed(2));
        ds.data.shift();
        ds.data.push(np);
        self.chart.update('none');

        var p = el('chartLivePrice');
        if (p) p.textContent = '$' + np.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      }, 3000);
    }
  };

  global.dashboardModule = dashboardModule;
})(window);

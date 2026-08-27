(function (global) {
  'use strict';

  var ui = {
    showToast: function (msg, type) {
      if (type === void 0) type = 'info';
      var container = document.getElementById('toastContainer');
      if (!container) return;

      var toast = document.createElement('div');
      var icon = type === 'success' ? 'check-circle' : 'alert-circle';
      var classes = type === 'success'
        ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
        : 'bg-red-950 text-red-300 border-red-500/40';

      toast.className = 'p-3 rounded-xl text-xs font-semibold shadow-2xl flex items-center gap-2 pointer-events-auto border transition-all duration-300 ' + classes;
      toast.innerHTML = '<i data-lucide="' + icon + '" class="w-4 h-4"></i> ' + msg;
      container.appendChild(toast);
      if (global.lucide && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
      }

      setTimeout(function () {
        toast.style.opacity = '0';
        setTimeout(function () {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
      }, 3000);
    },

    copyToClipboard: function (text) {
      if (navigator && navigator.clipboard) {
      try {
    navigator.clipboard.writeText(text);
    return Promise.resolve(true);
  } catch (e) {
    console.warn('Clipboard write failed', e);
  }
}
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      return true;
    },

    generateTxId: function () {
      return 'TX-' + Math.floor(100000 + Math.random() * 900000);
    },

    formatCurrency: function (val) {
      return '$' + (Number(val) || 0).toFixed(2);
    },

    formatPercent: function (val, digits) {
      if (digits === void 0) digits = 2;
      return (Number(val) || 0).toFixed(digits) + '%';
    }
  };

  global.ui = ui;
})(window);

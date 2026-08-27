(function (global) {
  'use strict';

  var _i18n = global.i18n;
  var _t = function(k,v){ return _i18n && typeof _i18n.t==='function' ? _i18n.t(k,v) : k; };

  function el(id) { return document.getElementById(id); }

  var supportModule = {
    init: function () {
      var input = el('chatInput');
      if (input) input.setAttribute('placeholder', _t('support_chat_placeholder'));
      var box = el('chatMessages');
      if (box && box.children.length === 0) {
        box.innerHTML =
          '<div class="flex items-start gap-2">' +
            '<div class="w-7 h-7 rounded-full gold-bg-gradient text-black flex items-center justify-center font-bold text-[10px]">G7</div>' +
            '<div>' +
              '<div class="text-[10px] text-gray-400 mb-1">' + _t('support_chat_g7') + ':</div>' +
              '<div class="bg-dark-hover border border-dark-border p-3 rounded-2xl rounded-tl-none max-w-xs text-xs text-gray-200">' +
                _t('support_chat_g7_auto') +
              '</div>' +
            '</div>' +
          '</div>';
      }
    },

    sendChatMessage: function () {
      var input = el('chatInput');
      var box = el('chatMessages');
      if (!input || !box) return;

      var text = (input.value || '').trim();
      if (!text) return;

      box.innerHTML +=
        '<div class="flex items-start gap-2 justify-end">' +
          '<div class="text-[10px] text-gray-400 self-end mb-1">' + _t('support_chat_me') + ':</div>' +
          '<div class="bg-amber-500/20 border border-amber-500/30 p-3 rounded-2xl rounded-tr-none max-w-xs text-xs text-white">' +
            text +
          '</div>' +
        '</div>';
      input.value = '';

      setTimeout(function () {
        box.innerHTML +=
          '<div class="flex items-start gap-2">' +
            '<div class="w-7 h-7 rounded-full gold-bg-gradient text-black flex items-center justify-center font-bold text-[10px]">G7</div>' +
            '<div>' +
              '<div class="text-[10px] text-gray-400 mb-1">' + _t('support_chat_g7') + ':</div>' +
              '<div class="bg-dark-hover border border-dark-border p-3 rounded-2xl rounded-tl-none max-w-xs text-xs text-gray-200">' +
                'Obrigado pelo contato! Um atendente especializado em XAU/USD responderá em instantes.' +
              '</div>' +
            '</div>' +
          '</div>';
        box.scrollTop = box.scrollHeight;
      }, 1000);

      box.scrollTop = box.scrollHeight;
    }
  };

  global.supportModule = supportModule;
})(window);

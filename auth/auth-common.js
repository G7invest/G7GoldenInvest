/* ==================================================================
 *  auth/auth-common.js — SCRIPTS COMPARTILHADOS (Login / Register / Forgot / Reset)
 *  Funcionalidades:
 *    1) Carrega SDK Supabase (CDN) se não carregado
 *    2) Olho mágico (exibe/oculta senha) em campos [data-eye]
 *    3) Botão seletor Idioma (🇧🇷 PT-BR / 🇺🇸 EN / 🇪🇸 ES)
 *    4) Carrega i18n e aplica data-i18n na página
 *    5) Helper toast, loader, validação de erros em formulários
 *    6) Carrega módulos auth.module + supabase.core
 * ================================================================== */
(function (global) {
  'use strict';

  var BASE = '..';  // todos arquivos auth/ estão 1 nível abaixo da raiz
  var CB = 'v=27082026-1420';  // Cache buster (altere o número a cada deploy!)
  var SCRIPTS = [
    BASE + '/modules/core/storage.js?' + CB,
    BASE + '/modules/core/eventbus.js?' + CB,
    BASE + '/modules/core/i18n.js?' + CB,
    BASE + '/modules/core/ui.js?' + CB,
    BASE + '/modules/core/supabase.js?' + CB,
    BASE + '/modules/auth/auth.module.js?' + CB
  ];
  var SDK_URL =
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js?' + CB;

  var langMap = {
    'PT': { flag: '🇧🇷', label: 'PT-BR' },
    'EN': { flag: '🇺🇸', label: 'EN-US' },
    'ES': { flag: '🇪🇸', label: 'ES'   }
  };

  function loadScript(url, opts) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      if (opts && opts.module) s.type = 'module';
      s.async = !(opts && opts.async === false);
      s.onload = function () { resolve(); };
      s.onerror = function (e) { console.warn('[auth-common] Falhou:', url, e); resolve(); };
      document.head.appendChild(s);
    });
  }

  function applyI18n() {
    var i18n = global.i18nService || global.I18n;
    if (!i18n || typeof i18n.t !== 'function') return;
    var t = i18n.t.bind(i18n);

    function _qsa(sel){ try { return document.querySelectorAll(sel); } catch (e) { return []; } }

    _qsa('[data-i18n]').forEach(function (el) {
      var k = el.getAttribute('data-i18n');
      var v = t(k);
      if (v !== k) el.textContent = v;
    });
    _qsa('[data-i18n-ph]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-ph');
      var v = t(k);
      if (v !== k) el.setAttribute('placeholder', v);
    });
    _qsa('[data-i18n-title]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-title');
      var v = t(k);
      if (v !== k) el.setAttribute('title', v);
    });
    // page <title>
    var k = document.documentElement.getAttribute('data-i18n-title');
    if (k) {
      var tv = t(k);
      if (tv !== k) document.title = tv;
    }
  }

  function setupEyeButtons() {
    try {
      document.querySelectorAll('[data-eye]').forEach(function (wrap) {
        var input = wrap.querySelector('input[type="password"], input[type="text"]');
        var btn = wrap.querySelector('.eye');
        if (!input || !btn) return;
        btn.addEventListener('click', function () {
          var isPw = input.type === 'password';
          input.type = isPw ? 'text' : 'password';
          btn.innerHTML = isPw ? iconEyeOff() : iconEyeOn();
          btn.setAttribute('aria-pressed', String(isPw));
        });
      });
    } catch (e) {}
  }

  function iconEyeOn() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  }
  function iconEyeOff() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19C5.5 19 2 12 2 12a17.86 17.86 0 0 1 4.22-5.36"/><path d="M22.54 12.88A17.9 17.9 0 0 0 22 12s-3.5-7-10-7a10.9 10.9 0 0 0-3.94.73"/><path d="M1 1l22 22"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a17.9 17.9 0 0 1-.54.88"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3.5 7 10 7a9.12 9.12 0 0 0 2.39-.31"/></svg>';
  }

  function setupLangSelector() {
    try {
      var selects = document.querySelectorAll('select.auth-lang');
      if (!selects.length) return;
      selects.forEach(function (sel) {
        // populates if empty
        if (!sel.options.length) {
          ['PT','EN','ES'].forEach(function (code) {
            var o = document.createElement('option');
            o.value = code;
            o.textContent = langMap[code].flag + '  ' + langMap[code].label;
            sel.appendChild(o);
          });
        }
        // valor atual
        var auth = global.authService || { getLanguage: function () { return 'PT'; } };
        var cur = auth.getLanguage ? auth.getLanguage() : 'PT';
        sel.value = cur;
        sel.addEventListener('change', function () {
          if (auth && auth.setLanguage) auth.setLanguage(sel.value);
          applyI18n();
        });
      });
    } catch (e) {}
  }

  function showToast(text, type) {
    type = type || 'info';
    try {
      if (global.showToast && typeof global.showToast === 'function') {
        global.showToast(text); return;
      }
    } catch (e) {}
    // fallback inline
    var t = document.createElement('div');
    t.style.cssText =
      'position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:999999;' +
      'padding:12px 18px;border-radius:14px;font-weight:700;font-size:14px;box-shadow:0 10px 40px rgba(0,0,0,.45);' +
      'border:1px solid ' + (type==='error' ? 'rgba(248,113,113,.45)' : 'rgba(242,201,76,.45)') + ';' +
      'background:' + (type==='error' ? '#2A1317' : '#1E1B08') + ';' +
      'color:' + (type==='error' ? '#FCA5A5' : '#F5D06A') + ';' +
      'animation:__t 3.2s ease forwards;';
    t.innerHTML = text;
    if (!document.getElementById('__ta')) {
      var s = document.createElement('style');
      s.id = '__ta';
      s.textContent = '@keyframes __t{0%{opacity:0;transform:translate(-50%,-12px)}8%{opacity:1;transform:translate(-50%,0)}85%{opacity:1}100%{opacity:0;transform:translate(-50%,-8px);visibility:hidden}}';
      document.head.appendChild(s);
    }
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3400);
  }

  function setFieldError(name, msg) {
    try {
      var input = document.querySelector('[name="' + name + '"]');
      if (!input) return;
      var wrap = input.closest('.input-wrap');
      var field = input.closest('.field');
      var errSpan = field && field.querySelector('.err');
      if (input) input.classList.toggle('error', !!msg);
      if (wrap)  wrap.classList.toggle('error',  !!msg);
      if (errSpan) errSpan.textContent = msg || '';
    } catch (e) {}
  }
  function clearAllErrors() {
    try {
      document.querySelectorAll('.field .err').forEach(function (e){ e.textContent=''; });
      document.querySelectorAll('input.error, .input-wrap.error').forEach(function (e){ e.classList.remove('error'); });
      var g = document.getElementById('globalAlert');
      if (g) g.remove();
    } catch (e) {}
  }
  function setGlobalAlert(msg, type) {
    type = type || 'error';
    var d = document.getElementById('globalAlert') || (function () {
      var wrap = document.getElementById('alerts');
      if (!wrap) return null;
      var x = document.createElement('div');
      x.id = 'globalAlert';
      x.className = 'global-alert';
      wrap.prepend(x);
      return x;
    })();
    if (!d) return;
    d.classList.toggle('success', type === 'success');
    d.innerHTML = msg;
  }

  function setBtnLoading(btn, loading, label) {
    if (!btn) return;
    btn.disabled = !!loading;
    if (loading) {
      btn.dataset._orig = btn.innerHTML;
      btn.innerHTML = '<span class="loader"></span>' + (label || '…');
    } else {
      if (btn.dataset._orig) btn.innerHTML = btn.dataset._orig;
    }
  }

  function getQueryParam(name) {
    try {
      var p = new URLSearchParams(location.search);
      return p.get(name) || p.get(name.toLowerCase());
    } catch (e) { return null; }
  }

  // Boot sequencial
  function boot(next) {
    // 1) SDK Supabase — o UMD do @supabase/supabase-js exporta window.supabase (não window.createClient)
    var sbReady = !!(global.supabase && typeof global.supabase.createClient === 'function');
    var p1 = sbReady ? Promise.resolve() : loadScript(SDK_URL, { async: false });

    // 2) módulos internos
    var pAll = p1;
    SCRIPTS.forEach(function (u) { pAll = pAll.then(function () { return loadScript(u, { async: false }); }); });

    pAll.then(function () {
      // linguagem inicial
      if (global.authService && global.authService.setLanguage) {
        var saved = global.authService.getLanguage();
        global.authService.setLanguage(saved);
      }
      applyI18n();
      setupEyeButtons();
      setupLangSelector();
      if (typeof next === 'function') next({
        showToast: showToast,
        setFieldError: setFieldError,
        clearAllErrors: clearAllErrors,
        setGlobalAlert: setGlobalAlert,
        setBtnLoading: setBtnLoading,
        getQueryParam: getQueryParam,
        applyI18n: applyI18n,
        langMap: langMap
      });
    }).catch(function (err) {
      console.error('[auth-common] boot error', err);
      if (typeof next === 'function') next({ error: err });
    });
  }

  global.AuthCommon = {
    boot: boot,
    showToast: showToast,
    setFieldError: setFieldError,
    clearAllErrors: clearAllErrors,
    setGlobalAlert: setGlobalAlert,
    setBtnLoading: setBtnLoading,
    getQueryParam: getQueryParam,
    applyI18n: applyI18n
  };
})(typeof window !== 'undefined' ? window : globalThis);

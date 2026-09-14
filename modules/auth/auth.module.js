/* =======================================================================
 *   modules/auth/auth.module.js — Auth Module (Login / Register / Reset)
 *   Dependências: global.SupabaseService, global.i18nService (carrega CDN)
 *   Integração Supabase Auth + storage local + eventBus
 * =======================================================================
 */
(function (global) {
  'use strict';

  var AUTH_REF_KEY = 'g7_auth_ref';    // username do sponsor (?ref=...)
  var LAST_LANG_KEY = 'g7_language';   // já existe no storage.js mas importar independente
  var VALID_LANGS = ['PT', 'EN', 'ES'];

  function AuthModule() {
    this.sb = global.SupabaseService || global.sb;
    this.i18n = global.i18nService || null;
    this.currentSponsor = null;
    this._detectRef();
    this._bindGlobalEvents();
  }

  AuthModule.prototype._detectRef = function () {
    try {
      var p = new URLSearchParams(global.location.search);
      var ref = p.get('ref') || p.get('referral') || p.get('sponsor') || p.get('u');
      if (ref) {
        ref = ref.trim().replace(/[^a-zA-Z0-9_\-.]/g, '').toLowerCase();
        this.currentSponsor = ref;
        try { global.sessionStorage.setItem(AUTH_REF_KEY, ref); } catch (e) {}
      } else {
        try {
          var s = global.sessionStorage.getItem(AUTH_REF_KEY);
          if (s) this.currentSponsor = s;
        } catch (e) {}
      }
    } catch (e) {}
  };

  AuthModule.prototype.getSponsor = function () {
    return this.currentSponsor || null;
  };

  AuthModule.prototype._bindGlobalEvents = function () {
    var self = this;
    if (global.EventBus && global.EventBus.on) {
      global.EventBus.on('sb:auth:signup', function (meta) {
        if (meta && meta.sponsor_username) {
          // after signup with sponsor → trigger upline population in backend via trigger
          try { global.sessionStorage.removeItem(AUTH_REF_KEY); } catch (e) {}
        }
      });
    }
  };

  AuthModule.prototype.setLanguage = function (lang) {
    lang = (lang || 'pt').toUpperCase().slice(0, 2);
    if (VALID_LANGS.indexOf(lang) === -1) lang = 'PT';
    try { global.localStorage.setItem(LAST_LANG_KEY, lang); } catch (e) {}
    if (this.i18n && typeof this.i18n.setLanguage === 'function') this.i18n.setLanguage(lang);
    // Atualiza atributo lang do HTML (para os CSS data-i18n carregarem)
    try { global.document.documentElement.setAttribute('lang', lang.toLowerCase()); } catch (e) {}
    return lang;
  };

  AuthModule.prototype.getLanguage = function () {
    try {
      var l = global.localStorage.getItem(LAST_LANG_KEY);
      if (l && VALID_LANGS.indexOf(l.toUpperCase()) !== -1) return l.toUpperCase();
    } catch (e) {}
    // detectar por navegador
    try {
      var nav = (global.navigator.language || 'pt-BR').toLowerCase();
      if (nav.startsWith('es')) return 'ES';
      if (nav.startsWith('en')) return 'EN';
    } catch (e) {}
    return 'PT';
  };

  AuthModule.prototype._t = function (key, vars) {
    if (this.i18n && typeof this.i18n.t === 'function') return this.i18n.t(key, vars);
    // fallback Dicionário rápido inline (NÃO DEIXA CHAVE CRUA APARECER pro usuário!)
    var FALLBACK = {
      'auth_login_title': 'Acessar Conta',
      'auth_login_subtitle': 'Entre na G7 Gold Invest',
      'auth_loguin_title': 'Acessar Conta',
      'auth_loguin_subtitle': 'Entre na G7 Gold Invest',
      'auth_label_email': 'E-mail / Username',
      'auth_label_password': 'Senha',
      'auth_ph_email': 'voce@email.com ou username',
      'auth_ph_password': 'Mínimo 6 caracteres',
      'auth_btn_login': 'Entrar',
      'auth_no_account': 'Não tem conta?',
      'auth_register_here': 'Crie aqui',
      'auth_forgot_link_action': 'Esqueci a senha',
      'auth_required_name': 'Informe seu nome completo',
      'auth_required_email': 'Informe seu email',
      'auth_invalid_email': 'Email inválido',
      'auth_required_username': 'Crie um nome de usuário (username)',
      'auth_username_taken': 'Usuário já existe. Escolha outro.',
      'auth_required_password': 'Informe a senha',
      'auth_password_min': 'Senha deve ter pelo menos {n} caracteres',
      'auth_passwords_not_match': 'Senha e confirmação não conferem',
      'auth_sponsor_not_found': 'Link de indicação inválido (patrocinador não encontrado)',
      'auth_login_invalid': 'Email/usuário ou senha inválidos',
      'auth_forgot_sent': 'Link de recuperação enviado para {email}',
      'auth_reset_done': 'Senha alterada com sucesso!',
      'auth_confirm_done': 'Email confirmado. Bem-vindo!',
      'auth_register_ok': 'Conta criada! Verifique seu email para confirmar.',
      'auth_logout_ok': 'Sessão encerrada.'
    };
    var str = FALLBACK[key] || key;
    if (vars) { for (var k in vars) str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k])); }
    return str;
  };

  AuthModule.prototype.validateRegister = function (data) {
    var errs = {};
    data = data || {};
    if (!data.fullName || String(data.fullName).trim().length < 3) errs.fullName = this._t('auth_required_name');
    if (!data.email) { errs.email = this._t('auth_required_email'); }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errs.email = this._t('auth_invalid_email');
    if (!data.username || String(data.username).replace(/[^a-zA-Z0-9_\-.]/g, '').length < 3) {
      errs.username = this._t('auth_required_username');
    } else {
      data.username = data.username.trim().replace(/[^a-zA-Z0-9_\-.]/g, '').toLowerCase();
    }
    if (!data.password || data.password.length < 6) {
      errs.password = this._t('auth_password_min', { n: 6 });
    }
    if (data.password !== data.confirmPassword) {
      errs.confirmPassword = this._t('auth_passwords_not_match');
    }
    return errs;
  };

  AuthModule.prototype.doRegister = function (formData) {
    var self = this;
    var errs = this.validateRegister(formData);
    if (Object.keys(errs).length) return Promise.resolve({ ok: false, errors: errs });

    var sponsor = this.getSponsor();
    var meta = {
      full_name: formData.fullName.trim(),
      username: formData.username,
      sponsor_username: sponsor || null,
      plan: 'Free',
      referral_source: formData.referralSource || 'web',
      signup_at: new Date().toISOString()
    };
    return this.sb.signUp(formData.email.trim().toLowerCase(), formData.password, meta)
      .then(function (r) {
        if (r && r.error) {
          var msg = (r.error.message || String(r.error) || '').toString();
          var httpStatus = r.error.status || (r.error.code && parseInt(r.error.code)) || 0;

          if (/username|duplicate|already/i.test(msg)) {
            return { ok: false, errors: { username: self._t('auth_username_taken') }, raw: r.error };
          }
          if (/sponsor|referral|ref/i.test(msg)) {
            return { ok: false, errors: { sponsor: self._t('auth_sponsor_not_found') }, raw: r.error };
          }

          /* ===============================================================
           *  CASO ESPECIAL SMTP RESEND: "Error sending confirmation email" / 500
           *  ===============================================================
           *  Quando o backend do Supabase CRIOU o auth.users com sucesso,
           *  MAS na hora de mandar o email de confirmação (via SMTP Resend)
           *  o SMTP deu erro (configuração, domain não verificado, key errada,
           *  porta errada, etc) — o Supabase responde erro 500 "sending conf email".
           *
           *  NESTE CASO, o USUÁRIO EXISTE NO BANCO e o trigger handle_new_user
           *  JÁ RODOU (public.users, wallets, users_network, notifications).
           *  Então NÃO É um erro de cadastro, só de envio de email.
           *  Tratamos como SUCESSO parciais e orientamos o usuário no UI.
           */
          var isSmtpErr =
            /sending confirmation email|envio de email|confirmation email|smtp|email send/i.test(msg) ||
            (httpStatus === 500 && /email|confirm/i.test(msg));
          if (isSmtpErr) {
            try { global.sessionStorage.removeItem(AUTH_REF_KEY); } catch (e) {}
            return {
              ok: true,
              smtpEmailError: true,
              email: formData.email.trim().toLowerCase(),
              user: (r.data && r.data.user) || { email: formData.email.trim().toLowerCase() },
              session: (r.data && r.data.session) || null,
              warning: msg
            };
          }
          return { ok: false, errors: { _global: msg }, raw: r.error };
        }
        try { global.sessionStorage.removeItem(AUTH_REF_KEY); } catch (e) {}
        return { ok: true, user: (r.data && r.data.user) || null, session: (r.data && r.data.session) || null };
      });
  };

  AuthModule.prototype.doLogin = function (login, password) {
    var self = this;
    if (!login || !login.trim()) return Promise.resolve({ ok: false, errors: { login: this._t('auth_required_email') } });
    if (!password) return Promise.resolve({ ok: false, errors: { password: this._t('auth_required_password') } });
    return this.sb.signInWithPassword(login.trim(), password)
      .then(function (r) {
        if (r && r.error) {
          return { ok: false, errors: { _global: self._t('auth_login_invalid') }, raw: r.error };
        }
        return { ok: true, user: (r.data && r.data.user) || null, session: (r.data && r.data.session) || null };
      });
  };

  AuthModule.prototype.doLogout = function () {
    var self = this;
    return this.sb.signOut().then(function () {
      return { ok: true, message: self._t('auth_logout_ok') };
    });
  };

  AuthModule.prototype.doForgot = function (email) {
    var self = this;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Promise.resolve({ ok: false, errors: { email: this._t('auth_invalid_email') } });
    }
    return this.sb.resetPasswordForEmail(email.toLowerCase()).then(function (r) {
      if (r && r.error) return { ok: false, errors: { _global: r.error.message || String(r.error) }, raw: r.error };
      return { ok: true, message: self._t('auth_forgot_sent', { email: email }) };
    });
  };

  AuthModule.prototype.doResetPassword = function (newPassword, confirmPassword) {
    var self = this;
    if (!newPassword || newPassword.length < 6) return Promise.resolve({ ok: false, errors: { password: this._t('auth_password_min', { n: 6 }) } });
    if (newPassword !== confirmPassword) return Promise.resolve({ ok: false, errors: { confirmPassword: this._t('auth_passwords_not_match') } });
    return this.sb.updateUser({ password: newPassword }).then(function (r) {
      if (r && r.error) return { ok: false, errors: { _global: r.error.message || String(r.error) }, raw: r.error };
      return { ok: true, message: self._t('auth_reset_done') };
    });
  };

  AuthModule.prototype.doConfirm = function () {
    var self = this;
    // Supabase SDK auto detecta token na URL. Forçamos pegar sessão.
    if (!this.sb.client || !this.sb.client.auth) {
      return Promise.resolve({ ok: false, errors: { _global: 'Supabase SDK não carregado' } });
    }
    return this.sb.client.auth.getSession().then(function (r) {
      var sess = r.data && r.data.session ? r.data.session : null;
      self.currentUser = sess && sess.user ? sess.user : null;
      self.currentSession = sess;
      if (self.currentUser) {
        // se tem metadata pending, marcamos confirmado (trigger SQL cuida do resto)
        return { ok: true, user: self.currentUser, message: self._t('auth_confirm_done') };
      }
      return { ok: false, errors: { _global: 'Link expirou ou inválido. Tente novamente.' } };
    });
  };

  global.AuthModule = AuthModule;
  global.authService = new AuthModule();
  if (typeof module !== 'undefined' && module.exports) module.exports = global.authService;
})(typeof window !== 'undefined' ? window : globalThis);

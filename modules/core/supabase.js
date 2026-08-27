/* =======================================================================
 *   modules/core/supabase.js — Singleton Cliente Supabase (v2)
 *   Carrega o Supabase JS SDK via CDN no HTML antes de chamar boot aqui.
 *   1) Tenta criar cliente com SUPABASE_URL e SUPABASE_ANON_KEY.
 *   2) Expõe global window.sb para login register reset etc.
 *   3) OnAuthStateChange → salva sessão em storage + dispara eventbus.
 * =======================================================================
 */
(function (global) {
  'use strict';

  // --- fallback local (se Supabase CDN não carregar — ambiente dev localhost)
  var SB_FALLBACK_ENABLED = true;

  // --- credenciais (iguais ao .env / Supabase Project developeG7invest)
  var CONFIG = {
    url: 'https://mimtidufeueexcsgcpgv.supabase.co',
    anonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbXRpZHVmZXVlZXhjc2djcGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTQ2OTMsImV4cCI6MjEwMjU3MDY5M30.so4cuna1ltC9dO4JaDNcsFg1AFtjLUc-CI-A6u753mE',
    siteUrl: 'https://g7goldinvest.com'
  };

  var SESSION_KEY = 'g7_sb_session';

  function SupabaseClient() {
    this.client = null;
    this.ready = false;
    this.currentUser = null;
    this.currentSession = null;
    this._listeners = [];
    this._fallbackMode = false;
    this.init();
  }

  SupabaseClient.prototype.init = function () {
    var self = this;
    try {
      if (typeof global.createClient === 'function') {
        this.client = global.createClient(CONFIG.url, CONFIG.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: {
              getItem: function (k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } },
              setItem: function (k, v) { try { global.localStorage.setItem(k, v); } catch (e) {} },
              removeItem: function (k) { try { global.localStorage.removeItem(k); } catch (e) {} }
            }
          }
        });
        this.ready = true;
        this._bindStateChange();
        this._restoreSessionFromStorage();
        return;
      }
    } catch (e) {
      console.warn('[sb] createClient falhou, caindo em fallback local:', e.message);
    }
    // Fallback (localhost sem internet / SDK não carregou)
    this._fallbackMode = SB_FALLBACK_ENABLED;
    this.ready = true;
    console.log('[sb] rodando em MODO FALLBACK LOCAL (supabase CDN não carregou)');
  };

  SupabaseClient.prototype._bindStateChange = function () {
    var self = this;
    if (!this.client || typeof this.client.auth.onAuthStateChange !== 'function') return;
    try {
      this.client.auth.onAuthStateChange(function (event, session) {
        self.currentSession = session || null;
        self.currentUser = session && session.user ? session.user : null;
        if (session) {
          try { global.localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
        } else {
          try { global.localStorage.removeItem(SESSION_KEY); } catch (e) {}
        }
        if (global.EventBus && global.EventBus.emit) {
          global.EventBus.emit('sb:auth:state', { event: event, session: session, user: self.currentUser });
        }
      });
    } catch (e) {
      console.warn('[sb] onAuthStateChange erro:', e.message);
    }
  };

  SupabaseClient.prototype._restoreSessionFromStorage = function () {
    try {
      var raw = global.localStorage.getItem(SESSION_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        this.currentSession = s;
        this.currentUser = s.user || null;
      }
    } catch (e) {}
  };

  /* ============= AUTH HELPERS (fallback compatível) ============= */
  SupabaseClient.prototype.isAuthenticated = function () {
    if (this._fallbackMode) {
      try { return !!global.localStorage.getItem('g7_user'); } catch (e) { return false; }
    }
    return !!this.currentUser;
  };

  SupabaseClient.prototype.signUp = function (email, password, metadata) {
    var self = this;
    metadata = metadata || {};
    if (this._fallbackMode) {
      return new Promise(function (resolve) {
        var user = {
          id: 'local_' + Math.random().toString(36).slice(2, 12),
          email: email,
          user_metadata: metadata,
          created_at: new Date().toISOString()
        };
        try { global.localStorage.setItem('g7_user', JSON.stringify(user)); } catch (e) {}
        self.currentUser = user;
        self._emitSignup(metadata);
        resolve({ data: { user: user, session: null }, error: null });
      });
    }
    return this.client.auth.signUp({
      email: email, password: password,
      options: {
        data: metadata,
        emailRedirectTo: CONFIG.siteUrl + '/auth/confirm.html'
      }
    });
  };

  SupabaseClient.prototype._emitSignup = function (metadata) {
    if (global.EventBus && global.EventBus.emit) {
      global.EventBus.emit('sb:auth:signup', metadata || {});
    }
  };

  SupabaseClient.prototype.signInWithPassword = function (emailOrUsername, password) {
    var self = this;
    if (this._fallbackMode) {
      return new Promise(function (resolve) {
        try {
          var rawUser = global || localStorage.getItem('g7_user');
          var u = raw ? JSON.parse(rawUser) : null;
          self.currentUser = u;
          resolve({ data: { user: u, session: { access_token: 'local_123' } }, error: null });
        } catch (e) {
          resolve({ data: { user: { id: 'eu', email: emailOrUsername }, session: { access_token: 'dev' } }, error: null });
        }
      });
    }
    // Supabase não aceita username por padrão → busca email pelo username via REST se tiver @
    var isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailOrUsername);
    if (isEmail) {
      return this.client.auth.signInWithPassword({ email: emailOrUsername, password: password });
    }
    return this._findEmailByUsername(emailOrUsername).then(function (res) {
      if (!res || !res.email) {
        return { data: null, error: { message: 'Username não encontrado' } };
      }
      return self.client.auth.signInWithPassword({ email: res.email, password: password });
    });
  };

  SupabaseClient.prototype._findEmailByUsername = function (username) {
    var self = this;
    return new Promise(function (resolve) {
      var url = CONFIG.url + '/rest/v1/users?username=eq.' + encodeURIComponent(username) + '&select=email';
      fetch(url, {
        headers: {
          'apikey': CONFIG.anonKey,
          'Authorization': 'Bearer ' + CONFIG.anonKey,
          'Accept': 'application/json'
        }
      }).then(function (r) { return r.json(); })
        .then(function (rows) {
          if (rows && rows.length) resolve({ email: rows[0].email });
          else resolve(null);
        })
        .catch(function () { resolve(null); });
    });
  };

  SupabaseClient.prototype.signOut = function () {
    var self = this;
    if (this._fallbackMode) {
      try { global.localStorage.removeItem('g7_user'); } catch (e) {}
      this.currentUser = null;
      this.currentSession = null;
      return Promise.resolve({ error: null });
    }
    return this.client.auth.signOut().then(function (r) {
      self.currentUser = null;
      self.currentSession = null;
      return r;
    });
  };

  SupabaseClient.prototype.resetPasswordForEmail = function (email) {
    if (this._fallbackMode) {
      return Promise.resolve({ data: true, error: null });
    }
    return this.client.auth.resetPasswordForEmail(email, {
      redirectTo: CONFIG.siteUrl + '/auth/reset-password.html'
    });
  };

  SupabaseClient.prototype.updateUser = function (changes) {
    if (this._fallbackMode) return Promise.resolve({ data: { user: this.currentUser }, error: null });
    return this.client.auth.updateUser(changes);
  };

  SupabaseClient.prototype.getSession = function () {
    if (this._fallbackMode) {
      return Promise.resolve({ data: { session: this.currentSession }, error: null });
    }
    return this.client.auth.getSession();
  };

  /* ============= REST (via fetch com anon key) ============= */
  SupabaseClient.prototype.rpc = function (fnName, params) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var jwt = self.currentSession && self.currentSession.access_token ? self.currentSession.access_token : CONFIG.anonKey;
      var url = CONFIG.url + '/rest/v1/rpc/' + fnName;
      fetch(url, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.anonKey,
          'Authorization': 'Bearer ' + jwt,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(params || {})
      })
        .then(function (r) { return r.json().catch(function () { return null; }).then(function (d) { return { ok: r.ok, data: d, status: r.status }; }); })
        .then(function (r) { if (r.ok) resolve(r.data); else reject(r); })
        .catch(function (e) { reject(e); });
    });
  };

  var singleton = new SupabaseClient();
  global.SupabaseService = singleton;
  global.sb = singleton;
  if (typeof module !== 'undefined' && module.exports) module.exports = singleton;
})(typeof window !== 'undefined' ? window : globalThis);

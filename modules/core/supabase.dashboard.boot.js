/* =========================================================================
 *   modules/core/supabase.dashboard.boot.js  (v3 - HARD REWRITE SEM FAKES)
 *   ============================================================ 2026-08-27
 *
 *   OBJETIVO: Garantir que 100% dos dados do Dashboard venham DAS TABELAS
 *   DO SUPABASE (public.users / wallets / users_network / notifications)
 *   e NÃO de dados fake/mock localStorage ("João da Silva", "usuario@g7gold.com").
 *
 *   MECANISMO:
 *     1) Espera o PRIMEIRO EVENTO REAL do onAuthStateChange (não getSession).
 *     2) Se SIGNED_OUT → /auth/login.html (verdadeiro, sem falso positivo).
 *     3) Se SIGNED_IN → Promise.all busca 5 tabelas do Supabase.
 *     4) APAGA dados antigos localStorage → SOBRESCREVE storageService com
 *        os dados REAIS → chama app.renderAll() de novo para PINTAR o header.
 *     5) Avisa o usuário via toast quem carregou.
 * ========================================================================= */
(function (global) {
  'use strict';

  var LOGIN_URL = './auth/login.html';
  var AUTH_TIMEOUT_MS = 10000;

  var authWatchdog = null;
  var authResolved = false;

  /* ---------- HELPERS ---------- */
  function rm(k) { try { global.localStorage.removeItem(k); } catch (e) {} }

  function fmtMoney(v) {
    if (v == null || isNaN(Number(v))) return '$0,00';
    var n = Number(v).toFixed(2).replace('.', ',');
    return '$' + n.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function goLogin(reason) {
    console.warn('[sb-dash-boot] SIGNED_OUT → login. Motivo:', reason || 'nenhum');
    try {
      global.sessionStorage.setItem('g7_redirect_after_login',
        String(global.location.pathname + global.location.search));
    } catch (e) {}
    try { if (authWatchdog) clearTimeout(authWatchdog); } catch (e) {}
    global.location.href = LOGIN_URL;
  }

  /* ---------------------------------------------------------------------
   * APAGA TUDO do storage fake legado. Impede que "João da Silva" fique
   * aparecendo por causa de chaves antigas no localStorage do usuário.
   * ------------------------------------------------------------------ */
  function wipeLegacyFakeData() {
    rm('g7_storage_user');
    rm('g7_storage_wallet');
    rm('g7_storage_notifications');
    rm('g7_storage_network');
    rm('g7_storage_team');
    rm('g7_storage_transactions');
    rm('g7_storage_applications');
    rm('g7_storage_binary');
    rm('g7_storage_tree');
    rm('g7_storage_tree_focus');
    rm('g7_welcome_shown');
    console.info('[sb-dash-boot] wipeLegacyFakeData → localStorage limpo.');
  }

  /* ---------------------------------------------------------------------
   * INJETA os dados REAIS das tabelas do Supabase no storageService.
   * Usa storageService.saveUser / saveWallet / etc. (métodos oficiais).
   * Garante "João da Silva" NUNCA mais.
   * ------------------------------------------------------------------ */
  function injectRealData(storage, payload) {
    if (!storage) { console.error('[sb-dash-boot] storageService NAO EXISTE.'); return false; }
    if (!payload) payload = {};
    var authUser = payload.authUser || {};
    var p = payload.profile || {};
    var w = payload.wallet  || {};
    var n = payload.network || {};
    var s = payload.sponsor || null;
    var notes = payload.notifications || [];

    /* --- Garante campos --- */
    var userId    = p.id || authUser.id;
    var userName  = (p.full_name && p.full_name.length > 0)
                    ? p.full_name
                    : ((authUser.user_metadata && authUser.user_metadata.full_name) ||
                       (authUser.email ? authUser.email.split('@')[0] : 'Usuário'));
    var userUser  = p.username || (authUser.user_metadata && authUser.user_metadata.username) || '';
    var userEmail = p.email || authUser.email || '';
    var sponsorUser = n.sponsor_username
                      || (authUser.user_metadata && authUser.user_metadata.sponsor_username)
                      || (s && s.username ? s.username : '');

    var userFinal = {
      id: userId,
      auth_id: authUser.id || userId,
      name: userName,
      username: userUser,
      email: userEmail,
      sponsor: sponsorUser,
      plan: p.plan || (authUser.user_metadata && authUser.user_metadata.plan) || 'Free',
      level: p.level || 1,
      cpf: p.cpf || '',
      phone: p.phone || '',
      createdAt: p.created_at || authUser.created_at || new Date().toISOString(),
      walletAddress: p.wallet_address || ''
    };

    var walletFinal = {
      balance:            w.balance            != null ? Number(w.balance)            : 0,
      teamGains:          w.team_gains         != null ? Number(w.team_gains)         : 0,
      dailyGains:         w.daily_gains        != null ? Number(w.daily_gains)        : 0,
      bonusGains:         w.bonus_gains        != null ? Number(w.bonus_gains)        : 0,
      totalGains:         w.total_gains        != null ? Number(w.total_gains)        : 0,
      totalInvested:      w.total_invested     != null ? Number(w.total_invested)     : 0,
      totalWithdrawn:     w.total_withdrawn    != null ? Number(w.total_withdrawn)    : 0,
      pendingWithdrawal:  w.pending_withdrawal != null ? Number(w.pending_withdrawal) : 0,
      referralEarnings:   w.referral_earnings  != null ? Number(w.referral_earnings)  : 0,
      binaryEarnings:     w.binary_earnings    != null ? Number(w.binary_earnings)    : 0,
      currency:           w.currency || 'USD',
      updatedAt:          w.updated_at || new Date().toISOString()
    };

    var notesFinal = notes.map(function (n) {
      return {
        id: n.id,
        title: n.title || '',
        message: n.message || '',
        type: n.type || 'info',
        date: n.created_at || new Date().toISOString(),
        read: !!n.read
      };
    });

    console.info('[sb-dash-boot] ★★★ DADOS REAIS VINDOS DO SUPABASE ★★★');
    console.info('[sb-dash-boot]  Nome    :', userFinal.name);
    console.info('[sb-dash-boot]  Username:', '@' + userFinal.username);
    console.info('[sb-dash-boot]  Email   :', userFinal.email);
    console.info('[sb-dash-boot]  Sponsor :', '@' + userFinal.sponsor);
    console.info('[sb-dash-boot]  Saldo   :', fmtMoney(walletFinal.balance));

    /* --- INJETA no storageService (chaves oficiais) --- */
    if (typeof storage.saveUser === 'function') storage.saveUser(userFinal);
    else { console.error('[sb-dash-boot] storage.saveUser nao existe!'); return false; }

    if (typeof storage.saveWallet === 'function') storage.saveWallet(walletFinal);
    if (typeof storage.setNotifications === 'function') storage.setNotifications(notesFinal);
    else if (typeof storage.saveNotifications === 'function') storage.saveNotifications(notesFinal);
    if (typeof storage.saveNetwork === 'function') storage.saveNetwork(n);

    return { user: userFinal, wallet: walletFinal, notifications: notesFinal, network: n };
  }

  /* ---------------------------------------------------------------------
   * Carrega todas as tabelas REAIS do usuário LOGADO:
   *   1) public.users (profile)
   *   2) public.wallets
   *   3) public.users_network
   *   4) public.notifications
   *   5) public.users DO SPONSOR (para confirmar username do patrocinador)
   * ------------------------------------------------------------------ */
  function loadAllRealTables(sb, storage, authUser) {
    if (!sb || !sb.client) return Promise.reject(new Error('SB client null'));

    var p1 = sb.client.from('users')
      .select('id, auth_id, full_name, username, email, phone, cpf, plan, level, wallet_address, status, created_at, updated_at')
      .eq('id', authUser.id)
      .maybeSingle();

    var p2 = sb.client.from('wallets')
      .select('*')
      .eq('user_id', authUser.id)
      .maybeSingle();

    var p3 = sb.client.from('users_network')
      .select('user_id, parent_id, referral_parent_id, sponsor_username, placement_side, build_leg, level, points_left, points_right')
      .eq('user_id', authUser.id)
      .maybeSingle();

    var p4 = sb.client.from('notifications')
      .select('id, title, message, type, read, created_at')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })
      .limit(30);

    return Promise.all([p1, p2, p3, p4])
      .then(function (r) {
        var profileR = r[0] || {};
        var walletR  = r[1] || {};
        var netR     = r[2] || {};
        var notifR   = r[3] || {};

        if (profileR.error) console.warn('[sb-dash-boot] profile.select ERR:', profileR.error);
        if (walletR.error)  console.warn('[sb-dash-boot] wallet.select ERR :', walletR.error);
        if (netR.error)     console.warn('[sb-dash-boot] network.select ERR:', netR.error);
        if (notifR.error)   console.warn('[sb-dash-boot] notif.select ERR  :', notifR.error);

        var profile = profileR.data || null;
        var wallet  = walletR.data  || null;
        var net     = netR.data     || null;
        var notes   = notifR.data   || [];

        /* --- Fallback se a tabela public.users estiver vazia p/ esse id --- */
        if (!profile) {
          console.warn('[sb-dash-boot] Profile nao encontrado em public.users, usando authUser.user_metadata');
          var um = (authUser.user_metadata || {});
          profile = {
            id: authUser.id, auth_id: authUser.id,
            full_name: um.full_name || '', username: um.username || '',
            email: authUser.email || '', phone: '', cpf: '', plan: um.plan || 'Free',
            level: 1, wallet_address: '', status: 'active',
            created_at: authUser.created_at, updated_at: authUser.created_at
          };
        }
        if (!wallet) {
          wallet = { user_id: authUser.id, balance: 0, team_gains: 0, daily_gains: 0,
                     bonus_gains: 0, total_gains: 0, total_invested: 0, total_withdrawn: 0,
                     pending_withdrawal: 0, referral_earnings: 0, binary_earnings: 0,
                     currency: 'USD', updated_at: new Date().toISOString() };
        }
        if (!net) {
          var um2 = (authUser.user_metadata || {});
          net = { user_id: authUser.id, sponsor_username: um2.sponsor_username || '',
                  placement_side: null, build_leg: null, level: 1,
                  points_left: 0, points_right: 0 };
        }

        /* --- Buscando username do SPONSOR real em public.users --- */
        var sponsorId = net.parent_id || net.referral_parent_id || null;
        var sponsorPromise = Promise.resolve({ data: null });
        if (sponsorId) {
          sponsorPromise = sb.client.from('users')
            .select('username, full_name')
            .eq('id', sponsorId)
            .maybeSingle();
        } else if (net.sponsor_username) {
          sponsorPromise = sb.client.from('users')
            .select('username, full_name')
            .eq('username', net.sponsor_username)
            .maybeSingle();
        }

        return sponsorPromise.then(function (sponsorR) {
          var sponsor = (sponsorR && sponsorR.data) ? sponsorR.data : null;
          if (sponsorR && sponsorR.error) console.warn('[sb-dash-boot] sponsor.select ERR:', sponsorR.error);

          var payload = {
            authUser: authUser,
            profile: profile,
            wallet: wallet,
            network: net,
            notifications: notes,
            sponsor: sponsor
          };

          /* --- 1) WIPE dados FAKE legado --- */
          wipeLegacyFakeData();

          /* --- 2) INJETA dados REAIS --- */
          var merged = injectRealData(storage, payload);

          /* --- 3) FORÇA RE-RENDER do App (header / perfil / wallet) --- */
          var app = global.app || global.App;
          if (app && typeof app.renderAll === 'function') {
            app.renderAll();
            console.info('[sb-dash-boot] app.renderAll() chamado COM DADOS REAIS DO SUPABASE ✅');
          } else {
            console.warn('[sb-dash-boot] app.renderAll NAO ENCONTRADO. TENTE F5.');
          }

          /* --- 4) Toast amigavel --- */
          var ui = global.ui || global.UIService;
          if (ui && typeof ui.toast === 'function') {
            var firstName = (merged.user.name || '').split(' ')[0] || 'Usuário';
            ui.toast('Bem-vindo(a), ' + firstName + '! Dados carregados do Supabase ✅', 'success');
          }

          /* --- 5) Emite evento para listeners --- */
          if (global.EventBus && typeof global.EventBus.emit === 'function') {
            global.EventBus.emit('sb:dashboard:ready', { ok: true, merged: merged });
          }

          return merged;
        });
      });
  }

  /* ---------- Loader principal (AGUARDA PRIMEIRO EVENTO AUTH SDK) ---------- */
  function bootDashboardFromSupabase() {
    var sb = global.sb || global.SupabaseService;
    var storage = global.storageService;

    console.groupCollapsed && console.groupCollapsed('[sb-dash-boot] boot v3');
    console.info('[sb-dash-boot] sb.client =', !!(sb && sb.client));
    console.info('[sb-dash-boot] storageService =', !!storage);

    /* 1) Sem SDK → não podemos fazer nada */
    if (!sb || !sb.client) {
      console.error('[sb-dash-boot] Supabase client nao disponivel. Verifique script SDK.');
      console.groupEnd && console.groupEnd();
      return Promise.resolve({ ok: false, reason: 'NO_CLIENT' });
    }

    /* 2) Timeout segurança (offline ou CDN lento) */
    authWatchdog = setTimeout(function () {
      if (authResolved) return;
      authResolved = true;
      console.warn('[sb-dash-boot] TIMEOUT SDK auth (10s). Vai para login.');
      goLogin('timeout_sdk');
    }, AUTH_TIMEOUT_MS);

    /* 3) PRIMEIRO EVENTO REAL (SIGNED_IN / SIGNED_OUT) */
    try {
      var unsub = sb.client.auth.onAuthStateChange(function (event, session) {
        if (authResolved) return;
        authResolved = true;
        try { clearTimeout(authWatchdog); } catch (e) {}

        var user = session && session.user ? session.user : null;
        console.info('[sb-dash-boot] 1o evento auth:', event, 'tem user?', !!user);

        if (event === 'SIGNED_OUT' || !user) {
          try { if (typeof unsub === 'function') unsub(); } catch (e) {}
          console.groupEnd && console.groupEnd();
          goLogin(event);
          return;
        }

        /* SIGNED_IN real → LOAD DATA */
        try { if (typeof unsub === 'function') unsub(); } catch (e) {}
        loadAllRealTables(sb, storage, user)
          .then(function () {
            console.info('[sb-dash-boot] finalizado COM SUCESSO.');
            console.groupEnd && console.groupEnd();
          })
          .catch(function (e) {
            console.error('[sb-dash-boot] loadAllRealTables ex:', e);
            console.groupEnd && console.groupEnd();
          });
      });
    } catch (eOnAuth) {
      authResolved = true;
      try { clearTimeout(authWatchdog); } catch (e) {}
      console.error('[sb-dash-boot] onAuthStateChange ex:', eOnAuth);

      /* FALLBACK: getSession tradicional */
      sb.getSession().then(function (r) {
        var s = (r && r.data && r.data.session) || r || null;
        var u = s && s.user ? s.user : null;
        if (!u) { goLogin('fallback_na'); return; }
        loadAllRealTables(sb, storage, u);
      });
    }

    return Promise.resolve({ ok: true, status: 'booting' });
  }

  global.SupabaseDashboardBoot = {
    boot: bootDashboardFromSupabase,
    injectRealData: injectRealData,
    wipeLegacyFakeData: wipeLegacyFakeData,
    fmtMoney: fmtMoney
  };

  /* ---------- Auto-boot ---------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { bootDashboardFromSupabase(); });
  } else {
    bootDashboardFromSupabase();
  }

})(typeof window !== 'undefined' ? window : globalThis);

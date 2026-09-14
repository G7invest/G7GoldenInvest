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

  var LOGIN_URL = '/auth/login.html';
  var AUTH_TIMEOUT_MS = 25000;

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
      balance:            w.total_balance        != null ? Number(w.total_balance)        : 0,
      total_balance:      w.total_balance        != null ? Number(w.total_balance)        : 0,
      teamGains:          w.team_gains           != null ? Number(w.team_gains)           : 0,
      dailyGains:         w.last_earnings        != null ? Number(w.last_earnings)        : 0,
      bonusGains:         0,
      totalGains:         w.total_gains          != null ? Number(w.total_gains)          : 0,
      totalInvested:      w.total_invested       != null ? Number(w.total_invested)       : 0,
      totalWithdrawn:     w.total_withdrawn      != null ? Number(w.total_withdrawn)      : 0,
      availableWithdraw:  w.available_withdraw   != null ? Number(w.available_withdraw)   : 0,
      pendingWithdrawal:  w.pending_withdraw     != null ? Number(w.pending_withdraw)     : 0,
      referralEarnings:   w.direct_commissions   != null ? Number(w.direct_commissions)   : 0,
      binaryEarnings:     w.binary_gains         != null ? Number(w.binary_gains)         : 0,
      totalProfit:        w.total_profit         != null ? Number(w.total_profit)         : 0,
      directCommissions:  w.direct_commissions   != null ? Number(w.direct_commissions)   : 0,
      lastEarnings:       w.last_earnings        != null ? Number(w.last_earnings)        : 0,
      currency:           w.currency || 'USD',
      updatedAt:          w.updated_at || new Date().toISOString()
    };

    var notesFinal = notes.map(function (n) {
      return {
        id: n.id,
        title: n.title || '',
        message: n.body  || n.message || '',
        type: n.category || n.type || 'info',
        icon: n.icon || null,
        date: n.date_at || n.created_at || new Date().toISOString(),
        read: !!(n.is_read != null ? n.is_read : n.read)
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
   *   5) SPONSOR profile (username do patrocinador)
   *   6) RPC get_team_stats(uid)   → team, binary, bonusProgress
   *   7) RPC materialize_binary_tree(uid, 8)  → TREE JSON exato p/ front
   *   8) public.transactions (extrato)
   *   9) public.apps (aplicações)
   * ------------------------------------------------------------------ */
  function loadAllRealTables(sb, storage, authUser) {
    if (!sb) return Promise.reject(new Error('SB service null'));

    var p1, p2, p3, p4;
    if (sb.client) {
      p1 = sb.client.from('users')
        .select('id, username, full_name, email, phone, plan, initials, country, language, created_at, updated_at')
        .eq('id', authUser.id)
        .maybeSingle();
      p2 = sb.client.from('wallets')
        .select('user_id, total_balance, available_withdraw, pending_withdraw, total_invested, total_profit, team_gains, binary_gains, total_gains, direct_commissions, last_earnings, updated_at')
        .eq('user_id', authUser.id)
        .maybeSingle();
      p3 = sb.client.from('users_network')
        .select('id, placement_parent_id, referral_parent_id, placement_side, build_leg, depth, left_child_id, right_child_id, volume_left, volume_right, volume_lifetime, qualified_1_1, active_date, created_at')
        .eq('id', authUser.id)
        .maybeSingle();
      p4 = sb.client.from('notifications')
        .select('id, title, body, icon, category, is_read, date_at')
        .eq('user_id', authUser.id)
        .order('date_at', { ascending: false })
        .limit(30);
    } else {
      p1 = Promise.resolve({ data: null, error: null });
      p2 = Promise.resolve({ data: null, error: null });
      p3 = Promise.resolve({ data: null, error: null });
      p4 = Promise.resolve({ data: [], error: null });
    }

    var p5 = Promise.resolve({ data: null, error: null });
    var p6 = Promise.resolve({ data: null, error: null });
    var p7 = Promise.resolve({ data: [], error: null });
    var p8 = Promise.resolve({ data: [], error: null });
    try {
      p5 = sb.rpc('get_team_stats', { p_user_id: authUser.id })
        .then(function (d) { return { data: d, error: null }; })
        .catch(function (e) { console.warn('[sb-dash-boot] rpc get_team_stats ERR:', e); return { data: null, error: e }; });
      p6 = sb.rpc('materialize_binary_tree', { p_root_id: authUser.id, p_depth: 8 })
        .then(function (d) { return { data: d, error: null }; })
        .catch(function (e) { console.warn('[sb-dash-boot] rpc materialize_binary_tree ERR:', e); return { data: null, error: e }; });
      if (sb.client) {
        p7 = sb.client.from('transactions')
          .select('id, type, amount, status, currency, description, details, date_at')
          .eq('user_id', authUser.id)
          .order('date_at', { ascending: false })
          .limit(60);
        p8 = sb.client.from('apps')
          .select('id, user_id, amount, asset, plan, roi_expected, status, start_date, end_date, created_at')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false })
          .limit(30);
      }
    } catch (eRpc) {
      console.warn('[sb-dash-boot] rpc/select prepare ERR:', eRpc);
    }

    return Promise.all([p1, p2, p3, p4, p5, p6, p7, p8])
      .then(function (r) {
        var profileR = r[0] || {};
        var walletR  = r[1] || {};
        var netR     = r[2] || {};
        var notifR   = r[3] || {};
        var statsR   = r[4] || {};
        var treeR    = r[5] || {};
        var txR      = r[6] || {};
        var appsR    = r[7] || {};

        if (profileR.error) console.warn('[sb-dash-boot] profile.select ERR:', profileR.error);
        if (walletR.error)  console.warn('[sb-dash-boot] wallet.select ERR :', walletR.error);
        if (netR.error)     console.warn('[sb-dash-boot] network.select ERR:', netR.error);
        if (notifR.error)   console.warn('[sb-dash-boot] notif.select ERR  :', notifR.error);
        if (statsR.error)   console.warn('[sb-dash-boot] team_stats ERR   :', statsR.error);
        if (treeR.error)    console.warn('[sb-dash-boot] bin_tree ERR     :', treeR.error);
        if (txR.error)      console.warn('[sb-dash-boot] tx ERR            :', txR.error);
        if (appsR.error)    console.warn('[sb-dash-boot] apps ERR          :', appsR.error);

        var profile = profileR.data || null;
        var wallet  = walletR.data  || null;
        var net     = netR.data     || null;
        var notes   = notifR.data   || [];
        var stats   = statsR.data   || null;
        var tree    = treeR.data    || null;
        var txs     = txR.data      || [];
        var apps    = appsR.data    || [];

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
          wallet = { user_id: authUser.id, total_balance: 0, available_withdraw: 0, pending_withdraw: 0,
                     total_invested: 0, total_profit: 0, team_gains: 0, binary_gains: 0, total_gains: 0,
                     direct_commissions: 0, last_earnings: 0,
                     updated_at: new Date().toISOString() };
        }
        if (!net) {
          var um2 = (authUser.user_metadata || {});
          net = { id: authUser.id, placement_parent_id: null, referral_parent_id: null,
                  placement_side: null, build_leg: null, depth: 0,
                  left_child_id: null, right_child_id: null,
                  volume_left: 0, volume_right: 0, volume_lifetime: 0,
                  qualified_1_1: false, active_date: null, created_at: authUser.created_at,
                  sponsor_username: um2.sponsor_username || '' };
        } else if (net && !net.sponsor_username) {
          net.sponsor_username = '';
        }

        /* --- Buscando username do SPONSOR real em public.users --- */
        var sponsorId = net.referral_parent_id || net.placement_parent_id || null;
        var sponsorPromise = Promise.resolve({ data: null });
        if (sponsorId && sb.client) {
          sponsorPromise = sb.client.from('users')
            .select('username, full_name')
            .eq('id', sponsorId)
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
            sponsor: sponsor,
            stats: stats || null,
            tree:  tree  || null,
            transactions: txs || [],
            applications: apps || []
          };

          /* --- 1) WIPE dados FAKE legado --- */
          wipeLegacyFakeData();

          /* --- 2) INJETA dados REAIS --- */
          var merged = injectRealData(storage, payload);

          /* --- 2.1) INJETA tree / binary / team do RPC --- */
          if (merged) {
            merged.stats = payload.stats;
            merged.tree  = payload.tree;
          }
          try {
            var binShape = payload.stats ? {
              leftPoints:  Number(payload.stats.leftPoints  || 0),
              rightPoints: Number(payload.stats.rightPoints || 0)
            } : {
              leftPoints:  Number(net.volume_left  || 0),
              rightPoints: Number(net.volume_right || 0)
            };
            var teamShape = payload.stats ? {
              directCount:  Number(payload.stats.directCount  || 0),
              activeCount:  Number(payload.stats.activeCount  || 0),
              bonusClaimed: !!(payload.stats.bonusProgress && payload.stats.bonusProgress.claimed),
              bonusProgress: payload.stats.bonusProgress || null,
              lesserLeg:   Number(payload.stats.lesserLeg   || 0),
              greaterLeg:  Number(payload.stats.greaterLeg  || 0),
              pendingBinaryPayout: Number(payload.stats.pendingBinaryPayout || 0),
              payoutSkipped: !!payload.stats.payoutSkipped,
              payoutSkipReason: payload.stats.payoutSkipReason || null,
              payoutMode: payload.stats.payoutMode || null,
              fixedPayout: Number(payload.stats.fixedPayout || 0),
              legPills: payload.stats.legPills || { leftActive: false, rightActive: false }
            } : {
              directCount: 0, activeCount: 0, bonusClaimed: false, bonusProgress: null,
              lesserLeg: 0, greaterLeg: 0, pendingBinaryPayout: 0, payoutSkipped: true,
              payoutSkipReason: 'NO_STATS', payoutMode: 'FIXED', fixedPayout: 10,
              legPills: { leftActive: false, rightActive: false }
            };
            if (typeof storage.saveBinary === 'function') storage.saveBinary(binShape);
            if (typeof storage.saveTeam   === 'function') storage.saveTeam(teamShape);
            if (payload.tree && typeof storage.saveTree === 'function') storage.saveTree(payload.tree);
            if (typeof storage.saveTreeFocus === 'function' && payload.tree && payload.tree.id) {
              var cur = null;
              try { cur = storage.getTreeFocus && storage.getTreeFocus(); } catch (e) {}
              if (!cur || !cur.focusNodeId) storage.saveTreeFocus({ focusNodeId: payload.tree.id });
            }
            if (payload.transactions && Array.isArray(payload.transactions) && typeof storage.saveTransactions === 'function') {
              var mappedTxs = payload.transactions.map(function (t) {
                return {
                  id: t.id,
                  type: t.type || 'Depósito / Aplicação',
                  amount: Number(t.amount || 0),
                  status: t.status || 'Creditado',
                  currency: t.currency || 'USD',
                  date: t.date_at ? String(t.date_at).replace('T',' ').slice(0,16) : new Date().toLocaleString(),
                  createdAt: (t.date_at ? new Date(t.date_at).getTime() : Date.now()),
                  description: t.description || '',
                  details: t.details || null
                };
              });
              storage.saveTransactions(mappedTxs);
            }
            if (payload.applications && Array.isArray(payload.applications) && typeof storage.saveApplications === 'function') {
              var mappedApps = payload.applications.map(function (a) {
                return {
                  id: a.id,
                  amount: Number(a.amount || 0),
                  asset: a.asset || 'XAU/USD',
                  plan: a.plan || 'Standard',
                  roiExpected: Number(a.roi_expected || 0),
                  status: a.status || 'Em Progresso',
                  startDate: a.start_date,
                  endDate: a.end_date,
                  createdAt: a.created_at
                };
              });
              storage.saveApplications(mappedApps);
            }
          } catch (eInj) {
            console.error('[sb-dash-boot] 2.1 inject team/binary/tree/txs/apps ERR:', eInj);
          }

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

  /* ---------- Loader principal (getSession PRIMEIRO — evita INITIAL_SESSION falsa) ---------- */
  function bootDashboardFromSupabase() {
    var sb = global.sb || global.SupabaseService;
    var storage = global.storageService;

    console.groupCollapsed && console.groupCollapsed('[sb-dash-boot] boot v4 (getSession-first)');
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
      console.warn('[sb-dash-boot] TIMEOUT SDK auth (' + (AUTH_TIMEOUT_MS / 1000) + 's). Vai para login.');
      goLogin('timeout_sdk');
    }, AUTH_TIMEOUT_MS);

    /* 3) getSession() PRIMEIRO → VERDADE da sessão SDK (resolve cookie HttpOnly)
     *    NÃO usa onAuthStateChange primeiro, pois ele sempre dispara
     *    INITIAL_SESSION user=NULL ANTES de restaurar o cookie.  */
    sb.getSession().then(function (r) {
      if (authResolved) return;
      var s = (r && r.data && r.data.session) || r || null;
      var u = s && s.user ? s.user : null;
      console.info('[sb-dash-boot] getSession() inicial → tem user?', !!u);

      if (u) {
        /* —— CASO 1: Sessão já válida (cookie HttpOnly restaurado) —— */
        authResolved = true;
        try { clearTimeout(authWatchdog); } catch (e) {}
        loadAllRealTables(sb, storage, u)
          .then(function () {
            console.info('[sb-dash-boot] finalizado COM SUCESSO (getSession-first).');
            console.groupEnd && console.groupEnd();
          })
          .catch(function (e) {
            console.error('[sb-dash-boot] loadAllRealTables ex:', e);
            console.groupEnd && console.groupEnd();
          });
        /* Mantém listener ligado apenas para eventos FUTUROS (SIGNED_OUT manual etc.) */
        try {
          sb.client.auth.onAuthStateChange(function (event, session) {
            if (event === 'SIGNED_OUT') {
              authResolved = false;
              goLogin('manual_signout');
            }
          });
        } catch (_) {}
        return;
      }

      /* —— CASO 2: Sem sessão inicial → AGUARDA evento REAL SIGNED_IN do listener —— */
      console.info('[sb-dash-boot] getSession vazio → aguardando onAuthStateChange SIGNED_IN real...');
      try {
        var unsub = sb.client.auth.onAuthStateChange(function (event, session) {
          if (authResolved) return;

          var user = session && session.user ? session.user : null;
          console.info('[sb-dash-boot] auth event:', event, 'tem user?', !!user);

          if (event === 'SIGNED_OUT' || !user) {
            /* Double-check: em RARE casos getSession() falhou mas listener traz sessão */
            sb.getSession().then(function (r2) {
              if (authResolved) return;
              var s2 = (r2 && r2.data && r2.data.session) || r2 || null;
              var u2 = s2 && s2.user ? s2.user : null;
              authResolved = true;
              try { clearTimeout(authWatchdog); } catch (e) {}
              if (!u2) {
                try { if (typeof unsub === 'function') unsub(); } catch (e) {}
                console.groupEnd && console.groupEnd();
                goLogin(event + '/no_session');
                return;
              }
              try { if (typeof unsub === 'function') unsub(); } catch (e) {}
              loadAllRealTables(sb, storage, u2)
                .then(function () {
                  console.info('[sb-dash-boot] finalizado COM SUCESSO (fallback pós-evento).');
                  console.groupEnd && console.groupEnd();
                })
                .catch(function (e) {
                  console.error('[sb-dash-boot] loadAllRealTables ex (fallback):', e);
                  console.groupEnd && console.groupEnd();
                });
            }).catch(function () {
              if (authResolved) return;
              authResolved = true;
              try { clearTimeout(authWatchdog); } catch (e) {}
              try { if (typeof unsub === 'function') unsub(); } catch (e) {}
              console.groupEnd && console.groupEnd();
              goLogin(event);
            });
            return;
          }

          /* SIGNED_IN real (ex: login vindo de /auth/login.html) */
          authResolved = true;
          try { clearTimeout(authWatchdog); } catch (e) {}
          try { if (typeof unsub === 'function') unsub(); } catch (e) {}
          loadAllRealTables(sb, storage, user)
            .then(function () {
              console.info('[sb-dash-boot] finalizado COM SUCESSO (SIGNED_IN event).');
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
        sb.getSession().then(function (r3) {
          var s3 = (r3 && r3.data && r3.data.session) || r3 || null;
          var u3 = s3 && s3.user ? s3.user : null;
          if (!u3) { goLogin('fallback_na'); return; }
          loadAllRealTables(sb, storage, u3);
        });
      }
    }).catch(function (eGs) {
      if (authResolved) return;
      authResolved = true;
      try { clearTimeout(authWatchdog); } catch (e) {}
      console.error('[sb-dash-boot] getSession() inicial ex:', eGs);
      goLogin('getsession_ex');
    });

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

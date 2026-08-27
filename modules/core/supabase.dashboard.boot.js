/* =========================================================================
 *   modules/core/supabase.dashboard.boot.js
 *   Carrega DADOS REAIS do usuário LOGADO das tabelas do Supabase e injeta
 *   no storageService (compatível com app.boot.js renderAll).
 *   Se NÃO tiver sessão → redireciona para /auth/login.html.
 *   Ordem de carregamento: DEPOIS de supabase.js / auth.module.js ANTES app.boot.js
 * ========================================================================= */
(function (global) {
  'use strict';

  var LOGIN_URL = './auth/login.html';
  var SB_LOAD_KEY = 'sb_dash_loaded_v1';

  function fmtMoney(v) {
    if (v == null || isNaN(Number(v))) return '$0,00';
    var n = Number(v).toFixed(2).replace('.', ',');
    return '$' + n.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /* ---------- HELPERS para injetar no storage (compatibilidade retroativa) ---------- */
  function injectIntoStorage(storage, payload) {
    if (!storage || !payload) return;
    var user = payload.user || {};
    var profile = payload.profile || {};
    var wallet  = payload.wallet || {};
    var network = payload.network || {};
    var notes   = payload.notifications || [];

    var mergedUser = {
      id:         profile.id || user.id || null,
      auth_id:    user.id || null,
      name:       profile.full_name || user.full_name || user.name || 'Usuário',
      username:   profile.username || (user.user_metadata && user.user_metadata.username) || '',
      email:      profile.email || user.email || '',
      sponsor:    network.sponsor_username || (user.user_metadata && user.user_metadata.sponsor_username) || '',
      plan:       profile.plan || (user.user_metadata && user.user_metadata.plan) || 'Free',
      level:      profile.level || 1,
      cpf:        profile.cpf || '',
      phone:      profile.phone || '',
      createdAt:  profile.created_at || user.created_at || new Date().toISOString(),
      walletAddress: profile.wallet_address || ''
    };

    if (typeof storage.saveUser === 'function') storage.saveUser(mergedUser);
    else if (typeof storage.setUser === 'function') storage.setUser(mergedUser);
    else { try { global.localStorage.setItem('g7_storage_user', JSON.stringify(mergedUser)); } catch (e) {} }

    var mergedWallet = {
      balance:            wallet.balance            != null ? Number(wallet.balance)            : 0,
      teamGains:          wallet.team_gains         != null ? Number(wallet.team_gains)         : 0,
      dailyGains:         wallet.daily_gains        != null ? Number(wallet.daily_gains)        : 0,
      bonusGains:         wallet.bonus_gains        != null ? Number(wallet.bonus_gains)        : 0,
      totalGains:         wallet.total_gains        != null ? Number(wallet.total_gains)        : 0,
      totalInvested:      wallet.total_invested     != null ? Number(wallet.total_invested)     : 0,
      totalWithdrawn:     wallet.total_withdrawn    != null ? Number(wallet.total_withdrawn)    : 0,
      pendingWithdrawal:  wallet.pending_withdrawal != null ? Number(wallet.pending_withdrawal) : 0,
      referralEarnings:   wallet.referral_earnings  != null ? Number(wallet.referral_earnings)  : 0,
      binaryEarnings:     wallet.binary_earnings    != null ? Number(wallet.binary_earnings)    : 0,
      currency:           wallet.currency || 'USD',
      updatedAt:          wallet.updated_at || new Date().toISOString()
    };

    if (typeof storage.saveWallet === 'function') storage.saveWallet(mergedWallet);
    else if (typeof storage.setWallet === 'function') storage.setWallet(mergedWallet);
    else { try { global.localStorage.setItem('g7_storage_wallet', JSON.stringify(mergedWallet)); } catch (e) {} }

    if (typeof storage.setNotifications === 'function') storage.setNotifications(notes);
    else if (typeof storage.saveNotifications === 'function') storage.saveNotifications(notes);
    else { try { global.localStorage.setItem('g7_storage_notifications', JSON.stringify(notes)); } catch (e) {} }

    if (typeof storage.saveNetwork === 'function') storage.saveNetwork(network);
    else { try { global.localStorage.setItem('g7_storage_network', JSON.stringify(network)); } catch (e) {} }
  }

  /* ---------- Loader principal ---------- */
  function bootDashboardFromSupabase() {
    var sb = global.sb || global.SupabaseService;
    var storage = global.storageService;
    var ui = global.ui || global.UIService;
    var t = function (k) { return (global.i18n && global.i18n.t ? global.i18n.t(k) : k); };

    /* 1) Sem SDK → pula (erro já é exibido no register) */
    if (!sb || !sb.client) {
      console.warn('[sb-dash-boot] Supabase client não disponível, usando storage local.');
      return Promise.resolve({ fallback: true });
    }

    /* 2) Sem sessão ativa → redireciona LOGIN */
    return sb.getSession().then(function (sessionRes) {
      var sess = (sessionRes && sessionRes.data && sessionRes.data.session) || sessionRes || null;
      var user = sess && sess.user ? sess.user : null;
      if (!user) {
        console.warn('[sb-dash-boot] Sem sessão ativa → login.');
        try { global.sessionStorage.setItem('g7_redirect_after_login', String(global.location.pathname + global.location.search)); } catch (e) {}
        global.location.href = LOGIN_URL;
        return { loggedOut: true };
      }

      /* 3) Busca em PARALELO: profile users + wallets + users_network + notifications */
      var profilePromise = sb.client.from('users')
        .select('id, auth_id, full_name, username, email, phone, cpf, plan, level, wallet_address, status, created_at, updated_at')
        .eq('id', user.id)
        .maybeSingle();

      var walletPromise = sb.client.from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      var networkPromise = sb.client.from('users_network')
        .select('user_id, parent_id, referral_parent_id, sponsor_username, placement_side, build_leg, level, points_left, points_right')
        .eq('user_id', user.id)
        .maybeSingle();

      var notifPromise = sb.client.from('notifications')
        .select('id, title, message, type, read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      return Promise.all([profilePromise, walletPromise, networkPromise, notifPromise])
        .then(function (results) {
          var profileRes = results[0] || {};
          var walletRes  = results[1] || {};
          var netRes     = results[2] || {};
          var notifRes   = results[3] || {};

          if (profileRes.error) console.warn('[sb-dash-boot] profile err:', profileRes.error);
          if (walletRes.error)  console.warn('[sb-dash-boot] wallet err:',  walletRes.error);
          if (netRes.error)     console.warn('[sb-dash-boot] net err:',     netRes.error);
          if (notifRes.error)   console.warn('[sb-dash-boot] notif err:',   notifRes.error);

          var payload = {
            user:            user,
            profile:         (profileRes.data) || { id: user.id, full_name: (user.user_metadata && user.user_metadata.full_name) || '', username: (user.user_metadata && user.user_metadata.username) || '', email: user.email || '', plan: 'Free', level: 1 },
            wallet:          (walletRes.data)  || { balance: 0, team_gains: 0, daily_gains: 0, bonus_gains: 0, total_gains: 0, total_invested: 0, total_withdrawn: 0, pending_withdrawal: 0, referral_earnings: 0, binary_earnings: 0, currency: 'USD' },
            network:         (netRes.data)     || { user_id: user.id, sponsor_username: (user.user_metadata && user.user_metadata.sponsor_username) || '', level: 1, points_left: 0, points_right: 0 },
            notifications:   (notifRes.data)   || []
          };

          injectIntoStorage(storage, payload);

          try { global.sessionStorage.setItem(SB_LOAD_KEY, '1'); } catch (e) {}

          /* Avisa UI carregou */
          if (global.EventBus && typeof global.EventBus.emit === 'function') {
            global.EventBus.emit('sb:dashboard:loaded', payload);
          }
          if (ui && typeof ui.toast === 'function' && !sessionStorage.getItem('g7_welcome_shown')) {
            try { sessionStorage.setItem('g7_welcome_shown', '1'); } catch (e) {}
            ui.toast(t('dash_welcome') || ('Bem-vindo, ' + (payload.profile.full_name || '').split(' ')[0] + '!'), 'success');
          }

          console.info('[sb-dash-boot] Dados Supabase carregados → storage atualizado.');
          return payload;
        });
    })
    .catch(function (err) {
      console.error('[sb-dash-boot] erro carregamento:', err);
      return { error: err && err.message ? err.message : String(err) };
    });
  }

  global.SupabaseDashboardBoot = {
    boot: bootDashboardFromSupabase,
    injectIntoStorage: injectIntoStorage,
    fmtMoney: fmtMoney
  };

  /* Auto-boot se DOM já carregou (carregamento síncrono de scripts no index.html) */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { bootDashboardFromSupabase(); });
  } else {
    bootDashboardFromSupabase();
  }

})(typeof window !== 'undefined' ? window : globalThis);

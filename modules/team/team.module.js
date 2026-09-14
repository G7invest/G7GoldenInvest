(function (global) {
  'use strict';

  var _C = global.CONTRACTS || {};
  var EV = _C.EVENTS || {};
  var TEAM_CFG = _C.TEAM || {};
  var _i18n = global.i18n;
  var _t = function(k,v){ return _i18n && typeof _i18n.t==='function' ? _i18n.t(k,v) : k; };

  function el(id) { return document.getElementById(id); }
  function fmt(v) { return global.ui && global.ui.formatCurrency ? global.ui.formatCurrency(v) : ('$' + Number(v || 0).toFixed(2)); }
  function showToast(msg, type) { if (global.ui && global.ui.showToast) global.ui.showToast(msg, type); else alert(msg); }
  function copyClip(txt) {
    if (global.ui && global.ui.copyToClipboard) return global.ui.copyToClipboard(txt);
    try {
      var ta = document.createElement('textarea'); ta.value = txt;
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      return true;
    } catch (e) { return false; }
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function initials(name) {
    var s = String(name == null ? '?' : name).trim();
    if (!s) return '?';
    if (s.length <= 3) return s.toUpperCase();
    var parts = s.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
  }

  function ensureTreeDefault() {
    var st = teamModule.storage;
    if (!st) return null;
    var tree = st.getTree();
    if (!tree) {
      tree = (global.treeEngine && global.treeEngine.defaultSeedTree) ? global.treeEngine.defaultSeedTree() : null;
      if (tree) st.saveTree(tree);
    }
    if (!st.getTreeFocus()) st.saveTreeFocus({ focusNodeId: tree && tree.id ? tree.id : 'eu' });
    return tree;
  }

  var teamModule = {
    storage: global.storageService || null,
    bus: global.eventBus || null,
    eng: global.binaryEngine || null,
    tEng: global.treeEngine || null,
    sb:   global.sb || global.SupabaseService || null,

    currentFocusId: 'eu',
    currentTree: null,
    lastLoadedStats: null,
    loading: false,

    init: function () {
      ensureTreeDefault.call(this);
      this.currentTree = this.storage ? this.storage.getTree() : null;
      var f = this.storage ? this.storage.getTreeFocus() : null;
      if (f && f.focusNodeId) this.currentFocusId = f.focusNodeId;

      var self = this;

      // Se tivermos session / sb disponível → carregamos tree/stats FRESCOS do Supabase
      this.hydrateFromSupabase().then(function () {
        self.render();
      }).catch(function () {
        /* fallback → usa storage cache */
      });

      if (this.bus) {
        this.bus.on(EV.RENDER_REQUIRED, function () { self.render(); });
        this.bus.on(EV.DATA_RESET, function () {
          self.currentTree = self.storage ? self.storage.getTree() : null;
          self.currentFocusId = self.currentTree && self.currentTree.id ? self.currentTree.id : 'eu';
          self.hydrateFromSupabase().then(function () { self.render(); }).catch(function () { self.render(); });
        });
        this.bus.on(EV.APPLICATION_CREATED, function () {
          self.hydrateFromSupabase().then(function () { self.render(); }).catch(function () { self.render(); });
        });
        // Quando dashboard boot termina → recarregar tudo do Supabase (SSOT)
        if (global.EventBus && typeof global.EventBus.on === 'function') {
          global.EventBus.on('sb:dashboard:ready', function () {
            self.hydrateFromSupabase().then(function () { self.render(); }).catch(function () { self.render(); });
          });
        }
      }
    },

    hydrateFromSupabase: function () {
      var self = this;
      var sb = this.sb;
      var user = this.storage && this.storage.getUser ? this.storage.getUser() : null;
      var uid = (user && user.id) || (sb && sb.currentUser && sb.currentUser.id) || null;
      if (!sb || !uid) return Promise.resolve(null);

      this.loading = true;
      var p1 = sb.rpc('get_team_stats', { p_user_id: uid });
      var p2 = sb.rpc('materialize_binary_tree', { p_root_id: uid, p_depth: 8 });
      return Promise.all([
        p1.catch(function (e) { console.warn('[team] rpc get_team_stats ERR:', e); return null; }),
        p2.catch(function (e) { console.warn('[team] rpc materialize_binary_tree ERR:', e); return null; })
      ]).then(function (rs) {
        var stats = rs[0], tree = rs[1];
        if (stats && typeof stats === 'object' && !stats.error) {
          self.lastLoadedStats = stats;
          var bin = {
            leftPoints:  Number(stats.leftPoints  || 0),
            rightPoints: Number(stats.rightPoints || 0)
          };
          var team = {
            directCount: Number(stats.directCount || 0),
            activeCount: Number(stats.activeCount || 0),
            bonusClaimed: !!(stats.bonusProgress && stats.bonusProgress.claimed),
            bonusProgress: stats.bonusProgress || null,
            lesserLeg: Number(stats.lesserLeg || 0),
            greaterLeg: Number(stats.greaterLeg || 0),
            pendingBinaryPayout: Number(stats.pendingBinaryPayout || 0),
            payoutSkipped: !!stats.payoutSkipped,
            payoutSkipReason: stats.payoutSkipReason || null,
            payoutMode: stats.payoutMode || null,
            fixedPayout: Number(stats.fixedPayout || 0),
            legPills: stats.legPills || { leftActive: false, rightActive: false }
          };
          if (self.storage) {
            self.storage.saveBinary(bin);
            self.storage.saveTeam(team);
          }
        }
        if (tree && tree.id) {
          self.currentTree = tree;
          if (self.storage) self.storage.saveTree(tree);
          if (!self.currentFocusId || self.currentFocusId === 'eu') {
            self.currentFocusId = tree.id;
            if (self.storage) self.storage.saveTreeFocus({ focusNodeId: tree.id });
          }
        }
        self.loading = false;
        return { stats: stats, tree: tree };
      });
    },

    getStats: function () {
      if (!this.eng || !this.storage) return null;
      var team = this.storage.getTeam() || {};
      var bin = this.storage.getBinary() || {};
      var wall = this.storage.getWallet() || {};
      var tree = this.currentTree || ensureTreeDefault.call(this);
      // Se lastLoadedStats veio do SSOT → usamos ele (mais preciso)
      if (this.lastLoadedStats && typeof this.lastLoadedStats === 'object') {
        var s = this.lastLoadedStats;
        return {
          userId: s.userId,
          leftPoints:   Number(s.leftPoints  || 0),
          rightPoints:  Number(s.rightPoints || 0),
          lesserLeg:    Number(s.lesserLeg   || 0),
          greaterLeg:   Number(s.greaterLeg  || 0),
          pendingBinaryPayout: Number(s.pendingBinaryPayout || 0),
          payoutMode:   s.payoutMode || 'FIXED',
          fixedPayout:  Number(s.fixedPayout || 10),
          payoutSkipped: !!s.payoutSkipped,
          payoutSkipReason: s.payoutSkipReason || null,
          directCount:  Number(s.directCount || 0),
          activeCount:  Number(s.activeCount || 0),
          bonusProgress: s.bonusProgress || {
            percentage: 0, activeCount: 0, target: 10, bonusAmount: 100, eligible: false, claimed: false
          },
          legPills: s.legPills || { leftActive: false, rightActive: false },
          eng: this.eng
        };
      }
      var fallback = this.eng.calcTeamStats(team, bin, wall, tree);
      if (fallback) fallback.eng = this.eng;
      return fallback;
    },

    getFocusNode: function () {
      if (!this.tEng || !this.currentTree) return null;
      return this.tEng.findNodeById(this.currentTree, this.currentFocusId);
    },

    focusNode: function (nodeId) {
      if (!nodeId || !this.tEng || !this.currentTree) return;
      var target = this.tEng.findNodeById(this.currentTree, nodeId);
      if (!target) { showToast(_t('tree_user_not_found'), 'error'); return; }
      this.currentFocusId = nodeId;
      if (this.storage) this.storage.saveTreeFocus({ focusNodeId: nodeId });
      if (this.bus) this.bus.emit(EV.TREE_FOCUS_CHANGED || 'team:tree-focus-changed', { nodeId: nodeId });
      this.renderTree();
    },

    goBackToParent: function () {
      if (!this.tEng || !this.currentTree) return;
      var parent = this.tEng.findParentNode(this.currentTree, this.currentFocusId);
      if (!parent) { showToast(_t('tree_already_root'), 'info'); return; }
      this.focusNode(parent.id);
    },

    goToRoot: function () { this.focusNode(this.currentTree ? this.currentTree.id : 'eu'); },

    doSearch: function (q) {
      var self = this;
      var box = el('team-search-results');
      if (!box) return;
      var query = String(q == null ? '' : q).trim();
      if (!query || !this.tEng || !this.currentTree) { box.classList.remove('open'); box.innerHTML = ''; return; }
      var list = this.tEng.searchNodes(this.currentTree, query).slice(0, 8);
      if (list.length === 0) {
        box.innerHTML = '<div class="sr-empty">' + _t('tree_search_empty') + '</div>';
        box.classList.add('open');
        return;
      }
      box.innerHTML = list.map(function (n) {
        return '<div class="sr-item" data-id="' + esc(n.id) + '">' +
               '<div class="sr-avatar">' + esc(initials(n.name)) + '</div>' +
               '<div class="sr-info"><div class="sr-name">' + esc(n.name) + '</div><div class="sr-user">@' + esc(n.username) + ' · ' + fmt(n.amount) + '</div></div>' +
               '</div>';
      }).join('');
      box.classList.add('open');
      box.querySelectorAll('.sr-item').forEach(function (it) {
        it.addEventListener('click', function () {
          var id = it.getAttribute('data-id');
          box.classList.remove('open');
          var inp = el('team-search-input');
          if (inp) inp.value = '';
          self.focusNode(id);
        });
      });
    },

    buildTreeNodeHTML: function (node) {
      if (!node) node = { empty: true, name: 'Vaga', amount: 0 };
      var empty = !!node.empty || !node.active || Number(node.amount || 0) <= 0;
      var self = this;
      var isFocus = node.id === this.currentFocusId;
      var qual = this.eng ? this.eng.getQualificationStatus(node) : null;
      var hasChildren = !!node.left || !!node.right;

      var posClass = empty ? 'pos-empty' : (node.level === 0 ? 'pos-root' : (node.position === 'L' || String(node.position).endsWith('L') ? 'pos-left' : 'pos-right'));

      var caret = hasChildren && !empty ? '<span class="caret" title="' + _t('tree_nav_tip') + '">↧</span>' : '';
      var tooltip = empty ? '' : (
        '<div class="binary-tooltip" style="display:none;" id="tip-' + esc(node.id) + '">' +
          '<div><strong>' + esc(node.name) + '</strong></div>' +
          '<div style="font-family:monospace;font-size:0.7rem;opacity:0.8;">@' + esc(node.username || '') + '</div>' +
          '<div style="margin-top:0.25rem;">' + _t('tooltip_invest') + ': <strong>' + fmt(node.amount) + '</strong></div>' +
          (node.points ? '<div>' + _t('tooltip_pts_e') + ': ' + esc(node.points.left || 0) + ' · ' + _t('tooltip_pts_d') + ': ' + esc(node.points.right || 0) + '</div>' : '') +
          (qual ? '<div style="margin-top:0.35rem;color:' + (qual.qualified ? '#10B981' : '#F59E0B') + ';">' + esc(qual.text) + '</div>' : '') +
          (node.joinedAt ? '<div style="margin-top:0.25rem;opacity:0.6;">' + _t('tooltip_joined') + ': ' + esc(node.joinedAt) + '</div>' : '') +
        '</div>'
      );

      var childrenHTML = '';
      if (!empty) {
        childrenHTML =
          '<div class="tree-node-children">' +
            '<div class="tree-child">' + this.buildTreeNodeHTML(node.left || { empty: true, name: 'Vaga E', amount: 0 }) + '</div>' +
            '<div class="tree-child">' + this.buildTreeNodeHTML(node.right || { empty: true, name: 'Vaga D', amount: 0 }) + '</div>' +
          '</div>';
      }

      var meta = empty ? '' : (
        '<div class="node-meta">' +
          '<div class="nm-name">' + esc(node.name) + '</div>' +
          (node.username ? '<div class="nm-user">@' + esc(node.username) + '</div>' : '') +
          '<div class="nm-vol">' + fmt(node.amount) + '</div>' +
        '</div>'
      );

      return (
        '<div class="tree-node-wrapper" data-node-id="' + esc(node.id || ('empty-' + Math.random().toString(36).slice(2, 7))) + '">' +
          '<div class="binary-node ' + (empty ? 'is-empty' : '') + ' ' + (isFocus ? 'is-focus' : '') + '" data-id="' + esc(node.id || '') + '" style="display:inline-flex;flex-direction:column;align-items:center;">' +
            '<div class="binary-avatar ' + posClass + '">' + esc(initials(empty ? '+' : node.name)) + caret + '</div>' +
            meta +
            tooltip +
          '</div>' +
          childrenHTML +
        '</div>'
      );
    },

    attachTreeEvents: function () {
      var self = this;
      var box = el('team-tree-viewport');
      if (!box) return;
      box.querySelectorAll('.binary-node[data-id]').forEach(function (nodeEl) {
        var id = nodeEl.getAttribute('data-id');
        if (!id) return;
        nodeEl.addEventListener('click', function (e) {
          e.stopPropagation();
          var tip = el('tip-' + id);
          if (tip) tip.style.display = 'none';
          self.focusNode(id);
        });
        nodeEl.addEventListener('mouseenter', function () {
          var tip = el('tip-' + id);
          if (!tip) return;
          var r = nodeEl.getBoundingClientRect();
          var br = box.getBoundingClientRect();
          tip.style.display = 'block';
          tip.style.left = Math.max(8, (r.left - br.left + box.scrollLeft) - 90) + 'px';
          tip.style.top = (r.bottom - br.top + box.scrollTop + 6) + 'px';
        });
        nodeEl.addEventListener('mouseleave', function () {
          var tip = el('tip-' + id);
          if (tip) tip.style.display = 'none';
        });
      });
    },

    renderTree: function () {
      var box = el('team-tree-viewport');
      if (!box) return;
      var focus = this.getFocusNode() || this.currentTree;
      var crumbBox = el('team-tree-breadcrumb');
      if (crumbBox && this.tEng && this.currentTree) {
        var path = this.tEng.getBreadcrumb(this.currentTree, this.currentFocusId) || [];
        var self = this;
        crumbBox.innerHTML = path.map(function (n, i) {
          var last = i === path.length - 1;
          return '<span class="crumb ' + (last ? 'current' : '') + '" data-crumb-id="' + esc(n.id) + '">' + esc(n.name) + '</span>' +
                 (last ? '' : '<span class="sep">›</span>');
        }).join('');
        crumbBox.querySelectorAll('.crumb:not(.current)').forEach(function (c) {
          c.addEventListener('click', function () { self.focusNode(c.getAttribute('data-crumb-id')); });
        });
        var btnBack = el('team-btn-back');
        if (btnBack) {
          var parent = self.tEng.findParentNode(self.currentTree, self.currentFocusId);
          btnBack.disabled = !parent;
        }
        var btnRoot = el('team-btn-root');
        if (btnRoot) btnRoot.disabled = self.currentFocusId === (self.currentTree && self.currentTree.id);
      }
      if (!focus) { box.innerHTML = '<div style="padding:2rem;text-align:center;color:#6B7280;">' + _t('tree_dismiss_tooltip') + '</div>'; return; }
      var qInfo = this.eng ? this.eng.getQualificationStatus(focus) : null;
      var qLegs = this.tEng ? this.tEng.getDirectLegStatus(focus) : { leftActive: false, rightActive: false };
      var qualBox = el('team-qualification-badge');
      if (qualBox && qInfo) {
        qualBox.className = 'qualification-badge ' + (qInfo.qualified ? 'qualified' : 'not-qualified') + ' legs';
        qualBox.innerHTML =
          '<span>' + (qInfo.qualified ? '✅ ' + _t('tree_qual_qualified') : '⚠️ ' + _t('tree_qual_not')) + '</span>' +
          '<span class="leg-pill left ' + (qLegs.leftActive ? 'ok' : 'no') + '">' + _t('tree_leg_left_pill') + (qLegs.leftActive ? ' ' + _t('legs_ok_short') : '') + '</span>' +
          '<span class="leg-pill right ' + (qLegs.rightActive ? 'ok' : 'no') + '">' + _t('tree_leg_right_pill') + (qLegs.rightActive ? ' ' + _t('legs_ok_short') : '') + '</span>';
        qualBox.title = qInfo.text;
      }
      box.innerHTML = '<div class="tree-wrapper">' + this.buildTreeNodeHTML(focus) + '</div>';
      this.attachTreeEvents();
    },

    render: function () {
      var stats = this.getStats();
      if (!stats) return;

      var rc = el('team-direct-count'); if (rc) rc.textContent = stats.directCount;
      var tdC = el('teamDirectCount');
      if (tdC) tdC.textContent = (stats.directCount || 0) + ' ' + _t('team_active_short');
      var rac = el('team-active-count'); if (rac) rac.textContent = stats.activeCount;

      var blp = el('binaryLeftPoints');
      if (blp) blp.textContent = (stats.leftPoints || 0) + ' ' + _t('tree_points_short');
      var brp = el('binaryRightPoints');
      if (brp) brp.textContent = (stats.rightPoints || 0) + ' ' + _t('tree_points_short');

      var rlg = el('team-lesser-leg'); if (rlg) rlg.textContent = fmt(stats.lesserLeg);
      var rgr = el('team-greater-leg'); if (rgr) rgr.textContent = fmt(stats.greaterLeg);
      var rbp = el('team-binary-pending'); if (rbp) rbp.textContent = fmt(stats.pendingBinaryPayout);
      var rpt = el('team-payout-type');
      if (rpt) rpt.textContent = stats.payoutMode === 'FIXED' ? _t('tree_payout_fixed') : (Number((stats.eng && stats.eng.CONFIG && stats.eng.CONFIG.BINARY_PERCENTAGE) || TEAM_CFG.BINARY_PERCENTAGE || 0.10) * 100 + '% menor perna');
      var rpk = el('team-payout-skip');
      if (rpk) {
        if (!stats.payoutSkipped) { rpk.style.display = 'none'; }
        else {
          rpk.style.display = '';
          rpk.textContent = stats.payoutSkipReason === 'NOT_QUALIFIED' ? _t('tree_payout_skip_noqual') : _t('tree_payout_skip_nopts');
        }
      }
      var prog = stats.bonusProgress || {};
      var bp = el('team-bonus-progress'); if (bp) bp.style.width = prog.percentage + '%';
      var bpt = el('team-bonus-progress-text');
      if (bpt) bpt.textContent = prog.activeCount + ' / ' + prog.target + ' ' + _t('team_assets') + ' · ' + _t('team_bonus_amount') + ' ' + fmt(prog.bonusAmount);

      var btnClaim = el('team-btn-claim-bonus');
      if (btnClaim) { btnClaim.disabled = !prog.eligible; btnClaim.textContent = prog.claimed ? _t('team_bonus_claimed') : (prog.eligible ? _t('team_bonus_claim_btn') : (_t('team_bonus_locked') + ': ' + prog.activeCount + '/' + prog.target)); }

      this.renderTree();
    },

    copyRefLink: function () {
      var u = this.storage && this.storage.getUser ? this.storage.getUser() : null;
      var uname = u && u.username ? u.username : 'g7investidor';
      var url = 'https://g7goldinvest.com/signup?ref=' + encodeURIComponent(uname);
      var ok = copyClip(url);
      showToast(ok ? _t('team_copy_ok') : _t('team_copy_err'), ok ? 'success' : 'error');
    },

    claimTeamBonus: function () {
      var self = this;
      var sb = this.sb;
      var user = this.storage && this.storage.getUser ? this.storage.getUser() : null;
      var uid = (user && user.id) || (sb && sb.currentUser && sb.currentUser.id) || null;
      var stats = this.getStats();
      var bp = stats ? (stats.bonusProgress || {}) : {};
      if (!stats || !bp.eligible) { showToast(_t('team_bonus_not_eligible'), 'error'); return; }

      if (sb && uid) {
        showToast(_t('team_bonus_claim_btn') + '...', 'info');
        sb.rpc('claim_team_10_bonus', { p_user_id: uid })
          .then(function (r) {
            if (!r || r.status !== 'claimed') {
              var errMsg = (r && r.reason === 'ALREADY_CLAIMED') ? _t('team_bonus_claimed')
                         : (r && r.reason === 'NOT_ENOUGH')   ? _t('team_bonus_locked')
                         : _t('team_bonus_not_eligible');
              showToast(errMsg, 'warning');
              return self.hydrateFromSupabase().then(function () { self.render(); });
            }
            var bonus = Number(r.amount || 0);
            if (self.storage) {
              var team = self.storage.getTeam() || {};
              team.bonusClaimed = true;
              self.storage.saveTeam(team);
              var wall = self.storage.getWallet() || {};
              wall.bonusGains          = Number(wall.bonusGains          || 0) + bonus;
              wall.availableWithdraw   = Number(wall.availableWithdraw   || 0) + bonus;
              wall.totalGains          = Number(wall.totalGains          || 0) + bonus;
              self.storage.saveWallet(wall);
              var target = Number(bp.target || 0);
              var active = Number(bp.activeCount || 0);
              self.storage.addTransaction({
                type: 'Bônus Equipe', amount: bonus, status: 'Creditado',
                description: 'Bônus de Equipe (Meta ' + target + ' ativos) · ' + active + '/' + target + ' concluído · RPC server-side',
                details: { txId: r.txId, tbId: r.tbId, target: target, activeCount: active,
                           bonusAmount: bonus, source: 'rpc_claim_team_10_bonus' }
              });
            }
            if (self.bus) {
              var wall2 = self.storage && self.storage.getWallet ? self.storage.getWallet() : {};
              self.bus.emit(EV.BONUS_CLAIMED, { amount: bonus });
              self.bus.emit(EV.WALLET_UPDATED, wall2);
              self.bus.emit(EV.RENDER_REQUIRED);
            }
            showToast(_t('team_bonus_claim_ok') + ' +' + fmt(bonus), 'success');
            return self.hydrateFromSupabase().then(function () { self.render(); });
          })
          .catch(function (e) {
            console.error('[team] rpc claim_team_10_bonus ERR:', e);
            showToast((e && (e.msg || e.message)) ? (e.msg || e.message) : _t('team_bonus_not_eligible'), 'error');
          });
        return;
      }

      // ============ FALLBACK (modo dev / local) ============
      var team = this.storage.getTeam() || {};
      team.bonusClaimed = true;
      this.storage.saveTeam(team);
      var wall = this.storage.getWallet() || {};
      var bonus = Number(stats.bonusProgress && stats.bonusProgress.bonusAmount || 0) || 0;
      wall.bonusGains = Number(wall.bonusGains || 0) + bonus;
      wall.availableWithdraw = Number(wall.availableWithdraw || 0) + bonus;
      wall.totalGains = Number(wall.totalGains || 0) + bonus;
      this.storage.saveWallet(wall);

      if (this.storage && typeof this.storage.addTransaction === 'function' && bonus > 0) {
        var target = Number(stats.bonusProgress && stats.bonusProgress.target || 0);
        var active = Number(stats.bonusProgress && stats.bonusProgress.activeCount || 0);
        this.storage.addTransaction({
          type: 'Bônus Equipe',
          amount: bonus,
          status: 'Creditado',
          description: 'Bônus de Equipe (Meta ' + target + ' ativos) · ' + active + '/' + target + ' concluído',
          details: { target: target, activeCount: active, bonusAmount: bonus, source: 'team_10_bonus_fallback' }
        });
      }

      if (this.bus) {
        this.bus.emit(EV.BONUS_CLAIMED, { amount: bonus });
        this.bus.emit(EV.WALLET_UPDATED, wall);
        this.bus.emit(EV.RENDER_REQUIRED);
      }
      showToast(_t('team_bonus_claim_ok'), 'success');
    },

    simAddReferral: function () {
      var side = Math.random() < 0.5 ? 'left' : 'right';
      var appAmount = 100 + Math.floor(Math.random() * 500);
      var pts = appAmount;
      var randomTarget = Math.random();
      var candidateIds = [
        { id: 'node-PL1L1', forceLeg: 'SPILLOVER' },
        { id: 'node-PL1R1', forceLeg: 'SPILLOVER' },
        { id: 'node-PL1', forceLeg: 'SPILLOVER' },
        { id: 'node-PR1', forceLeg: 'CONSTRUCTION' },
        { id: 'node-AL1', forceLeg: 'CONSTRUCTION' },
        { id: 'node-AR1', forceLeg: 'SPILLOVER' }
      ];
      var cand = candidateIds[Math.floor(Math.random() * candidateIds.length)];
      var startNodeId = cand.id;
      var forcedLeg = cand.forceLeg;

      var team = this.storage.getTeam() || {};
      var t2 = this.eng.addReferral(team, appAmount);
      this.storage.saveTeam(t2);

      var tree = this.currentTree || ensureTreeDefault.call(this);
      var applyResult = this.eng.addBinaryPointsAdvanced(tree, startNodeId, side, pts, { legType: forcedLeg });
      if (this.storage) this.storage.saveTree(tree);
      var bin = this.storage.getBinary() || {};
      if (applyResult && applyResult.rootBinaryDelta) {
        bin.leftPoints = (Number(bin.leftPoints) || 0) + (Number(applyResult.rootBinaryDelta.left) || 0);
        bin.rightPoints = (Number(bin.rightPoints) || 0) + (Number(applyResult.rootBinaryDelta.right) || 0);
      } else {
        var b2 = this.eng.addBinaryPoints(bin, side, pts);
        bin = b2;
      }
      this.storage.saveBinary(bin);

      var bonusResult = this.eng.calcDirectBonus(appAmount);
      var commission = Number(bonusResult.commission) || 0;
      var pctDisplay = Math.round(Number(bonusResult.percentage || 0) * 100);

      var wall = this.storage.getWallet() || {};
      if (commission > 0) {
        wall.teamGains = Number(wall.teamGains || 0) + commission;
        wall.availableWithdraw = Number(wall.availableWithdraw || 0) + commission;
        wall.totalGains = Number(wall.totalGains || 0) + commission;
        this.storage.saveWallet(wall);
      }

      if (this.storage && typeof this.storage.addTransaction === 'function') {
        this.storage.addTransaction({
          type: 'Comissão Indicação',
          amount: commission,
          status: 'Creditado',
          description: 'Indicação Direta Nível 1 · ' + pctDisplay + '% · Aplicação ' + fmt(appAmount) + ' · ' + (side === 'left' ? 'Perna Esquerda' : 'Perna Direita') + ' · Leg: ' + forcedLeg,
          details: { side: side, appAmount: appAmount, points: pts, percentage: pctDisplay, referralLevel: 1, legType: forcedLeg, sourceNode: startNodeId, uplineHits: applyResult ? applyResult.nodeUpdates.length : 0 }
        });
        this.storage.addTransaction({
          type: 'Depósito / Aplicação',
          amount: appAmount,
          status: 'Confirmado',
          description: 'Nova indicação direta · Pontos Binários: ' + pts + ' pts adicionados na ' + (side === 'left' ? 'Perna Esquerda' : 'Perna Direita') + ' · ' + forcedLeg,
          details: { side: side, appAmount: appAmount, points: pts, referralType: 'direct', legType: forcedLeg, sourceNode: startNodeId, uplineTrail: applyResult ? applyResult.nodeUpdates : null }
        });
      }

      if (this.bus) {
        this.bus.emit(EV.REFERRAL_ADDED, { side: side, amount: appAmount, points: pts, commission: commission, legType: forcedLeg, sourceNode: startNodeId, applyResult: applyResult });
        this.bus.emit(EV.WALLET_UPDATED, wall);
        this.bus.emit(EV.RENDER_REQUIRED);
      }

      var sideText = side === 'left' ? _t('dev_referral_added_left') : _t('dev_referral_added_right');
      var legLabel = forcedLeg === 'CONSTRUCTION' ? '[Build]' : '[Spill]';
      var toastMsg = sideText + ' · ' + fmt(appAmount) + ' · ' + legLabel + ' · ' + _t('dev_referral_commission', { pct: pctDisplay, value: fmt(commission) });
      showToast(toastMsg, 'success');
    },

    simAddBinaryPoints: function () {
      var side = Math.random() < 0.5 ? 'left' : 'right';
      var pts = 100 + Math.floor(Math.random() * 1000);
      var qualOnly = Math.random() < 0.3;
      var targets = [
        { id: 'node-PL1', leg: 'SPILLOVER' },
        { id: 'node-PR1', leg: 'CONSTRUCTION' },
        { id: 'node-AR1', leg: 'SPILLOVER' },
        { id: 'node-AL1', leg: 'CONSTRUCTION' },
        { id: 'node-PL1R1', leg: 'SPILLOVER' },
        { id: 'node-PL1L1', leg: 'SPILLOVER' }
      ];
      var t = targets[Math.floor(Math.random() * targets.length)];
      var tree = this.currentTree || ensureTreeDefault.call(this);
      var bin = this.storage.getBinary() || { leftPoints: 0, rightPoints: 0 };
      var beforeL = Number(bin.leftPoints) || 0;
      var beforeR = Number(bin.rightPoints) || 0;
      var applyResult = this.eng.addBinaryPointsAdvanced(tree, t.id, side, pts, { legType: t.leg, qualificationOnly: qualOnly });
      if (this.storage) this.storage.saveTree(tree);
      if (applyResult && applyResult.rootBinaryDelta) {
        bin.leftPoints = beforeL + (Number(applyResult.rootBinaryDelta.left) || 0);
        bin.rightPoints = beforeR + (Number(applyResult.rootBinaryDelta.right) || 0);
      } else {
        var b2 = this.eng.addBinaryPoints(bin, side, pts);
        bin = b2;
      }
      this.storage.saveBinary(bin);
      var afterL = Number(bin.leftPoints) || 0;
      var afterR = Number(bin.rightPoints) || 0;

      if (this.storage && typeof this.storage.addTransaction === 'function') {
        this.storage.addTransaction({
          type: qualOnly ? 'Qualificação' : 'Depósito / Aplicação',
          amount: pts,
          status: 'Confirmado',
          description: (qualOnly ? 'Pontos Qualificação · ' : 'Pontos Binários · ') + pts + ' pts adicionados na ' + (side === 'left' ? 'Perna Esquerda' : 'Perna Direita') + ' · ' + t.leg,
          details: {
            side: side,
            pointsAdded: pts,
            qualificationOnly: qualOnly,
            legType: t.leg,
            sourceNode: t.id,
            before: { leftPoints: beforeL, rightPoints: beforeR },
            after: { leftPoints: afterL, rightPoints: afterR },
            source: 'manual_points',
            uplineTrail: applyResult ? applyResult.nodeUpdates : null
          }
        });
      }

      if (this.bus) this.bus.emit(EV.RENDER_REQUIRED);

      var sideKey = side === 'left' ? 'dev_points_added_left' : 'dev_points_added_right';
      var totalNow = side === 'left' ? afterL : afterR;
      var legLabel = t.leg === 'CONSTRUCTION' ? '[Build]' : '[Spill]';
      var qualLabel = qualOnly ? '[Qualif]' : '';
      var toastMsg = pts + ' ' + _t(sideKey) + ' ' + legLabel + qualLabel + ' · ' + _t('dev_points_total', { value: totalNow });
      showToast(toastMsg, qualOnly ? 'info' : 'success');
    },

    processBinaryPayout: function () {
      var self = this;
      var sb = this.sb;
      var user = this.storage && this.storage.getUser ? this.storage.getUser() : null;
      var uid = (user && user.id) || (sb && sb.currentUser && sb.currentUser.id) || null;

      if (sb && uid) {
        showToast(_t('dev_process_binary') + '...', 'info');
        sb.rpc('process_binary_payout_for_user', { p_user_id: uid })
          .then(function (r) {
            if (!r || r.status === 'skipped') {
              var reason = r && r.reason ? r.reason : '';
              showToast(reason === 'NOT_QUALIFIED' ? _t('dev_qualification_warning')
                        : (reason === 'NO_POINTS' ? _t('dev_nopoints_warning') : (_t('dev_nopoints_warning') || 'Sem pontos')),
                        'warning');
              return self.hydrateFromSupabase().then(function () { self.render(); });
            }
            if (r && r.status === 'paid') {
              var payout = Number(r.payout || 0);
              if (self.storage) {
                var wall = self.storage.getWallet() || {};
                wall.binaryGains        = Number(wall.binaryGains        || 0) + payout;
                wall.teamGains          = Number(wall.teamGains          || 0) + payout;
                wall.availableWithdraw  = Number(wall.availableWithdraw  || 0) + payout;
                wall.totalGains         = Number(wall.totalGains         || 0) + payout;
                self.storage.saveWallet(wall);
                var bin = self.storage.getBinary() || { leftPoints: 0, rightPoints: 0 };
                bin.leftPoints  = Number(r.newLeft  || 0);
                bin.rightPoints = Number(r.newRight || 0);
                self.storage.saveBinary(bin);
                var beforeL = r.lesserSide === 'LEFT' ? Number(r.lesserBefore || 0) : Number(r.greaterBefore || 0);
                var beforeR = r.lesserSide === 'RIGHT' ? Number(r.lesserBefore || 0) : Number(r.greaterBefore || 0);
                self.storage.addTransaction({
                  type: 'Bônus Binário',
                  amount: payout, status: 'Creditado',
                  description: 'Pagamento Binário · ' + (r.mode || 'FIXED') + ' $' + (r.fixedPayout || 10)
                             + ' · Desconto da ' + (r.discountFrom || 'GREATER_LEG')
                             + ' · Antes: E=' + beforeL + ' / D=' + beforeR
                             + ' · Depois: E=' + r.newLeft + ' / D=' + r.newRight,
                  details: r
                });
              }
              if (self.bus) {
                var res = { mode: r.mode, payout: payout, fixedAmount: r.fixedPayout, percentage: null,
                            discountFrom: r.discountFrom,
                            lesserSide: r.lesserSide,
                            lesserBefore: r.lesserBefore, greaterBefore: r.greaterBefore,
                            newLeft: r.newLeft, newRight: r.newRight,
                            newL: r.newLeft, newR: r.newRight,
                            qualified: true, skipped: false, skipReason: null };
                if (r.lesserSide === 'LEFT') { res.lesserLeg = beforeL; res.greaterLeg = beforeR; }
                else                          { res.lesserLeg = beforeR; res.greaterLeg = beforeL; }
                var wall2 = self.storage && self.storage.getWallet ? self.storage.getWallet() : {};
                self.bus.emit(EV.BINARY_PAYOUT_PROCESSED, res);
                self.bus.emit(EV.WALLET_UPDATED, wall2);
                self.bus.emit(EV.RENDER_REQUIRED);
              }
              showToast(_t('dev_binary_processed_ok') + ' +' + fmt(payout) + ' ' + _t('dev_binary_processed_credit'), 'success');
              return self.hydrateFromSupabase().then(function () { self.render(); });
            }
            showToast((r && (r.msg || r.message)) || _t('dev_nopoints_warning'), 'warning');
            return self.hydrateFromSupabase().then(function () { self.render(); });
          })
          .catch(function (e) {
            console.error('[team] rpc process_binary_payout_for_user ERR:', e);
            showToast((e && (e.msg || e.message)) || _t('dev_nopoints_warning'), 'error');
          });
        return;
      }

      // ============ FALLBACK (modo dev / local) ============
      var bin = this.storage.getBinary() || { leftPoints: 0, rightPoints: 0 };
      var tree = this.currentTree || (this.storage && this.storage.getTree());
      var qual = this.eng.getQualificationStatus(tree);
      var beforeL = Number(bin.leftPoints) || 0;
      var beforeR = Number(bin.rightPoints) || 0;
      var result = this.eng.calcBinaryPayout(bin.leftPoints, bin.rightPoints, { qualified: qual.qualified });
      if (result.skipped) {
        showToast(result.skipReason === 'NOT_QUALIFIED' ? _t('dev_qualification_warning') : _t('dev_nopoints_warning'), 'warning');
        return;
      }
      this.storage.saveBinary({ leftPoints: result.newLeft, rightPoints: result.newRight });
      var wall = this.storage.getWallet() || {};
      wall.teamGains = Number(wall.teamGains || 0) + result.payout;
      wall.availableWithdraw = Number(wall.availableWithdraw || 0) + result.payout;
      wall.totalGains = Number(wall.totalGains || 0) + result.payout;
      this.storage.saveWallet(wall);

      if (this.storage && typeof this.storage.addTransaction === 'function') {
        var modeLabel = result.mode === 'FIXED'
          ? (_t('dev_payout_mode_fixed', { value: fmt(result.fixedAmount || 0) }))
          : (Math.round((result.percentage || 0) * 100) + '% ' + _t('tree_payout_lesser'));
        var usedLegLabel = result.discountFrom === 'GREATER_LEG' ? _t('tree_payout_greater') : (result.discountFrom === 'LESSER_LEG' ? _t('tree_payout_lesser') : 'Ambas');
        this.storage.addTransaction({
          type: 'Bônus Binário',
          amount: result.payout,
          status: 'Creditado',
          description: 'Pagamento Binário · ' + modeLabel + ' · Desconto da ' + usedLegLabel
            + ' · Antes: E=' + beforeL + ' / D=' + beforeR
            + ' · Depois: E=' + (result.newLeft || 0) + ' / D=' + (result.newRight || 0),
          details: {
            mode: result.mode,
            payout: result.payout,
            fixedAmount: result.fixedAmount || null,
            percentage: result.percentage || null,
            discountFrom: result.discountFrom,
            before: { leftPoints: beforeL, rightPoints: beforeR, lesserLeg: result.lesserLeg, greaterLeg: result.greaterLeg },
            after: { leftPoints: result.newLeft, rightPoints: result.newRight },
            qualified: !!result.qualified,
            source: 'fallback_local_process_binary'
          }
        });
      }

      if (this.bus) {
        this.bus.emit(EV.BINARY_PAYOUT_PROCESSED, result);
        this.bus.emit(EV.WALLET_UPDATED, wall);
        this.bus.emit(EV.RENDER_REQUIRED);
      }
      showToast(_t('dev_binary_processed_ok') + ' ' + fmt(result.payout) + ' ' + _t('dev_binary_processed_credit'), 'success');
    }
  };

  global.teamModule = teamModule;

  document.addEventListener && document.addEventListener('DOMContentLoaded', function () {
    var inp = el('team-search-input');
    if (inp) {
      var tm;
      inp.addEventListener('input', function () {
        clearTimeout(tm);
        var v = inp.value;
        tm = setTimeout(function () { teamModule.doSearch(v); }, 180);
      });
      inp.addEventListener('focus', function () { if (inp.value) teamModule.doSearch(inp.value); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var box = el('team-search-results'); if (box) box.classList.remove('open'); } });
    }
    document.addEventListener('click', function (e) {
      var wrap = document.querySelector('.team-search');
      if (!wrap) return;
      if (!wrap.contains(e.target)) {
        var box = el('team-search-results');
        if (box) box.classList.remove('open');
      }
    });
    var bBack = el('team-btn-back'); if (bBack) bBack.addEventListener('click', function () { teamModule.goBackToParent(); });
    var bRoot = el('team-btn-root'); if (bRoot) bRoot.addEventListener('click', function () { teamModule.goToRoot(); });
  });
})(window);

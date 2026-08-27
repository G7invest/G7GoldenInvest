(function (global) {
  'use strict';

  function clone(obj) {
    return obj ? JSON.parse(JSON.stringify(obj)) : null;
  }
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  function defaultSeedTree() {
    var now = new Date().toISOString().slice(0, 10);
    return {
      id: 'eu',
      username: 'g7investidor',
      name: 'Você',
      email: 'voce@g7goldinvest.com',
      amount: 2000,
      active: true,
      position: 'root',
      level: 0,
      joinedAt: now,
      referralParentId: null,
      buildLeg: null,
      points: { left: 500, right: 300 },
      left: {
        id: 'node-J',
        username: 'joao_santos',
        name: 'João Santos',
        email: 'joao@g7goldinvest.com',
        amount: 1500,
        active: true,
        position: 'L',
        level: 1,
        joinedAt: now,
        referralParentId: 'eu',
        buildLeg: null,
        points: { left: 300, right: 0 },
        left: {
          id: 'node-P',
          username: 'pedro_g7',
          name: 'Pedro Almeida',
          email: 'pedro@g7goldinvest.com',
          amount: 800,
          active: true,
          position: 'LL',
          level: 2,
          joinedAt: now,
          referralParentId: 'node-J',
          buildLeg: 'RIGHT',
          points: { left: 200, right: 150 },
          left: {
            id: 'node-PL1',
            username: 'bruno.gold',
            name: 'Bruno Lima',
            email: 'bruno@g7goldinvest.com',
            amount: 500,
            active: true,
            position: 'LLL',
            level: 3,
            joinedAt: now,
            referralParentId: 'node-P',
            points: { left: 50, right: 30 },
            left: {
              id: 'node-PL1L1',
              username: 'marcio_gold',
              name: 'Márcio Gomes',
              email: 'marcio@g7goldinvest.com',
              amount: 300,
              active: true,
              position: 'LLLL',
              level: 4,
              joinedAt: now,
              referralParentId: 'node-PL1',
              points: { left: 0, right: 0 },
              left: null,
              right: null
            },
            right: {
              id: 'node-PL1R1',
              username: 'rafael_g7',
              name: 'Rafael Dias',
              email: 'rafael@g7goldinvest.com',
              amount: 250,
              active: true,
              position: 'LLLR',
              level: 4,
              joinedAt: now,
              referralParentId: 'node-PL1',
              points: { left: 0, right: 0 },
              left: null,
              right: null
            }
          },
          right: {
            id: 'node-PR1',
            username: 'carla.gold',
            name: 'Carla Prado',
            email: 'carla@g7goldinvest.com',
            amount: 400,
            active: true,
            position: 'LLR',
            level: 3,
            joinedAt: now,
            referralParentId: 'node-P',
            points: { left: 0, right: 20 },
            left: null,
            right: null
          }
        },
        right: {
          id: 'node-JR1',
          username: 'empty-JR1',
          name: 'Vaga (Direita J)',
          amount: 0,
          active: false,
          empty: true,
          position: 'LR',
          level: 2,
          points: { left: 0, right: 0 },
          left: null,
          right: null
        }
      },
      right: {
        id: 'node-M',
        username: 'maria_ouro',
        name: 'Maria Souza',
        email: 'maria@g7goldinvest.com',
        amount: 1000,
        active: true,
        position: 'R',
        level: 1,
        joinedAt: now,
        referralParentId: 'eu',
        buildLeg: 'LEFT',
        points: { left: 200, right: 100 },
        left: {
          id: 'node-A',
          username: 'ana_gold',
          name: 'Ana Costa',
          email: 'ana@g7goldinvest.com',
          amount: 700,
          active: true,
          position: 'RL',
          level: 2,
          joinedAt: now,
          referralParentId: 'node-M',
          points: { left: 100, right: 80 },
          left: {
            id: 'node-AL1',
            username: 'felipe.g7',
            name: 'Felipe Andrade',
            email: 'felipe@g7goldinvest.com',
            amount: 450,
            active: true,
            position: 'RLL',
            level: 3,
            joinedAt: now,
            referralParentId: 'node-A',
            points: { left: 0, right: 0 },
            left: null,
            right: null
          },
          right: {
            id: 'node-AR1',
            username: 'juliana_ouro',
            name: 'Juliana Nunes',
            email: 'juliana@g7goldinvest.com',
            amount: 350,
            active: true,
            position: 'RLR',
            level: 3,
            joinedAt: now,
            referralParentId: 'node-A',
            points: { left: 0, right: 0 },
            left: null,
            right: null
          }
        },
        right: {
          id: 'node-MR1',
          username: 'empty-MR1',
          name: 'Vaga (Direita M)',
          amount: 0,
          active: false,
          empty: true,
          position: 'RR',
          level: 2,
          points: { left: 0, right: 0 },
          left: null,
          right: null
        }
      }
    };
  }

  var treeEngine = {
    defaultSeedTree: defaultSeedTree,

    cloneTree: clone,

    findNodeById: function (root, id) {
      if (!root || !id) return null;
      if (root.id === id) return root;
      var found = this.findNodeById(root.left, id);
      if (found) return found;
      return this.findNodeById(root.right, id);
    },

    findNodeByUsername: function (root, username) {
      if (!root || !username) return null;
      var target = norm(username);
      if (norm(root.username) === target || norm(root.name) === target) return root;
      var found = this.findNodeByUsername(root.left, username);
      if (found) return found;
      return this.findNodeByUsername(root.right, username);
    },

    searchNodes: function (root, query) {
      var out = [];
      if (!root || !query) return out;
      var q = norm(query);
      (function walk(node) {
        if (!node) return;
        if (!node.empty) {
          if (norm(node.username).indexOf(q) !== -1 || norm(node.name).indexOf(q) !== -1 || norm(node.id).indexOf(q) !== -1) {
            out.push(node);
          }
        }
        walk(node.left);
        walk(node.right);
      })(root);
      return out;
    },

    findParentNode: function (root, targetId, parent) {
      if (parent === void 0) parent = null;
      if (!root || !targetId) return null;
      if (root.id === targetId) return parent;
      var found = this.findParentNode(root.left, targetId, root);
      if (found) return found;
      return this.findParentNode(root.right, targetId, root);
    },

    findSideOfChild: function (root, childId) {
      if (!root || !childId) return null;
      if (root.left && root.left.id === childId) return 'LEFT';
      if (root.right && root.right.id === childId) return 'RIGHT';
      var l = this.findSideOfChild(root.left || null, childId);
      if (l) return l;
      return this.findSideOfChild(root.right || null, childId);
    },

    classifyLegType: function (root, nodeId) {
      var self = this;
      var node = this.findNodeById(root, nodeId);
      if (!node) return { legType: 'SPILLOVER', sideOnParent: null, buildLeg: null };
      var parentNode = this.findParentNode(root, nodeId);
      if (!parentNode) return { legType: 'SPILLOVER', sideOnParent: null, buildLeg: null };
      var sideOnParent = self.findSideOfChild(parentNode, nodeId);
      var parentBuildLeg = (parentNode.buildLeg || '').toUpperCase();
      var referralMatch = String(node.referralParentId || '') === String(parentNode.id || '');
      var legType;
      if (referralMatch && parentBuildLeg && sideOnParent === parentBuildLeg) {
        legType = 'CONSTRUCTION';
      } else {
        legType = 'SPILLOVER';
      }
      return {
        legType: legType,
        sideOnParent: sideOnParent,
        buildLeg: parentBuildLeg || null,
        referralMatch: referralMatch
      };
    },

    getBreadcrumb: function (root, targetId) {
      var path = [];
      if (!root || !targetId) return path;
      (function walk(node, trail) {
        if (!node) return false;
        trail.push(node);
        if (node.id === targetId) { path = trail.slice(); return true; }
        if (walk(node.left, trail)) return true;
        if (walk(node.right, trail)) return true;
        trail.pop();
        return false;
      })(root, []);
      return path;
    },

    getAncestorChain: function (root, targetId) {
      var chain = [];
      var bc = this.getBreadcrumb(root, targetId);
      for (var i = bc.length - 2; i >= 0; i--) chain.push(bc[i]);
      return chain;
    },

    countDownlineActive: function (node) {
      if (!node) return 0;
      var c = node.active && !node.empty ? 1 : 0;
      c += this.countDownlineActive(node.left);
      c += this.countDownlineActive(node.right);
      return c;
    },

    sumVolume: function (node) {
      if (!node) return 0;
      var v = Number(node.amount) || 0;
      v += this.sumVolume(node.left);
      v += this.sumVolume(node.right);
      return v;
    },

    getTreeHeight: function (node) {
      if (!node) return 0;
      return 1 + Math.max(this.getTreeHeight(node.left), this.getTreeHeight(node.right));
    },

    hasDirectActiveBoth: function (node) {
      if (!node) return false;
      var L = !!(node.left && node.left.active && !node.left.empty);
      var R = !!(node.right && node.right.active && !node.right.empty);
      return L && R;
    },

    getDirectLegStatus: function (node) {
      if (!node) return { leftActive: false, rightActive: false };
      return {
        leftActive: !!(node.left && node.left.active && !node.left.empty),
        rightActive: !!(node.right && node.right.active && !node.right.empty)
      };
    }
  };

  global.treeEngine = treeEngine;
})(window);

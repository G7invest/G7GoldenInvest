(function (global) {
  'use strict';

  var CFG = (global.CONTRACTS && global.CONTRACTS.TEAM) || {};
  var MODE = CFG.BINARY_PAYOUT_MODE || 'PERCENTAGE';
  var FIXED = CFG.BINARY_FIXED_PAYOUT != null ? CFG.BINARY_FIXED_PAYOUT : 10;
  var DISCOUNT = CFG.BINARY_DISCOUNT_FROM || 'LESSER_LEG';
  var QUALIFY = CFG.QUALIFICATION_REQUIRED === true;
  var QUALIFY_BOTH = CFG.QUALIFICATION_REQUIRES_BOTH_LEGS !== false;
  var PERCENTAGE = CFG.BINARY_PERCENTAGE != null ? CFG.BINARY_PERCENTAGE : 0.10;
  var DIRECT_BONUS_PCT = CFG.DIRECT_BONUS_PCT != null ? CFG.DIRECT_BONUS_PCT : 0.05;
  var BONUS_10REF_TARGET = CFG.BONUS_10REF_TARGET != null ? CFG.BONUS_10REF_TARGET : 10;
  var BONUS_10REF_AMOUNT = CFG.BONUS_10REF_AMOUNT != null ? CFG.BONUS_10REF_AMOUNT : 100;

  function isActiveNode(node) {
    return !!(node && (node.active === true || (node.amount != null && Number(node.amount) > 0)));
  }

  var binaryEngine = {
    CONFIG: {
      BINARY_PAYOUT_MODE: MODE,
      BINARY_FIXED_PAYOUT: FIXED,
      BINARY_DISCOUNT_FROM: DISCOUNT,
      QUALIFICATION_REQUIRED: QUALIFY,
      QUALIFICATION_REQUIRES_BOTH_LEGS: QUALIFY_BOTH,
      BINARY_PERCENTAGE: PERCENTAGE,
      DIRECT_BONUS_PCT: DIRECT_BONUS_PCT,
      BONUS_10REF_TARGET: BONUS_10REF_TARGET,
      BONUS_10REF_AMOUNT: BONUS_10REF_AMOUNT
    },

    hasActiveLeftDirect: function (node) {
      if (!QUALIFY || !QUALIFY_BOTH) return true;
      return isActiveNode(node && node.left);
    },
    hasActiveRightDirect: function (node) {
      if (!QUALIFY || !QUALIFY_BOTH) return true;
      return isActiveNode(node && node.right);
    },

    isNodeQualified: function (node) {
      if (!QUALIFY) return true;
      if (!node) return false;
      if (!QUALIFY_BOTH) {
        return this.hasActiveLeftDirect(node) || this.hasActiveRightDirect(node);
      }
      return this.hasActiveLeftDirect(node) && this.hasActiveRightDirect(node);
    },

    getQualificationStatus: function (node) {
      if (!QUALIFY) {
        return { qualified: true, needLeft: false, needRight: false, text: 'Qualificação não requerida' };
      }
      var L = this.hasActiveLeftDirect(node);
      var R = this.hasActiveRightDirect(node);
      var qualified;
      if (QUALIFY_BOTH) qualified = L && R;
      else qualified = L || R;

      var text;
      if (qualified) text = '✅ Qualificado para receber binário';
      else if (QUALIFY_BOTH) {
        if (!L && !R) text = '⚠️ Necessário 1 ativo na Esquerda e 1 ativo na Direita';
        else if (!L) text = '⚠️ Falta 1 indicado ativo na ESQUERDA';
        else text = '⚠️ Falta 1 indicado ativo na DIREITA';
      } else {
        text = '⚠️ Necessário pelo menos 1 indicado ativo';
      }

      return { qualified: qualified, needLeft: !L, needRight: !R, text: text };
    },

    calcLesserLeg: function (leftPoints, rightPoints) {
      return Math.min(Number(leftPoints) || 0, Number(rightPoints) || 0);
    },
    calcGreaterLeg: function (leftPoints, rightPoints) {
      return Math.max(Number(leftPoints) || 0, Number(rightPoints) || 0);
    },

    calcBinaryPayout: function (leftPoints, rightPoints, options) {
      if (options === void 0) options = {};
      var mode = options.mode || MODE;
      var discountFrom = options.discountFrom || DISCOUNT;
      var fixedAmount = options.fixedAmount != null ? options.fixedAmount : FIXED;
      var percentage = options.percentage != null ? options.percentage : PERCENTAGE;
      var qualified = options.qualified !== false;

      var L = Number(leftPoints) || 0;
      var R = Number(rightPoints) || 0;
      var lesser = Math.min(L, R);
      var greater = Math.max(L, R);
      var isGreaterLeft = L >= R;

      if (lesser <= 0) {
        return { payout: 0, lesserLeg: 0, greaterLeg: greater, newLeft: L, newRight: R, skipped: true, skipReason: 'NO_POINTS' };
      }

      if (QUALIFY && !qualified) {
        return { payout: 0, lesserLeg: lesser, greaterLeg: greater, newLeft: L, newRight: R, skipped: true, skipReason: 'NOT_QUALIFIED' };
      }

      var payout;
      if (mode === 'FIXED') {
        payout = Number(fixedAmount) || 0;
      } else {
        payout = lesser * percentage;
      }

      var nL = L, nR = R;
      if (discountFrom === 'GREATER_LEG') {
        if (lesser > 0) {
          if (isGreaterLeft) nL = L - lesser;
          else nR = R - lesser;
        }
      } else if (discountFrom === 'LESSER_LEG') {
        if (isGreaterLeft) nR = 0;
        else nL = 0;
      } else if (discountFrom === 'BOTH') {
        nL = L - lesser;
        nR = R - lesser;
      }

      return {
        payout: payout,
        mode: mode,
        lesserLeg: lesser,
        greaterLeg: greater,
        fixedAmount: mode === 'FIXED' ? fixedAmount : null,
        percentage: mode === 'PERCENTAGE' ? percentage : null,
        discountFrom: discountFrom,
        qualified: qualified,
        newLeft: Math.max(0, nL),
        newRight: Math.max(0, nR),
        skipped: false
      };
    },

    calcDirectBonus: function (referralAppAmount, options) {
      if (options === void 0) options = {};
      var pct = options.pct != null ? options.pct : DIRECT_BONUS_PCT;
      var amount = Number(referralAppAmount) || 0;
      return { commission: amount * pct, amount: amount, percentage: pct };
    },

    addBinaryPoints: function (binaryState, side, points) {
      var left = Number(binaryState && binaryState.leftPoints) || 0;
      var right = Number(binaryState && binaryState.rightPoints) || 0;
      var pts = Number(points) || 0;
      if (side === 'left' || side === 'L') left += pts;
      else if (side === 'right' || side === 'R') right += pts;
      else {
        if (left <= right) left += pts;
        else right += pts;
      }
      return { leftPoints: left, rightPoints: right };
    },

    addPointsToNode: function (node, side, points) {
      if (!node || !node.points) node = node || {};
      if (!node.points) node.points = { left: 0, right: 0 };
      var pts = Number(points) || 0;
      var s = (side || '').toUpperCase();
      if (s === 'RIGHT' || s === 'R') node.points.right = (Number(node.points.right) || 0) + pts;
      else node.points.left = (Number(node.points.left) || 0) + pts;
      return node;
    },

    addBinaryPointsAdvanced: function (rootTree, startNodeId, sideOnParent, points, options) {
      if (!rootTree || !startNodeId) {
        return { applied: false, reason: 'INVALID_ARGS', nodeUpdates: [], rootBinaryDelta: { left: 0, right: 0 } };
      }
      if (options === void 0) options = {};
      var pointsTotal = Number(points) || 0;
      if (pointsTotal <= 0) {
        return { applied: false, reason: 'ZERO_POINTS', nodeUpdates: [], rootBinaryDelta: { left: 0, right: 0 } };
      }
      var tEng = global.treeEngine;
      var onlyQualification = options.qualificationOnly === true;
      var legTypeOverride = options.legType || null;
      var nodeUpdates = [];
      var rootBinaryDelta = { left: 0, right: 0 };
      var ancestors = tEng ? tEng.getAncestorChain(rootTree, startNodeId) : [];
      var targetNode = tEng ? tEng.findNodeById(rootTree, startNodeId) : null;
      if (!targetNode) {
        return { applied: false, reason: 'TARGET_NOT_FOUND', nodeUpdates: [], rootBinaryDelta: { left: 0, right: 0 } };
      }
      var firstSide = (sideOnParent || '').toUpperCase();
      if (!firstSide && tEng) {
        var directParent = ancestors.length ? ancestors[0] : null;
        if (directParent) firstSide = tEng.findSideOfChild(directParent, startNodeId);
      }
      firstSide = (firstSide === 'RIGHT' || firstSide === 'R') ? 'RIGHT' : 'LEFT';
      var self = this;

      function recordUpdate(nodeId, side, pts, reason, leg) {
        var n = tEng ? tEng.findNodeById(rootTree, nodeId) : null;
        if (n) self.addPointsToNode(n, side, pts);
        nodeUpdates.push({ nodeId: nodeId, side: side, points: pts, reason: reason, leg: leg });
        if (nodeId === rootTree.id) {
          if (side === 'RIGHT') rootBinaryDelta.right += pts;
          else rootBinaryDelta.left += pts;
        }
      }

      function walkUp() {
        var currentNodeId = startNodeId;
        var currentSide = firstSide;
        var currentNode = targetNode;
        var depth = 0;
        var alreadyHitConstruction = false;

        while (true) {
          depth++;
          var parentNode = null;
          var parentId = null;
          if (tEng) {
            parentNode = tEng.findParentNode(rootTree, currentNodeId);
            if (parentNode) parentId = parentNode.id;
          }
          if (!parentNode || !parentId) break;
          var classification;
          if (depth === 1 && legTypeOverride) {
            classification = { legType: legTypeOverride, sideOnParent: currentSide, buildLeg: (parentNode.buildLeg || null), referralMatch: String(currentNode.referralParentId || '') === String(parentId || '') };
          } else if (tEng) {
            classification = tEng.classifyLegType(rootTree, currentNodeId);
            if (classification && classification.sideOnParent) currentSide = classification.sideOnParent;
          } else {
            classification = { legType: 'SPILLOVER', sideOnParent: currentSide };
          }
          var leg = classification.legType;
          var s = (currentSide === 'RIGHT' || currentSide === 'R') ? 'RIGHT' : 'LEFT';

          if (onlyQualification) {
            if (leg === 'SPILLOVER' && alreadyHitConstruction === false) {
              if (depth === 1) {
                // NÍVEL 1 (Indicador direto) = NÃO RECEBE pontos qualificação
              } else {
                recordUpdate(parentId, s, pointsTotal, 'QUALIFICATION_UPLINE_SPILLOVER', leg);
              }
            } else if (leg === 'CONSTRUCTION') {
              alreadyHitConstruction = true;
            }
          } else {
            // Caso NORMAL (aplicação real)
            if (leg === 'SPILLOVER') {
              recordUpdate(parentId, s, pointsTotal, 'APPLICATION_SPILLOVER', leg);
              if (parentId === rootTree.id) {
                // atualiza rootBinary (pontos do user principal)
              }
            } else if (leg === 'CONSTRUCTION') {
              if (depth === 1) {
                recordUpdate(parentId, s, pointsTotal, 'APPLICATION_CONSTRUCTION_DIRECT', leg);
              }
              break;
            }
          }

          currentNodeId = parentId;
          currentNode = parentNode;
        }
      }

      walkUp();

      return {
        applied: true,
        qualificationOnly: !!onlyQualification,
        startNodeId: startNodeId,
        firstSide: firstSide,
        legTypeOverride: legTypeOverride,
        points: pointsTotal,
        nodeUpdates: nodeUpdates,
        rootBinaryDelta: rootBinaryDelta
      };
    },

    is10RefBonusEligible: function (teamState) {
      var activeCount = Number(teamState && teamState.activeCount) || 0;
      var claimed = !!(teamState && teamState.bonusClaimed);
      return activeCount >= BONUS_10REF_TARGET && !claimed;
    },

    calc10RefBonusProgress: function (teamState) {
      var activeCount = Number(teamState && teamState.activeCount) || 0;
      var pct = Math.min((activeCount / BONUS_10REF_TARGET) * 100, 100);
      return {
        activeCount: activeCount,
        target: BONUS_10REF_TARGET,
        percentage: pct,
        bonusAmount: BONUS_10REF_AMOUNT,
        eligible: activeCount >= BONUS_10REF_TARGET,
        claimed: !!(teamState && teamState.bonusClaimed)
      };
    },

    addReferral: function (teamState, referralAppAmount) {
      if (referralAppAmount === void 0) referralAppAmount = 100;
      var directCount = Number(teamState && teamState.directCount) || 0;
      var activeCount = Number(teamState && teamState.activeCount) || 0;
      var bonusClaimed = !!(teamState && teamState.bonusClaimed);
      return { directCount: directCount + 1, activeCount: activeCount + 1, bonusClaimed: bonusClaimed };
    },

    calcTeamStats: function (teamState, binaryState, walletState, rootNode) {
      var L = Number(binaryState && binaryState.leftPoints) || 0;
      var R = Number(binaryState && binaryState.rightPoints) || 0;
      var qualStatus = this.getQualificationStatus(rootNode || null);
      var payoutDraft = this.calcBinaryPayout(L, R, { qualified: qualStatus.qualified });

      return {
        directCount: Number(teamState && teamState.directCount) || 0,
        activeCount: Number(teamState && teamState.activeCount) || 0,
        bonusClaimed: !!(teamState && teamState.bonusClaimed),
        leftPoints: L,
        rightPoints: R,
        lesserLeg: this.calcLesserLeg(L, R),
        greaterLeg: this.calcGreaterLeg(L, R),
        pendingBinaryPayout: qualStatus.qualified ? payoutDraft.payout : 0,
        payoutMode: MODE,
        fixedPayoutAmount: FIXED,
        teamGains: Number(walletState && walletState.teamGains) || 0,
        bonusGains: Number(walletState && walletState.bonusGains) || 0,
        bonusProgress: this.calc10RefBonusProgress(teamState),
        qualification: qualStatus,
        payoutSkipped: payoutDraft.skipped,
        payoutSkipReason: payoutDraft.skipReason
      };
    },

    computeFullCyclePayout: function (leftPoints, rightPoints, cycles, options) {
      if (cycles === void 0) cycles = 1;
      if (options === void 0) options = {};
      var totalPayout = 0;
      var L = Number(leftPoints) || 0;
      var R = Number(rightPoints) || 0;
      var i;
      for (i = 0; i < cycles; i++) {
        var result = this.calcBinaryPayout(L, R, options);
        if (result.skipped) break;
        totalPayout += result.payout;
        L = result.newLeft;
        R = result.newRight;
        if (result.lesserLeg <= 0) break;
      }
      return { totalPayout: totalPayout, remainingLeft: L, remainingRight: R, cyclesRun: i };
    }
  };

  global.binaryEngine = binaryEngine;
})(window);

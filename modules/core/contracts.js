(function (global) {
  'use strict';

  var CONTRACTS = {
    TEAM: {
      DIRECT_BONUS_PCT: 0.05,
      BINARY_PERCENTAGE: 0.10,
      BINARY_PAYOUT_MODE: 'FIXED',
      BINARY_FIXED_PAYOUT: 10,
      BINARY_DISCOUNT_FROM: 'GREATER_LEG',
      QUALIFICATION_REQUIRED: true,
      QUALIFICATION_REQUIRES_BOTH_LEGS: true,
      QUALIFICATION_PREVENTS_PAYOUT: true,
      BONUS_10REF_AMOUNT: 100,
      BONUS_10REF_TARGET: 10,
      MIN_APP_FOR_BONUS: 100,
      BINARY_POINT_TYPES: {
        SPILLOVER: 'SPILLOVER',
        CONSTRUCTION: 'CONSTRUCTION',
        QUALIFICATION: 'QUALIFICATION'
      }
    },
    WALLET: {
      WITHDRAW_MIN: 50,
      WITHDRAW_FEE_PCT: 0.05,
      INVEST_MIN: 100
    },
    STORAGE_KEYS: {
      USER: 'g7_user',
      APPLICATIONS: 'g7_applications',
      TRANSACTIONS: 'g7_transactions',
      NOTIFICATIONS: 'g7_notifications',
      TEAM: 'g7_team',
      BINARY: 'g7_binary',
      WALLET: 'g7_wallet',
      SETTINGS: 'g7_settings',
      LANG: 'g7_language',
      TREE: 'g7_tree',
      TREE_FOCUS: 'g7_tree_focus'
    },
    EVENTS: {
      TEAM_STATS_UPDATED: 'team:stats-updated',
      BINARY_PAYOUT_PROCESSED: 'team:binary-payout',
      REFERRAL_ADDED: 'team:referral-added',
      BONUS_CLAIMED: 'team:bonus-claimed',
      WALLET_UPDATED: 'wallet:updated',
      TRANSACTION_ADDED: 'tx:added',
      NOTIFICATION_ADDED: 'notif:added',
      RENDER_REQUIRED: 'ui:render-required',
      APPLICATION_CREATED: 'app:application-created',
      DATA_RESET: 'system:data-reset',
      TREE_FOCUS_CHANGED: 'team:tree-focus-changed',
      QUALIFICATION_CHANGED: 'team:qualification-changed'
    },
    VIEWS: ['home', 'team', 'wallet', 'reports', 'settings', 'support']
  };

  global.CONTRACTS = CONTRACTS;
  CONTRACTS.NOWPAYMENTS = CONTRACTS.NOWPAYMENTS || {
    ENABLED: true,
    API_BASE_URL: 'https://api.nowpayments.io/v1',
    CREATE_ORDER_ENDPOINT: 'https://mimtidufeueexcsgcpgv.supabase.co/functions/v1/np-create-order',
    IPN_WEBHOOK_URL: 'https://mimtidufeueexcsgcpgv.supabase.co/functions/v1/np-webhook',
    RETURN_URLS: {
      success: 'https://g7goldinvest.com/index.html?from=nowpayments&status=success',
      cancel:  'https://g7goldinvest.com/index.html?from=nowpayments&status=cancel'
    },
    ALLOWED_DEPOSIT_ASSETS: [
      { code: 'usdtbep20', label: 'USDT BEP-20', network: 'BEP-20' },
      { code: 'usdttrc20', label: 'USDT TRC-20', network: 'TRC-20' },
      { code: 'usdterc20', label: 'USDT ERC-20', network: 'ERC-20' }
    ],
    ALLOWED_WITHDRAW_ASSETS: [
      { code: 'usdtbep20', label: 'USDT BEP-20', network: 'BEP-20' },
      { code: 'usdttrc20', label: 'USDT TRC-20', network: 'TRC-20' },
      { code: 'usdterc20', label: 'USDT ERC-20', network: 'ERC-20' },
      { code: 'eth',     label: 'ETH',        network: 'ERC-20' }
    ],
    MIN_DEPOSIT_USD: 100,
    ORDER_EXPIRY_MINUTES: 180,
    AUTO_CONFIRM_ON_STATUS: 'finished'
  };
  global.CONTRACTS = CONTRACTS;
})(window);

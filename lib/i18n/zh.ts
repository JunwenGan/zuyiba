/**
 * Chinese UI copy for the ZuYiBa game.
 * Centralised to avoid scattering Chinese strings throughout components.
 */

export const zh = {
  // Brand
  brand: '足一把',
  tagline: 'Guess the Footballer',
  subtitle: '猜出这名足球运动员',

  // Game actions
  startGame: '开始游戏',
  newGame: '再来一局',
  restartGame: '重新开始',
  submitGuess: '确认',

  // Game modes
  selectMode: '选择游戏模式',
  normalMode: '普通模式',
  hardMode: '挑战模式',
  normalModeDesc: '仅包含顶级豪门球员',
  hardModeDesc: '包含五大联赛所有球员',

  // Search
  searchPlaceholder: '搜索球员姓名',
  noResults: '未找到球员',
  searching: '搜索中...',

  // Game state
  attemptsRemaining: '剩余次数',
  attempt: '次',

  // Results
  win: '猜对了！',
  loss: '很遗憾，答案是：',
  shareResult: '分享结果',

  // How to play
  howToPlay: '玩法说明',
  howToPlayDescription: '猜测隐藏的足球运动员。每次猜测后，你会看到每个属性的匹配情况。',

  // Comparison feedback
  correct: '正确',
  partial: '接近',
  incorrect: '不对',
  higher: '更高',
  lower: '更低',
  unknown: '未知',

  // Player attributes
  attributes: {
    name: '球员',
    nationality: '国籍',
    club: '俱乐部',
    league: '联赛',
    position: '位置',
    age: '年龄',
    height: '身高',
    preferredFoot: '惯用脚',
  },

  // Preferred foot values
  foot: {
    LEFT: '左脚',
    RIGHT: '右脚',
    BOTH: '双脚',
  },

  // Position groups
  positionGroups: {
    GOALKEEPER: '门将',
    DEFENDER: '后卫',
    MIDFIELDER: '中场',
    FORWARD: '前锋',
  },

  // Leagues
  leagues: {
    PREMIER_LEAGUE: '英超',
    LA_LIGA: '西甲',
    BUNDESLIGA: '德甲',
    SERIE_A: '意甲',
    LIGUE_1: '法甲',
  },

  // Errors
  errors: {
    networkError: '网络错误，请重试',
    gameNotFound: '游戏不存在',
    playerNotFound: '球员不存在',
    duplicateGuess: '你已经猜过这位球员了',
    gameCompleted: '游戏已结束',
    genericError: '出错了，请重试',
  },

  // Loading
  loading: '加载中...',
  startingGame: '正在开始游戏...',
} as const;

export type ZhKey = keyof typeof zh;

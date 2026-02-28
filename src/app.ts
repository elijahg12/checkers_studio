type Color = "w" | "b";
type Difficulty = "easy" | "medium" | "hard";
type GameMode = "ai" | "pvp";
type Variant = "classic" | "giveaway";
type Language = "ru" | "en";
type GameOutcome = "win" | "loss";

interface Piece {
  color: Color;
  king: boolean;
}

interface Coords {
  r: number;
  c: number;
}

interface Move {
  from: Coords;
  to: Coords;
  captures: Coords[];
}

interface DifficultyConfig {
  maxDepth: number;
  timeMs: number;
  randomChance: number;
  noise: number;
  hintDepth: number;
  hintTimeMs: number;
}

type Board = Array<Array<Piece | null>>;

interface GameNode {
  board: Board;
  hash: bigint;
  turn: Color;
  pendingCapture: Coords | null;
}

interface SetupBackup {
  board: Board;
  turn: Color;
  pendingCapture: Coords | null;
  gameOver: boolean;
  winner: Color | null;
  gameStarted: boolean;
  whiteTimeMs: number;
  blackTimeMs: number;
}

interface UndoSnapshot {
  board: Board;
  turn: Color;
  pendingCapture: Coords | null;
  gameOver: boolean;
  winner: Color | null;
  gameStarted: boolean;
  whiteTimeMs: number;
  blackTimeMs: number;
  humanColor: Color;
  aiColor: Color;
}

interface SearchResult {
  move: Move | null;
  score: number;
  depthReached: number;
}

interface TTEntry {
  depth: number;
  score: number;
  bestMove: Move | null;
  flag: "exact" | "lower" | "upper";
}

interface SearchClock {
  nodes: number;
}

interface CapturedPieceUndo {
  r: number;
  c: number;
  piece: Piece;
}

interface AppliedMoveUndo {
  move: Move;
  movedPiece: Piece;
  wasKing: boolean;
  captured: CapturedPieceUndo[];
  prevHash: bigint;
  prevTurn: Color;
  prevPendingCapture: Coords | null;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  result: GameOutcome;
  difficulty: Difficulty;
  variant: Variant;
  elapsedMs: number;
  hintsUsed: number;
  playedAt: number;
}

interface RankedSessionToken {
  sessionId: string;
  issuedAt: number;
  signature: string;
}

type TelemetryEventName = "game_start" | "game_finish" | "setup_open" | "setup_apply" | "setup_cancel" | "hint_request";

interface GameState {
  board: Board;
  turn: Color;
  variant: Variant;
  language: Language;
  gameMode: GameMode;
  humanColor: Color;
  aiColor: Color;
  difficulty: Difficulty;
  selected: Coords | null;
  legalMovesForSelected: Move[];
  pendingCapture: Coords | null;
  gameOver: boolean;
  winner: Color | null;
  gameStarted: boolean;
  setupMode: boolean;
  settingsOpen: boolean;
  setupBackup: SetupBackup | null;
  aiThinking: boolean;
  aiGeneration: number;
  hintMove: Move | null;
  hintText: string | null;
  hintThinking: boolean;
  hintGeneration: number;
  hintMode: boolean;
  initialTimeMs: number;
  whiteTimeMs: number;
  blackTimeMs: number;
  lastClockTs: number | null;
}

interface Elements {
  layout: HTMLElement;
  editorPanel: HTMLElement;
  settingsPanel: HTMLElement;
  board: HTMLDivElement;
  status: HTMLDivElement;
  hintText: HTMLDivElement;
  modeGroup: HTMLDivElement;
  variantGroup: HTMLDivElement;
  colorGroup: HTMLDivElement;
  langGroup: HTMLDivElement;
  settingsToggleBtn: HTMLButtonElement;
  leaderboardPanel: HTMLElement;
  leaderboardBody: HTMLTableSectionElement;
  leaderboardEmpty: HTMLElement;
  langRuBtn: HTMLButtonElement;
  langEnBtn: HTMLButtonElement;
  modeAiBtn: HTMLButtonElement;
  modePvpBtn: HTMLButtonElement;
  variantClassicBtn: HTMLButtonElement;
  variantGiveawayBtn: HTMLButtonElement;
  colorWhiteBtn: HTMLButtonElement;
  colorBlackBtn: HTMLButtonElement;
  whiteTimer: HTMLDivElement;
  blackTimer: HTMLDivElement;
  timeControl: HTMLSelectElement;
  difficulty: HTMLSelectElement;
  newGameBtn: HTMLButtonElement;
  undoBtn: HTMLButtonElement;
  hintOnceBtn: HTMLButtonElement;
  hintBtn: HTMLButtonElement;
  enterSetupBtn: HTMLButtonElement;
  setupPanel: HTMLDivElement;
  setupPiece: HTMLSelectElement;
  setupTurn: HTMLSelectElement;
  setupHumanColor: HTMLSelectElement;
  clearBoardBtn: HTMLButtonElement;
  fillStandardBtn: HTMLButtonElement;
  applySetupBtn: HTMLButtonElement;
  cancelSetupBtn: HTMLButtonElement;
  nameModal: HTMLDivElement;
  nameModalText: HTMLParagraphElement;
  nameModalInput: HTMLInputElement;
  nameModalSubmit: HTMLButtonElement;
  nameModalCancel: HTMLButtonElement;
  topControls: HTMLDivElement;
  mobileControlsToggle: HTMLButtonElement;
  mobileToggleText: HTMLSpanElement;
}

const BOARD_SIZE = 8;
const WIN_SCORE = 1_000_000;
const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: { maxDepth: 4, timeMs: 260, randomChance: 0.22, noise: 120, hintDepth: 6, hintTimeMs: 900 },
  medium: { maxDepth: 6, timeMs: 750, randomChance: 0.05, noise: 24, hintDepth: 8, hintTimeMs: 1600 },
  hard: { maxDepth: 8, timeMs: 1500, randomChance: 0, noise: 0, hintDepth: 9, hintTimeMs: 1500 },
};

const zobristRand32 = createXorShift32(0x9e3779b9);
const ZOBRIST_PIECES: bigint[][] = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => [
  random64(zobristRand32),
  random64(zobristRand32),
  random64(zobristRand32),
  random64(zobristRand32),
]);
const ZOBRIST_TURN_WHITE = random64(zobristRand32);
const ZOBRIST_TURN_BLACK = random64(zobristRand32);
const ZOBRIST_PENDING: bigint[] = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => random64(zobristRand32));
const ZOBRIST_NO_PENDING = random64(zobristRand32);
const ZOBRIST_VARIANT_CLASSIC = random64(zobristRand32);
const ZOBRIST_VARIANT_GIVEAWAY = random64(zobristRand32);

const LANGUAGE_STORAGE_KEY = "chekers_lang";
const LEADERBOARD_LIMIT = 20;
const API_PREFIX = "/api";
const SCORE_PAR_TIME_MS: Record<Difficulty, number> = {
  easy: 6 * 60_000,
  medium: 8 * 60_000,
  hard: 10 * 60_000,
};
const SCORE_DIFFICULTY_MULT: Record<Difficulty, number> = {
  easy: 1,
  medium: 1.4,
  hard: 1.9,
};

const TRANSLATIONS: Record<Language, Record<string, string>> = {
  ru: {
    appTitle: "Checkers Studio",
    subtitle: "Шашки: моделируйте любую партию с любого хода, задавайте любую позицию и играйте против ИИ или человека.",
    seoDescription: "Checkers Studio: играйте в шашки против ИИ или человека, задавайте любую позицию, моделируйте партии с любого хода, используйте подсказки, таймер и таблицу лидеров.",
    seoKeywords: "шашки, checkers, редактор позиции, симулятор шашек, шашки против компьютера, таблица лидеров",
    seoFeatureEditor: "Редактор позиции: стартуйте с любой расстановки",
    seoFeatureSimulation: "Моделирование партии с любого хода",
    seoFeatureLeaderboard: "Таблица лидеров для игр против компьютера",
    seoFeatureHints: "Подсказки и таймер",
    languageLabel: "Язык",
    settingsTitle: "Настройки",
    settingsOpenAria: "Открыть настройки",
    settingsCloseAria: "Закрыть настройки",
    modeLabel: "Режим игры",
    modeAi: "Против компьютера",
    modePvp: "Человек vs человек",
    variantLabel: "Вариант",
    variantClassic: "Классика",
    variantGiveaway: "Поддавки",
    colorBottomLabel: "Цвет",
    colorWhiteBottom: "Белые",
    colorBlackBottom: "Чёрные",
    difficultyLabel: "Сложность",
    difficultyEasy: "Лёгкая",
    difficultyMedium: "Средняя",
    difficultyHard: "Сложная",
    timerLabel: "Таймер",
    newGameBtn: "Новая стандартная партия",
    leaderboardTitle: "Таблица лидеров (vs компьютер)",
    leaderboardInfo: "Очки: результат + скорость + сложность, штраф за подсказки.",
    leaderboardColRank: "#",
    leaderboardColName: "Имя",
    leaderboardColScore: "Очки",
    leaderboardColResult: "Результат",
    leaderboardColTime: "Время",
    leaderboardColDiff: "Сложность",
    leaderboardEmpty: "Пока нет записей. Завершите партию против компьютера.",
    leaderboardResultWin: "Победа",
    leaderboardResultLoss: "Поражение",
    leaderboardNamePrompt: "Вы попали в таблицу лидеров! Очки: {score}. Введите имя (2-16 символов).",
    leaderboardNamePromptTitle: "Вы в топе!",
    leaderboardNamePlaceholder: "Ваше имя",
    leaderboardSyncError: "Лидерборд недоступен: сервер не отвечает.",
    leaderboardRejectedSetup: "Запись не засчитана: партия начата из редактора позиции.",
    leaderboardRejectedGuard: "Запись не засчитана: сработала anti-cheat проверка.",
    leaderboardSubmitted: "Результат отправлен в глобальный лидерборд.",
    submitBtn: "Отправить",
    undoBtn: "Отменить ход",
    hintOnceBtn: "Подсказка",
    hintModeOn: "Авто: вкл",
    hintModeOff: "Авто: выкл",
    showMoreControls: "Показать все настройки",
    showLessControls: "Скрыть настройки",
    setupModeOn: "Редактор позиции: вкл",
    setupModeOff: "Редактор позиции: выкл",
    timerWhite: "Белые",
    timerBlack: "Чёрные",
    boardAria: "Доска шашек",
    modeGroupAria: "Режим игры",
    variantGroupAria: "Вариант правил",
    colorGroupAria: "Выбор цвета",
    langGroupAria: "Язык",
    editorTitle: "Режим редактора",
    setupPieceLabel: "Что ставить на поле:",
    pieceEmpty: "Пусто",
    pieceWhiteMan: "Белая шашка",
    pieceWhiteKing: "Белая дамка",
    pieceBlackMan: "Чёрная шашка",
    pieceBlackKing: "Чёрная дамка",
    setupTurnLabel: "Чей ход в позиции:",
    colorWhite: "Белые",
    colorBlack: "Чёрные",
    setupHumanColorLabel: "Вы играете за:",
    playWhite: "Белых",
    playBlack: "Чёрных",
    clearBoardBtn: "Очистить доску",
    fillStandardBtn: "Стартовая расстановка",
    applySetupBtn: "Играть с этой позиции",
    cancelBtn: "Отмена",
    setupHintText: "Нажимайте на тёмные клетки, чтобы выставлять фигуры.",
    statusSetup: "Режим редактора: расставьте фигуры, выберите чей ход и за кого играете, затем нажмите «{applySetup}».",
    statusPressNewGame: "Нажмите «{newGame}», чтобы начать игру.",
    statusVictoryYou: "Победа! Вы играли за {color}.",
    statusGameOverWinner: "Партия закончена: победили {color}.",
    statusAiThinking: "Компьютер думает...",
    statusForcedCapture: "Обязательное продолжение взятия этой же фигурой.",
    statusTurn: "Ход: {color}.",
    statusYourTurn: "Ваш ход ({color}).",
    statusAiTurn: "Ход компьютера ({color}).",
    confirmRestart: "Партия уже идёт. Перезапустить и начать новую?",
    hintThinking: "Подбираю лучший ход...",
    hintUnavailable: "Подсказка недоступна: в позиции нет хода.",
    hintBestMove: "Подсказка: {move} (глубина {depth}).",
    colorWhiteLower: "белые",
    colorBlackLower: "чёрные",
    colorUnknown: "неизвестные",
    pieceEmptyLower: "пусто",
    pieceWhiteManLower: "белая шашка",
    pieceWhiteKingLower: "белая дамка",
    pieceBlackManLower: "чёрная шашка",
    pieceBlackKingLower: "чёрная дамка",
    squareLabel: "Клетка {square}: {piece}.",
  },
  en: {
    appTitle: "Checkers Studio",
    subtitle: "Stage any position, simulate any checkers game from any move, and play versus AI or human.",
    seoDescription: "Checkers Studio lets you play checkers vs AI or human, stage any board position, simulate games from any move, and use hints, timer, and leaderboard.",
    seoKeywords: "checkers, draughts, checkers ai, position editor, game simulator, leaderboard",
    seoFeatureEditor: "Position editor: start from any board setup",
    seoFeatureSimulation: "Game simulation from any move",
    seoFeatureLeaderboard: "Leaderboard for games vs computer",
    seoFeatureHints: "Hints and game timer",
    languageLabel: "Language",
    settingsTitle: "Settings",
    settingsOpenAria: "Open settings",
    settingsCloseAria: "Close settings",
    modeLabel: "Game mode",
    modeAi: "Vs computer",
    modePvp: "Human vs human",
    variantLabel: "Variant",
    variantClassic: "Classic",
    variantGiveaway: "Giveaway",
    colorBottomLabel: "Color",
    colorWhiteBottom: "White",
    colorBlackBottom: "Black",
    difficultyLabel: "Difficulty",
    difficultyEasy: "Easy",
    difficultyMedium: "Medium",
    difficultyHard: "Hard",
    timerLabel: "Timer",
    newGameBtn: "New standard game",
    leaderboardTitle: "Leaderboard (vs computer)",
    leaderboardInfo: "Score: result + speed + difficulty, hints reduce score.",
    leaderboardColRank: "#",
    leaderboardColName: "Name",
    leaderboardColScore: "Score",
    leaderboardColResult: "Result",
    leaderboardColTime: "Time",
    leaderboardColDiff: "Difficulty",
    leaderboardEmpty: "No entries yet. Finish a game versus computer.",
    leaderboardResultWin: "Win",
    leaderboardResultLoss: "Loss",
    leaderboardNamePrompt: "You made the leaderboard! Score: {score}. Enter name (2-16 chars).",
    leaderboardNamePromptTitle: "You're on the leaderboard!",
    leaderboardNamePlaceholder: "Your name",
    leaderboardSyncError: "Leaderboard unavailable: server did not respond.",
    leaderboardRejectedSetup: "Result not ranked: game started from position editor.",
    leaderboardRejectedGuard: "Result not ranked: anti-cheat validation failed.",
    leaderboardSubmitted: "Result submitted to global leaderboard.",
    submitBtn: "Submit",
    undoBtn: "Undo move",
    hintOnceBtn: "Hint",
    hintModeOn: "Auto: on",
    hintModeOff: "Auto: off",
    showMoreControls: "Show all controls",
    showLessControls: "Hide controls",
    setupModeOn: "Position editor: on",
    setupModeOff: "Position editor: off",
    timerWhite: "White",
    timerBlack: "Black",
    boardAria: "Checkers board",
    modeGroupAria: "Game mode",
    variantGroupAria: "Rules variant",
    colorGroupAria: "Color selection",
    langGroupAria: "Language",
    editorTitle: "Editor mode",
    setupPieceLabel: "Piece to place:",
    pieceEmpty: "Empty",
    pieceWhiteMan: "White man",
    pieceWhiteKing: "White king",
    pieceBlackMan: "Black man",
    pieceBlackKing: "Black king",
    setupTurnLabel: "Side to move:",
    colorWhite: "White",
    colorBlack: "Black",
    setupHumanColorLabel: "You play as:",
    playWhite: "White",
    playBlack: "Black",
    clearBoardBtn: "Clear board",
    fillStandardBtn: "Standard setup",
    applySetupBtn: "Play from this position",
    cancelBtn: "Cancel",
    setupHintText: "Click dark squares to place pieces.",
    statusSetup: "Editor mode: set pieces, choose side to move and your side, then click \"{applySetup}\".",
    statusPressNewGame: "Click \"{newGame}\" to start.",
    statusVictoryYou: "Victory! You played {color}.",
    statusGameOverWinner: "Game over: {color} won.",
    statusAiThinking: "Computer is thinking...",
    statusForcedCapture: "You must continue capture with the same piece.",
    statusTurn: "Turn: {color}.",
    statusYourTurn: "Your move ({color}).",
    statusAiTurn: "Computer move ({color}).",
    confirmRestart: "A game is already in progress. Restart and start a new one?",
    hintThinking: "Finding the best move...",
    hintUnavailable: "Hint unavailable: no legal move in this position.",
    hintBestMove: "Hint: {move} (depth {depth}).",
    colorWhiteLower: "white",
    colorBlackLower: "black",
    colorUnknown: "unknown",
    pieceEmptyLower: "empty",
    pieceWhiteManLower: "white man",
    pieceWhiteKingLower: "white king",
    pieceBlackManLower: "black man",
    pieceBlackKingLower: "black king",
    squareLabel: "Square {square}: {piece}.",
  },
};

function normalizeLanguage(value: string | null): Language | null {
  if (value === "ru" || value === "en") {
    return value;
  }
  return null;
}

function getStoredLanguage(): Language {
  try {
    const stored = normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
    if (stored) {
      return stored;
    }
  } catch {
    // Ignore storage errors.
  }

  return "ru";
}

function saveLanguage(language: Language) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore storage errors.
  }
}

function t(key: string, params: Record<string, string | number> = {}): string {
  const current = TRANSLATIONS[state.language] ?? TRANSLATIONS.ru;
  let template = current[key] ?? TRANSLATIONS.ru[key] ?? key;

  for (const [param, value] of Object.entries(params)) {
    template = template.replace(new RegExp(`\\{${param}\\}`, "g"), String(value));
  }

  return template;
}

class SearchTimeoutError extends Error {}

function setMetaContent(id: string, content: string) {
  const node = document.getElementById(id) as HTMLMetaElement | null;
  if (!node) {
    return;
  }
  node.content = content;
}

function updateSeoMetadata() {
  const title = t("appTitle");
  const description = t("seoDescription");
  const keywords = t("seoKeywords");
  const currentUrl = window.location.href.split("#")[0];

  document.title = title;
  setMetaContent("metaDescription", description);
  setMetaContent("metaKeywords", keywords);
  setMetaContent("metaOgTitle", title);
  setMetaContent("metaOgDescription", description);
  setMetaContent("metaOgUrl", currentUrl);
  setMetaContent("metaTwitterTitle", title);
  setMetaContent("metaTwitterDescription", description);

  const canonical = document.getElementById("canonicalLink") as HTMLLinkElement | null;
  if (canonical) {
    canonical.href = currentUrl;
  }

  const jsonLdNode = document.getElementById("ldJsonApp") as HTMLScriptElement | null;
  if (jsonLdNode) {
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: title,
      applicationCategory: "GameApplication",
      operatingSystem: "Any",
      inLanguage: state.language,
      url: currentUrl,
      description,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        t("seoFeatureEditor"),
        t("seoFeatureSimulation"),
        t("seoFeatureLeaderboard"),
        t("seoFeatureHints"),
      ],
    };
    jsonLdNode.textContent = JSON.stringify(jsonLd);
  }
}

function getRequiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Element with id "${id}" not found`);
  }
  return element as T;
}

const elements: Elements = {
  layout: getRequiredElement<HTMLElement>("layout"),
  editorPanel: getRequiredElement<HTMLElement>("editorPanel"),
  settingsPanel: getRequiredElement<HTMLElement>("settingsPanel"),
  board: getRequiredElement<HTMLDivElement>("board"),
  status: getRequiredElement<HTMLDivElement>("status"),
  hintText: getRequiredElement<HTMLDivElement>("hintText"),
  modeGroup: getRequiredElement<HTMLDivElement>("modeGroup"),
  variantGroup: getRequiredElement<HTMLDivElement>("variantGroup"),
  colorGroup: getRequiredElement<HTMLDivElement>("colorGroup"),
  langGroup: getRequiredElement<HTMLDivElement>("langGroup"),
  settingsToggleBtn: getRequiredElement<HTMLButtonElement>("settingsToggleBtn"),
  leaderboardPanel: getRequiredElement<HTMLElement>("leaderboardPanel"),
  leaderboardBody: getRequiredElement<HTMLTableSectionElement>("leaderboardBody"),
  leaderboardEmpty: getRequiredElement<HTMLElement>("leaderboardEmpty"),
  langRuBtn: getRequiredElement<HTMLButtonElement>("langRuBtn"),
  langEnBtn: getRequiredElement<HTMLButtonElement>("langEnBtn"),
  modeAiBtn: getRequiredElement<HTMLButtonElement>("modeAiBtn"),
  modePvpBtn: getRequiredElement<HTMLButtonElement>("modePvpBtn"),
  variantClassicBtn: getRequiredElement<HTMLButtonElement>("variantClassicBtn"),
  variantGiveawayBtn: getRequiredElement<HTMLButtonElement>("variantGiveawayBtn"),
  colorWhiteBtn: getRequiredElement<HTMLButtonElement>("colorWhiteBtn"),
  colorBlackBtn: getRequiredElement<HTMLButtonElement>("colorBlackBtn"),
  whiteTimer: getRequiredElement<HTMLDivElement>("whiteTimer"),
  blackTimer: getRequiredElement<HTMLDivElement>("blackTimer"),
  timeControl: getRequiredElement<HTMLSelectElement>("timeControl"),
  difficulty: getRequiredElement<HTMLSelectElement>("difficulty"),
  newGameBtn: getRequiredElement<HTMLButtonElement>("newGameBtn"),
  undoBtn: getRequiredElement<HTMLButtonElement>("undoBtn"),
  hintOnceBtn: getRequiredElement<HTMLButtonElement>("hintOnceBtn"),
  hintBtn: getRequiredElement<HTMLButtonElement>("hintBtn"),
  enterSetupBtn: getRequiredElement<HTMLButtonElement>("enterSetupBtn"),
  setupPanel: getRequiredElement<HTMLDivElement>("setupPanel"),
  setupPiece: getRequiredElement<HTMLSelectElement>("setupPiece"),
  setupTurn: getRequiredElement<HTMLSelectElement>("setupTurn"),
  setupHumanColor: getRequiredElement<HTMLSelectElement>("setupHumanColor"),
  clearBoardBtn: getRequiredElement<HTMLButtonElement>("clearBoardBtn"),
  fillStandardBtn: getRequiredElement<HTMLButtonElement>("fillStandardBtn"),
  applySetupBtn: getRequiredElement<HTMLButtonElement>("applySetupBtn"),
  cancelSetupBtn: getRequiredElement<HTMLButtonElement>("cancelSetupBtn"),
  nameModal: getRequiredElement<HTMLDivElement>("nameModal"),
  nameModalText: getRequiredElement<HTMLParagraphElement>("nameModalText"),
  nameModalInput: getRequiredElement<HTMLInputElement>("nameModalInput"),
  nameModalSubmit: getRequiredElement<HTMLButtonElement>("nameModalSubmit"),
  nameModalCancel: getRequiredElement<HTMLButtonElement>("nameModalCancel"),
  topControls: getRequiredElement<HTMLDivElement>("topControls"),
  mobileControlsToggle: getRequiredElement<HTMLButtonElement>("mobileControlsToggle"),
  mobileToggleText: getRequiredElement<HTMLSpanElement>("mobileToggleText"),
};

const state: GameState = {
  board: createInitialBoard(),
  turn: "w",
  variant: "classic",
  language: "ru",
  gameMode: "ai",
  humanColor: "w",
  aiColor: "b",
  difficulty: "medium",
  selected: null,
  legalMovesForSelected: [],
  pendingCapture: null,
  gameOver: false,
  winner: null,
  gameStarted: false,
  setupMode: false,
  settingsOpen: false,
  setupBackup: null,
  aiThinking: false,
  aiGeneration: 0,
  hintMove: null,
  hintText: null,
  hintThinking: false,
  hintGeneration: 0,
  hintMode: false,
  initialTimeMs: 10 * 60 * 1000,
  whiteTimeMs: 10 * 60 * 1000,
  blackTimeMs: 10 * 60 * 1000,
  lastClockTs: null,
};

let clockIntervalId: number | null = null;
const undoStack: UndoSnapshot[] = [];
let leaderboardEntries: LeaderboardEntry[] = [];
let gameSessionId = 0;
let finalizedSessionId = -1;
let sessionStartedAt: number | null = null;
let sessionHintsUsed = 0;
let sessionMoveCount = 0;
let sessionUsedSetupMode = false;
let rankedSessionToken: RankedSessionToken | null = null;

function isAiMode(): boolean {
  return state.gameMode === "ai";
}

function isGiveawayVariant(): boolean {
  return state.variant === "giveaway";
}

function winnerWhenNoLegalMoves(turn: Color): Color {
  return isGiveawayVariant() ? turn : opposite(turn);
}

function isHumanTurnNow(): boolean {
  if (!isAiMode()) {
    return true;
  }

  return state.turn === state.humanColor;
}

function hintSide(): Color {
  return isAiMode() ? state.humanColor : state.turn;
}

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatElapsedClock(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function difficultyLabel(difficulty: Difficulty): string {
  if (difficulty === "easy") {
    return t("difficultyEasy");
  }
  if (difficulty === "medium") {
    return t("difficultyMedium");
  }
  return t("difficultyHard");
}

function resultLabel(result: GameOutcome): string {
  return result === "win" ? t("leaderboardResultWin") : t("leaderboardResultLoss");
}

function normalizePlayerName(input: string): string | null {
  const normalized = input
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} _.-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length < 2) {
    return null;
  }
  return normalized.slice(0, 16).trim();
}

function isLeaderboardEntry(value: unknown): value is LeaderboardEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Partial<LeaderboardEntry>;
  return typeof entry.id === "string"
    && typeof entry.name === "string"
    && typeof entry.score === "number"
    && (entry.result === "win" || entry.result === "loss")
    && (entry.difficulty === "easy" || entry.difficulty === "medium" || entry.difficulty === "hard")
    && (entry.variant === "classic" || entry.variant === "giveaway")
    && typeof entry.elapsedMs === "number"
    && typeof entry.hintsUsed === "number"
    && typeof entry.playedAt === "number";
}

function sortLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    if (left.elapsedMs !== right.elapsedMs) {
      return left.elapsedMs - right.elapsedMs;
    }
    return right.playedAt - left.playedAt;
  });
}

async function apiFetchJson<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  try {
    const response = await fetch(`${API_PREFIX}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function refreshLeaderboardFromServer() {
  const data = await apiFetchJson<{ entries: LeaderboardEntry[] }>(`/leaderboard?limit=${LEADERBOARD_LIMIT}`);
  if (!data || !Array.isArray(data.entries)) {
    return;
  }
  leaderboardEntries = sortLeaderboard(data.entries.filter(isLeaderboardEntry)).slice(0, LEADERBOARD_LIMIT);
  render();
}

function sendTelemetryEvent(event: TelemetryEventName, payload: Record<string, unknown> = {}) {
  const body = JSON.stringify({
    event,
    ts: Date.now(),
    sessionId: rankedSessionToken?.sessionId ?? null,
    payload,
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(`${API_PREFIX}/telemetry/event`, blob);
      return;
    }
  } catch {
    // Ignore and fallback to fetch.
  }

  void fetch(`${API_PREFIX}/telemetry/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

function renderLeaderboard() {
  elements.leaderboardBody.innerHTML = "";

  for (let i = 0; i < leaderboardEntries.length; i += 1) {
    const entry = leaderboardEntries[i];
    const row = document.createElement("tr");

    const rankCell = document.createElement("td");
    rankCell.textContent = String(i + 1);
    row.appendChild(rankCell);

    const nameCell = document.createElement("td");
    nameCell.textContent = entry.name;
    row.appendChild(nameCell);

    const scoreCell = document.createElement("td");
    scoreCell.textContent = String(entry.score);
    row.appendChild(scoreCell);

    const resultCell = document.createElement("td");
    resultCell.textContent = resultLabel(entry.result);
    row.appendChild(resultCell);

    const timeCell = document.createElement("td");
    timeCell.textContent = formatElapsedClock(entry.elapsedMs);
    row.appendChild(timeCell);

    const diffCell = document.createElement("td");
    const variantLabel = entry.variant === "classic" ? t("variantClassic") : t("variantGiveaway");
    diffCell.textContent = `${difficultyLabel(entry.difficulty)} · ${variantLabel}`;
    row.appendChild(diffCell);

    elements.leaderboardBody.appendChild(row);
  }

  elements.leaderboardEmpty.hidden = leaderboardEntries.length > 0;
}

function isLeaderboardQualifyingScore(score: number): boolean {
  if (leaderboardEntries.length < LEADERBOARD_LIMIT) {
    return true;
  }
  const last = leaderboardEntries[leaderboardEntries.length - 1];
  if (!last) {
    return true;
  }
  return score > last.score;
}

function clampScore(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function computeLeaderboardScore(
  result: GameOutcome,
  difficulty: Difficulty,
  elapsedMs: number,
  hintsUsed: number,
  wonOnTime: boolean,
): number {
  const speedRatio = elapsedMs / SCORE_PAR_TIME_MS[difficulty];
  let base = 0;

  if (result === "win") {
    if (speedRatio <= 0.5) {
      base = 200;
    } else if (speedRatio <= 1.0) {
      base = 150;
    } else {
      base = 110;
    }
  } else if (speedRatio <= 0.5) {
    base = -130;
  } else if (speedRatio <= 1.0) {
    base = -90;
  } else {
    base = -60;
  }

  let score = Math.round(base * SCORE_DIFFICULTY_MULT[difficulty]);
  if (hintsUsed === 0) {
    score += 20;
  } else {
    score -= Math.min(8, hintsUsed) * 10;
  }
  if (wonOnTime && result === "win") {
    score += 10;
  }

  return clampScore(score, -300, 500);
}

function beginGameSession(startedFromSetup = false) {
  gameSessionId += 1;
  finalizedSessionId = -1;
  sessionStartedAt = Date.now();
  sessionHintsUsed = 0;
  sessionMoveCount = 0;
  sessionUsedSetupMode = startedFromSetup;
  rankedSessionToken = null;
  sendTelemetryEvent("game_start", {
    mode: state.gameMode,
    difficulty: state.difficulty,
    variant: state.variant,
    startedFromSetup,
  });

  const sessionIdAtStart = gameSessionId;
  void apiFetchJson<RankedSessionToken>("/session/start", {
    method: "POST",
    body: JSON.stringify({
      mode: state.gameMode,
      difficulty: state.difficulty,
      variant: state.variant,
      startedFromSetup,
    }),
  }).then((token) => {
    if (!token || sessionIdAtStart !== gameSessionId) {
      return;
    }
    rankedSessionToken = token;
  });
}

function showNameModal(promptText: string): Promise<string | null> {
  return new Promise((resolve) => {
    elements.nameModalText.textContent = promptText;
    elements.nameModalInput.value = "";
    elements.nameModal.hidden = false;
    elements.nameModalInput.focus();

    const handleSubmit = () => {
      const value = elements.nameModalInput.value.trim();
      cleanup();
      resolve(value || null);
    };

    const handleCancel = () => {
      cleanup();
      resolve(null);
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    };

    const cleanup = () => {
      elements.nameModal.hidden = true;
      elements.nameModalSubmit.removeEventListener("click", handleSubmit);
      elements.nameModalCancel.removeEventListener("click", handleCancel);
      elements.nameModalInput.removeEventListener("keydown", handleKeydown);
    };

    elements.nameModalSubmit.addEventListener("click", handleSubmit);
    elements.nameModalCancel.addEventListener("click", handleCancel);
    elements.nameModalInput.addEventListener("keydown", handleKeydown);
  });
}

function maybeFinalizeLeaderboardForAi(reason: "normal" | "timeout") {
  if (!state.gameStarted || !state.gameOver) {
    return;
  }
  if (finalizedSessionId === gameSessionId) {
    return;
  }
  finalizedSessionId = gameSessionId;

  if (!isAiMode() || sessionStartedAt === null || sessionMoveCount <= 0 || !rankedSessionToken) {
    return;
  }

  const result: GameOutcome = state.winner === state.humanColor ? "win" : "loss";
  const elapsedMs = Math.max(0, Date.now() - sessionStartedAt);
  const wonOnTime = reason === "timeout" && result === "win";
  const score = computeLeaderboardScore(result, state.difficulty, elapsedMs, sessionHintsUsed, wonOnTime);
  if (sessionUsedSetupMode) {
    sendTelemetryEvent("game_finish", {
      result,
      elapsedMs,
      moveCount: sessionMoveCount,
      hintsUsed: sessionHintsUsed,
      accepted: false,
      reason: "setup_used",
    });
    state.hintText = t("leaderboardRejectedSetup");
    render();
    return;
  }
  if (!isLeaderboardQualifyingScore(score)) {
    sendTelemetryEvent("game_finish", {
      result,
      elapsedMs,
      moveCount: sessionMoveCount,
      hintsUsed: sessionHintsUsed,
      accepted: false,
      reason: "not_qualified",
      score,
    });
    return;
  }

  const promptText = t("leaderboardNamePrompt", { score });

  void showNameModal(promptText).then((rawName) => {
    if (rawName === null) {
      return;
    }
    const name = normalizePlayerName(rawName);
    if (!name) {
      return;
    }

    void apiFetchJson<{ accepted: boolean; reason?: string; entry?: LeaderboardEntry; leaderboard?: LeaderboardEntry[] }>(
      "/leaderboard/submit",
      {
        method: "POST",
        body: JSON.stringify({
          sessionId: rankedSessionToken.sessionId,
          issuedAt: rankedSessionToken.issuedAt,
          signature: rankedSessionToken.signature,
          name,
          result,
          difficulty: state.difficulty,
          variant: state.variant,
          elapsedMs,
          hintsUsed: sessionHintsUsed,
          moveCount: sessionMoveCount,
          setupUsed: sessionUsedSetupMode,
          timedOut: wonOnTime,
        }),
      },
    ).then((response) => {
    if (!response) {
      state.hintText = t("leaderboardSyncError");
      render();
      return;
    }

    if (!response.accepted) {
      sendTelemetryEvent("game_finish", {
        result,
        elapsedMs,
        moveCount: sessionMoveCount,
        hintsUsed: sessionHintsUsed,
        accepted: false,
        reason: response.reason ?? "rejected",
      });
      if (response.reason === "rejected_setup") {
        state.hintText = t("leaderboardRejectedSetup");
      } else if (response.reason && response.reason.startsWith("guard_")) {
        state.hintText = t("leaderboardRejectedGuard");
      }
      if (Array.isArray(response.leaderboard)) {
        leaderboardEntries = sortLeaderboard(response.leaderboard.filter(isLeaderboardEntry)).slice(0, LEADERBOARD_LIMIT);
      }
      render();
      return;
    }

    if (Array.isArray(response.leaderboard)) {
      leaderboardEntries = sortLeaderboard(response.leaderboard.filter(isLeaderboardEntry)).slice(0, LEADERBOARD_LIMIT);
    } else if (response.entry && isLeaderboardEntry(response.entry)) {
      leaderboardEntries = sortLeaderboard([...leaderboardEntries, response.entry]).slice(0, LEADERBOARD_LIMIT);
    }
    sendTelemetryEvent("game_finish", {
      result,
      elapsedMs,
      moveCount: sessionMoveCount,
      hintsUsed: sessionHintsUsed,
      accepted: true,
      score: response.entry?.score ?? score,
    });
      state.hintText = t("leaderboardSubmitted");
      render();
    });
  });
}

function resetClocks() {
  state.whiteTimeMs = state.initialTimeMs;
  state.blackTimeMs = state.initialTimeMs;
  state.lastClockTs = Date.now();
}

function clearUndoStack() {
  undoStack.length = 0;
}

function createUndoSnapshot(): UndoSnapshot {
  return {
    board: cloneBoard(state.board),
    turn: state.turn,
    pendingCapture: state.pendingCapture ? { ...state.pendingCapture } : null,
    gameOver: state.gameOver,
    winner: state.winner,
    gameStarted: state.gameStarted,
    whiteTimeMs: state.whiteTimeMs,
    blackTimeMs: state.blackTimeMs,
    humanColor: state.humanColor,
    aiColor: state.aiColor,
  };
}

function pushUndoSnapshot() {
  undoStack.push(createUndoSnapshot());
  if (undoStack.length > 300) {
    undoStack.shift();
  }
}

function hasUndoMove(): boolean {
  return undoStack.length > 0;
}

function restoreUndoSnapshot(snapshot: UndoSnapshot) {
  state.board = cloneBoard(snapshot.board);
  state.turn = snapshot.turn;
  state.pendingCapture = snapshot.pendingCapture ? { ...snapshot.pendingCapture } : null;
  state.gameOver = snapshot.gameOver;
  state.winner = snapshot.winner;
  state.gameStarted = snapshot.gameStarted;
  state.whiteTimeMs = snapshot.whiteTimeMs;
  state.blackTimeMs = snapshot.blackTimeMs;
  state.humanColor = snapshot.humanColor;
  state.aiColor = snapshot.aiColor;
  state.selected = null;
  state.legalMovesForSelected = [];
  state.lastClockTs = Date.now();
}

function hasActiveGameInProgress(): boolean {
  return state.gameStarted && !state.gameOver && !state.setupMode;
}

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

function createInitialBoard() {
  const board = createEmptyBoard();

  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (isPlayableSquare(r, c)) {
        board[r][c] = { color: "b", king: false };
      }
    }
  }

  for (let r = 5; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (isPlayableSquare(r, c)) {
        board[r][c] = { color: "w", king: false };
      }
    }
  }

  return board;
}

function cloneBoard(board) {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

function opposite(color) {
  return color === "w" ? "b" : "w";
}

function isInside(r, c) {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

function isPlayableSquare(r, c) {
  return (r + c) % 2 === 1;
}

function createXorShift32(seed: number): () => number {
  let value = seed >>> 0 || 1;
  return () => {
    value ^= value << 13;
    value >>>= 0;
    value ^= value >>> 17;
    value >>>= 0;
    value ^= value << 5;
    value >>>= 0;
    return value;
  };
}

function random64(next: () => number): bigint {
  return (BigInt(next()) << 32n) ^ BigInt(next());
}

function boardIndex(r: number, c: number): number {
  return r * BOARD_SIZE + c;
}

function pieceHashIndex(piece: Piece): number {
  if (piece.color === "w") {
    return piece.king ? 1 : 0;
  }
  return piece.king ? 3 : 2;
}

function computeBoardHash(board: Board): bigint {
  let hash = 0n;
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const piece = board[r][c];
      if (!piece) {
        continue;
      }
      hash ^= ZOBRIST_PIECES[boardIndex(r, c)][pieceHashIndex(piece)];
    }
  }
  return hash;
}

function pendingCaptureHash(pendingCapture: Coords | null): bigint {
  if (!pendingCapture) {
    return ZOBRIST_NO_PENDING;
  }
  return ZOBRIST_PENDING[boardIndex(pendingCapture.r, pendingCapture.c)];
}

function variantHash(variant: Variant): bigint {
  return variant === "classic" ? ZOBRIST_VARIANT_CLASSIC : ZOBRIST_VARIANT_GIVEAWAY;
}

function colorName(color: Color | null) {
  if (color === "w") {
    return t("colorWhiteLower");
  }
  if (color === "b") {
    return t("colorBlackLower");
  }
  return t("colorUnknown");
}

function pieceName(piece: Piece | null) {
  if (!piece) {
    return t("pieceEmptyLower");
  }

  if (piece.color === "w") {
    return piece.king ? t("pieceWhiteKingLower") : t("pieceWhiteManLower");
  }

  return piece.king ? t("pieceBlackKingLower") : t("pieceBlackManLower");
}

function squareLabel(r: number, c: number, piece: Piece | null) {
  const file = String.fromCharCode(97 + c);
  const rank = BOARD_SIZE - r;
  return t("squareLabel", { square: `${file}${rank}`, piece: pieceName(piece) });
}

function getDisplayToBoardCoords(displayR, displayC) {
  if (state.humanColor === "w") {
    return { r: displayR, c: displayC };
  }

  return { r: BOARD_SIZE - 1 - displayR, c: BOARD_SIZE - 1 - displayC };
}

function getBoardToDisplayCoords(r: number, c: number): Coords {
  if (state.humanColor === "w") {
    return { r, c };
  }

  return { r: BOARD_SIZE - 1 - r, c: BOARD_SIZE - 1 - c };
}

function getSimpleMovesForPiece(board, r, c, piece) {
  const moves = [];

  if (piece.king) {
    for (const [dr, dc] of DIRECTIONS) {
      let nr = r + dr;
      let nc = c + dc;

      while (isInside(nr, nc) && !board[nr][nc]) {
        moves.push({
          from: { r, c },
          to: { r: nr, c: nc },
          captures: [],
        });
        nr += dr;
        nc += dc;
      }
    }

    return moves;
  }

  const forward = piece.color === "w" ? -1 : 1;
  for (const dc of [-1, 1]) {
    const nr = r + forward;
    const nc = c + dc;
    if (isInside(nr, nc) && !board[nr][nc]) {
      moves.push({
        from: { r, c },
        to: { r: nr, c: nc },
        captures: [],
      });
    }
  }

  return moves;
}

function getCaptureMovesForPiece(board, r, c, piece) {
  if (piece.king) {
    return getKingCaptures(board, r, c, piece);
  }

  return getManCaptures(board, r, c, piece);
}

function getManCaptures(board, r, c, piece) {
  const moves = [];

  for (const [dr, dc] of DIRECTIONS) {
    const mr = r + dr;
    const mc = c + dc;
    const tr = r + dr * 2;
    const tc = c + dc * 2;

    if (!isInside(mr, mc) || !isInside(tr, tc)) {
      continue;
    }

    const middle = board[mr][mc];
    if (middle && middle.color !== piece.color && !board[tr][tc]) {
      moves.push({
        from: { r, c },
        to: { r: tr, c: tc },
        captures: [{ r: mr, c: mc }],
      });
    }
  }

  return moves;
}

function getKingCaptures(board, r, c, piece) {
  const moves = [];

  for (const [dr, dc] of DIRECTIONS) {
    let nr = r + dr;
    let nc = c + dc;
    let enemySquare = null;

    while (isInside(nr, nc)) {
      const current = board[nr][nc];

      if (!enemySquare) {
        if (!current) {
          nr += dr;
          nc += dc;
          continue;
        }

        if (current.color === piece.color) {
          break;
        }

        enemySquare = { r: nr, c: nc };
        nr += dr;
        nc += dc;
        continue;
      }

      if (current) {
        break;
      }

      moves.push({
        from: { r, c },
        to: { r: nr, c: nc },
        captures: [enemySquare],
      });
      nr += dr;
      nc += dc;
    }
  }

  return moves;
}

function appendMoves(target: Move[], source: Move[]) {
  for (let i = 0; i < source.length; i += 1) {
    target.push(source[i]);
  }
}

function getLegalMoves(board, color, pendingCapture = null) {
  if (pendingCapture) {
    const piece = board[pendingCapture.r][pendingCapture.c];
    if (!piece || piece.color !== color) {
      return [];
    }
    return getCaptureMovesForPiece(board, pendingCapture.r, pendingCapture.c, piece);
  }

  const captureMoves = [];
  const quietMoves = [];
  let hasCaptures = false;

  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const piece = board[r][c];
      if (!piece || piece.color !== color) {
        continue;
      }

      const captures = getCaptureMovesForPiece(board, r, c, piece);
      if (captures.length > 0) {
        hasCaptures = true;
        appendMoves(captureMoves, captures);
        continue;
      }

      if (!hasCaptures) {
        appendMoves(quietMoves, getSimpleMovesForPiece(board, r, c, piece));
      }
    }
  }

  return hasCaptures ? captureMoves : quietMoves;
}

function executeMove(board, move) {
  const piece = board[move.from.r][move.from.c];
  board[move.from.r][move.from.c] = null;

  for (const captured of move.captures) {
    board[captured.r][captured.c] = null;
  }

  board[move.to.r][move.to.c] = piece;
  if (!piece.king) {
    if ((piece.color === "w" && move.to.r === 0) || (piece.color === "b" && move.to.r === BOARD_SIZE - 1)) {
      piece.king = true;
    }
  }
}

function nextTurnState(board, turn, move) {
  if (move.captures.length > 0) {
    const movedPiece = board[move.to.r][move.to.c];
    const followUps = getCaptureMovesForPiece(board, move.to.r, move.to.c, movedPiece);
    if (followUps.length > 0) {
      return {
        turn,
        pendingCapture: { r: move.to.r, c: move.to.c },
      };
    }
  }

  return {
    turn: opposite(turn),
    pendingCapture: null,
  };
}

function applyMoveMutable(node: GameNode, move: Move): AppliedMoveUndo {
  const board = node.board;
  const movedPiece = board[move.from.r][move.from.c];
  if (!movedPiece) {
    throw new Error("Invalid move: source square is empty");
  }

  let nextHash = node.hash;
  nextHash ^= ZOBRIST_PIECES[boardIndex(move.from.r, move.from.c)][pieceHashIndex(movedPiece)];

  const undo: AppliedMoveUndo = {
    move,
    movedPiece,
    wasKing: movedPiece.king,
    captured: [],
    prevHash: node.hash,
    prevTurn: node.turn,
    prevPendingCapture: node.pendingCapture,
  };

  board[move.from.r][move.from.c] = null;
  for (let i = 0; i < move.captures.length; i += 1) {
    const capturedSquare = move.captures[i];
    const capturedPiece = board[capturedSquare.r][capturedSquare.c];
    if (!capturedPiece) {
      continue;
    }
    undo.captured.push({ r: capturedSquare.r, c: capturedSquare.c, piece: capturedPiece });
    nextHash ^= ZOBRIST_PIECES[boardIndex(capturedSquare.r, capturedSquare.c)][pieceHashIndex(capturedPiece)];
    board[capturedSquare.r][capturedSquare.c] = null;
  }

  board[move.to.r][move.to.c] = movedPiece;
  if (!movedPiece.king) {
    if ((movedPiece.color === "w" && move.to.r === 0) || (movedPiece.color === "b" && move.to.r === BOARD_SIZE - 1)) {
      movedPiece.king = true;
    }
  }
  nextHash ^= ZOBRIST_PIECES[boardIndex(move.to.r, move.to.c)][pieceHashIndex(movedPiece)];
  node.hash = nextHash;

  const turnState = nextTurnState(board, node.turn, move);
  node.turn = turnState.turn;
  node.pendingCapture = turnState.pendingCapture;
  return undo;
}

function undoMoveMutable(node: GameNode, undo: AppliedMoveUndo) {
  const board = node.board;
  const { move, movedPiece } = undo;

  board[move.to.r][move.to.c] = null;
  movedPiece.king = undo.wasKing;
  board[move.from.r][move.from.c] = movedPiece;

  for (let i = 0; i < undo.captured.length; i += 1) {
    const captured = undo.captured[i];
    board[captured.r][captured.c] = captured.piece;
  }

  node.hash = undo.prevHash;
  node.turn = undo.prevTurn;
  node.pendingCapture = undo.prevPendingCapture;
}

function sameMove(a: Move, b: Move): boolean {
  if (a.from.r !== b.from.r || a.from.c !== b.from.c || a.to.r !== b.to.r || a.to.c !== b.to.c) {
    return false;
  }

  if (a.captures.length !== b.captures.length) {
    return false;
  }

  for (let i = 0; i < a.captures.length; i += 1) {
    if (a.captures[i].r !== b.captures[i].r || a.captures[i].c !== b.captures[i].c) {
      return false;
    }
  }

  return true;
}

function squareName(coords: Coords): string {
  const file = String.fromCharCode(97 + coords.c);
  const rank = BOARD_SIZE - coords.r;
  return `${file}${rank}`;
}

function formatMove(move: Move): string {
  const separator = move.captures.length > 0 ? "x" : "-";
  return `${squareName(move.from)}${separator}${squareName(move.to)}`;
}

function nodeCacheKey(node: GameNode): bigint {
  let key = node.hash;
  key ^= node.turn === "w" ? ZOBRIST_TURN_WHITE : ZOBRIST_TURN_BLACK;
  key ^= pendingCaptureHash(node.pendingCapture);
  key ^= variantHash(state.variant);
  return key;
}

function moveOrderingScore(board: Board, move: Move): number {
  let score = move.captures.length * 1000;
  const piece = board[move.from.r][move.from.c];

  if (!piece) {
    return score;
  }

  if (!piece.king) {
    const promotionRow = piece.color === "w" ? 0 : BOARD_SIZE - 1;
    if (move.to.r === promotionRow) {
      score += 700;
    }
  } else {
    score += 70;
  }

  const centerDistance = Math.abs(3.5 - move.to.r) + Math.abs(3.5 - move.to.c);
  score += 40 - centerDistance * 5;
  return score;
}

function orderMoves(board: Board, moves: Move[], preferredMove: Move | null): Move[] {
  const scored = moves.map((move) => {
    let score = moveOrderingScore(board, move);
    if (preferredMove && sameMove(move, preferredMove)) {
      score += 10_000;
    }
    return { move, score };
  });

  scored.sort((left, right) => right.score - left.score);
  return scored.map((entry) => entry.move);
}

function terminalScore(sideToMove: Color, perspectiveColor: Color, depth: number): number {
  const perspectiveWins = isGiveawayVariant() ? sideToMove === perspectiveColor : sideToMove !== perspectiveColor;
  if (perspectiveWins) {
    return WIN_SCORE - depth;
  }
  return -WIN_SCORE + depth;
}

function isPotentialVictim(board: Board, r: number, c: number, victimColor: Color): boolean {
  const attackerColor = opposite(victimColor);
  for (const [dr, dc] of DIRECTIONS) {
    const attackerR = r - dr;
    const attackerC = c - dc;
    const landingR = r + dr;
    const landingC = c + dc;
    if (!isInside(attackerR, attackerC) || !isInside(landingR, landingC)) {
      continue;
    }

    const attacker = board[attackerR][attackerC];
    if (!attacker || attacker.color !== attackerColor) {
      continue;
    }
    if (board[landingR][landingC]) {
      continue;
    }
    return true;
  }
  return false;
}

function evaluateGiveawayPosition(node: GameNode, perspectiveColor: Color, legalMoves: Move[]): number {
  let myMen = 0;
  let myKings = 0;
  let oppMen = 0;
  let oppKings = 0;
  let myProgress = 0;
  let oppProgress = 0;
  let myVictims = 0;
  let oppVictims = 0;

  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const piece = node.board[r][c];
      if (!piece) {
        continue;
      }

      const isMine = piece.color === perspectiveColor;
      if (piece.king) {
        if (isMine) {
          myKings += 1;
        } else {
          oppKings += 1;
        }
      } else {
        const progress = piece.color === "w" ? (BOARD_SIZE - 1 - r) : r;
        if (isMine) {
          myMen += 1;
          myProgress += progress;
        } else {
          oppMen += 1;
          oppProgress += progress;
        }
      }

      if (isPotentialVictim(node.board, r, c, piece.color)) {
        if (isMine) {
          myVictims += 1;
        } else {
          oppVictims += 1;
        }
      }
    }
  }

  const myPieces = myMen + myKings;
  const oppPieces = oppMen + oppKings;
  if (myPieces === 0) {
    return WIN_SCORE;
  }
  if (oppPieces === 0) {
    return -WIN_SCORE;
  }

  let score = 0;
  score += (oppMen - myMen) * 170;
  score += (oppKings - myKings) * 300;
  score += (oppProgress - myProgress) * 8;
  score += (myVictims - oppVictims) * 52;

  if (myMen === 0 && myKings > 0) {
    score -= myKings * 34;
  }
  if (oppMen === 0 && oppKings > 0) {
    score += oppKings * 34;
  }

  const mobility = legalMoves.length * 4;
  score += node.turn === perspectiveColor ? -mobility : mobility;
  return score;
}

function evaluatePosition(node: GameNode, perspectiveColor: Color, legalMoves: Move[] | null = null): number {
  const availableMoves = legalMoves ?? getLegalMoves(node.board, node.turn, node.pendingCapture);
  if (availableMoves.length === 0) {
    return terminalScore(node.turn, perspectiveColor, 0);
  }

  if (isGiveawayVariant()) {
    return evaluateGiveawayPosition(node, perspectiveColor, availableMoves);
  }

  let score = 0;
  let myCount = 0;
  let oppCount = 0;

  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const piece = node.board[r][c];
      if (!piece) {
        continue;
      }

      let value = piece.king ? 320 : 120;
      if (!piece.king) {
        const progress = piece.color === "w" ? (BOARD_SIZE - 1 - r) : r;
        value += progress * 9;
        const homeRow = piece.color === "w" ? BOARD_SIZE - 1 : 0;
        if (r === homeRow) {
          value += 10;
        }
      } else if (r === 0 || r === BOARD_SIZE - 1 || c === 0 || c === BOARD_SIZE - 1) {
        value -= 8;
      }

      if (r >= 2 && r <= 5 && c >= 2 && c <= 5) {
        value += 10;
      }

      const supportRow = piece.color === "w" ? r + 1 : r - 1;
      if (
        (isInside(supportRow, c - 1) && node.board[supportRow][c - 1]?.color === piece.color)
        || (isInside(supportRow, c + 1) && node.board[supportRow][c + 1]?.color === piece.color)
      ) {
        value += 7;
      }

      if (piece.color === perspectiveColor) {
        score += value;
        myCount += 1;
      } else {
        score -= value;
        oppCount += 1;
      }
    }
  }

  if (myCount === 0) {
    return isGiveawayVariant() ? WIN_SCORE : -WIN_SCORE;
  }
  if (oppCount === 0) {
    return isGiveawayVariant() ? -WIN_SCORE : WIN_SCORE;
  }

  const mobility = availableMoves.length * 3;
  score += node.turn === perspectiveColor ? mobility : -mobility;
  return isGiveawayVariant() ? -score : score;
}

function checkSearchDeadline(deadline: number, clock: SearchClock) {
  clock.nodes += 1;
  if ((clock.nodes & 63) !== 0) {
    return;
  }
  if (Date.now() >= deadline) {
    throw new SearchTimeoutError();
  }
}

function minimax(
  node: GameNode,
  depth: number,
  alpha: number,
  beta: number,
  rootColor: Color,
  deadline: number,
  table: Map<bigint, TTEntry>,
  clock: SearchClock,
): number {
  checkSearchDeadline(deadline, clock);

  const legalMoves = getLegalMoves(node.board, node.turn, node.pendingCapture);
  if (legalMoves.length === 0) {
    return terminalScore(node.turn, rootColor, depth);
  }

  if (depth === 0) {
    return evaluatePosition(node, rootColor, legalMoves);
  }

  const alphaOriginal = alpha;
  const betaOriginal = beta;

  const cacheKey = nodeCacheKey(node);
  const cached = table.get(cacheKey);
  let preferredMove: Move | null = null;
  if (cached && cached.depth >= depth) {
    preferredMove = cached.bestMove;
    if (cached.flag === "exact") {
      return cached.score;
    }
    if (cached.flag === "lower") {
      alpha = Math.max(alpha, cached.score);
    } else if (cached.flag === "upper") {
      beta = Math.min(beta, cached.score);
    }
    if (beta <= alpha) {
      return cached.score;
    }
  } else if (cached) {
    preferredMove = cached.bestMove;
  }

  const maximizing = node.turn === rootColor;
  const ordered = orderMoves(node.board, legalMoves, preferredMove);
  let bestMove: Move | null = ordered[0] ?? null;
  let bestScore = maximizing ? -Infinity : Infinity;

  for (const move of ordered) {
    const undo = applyMoveMutable(node, move);
    let childScore = 0;
    try {
      childScore = minimax(node, depth - 1, alpha, beta, rootColor, deadline, table, clock);
    } finally {
      undoMoveMutable(node, undo);
    }

    if (maximizing) {
      if (childScore > bestScore) {
        bestScore = childScore;
        bestMove = move;
      }
      alpha = Math.max(alpha, bestScore);
    } else {
      if (childScore < bestScore) {
        bestScore = childScore;
        bestMove = move;
      }
      beta = Math.min(beta, bestScore);
    }

    if (beta <= alpha) {
      break;
    }
  }

  let flag: TTEntry["flag"] = "exact";
  if (bestScore <= alphaOriginal) {
    flag = "upper";
  } else if (bestScore >= betaOriginal) {
    flag = "lower";
  }

  table.set(cacheKey, {
    depth,
    score: bestScore,
    bestMove,
    flag,
  });

  return bestScore;
}

function chooseBestMove(side: Color, mode: "ai" | "hint"): SearchResult {
  const board = cloneBoard(state.board);
  const root: GameNode = {
    board,
    hash: computeBoardHash(board),
    turn: state.turn,
    pendingCapture: state.pendingCapture ? { ...state.pendingCapture } : null,
  };

  const legalMoves = getLegalMoves(root.board, root.turn, root.pendingCapture);
  if (legalMoves.length === 0) {
    return { move: null, score: terminalScore(root.turn, side, 0), depthReached: 0 };
  }
  if (root.turn !== side) {
    return { move: null, score: -WIN_SCORE, depthReached: 0 };
  }

  const config = mode === "hint" ? DIFFICULTIES.hard : DIFFICULTIES[state.difficulty];
  if (mode === "ai" && config.randomChance > 0 && Math.random() < config.randomChance) {
    return {
      move: legalMoves[Math.floor(Math.random() * legalMoves.length)],
      score: 0,
      depthReached: 0,
    };
  }

  const maxDepth = mode === "ai" ? config.maxDepth : config.hintDepth;
  const timeMs = mode === "ai" ? config.timeMs : config.hintTimeMs;
  const deadline = Date.now() + timeMs;
  const table = new Map<bigint, TTEntry>();
  const clock: SearchClock = { nodes: 0 };

  let bestMove: Move = legalMoves[0];
  let bestScore = -Infinity;
  let depthReached = 0;
  let scoredAtDepth: Array<{ move: Move; score: number }> = [{ move: bestMove, score: bestScore }];

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    if (Date.now() >= deadline) {
      break;
    }

    try {
      const orderedRootMoves = orderMoves(root.board, legalMoves, bestMove);
      let depthBestMove = orderedRootMoves[0];
      let depthBestScore = -Infinity;
      const depthScores: Array<{ move: Move; score: number }> = [];

      for (const move of orderedRootMoves) {
        if (Date.now() >= deadline) {
          throw new SearchTimeoutError();
        }

        const undo = applyMoveMutable(root, move);
        let score = 0;
        try {
          score = minimax(root, depth - 1, -Infinity, Infinity, side, deadline, table, clock);
        } finally {
          undoMoveMutable(root, undo);
        }
        depthScores.push({ move, score });

        if (score > depthBestScore) {
          depthBestScore = score;
          depthBestMove = move;
        }
      }

      bestMove = depthBestMove;
      bestScore = depthBestScore;
      depthReached = depth;
      scoredAtDepth = depthScores;
    } catch (error) {
      if (error instanceof SearchTimeoutError) {
        break;
      }
      throw error;
    }
  }

  if (mode === "ai" && scoredAtDepth.length > 1 && config.noise > 0) {
    const candidates = scoredAtDepth.filter((entry) => entry.score >= bestScore - config.noise);
    if (candidates.length > 0) {
      const picked = candidates[Math.floor(Math.random() * candidates.length)];
      bestMove = picked.move;
      bestScore = picked.score;
    }
  }

  return {
    move: bestMove,
    score: bestScore,
    depthReached,
  };
}

function chooseAIMove(): Move | null {
  return chooseBestMove(state.aiColor, "ai").move;
}

function resetHintState(incrementGeneration = true) {
  state.hintMove = null;
  state.hintText = null;
  state.hintThinking = false;
  if (incrementGeneration) {
    state.hintGeneration += 1;
  }
}

function requestHint() {
  if (!state.gameStarted || state.setupMode || state.gameOver || state.aiThinking || state.hintThinking) {
    return;
  }

  if (isAiMode() && state.turn !== state.humanColor) {
    return;
  }

  sessionHintsUsed += 1;
  sendTelemetryEvent("hint_request", {
    hintsUsed: sessionHintsUsed,
    gameMode: state.gameMode,
    variant: state.variant,
  });
  resetHintState(false);
  state.hintThinking = true;
  state.hintText = t("hintThinking");
  const generation = ++state.hintGeneration;
  render();

  setTimeout(() => {
    if (generation !== state.hintGeneration) {
      return;
    }

    const result = chooseBestMove(hintSide(), "hint");
    if (generation !== state.hintGeneration) {
      return;
    }

    state.hintThinking = false;
    if (!result.move) {
      state.hintText = t("hintUnavailable");
      state.hintMove = null;
      render();
      return;
    }

    state.hintMove = result.move;
    state.hintText = t("hintBestMove", { move: formatMove(result.move), depth: result.depthReached });
    render();
  }, 24);
}

function ensureHintIfNeeded() {
  if (!state.hintMode) {
    return;
  }

  if (!state.gameStarted || state.setupMode || state.gameOver || state.aiThinking || state.hintThinking) {
    return;
  }

  if (isAiMode() && state.turn !== state.humanColor) {
    return;
  }

  if (state.hintMove) {
    return;
  }

  requestHint();
}

function toggleHintMode() {
  state.hintMode = !state.hintMode;
  resetHintState();
  render();
}

function onHintOnceClick() {
  requestHint();
}

function toggleSettingsPanel() {
  state.settingsOpen = !state.settingsOpen;
  render();
}

function setGameMode(mode: GameMode) {
  if (state.gameMode === mode) {
    return;
  }

  state.gameMode = mode;
  invalidateAI();
  render();

  if (isAiMode() && state.gameStarted && !state.setupMode && !state.gameOver && state.turn === state.aiColor) {
    scheduleAI();
  }
}

function setVariant(variant: Variant) {
  if (state.variant === variant) {
    return;
  }

  state.variant = variant;
  invalidateAI();
  render();

  if (isAiMode() && state.gameStarted && !state.setupMode && !state.gameOver && state.turn === state.aiColor) {
    scheduleAI();
  }
}

function applyBottomColor(color: Color) {
  state.humanColor = color;
  state.aiColor = opposite(color);
  state.selected = null;
  state.legalMovesForSelected = [];

  invalidateAI();
  render();

  if (isAiMode() && state.gameStarted && !state.setupMode && !state.gameOver && state.turn === state.aiColor) {
    scheduleAI();
  }
}

function onTimeOut(loser: Color) {
  if (!state.gameStarted || state.gameOver) {
    return;
  }

  if (loser === "w") {
    state.whiteTimeMs = 0;
  } else {
    state.blackTimeMs = 0;
  }

  state.gameOver = true;
  state.winner = opposite(loser);
  invalidateAI();
  maybeFinalizeLeaderboardForAi("timeout");
  render();
}

function startClockLoop() {
  if (clockIntervalId !== null) {
    return;
  }

  clockIntervalId = window.setInterval(() => {
    const now = Date.now();
    if (state.lastClockTs === null) {
      state.lastClockTs = now;
      return;
    }

    const delta = now - state.lastClockTs;
    state.lastClockTs = now;

    if (!state.gameStarted || state.setupMode || state.gameOver) {
      renderTimers();
      return;
    }

    if (state.turn === "w") {
      state.whiteTimeMs -= delta;
      if (state.whiteTimeMs <= 0) {
        onTimeOut("w");
        return;
      }
    } else {
      state.blackTimeMs -= delta;
      if (state.blackTimeMs <= 0) {
        onTimeOut("b");
        return;
      }
    }

    renderTimers();
  }, 200);
}

function checkGameOver() {
  const legalMoves = getLegalMoves(state.board, state.turn, state.pendingCapture);
  if (legalMoves.length === 0) {
    state.gameOver = true;
    state.winner = winnerWhenNoLegalMoves(state.turn);
    maybeFinalizeLeaderboardForAi("normal");
    return true;
  }

  state.gameOver = false;
  state.winner = null;
  return false;
}

function invalidateAI() {
  state.aiGeneration += 1;
  state.aiThinking = false;
  resetHintState();
}

function scheduleAI() {
  if (!state.gameStarted || !isAiMode() || state.setupMode || state.gameOver || state.turn !== state.aiColor || state.aiThinking) {
    return;
  }

  state.aiThinking = true;
  const currentGeneration = ++state.aiGeneration;
  render();

  setTimeout(() => {
    if (currentGeneration !== state.aiGeneration) {
      return;
    }

    const move = chooseAIMove();
    state.aiThinking = false;

    if (!move) {
      state.gameOver = true;
      state.winner = winnerWhenNoLegalMoves(state.turn);
      maybeFinalizeLeaderboardForAi("normal");
      render();
      return;
    }

    applyMoveInGame(move);
  }, 130);
}

function applyMoveInGame(move) {
  if (!state.gameStarted || state.gameOver) {
    return;
  }

  pushUndoSnapshot();
  resetHintState();

  const movingColor = state.turn;
  executeMove(state.board, move);
  sessionMoveCount += 1;
  const turnState = nextTurnState(state.board, movingColor, move);
  state.turn = turnState.turn;
  state.pendingCapture = turnState.pendingCapture;

  state.selected = null;
  state.legalMovesForSelected = [];

  if (state.pendingCapture && isHumanTurnNow()) {
    state.selected = { ...state.pendingCapture };
    state.legalMovesForSelected = getLegalMoves(state.board, state.turn, state.pendingCapture);
  }

  if (checkGameOver()) {
    render();
    return;
  }

  render();
  if (isAiMode() && state.turn === state.aiColor) {
    scheduleAI();
  }
}

function onSquareClick(r, c) {
  if (!isPlayableSquare(r, c)) {
    return;
  }

  if (state.setupMode) {
    placeSetupPiece(r, c);
    return;
  }

  if (!state.gameStarted || !isHumanTurnNow() || state.gameOver || state.aiThinking) {
    return;
  }

  const allMoves = getLegalMoves(state.board, state.turn, state.pendingCapture);
  if (allMoves.length === 0) {
    state.gameOver = true;
    state.winner = winnerWhenNoLegalMoves(state.turn);
    maybeFinalizeLeaderboardForAi("normal");
    render();
    return;
  }

  if (state.selected) {
    const selectedMoves = allMoves.filter(
      (move) => move.from.r === state.selected.r && move.from.c === state.selected.c,
    );
    const chosen = selectedMoves.find((move) => move.to.r === r && move.to.c === c);
    if (chosen) {
      applyMoveInGame(chosen);
      return;
    }
  }

  const piece = state.board[r][c];
  const selectableColor = state.turn;
  if (piece && piece.color === selectableColor) {
    if (state.pendingCapture && (r !== state.pendingCapture.r || c !== state.pendingCapture.c)) {
      return;
    }

    const pieceMoves = allMoves.filter((move) => move.from.r === r && move.from.c === c);
    if (pieceMoves.length > 0) {
      state.selected = { r, c };
      state.legalMovesForSelected = pieceMoves;
    } else {
      state.selected = null;
      state.legalMovesForSelected = [];
    }
    render();
    return;
  }

  if (!state.pendingCapture) {
    state.selected = null;
    state.legalMovesForSelected = [];
    render();
  }
}

function placeSetupPiece(r, c) {
  const code = elements.setupPiece.value;
  if (code === "empty") {
    state.board[r][c] = null;
  } else {
    state.board[r][c] = {
      color: code.toLowerCase() === "w" ? "w" : "b",
      king: code === code.toUpperCase(),
    };
  }

  renderBoard();
}

function openSetupMode() {
  invalidateAI();
  sessionUsedSetupMode = true;
  sendTelemetryEvent("setup_open", {
    gameStarted: state.gameStarted,
    moveCount: sessionMoveCount,
  });

  state.setupBackup = {
    board: cloneBoard(state.board),
    turn: state.turn,
    pendingCapture: state.pendingCapture ? { ...state.pendingCapture } : null,
    gameOver: state.gameOver,
    winner: state.winner,
    gameStarted: state.gameStarted,
    whiteTimeMs: state.whiteTimeMs,
    blackTimeMs: state.blackTimeMs,
  };

  state.setupMode = true;
  state.selected = null;
  state.legalMovesForSelected = [];
  state.pendingCapture = null;
  state.gameOver = false;
  state.winner = null;
  state.gameStarted = false;

  elements.setupTurn.value = state.turn;
  elements.setupHumanColor.value = state.humanColor;
  render();
}

function cancelSetupMode() {
  if (!state.setupBackup) {
    return;
  }

  invalidateAI();
  sendTelemetryEvent("setup_cancel", {});

  state.board = cloneBoard(state.setupBackup.board);
  state.turn = state.setupBackup.turn;
  state.pendingCapture = state.setupBackup.pendingCapture ? { ...state.setupBackup.pendingCapture } : null;
  state.gameOver = state.setupBackup.gameOver;
  state.winner = state.setupBackup.winner;
  state.gameStarted = state.setupBackup.gameStarted;
  state.whiteTimeMs = state.setupBackup.whiteTimeMs;
  state.blackTimeMs = state.setupBackup.blackTimeMs;
  state.lastClockTs = Date.now();

  state.setupMode = false;
  state.setupBackup = null;
  state.selected = null;
  state.legalMovesForSelected = [];

  render();
  if (isAiMode() && state.gameStarted && !state.gameOver && state.turn === state.aiColor) {
    scheduleAI();
  }
}

function applySetupAndPlay() {
  invalidateAI();
  sessionUsedSetupMode = true;
  sendTelemetryEvent("setup_apply", {});

  state.humanColor = elements.setupHumanColor.value as Color;
  state.aiColor = opposite(state.humanColor);

  state.setupMode = false;
  state.setupBackup = null;
  state.turn = elements.setupTurn.value as Color;
  state.pendingCapture = null;
  state.selected = null;
  state.legalMovesForSelected = [];
  state.gameOver = false;
  state.winner = null;
  state.gameStarted = true;
  clearUndoStack();
  resetClocks();
  beginGameSession(true);

  checkGameOver();
  render();

  if (isAiMode() && state.gameStarted && !state.gameOver && state.turn === state.aiColor) {
    scheduleAI();
  }
}

function startStandardGame() {
  invalidateAI();

  state.board = createInitialBoard();
  state.turn = "w";
  state.pendingCapture = null;
  state.selected = null;
  state.legalMovesForSelected = [];
  state.gameOver = false;
  state.winner = null;
  state.gameStarted = true;
  state.setupMode = false;
  state.setupBackup = null;
  clearUndoStack();
  resetClocks();
  beginGameSession(false);

  elements.setupTurn.value = "w";
  elements.setupHumanColor.value = state.humanColor;
  render();

  if (isAiMode() && state.gameStarted && state.turn === state.aiColor) {
    scheduleAI();
  }
}

function onNewGameClick() {
  if (hasActiveGameInProgress()) {
    const shouldRestart = window.confirm(t("confirmRestart"));
    if (!shouldRestart) {
      return;
    }
  }

  startStandardGame();
}

function onUndoClick() {
  if (state.setupMode || state.aiThinking || !hasUndoMove()) {
    return;
  }

  invalidateAI();
  const snapshot = undoStack.pop();
  if (!snapshot) {
    return;
  }

  restoreUndoSnapshot(snapshot);
  render();

  if (isAiMode() && state.gameStarted && !state.gameOver && state.turn === state.aiColor) {
    scheduleAI();
  }
}

function renderStatus() {
  if (state.setupMode) {
    elements.status.textContent = t("statusSetup", { applySetup: t("applySetupBtn") });
    return;
  }

  if (!state.gameStarted) {
    elements.status.textContent = t("statusPressNewGame", { newGame: t("newGameBtn") });
    return;
  }

  if (state.gameOver) {
    if (isAiMode() && state.winner === state.humanColor) {
      elements.status.textContent = t("statusVictoryYou", { color: colorName(state.humanColor) });
    } else {
      elements.status.textContent = t("statusGameOverWinner", { color: colorName(state.winner) });
    }
    return;
  }

  if (state.aiThinking) {
    elements.status.textContent = t("statusAiThinking");
    return;
  }

  if (state.pendingCapture && isHumanTurnNow()) {
    elements.status.textContent = t("statusForcedCapture");
    return;
  }

  if (!isAiMode()) {
    elements.status.textContent = t("statusTurn", { color: colorName(state.turn) });
    return;
  }

  if (state.turn === state.humanColor) {
    elements.status.textContent = t("statusYourTurn", { color: colorName(state.humanColor) });
  } else {
    elements.status.textContent = t("statusAiTurn", { color: colorName(state.aiColor) });
  }
}

function renderHintText() {
  if (!state.gameStarted || state.setupMode) {
    elements.hintText.textContent = "";
    return;
  }

  if (!state.hintMode && !state.hintThinking && !state.hintMove && !state.hintText) {
    elements.hintText.textContent = "";
    return;
  }

  elements.hintText.textContent = state.hintText ?? "";
}

function renderHintModeButton() {
  const label = elements.hintBtn.querySelector(".toggle-label");
  const text = state.hintMode ? t("hintModeOn") : t("hintModeOff");
  if (label) {
    label.textContent = text;
  } else {
    elements.hintBtn.textContent = text;
  }

  elements.hintBtn.classList.toggle("active", state.hintMode);
  elements.hintBtn.setAttribute("aria-pressed", state.hintMode ? "true" : "false");
}

function renderSetupModeButton() {
  const label = elements.enterSetupBtn.querySelector(".toggle-label");
  const text = state.setupMode ? t("setupModeOn") : t("setupModeOff");
  if (label) {
    label.textContent = text;
  } else {
    elements.enterSetupBtn.textContent = text;
  }

  elements.enterSetupBtn.classList.toggle("active", state.setupMode);
  elements.enterSetupBtn.setAttribute("aria-pressed", state.setupMode ? "true" : "false");
}

function applyStaticTranslations() {
  document.documentElement.lang = state.language;
  updateSeoMetadata();

  const translatable = document.querySelectorAll<HTMLElement>("[data-i18n]");
  translatable.forEach((node) => {
    const key = node.dataset.i18n;
    if (!key) {
      return;
    }
    node.textContent = t(key);
  });

  const translatablePlaceholders = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-i18n-placeholder]");
  translatablePlaceholders.forEach((node) => {
    const key = node.dataset.i18nPlaceholder;
    if (!key) {
      return;
    }
    node.placeholder = t(key);
  });

  elements.board.setAttribute("aria-label", t("boardAria"));
  elements.modeGroup.setAttribute("aria-label", t("modeGroupAria"));
  elements.variantGroup.setAttribute("aria-label", t("variantGroupAria"));
  elements.colorGroup.setAttribute("aria-label", t("colorGroupAria"));
  elements.langGroup.setAttribute("aria-label", t("langGroupAria"));
}

function renderLanguageButtons() {
  const ruActive = state.language === "ru";
  elements.langRuBtn.classList.toggle("active", ruActive);
  elements.langEnBtn.classList.toggle("active", !ruActive);
  elements.langRuBtn.setAttribute("aria-pressed", ruActive ? "true" : "false");
  elements.langEnBtn.setAttribute("aria-pressed", ruActive ? "false" : "true");
}

function setLanguage(language: Language) {
  if (state.language === language) {
    return;
  }

  state.language = language;
  saveLanguage(language);
  resetHintState();
  render();
}

function renderModeButtons() {
  elements.modeAiBtn.classList.toggle("active", isAiMode());
  elements.modePvpBtn.classList.toggle("active", !isAiMode());
}

function renderVariantButtons() {
  const classic = state.variant === "classic";
  elements.variantClassicBtn.classList.toggle("active", classic);
  elements.variantGiveawayBtn.classList.toggle("active", !classic);
}

function renderColorButtons() {
  elements.colorWhiteBtn.classList.toggle("active", state.humanColor === "w");
  elements.colorBlackBtn.classList.toggle("active", state.humanColor === "b");
}

function renderTimers() {
  elements.whiteTimer.textContent = `${t("timerWhite")} ${formatClock(state.whiteTimeMs)}`;
  elements.blackTimer.textContent = `${t("timerBlack")} ${formatClock(state.blackTimeMs)}`;

  elements.whiteTimer.classList.toggle("active", state.gameStarted && state.turn === "w" && !state.gameOver && !state.setupMode);
  elements.blackTimer.classList.toggle("active", state.gameStarted && state.turn === "b" && !state.gameOver && !state.setupMode);
  elements.whiteTimer.classList.toggle("low", state.whiteTimeMs <= 30_000);
  elements.blackTimer.classList.toggle("low", state.blackTimeMs <= 30_000);
}

function renderHintArrow() {
  const existing = elements.board.querySelector(".hint-arrow");
  if (existing) {
    existing.remove();
  }

  if (!state.gameStarted || state.setupMode || !state.hintMove) {
    return;
  }

  const fromDisplay = getBoardToDisplayCoords(state.hintMove.from.r, state.hintMove.from.c);
  const toDisplay = getBoardToDisplayCoords(state.hintMove.to.r, state.hintMove.to.c);

  const boardPx = elements.board.clientWidth;
  if (!boardPx) {
    return;
  }

  const cellPx = boardPx / BOARD_SIZE;
  const fromX = fromDisplay.c * cellPx + cellPx / 2;
  const fromY = fromDisplay.r * cellPx + cellPx / 2;
  const toX = toDisplay.c * cellPx + cellPx / 2;
  const toY = toDisplay.r * cellPx + cellPx / 2;

  const deltaX = toX - fromX;
  const deltaY = toY - fromY;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance < 2) {
    return;
  }

  const arrow = document.createElement("div");
  arrow.className = "hint-arrow";
  arrow.style.left = `${fromX}px`;
  arrow.style.top = `${fromY}px`;
  arrow.style.width = `${Math.max(10, distance - cellPx * 0.25)}px`;
  arrow.style.transform = `translateY(-50%) rotate(${Math.atan2(deltaY, deltaX) * (180 / Math.PI)}deg)`;
  elements.board.appendChild(arrow);
}

function renderBoard() {
  elements.board.innerHTML = "";

  const targetSet = new Set(
    state.legalMovesForSelected.map((move) => `${move.to.r},${move.to.c}`),
  );
  const hintFrom = state.hintMove ? `${state.hintMove.from.r},${state.hintMove.from.c}` : null;
  const hintTo = state.hintMove ? `${state.hintMove.to.r},${state.hintMove.to.c}` : null;

  for (let displayR = 0; displayR < BOARD_SIZE; displayR += 1) {
    for (let displayC = 0; displayC < BOARD_SIZE; displayC += 1) {
      const { r, c } = getDisplayToBoardCoords(displayR, displayC);
      const piece = state.board[r][c];
      const square = document.createElement("button");
      square.type = "button";
      square.className = `square ${(displayR + displayC) % 2 === 0 ? "light" : "dark"}`;
      square.dataset.r = String(r);
      square.dataset.c = String(c);
      square.setAttribute("aria-label", squareLabel(r, c, piece));

      if (isPlayableSquare(r, c)) {
        square.classList.add("playable");
      } else {
        square.disabled = true;
      }

      if (state.selected && state.selected.r === r && state.selected.c === c) {
        square.classList.add("selected");
      }

      if (state.pendingCapture && state.pendingCapture.r === r && state.pendingCapture.c === c) {
        square.classList.add("forced-source");
      }

      if (targetSet.has(`${r},${c}`)) {
        square.classList.add("legal-target");
      }

      if (hintFrom === `${r},${c}`) {
        square.classList.add("hint-source");
      }
      if (hintTo === `${r},${c}`) {
        square.classList.add("hint-target");
      }

      if (piece) {
        const pieceEl = document.createElement("div");
        pieceEl.className = `piece ${piece.color === "w" ? "white" : "black"}${piece.king ? " king" : ""}`;
        if (hintFrom === `${r},${c}`) {
          pieceEl.classList.add("hint-piece-source");
        }
        square.appendChild(pieceEl);
      }

      if (displayC === 0) {
        const rankLabel = document.createElement("span");
        rankLabel.className = "coord-label coord-rank";
        rankLabel.textContent = String(BOARD_SIZE - r);
        square.appendChild(rankLabel);
      }

      if (displayR === BOARD_SIZE - 1) {
        const fileLabel = document.createElement("span");
        fileLabel.className = "coord-label coord-file";
        fileLabel.textContent = String.fromCharCode(97 + c);
        square.appendChild(fileLabel);
      }

      square.addEventListener("click", () => onSquareClick(r, c));
      elements.board.appendChild(square);
    }
  }

  renderHintArrow();
}

function render() {
  const settingsLocked = hasActiveGameInProgress() || state.setupMode;
  const canRequestSingleHint = state.gameStarted
    && !state.setupMode
    && !state.gameOver
    && !state.aiThinking
    && !state.hintThinking
    && (!isAiMode() || state.turn === state.humanColor);
  applyStaticTranslations();
  elements.layout.classList.toggle("setup-open", state.setupMode);
  elements.editorPanel.hidden = !state.setupMode;
  elements.settingsPanel.hidden = !state.settingsOpen;
  elements.settingsToggleBtn.classList.toggle("active", state.settingsOpen);
  elements.settingsToggleBtn.setAttribute("aria-expanded", state.settingsOpen ? "true" : "false");
  const settingsAria = state.settingsOpen ? t("settingsCloseAria") : t("settingsOpenAria");
  elements.settingsToggleBtn.setAttribute("aria-label", settingsAria);
  elements.settingsToggleBtn.title = settingsAria;
  elements.setupPanel.hidden = !state.setupMode;
  elements.modeAiBtn.disabled = settingsLocked;
  elements.modePvpBtn.disabled = settingsLocked;
  elements.variantClassicBtn.disabled = settingsLocked;
  elements.variantGiveawayBtn.disabled = settingsLocked;
  elements.colorWhiteBtn.disabled = settingsLocked;
  elements.colorBlackBtn.disabled = settingsLocked;
  elements.difficulty.disabled = settingsLocked || !isAiMode();
  elements.timeControl.disabled = settingsLocked;
  elements.undoBtn.disabled = state.setupMode || state.aiThinking || !hasUndoMove();
  elements.hintOnceBtn.disabled = !canRequestSingleHint;
  elements.hintBtn.disabled = state.setupMode;
  renderModeButtons();
  renderVariantButtons();
  renderColorButtons();
  renderLanguageButtons();
  renderHintModeButton();
  renderSetupModeButton();
  renderTimers();
  renderStatus();
  renderHintText();
  renderLeaderboard();
  renderBoard();
  ensureHintIfNeeded();
}

function toggleMobileControls() {
  const isCollapsed = elements.topControls.classList.contains("mobile-collapsed");
  if (isCollapsed) {
    elements.topControls.classList.remove("mobile-collapsed");
    elements.mobileToggleText.textContent = t("showLessControls");
  } else {
    elements.topControls.classList.add("mobile-collapsed");
    elements.mobileToggleText.textContent = t("showMoreControls");
  }
}

function bindEvents() {
  elements.settingsToggleBtn.addEventListener("click", toggleSettingsPanel);
  elements.mobileControlsToggle.addEventListener("click", toggleMobileControls);
  elements.langRuBtn.addEventListener("click", () => setLanguage("ru"));
  elements.langEnBtn.addEventListener("click", () => setLanguage("en"));
  elements.modeAiBtn.addEventListener("click", () => setGameMode("ai"));
  elements.modePvpBtn.addEventListener("click", () => setGameMode("pvp"));
  elements.variantClassicBtn.addEventListener("click", () => setVariant("classic"));
  elements.variantGiveawayBtn.addEventListener("click", () => setVariant("giveaway"));
  elements.colorWhiteBtn.addEventListener("click", () => applyBottomColor("w"));
  elements.colorBlackBtn.addEventListener("click", () => applyBottomColor("b"));

  elements.difficulty.addEventListener("change", () => {
    state.difficulty = elements.difficulty.value as Difficulty;
    resetHintState();
    render();
  });

  elements.timeControl.addEventListener("change", () => {
    const seconds = Number(elements.timeControl.value);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return;
    }

    state.initialTimeMs = seconds * 1000;
    resetClocks();
    render();
  });

  elements.newGameBtn.addEventListener("click", onNewGameClick);
  elements.undoBtn.addEventListener("click", onUndoClick);
  elements.hintOnceBtn.addEventListener("click", onHintOnceClick);
  elements.hintBtn.addEventListener("click", toggleHintMode);
  elements.enterSetupBtn.addEventListener("click", () => {
    if (state.setupMode) {
      cancelSetupMode();
    } else {
      openSetupMode();
    }
  });

  elements.clearBoardBtn.addEventListener("click", () => {
    state.board = createEmptyBoard();
    renderBoard();
  });

  elements.fillStandardBtn.addEventListener("click", () => {
    state.board = createInitialBoard();
    renderBoard();
  });

  elements.applySetupBtn.addEventListener("click", applySetupAndPlay);
  elements.cancelSetupBtn.addEventListener("click", cancelSetupMode);
}

function init() {
  leaderboardEntries = [];
  void refreshLeaderboardFromServer();
  state.language = getStoredLanguage();
  bindEvents();
  state.humanColor = "w";
  state.aiColor = opposite(state.humanColor);
  state.difficulty = elements.difficulty.value as Difficulty;
  state.initialTimeMs = Number(elements.timeControl.value) * 1000;
  state.board = createInitialBoard();
  state.turn = "w";
  state.pendingCapture = null;
  state.selected = null;
  state.legalMovesForSelected = [];
  state.gameOver = false;
  state.winner = null;
  state.gameStarted = false;
  sessionStartedAt = null;
  sessionHintsUsed = 0;
  sessionMoveCount = 0;
  clearUndoStack();
  resetClocks();
  startClockLoop();
  render();
}

init();

import { getGlitchCheat, isCheat } from "./Cheat";

export type LocalizedString = { en: string; zh: string; ja: string };

function u(en: string, zh: string, ja: string): LocalizedString {
  return { en, zh, ja };
}

let locale = "en";

function setLocale(newLocale: string) {
  locale = newLocale;
}

const GetLocalizedString = (strObj: LocalizedString, args?: Map<string, string>) => {
  let localizedString = locale === "ja" ? strObj.ja
    : locale === "zh" ? strObj.zh : strObj.en;
  if (args) {
    args.forEach((value, key) => {
      localizedString = localizedString.replace(`{${key}}`, value);
    });
  }
  if (isCheat()) {
    return getGlitchCheat(true, localizedString);
  }
  return localizedString;
}

const Localization = {

  TabNamePlayer: u("Player", "播放", "プレイヤー"),
  TabNameList: u("List", "列表", "リスト"),
  TabNameConfigs: u("Config", "设置", "設定"),
  TabNameAbout: u("Match", "游戏", "ゲーム"),
  TabNameSourceCode: u("Source", "源码", "ソース"),

  PlayerTabUpcoming: u("Upcoming (click to skip)", "接下来（点击以跳过）", "次の曲（クリックでスキップ）"),
  PlayerTabShuffle: u("Shuffle", "重新抽选", "再抽選"),
  PlayerTabSort: u("Sort", "重置顺序", "順序リセット"),
  PlayerTabRandomStart: u("Random Start", "播放位置随机", "再生位置をランダム"),
  PlayerTabCountdown: u("Countdown", "倒计时", "カウントダウン"),
  PlayerTabPlaybackDurationLabel: u("Playback Duration (s; 0 = inf)", "播放时长（秒；0 = 无限）", "再生時間（秒；0 = 無制限）"),
  PlayerTabHideDisplay: u("Hide Display", "隐藏显示", "表示を隠す"),
  PlayerTabSwitchPaused: u("Skip Without Playing", "切歌不播放", "スキップ時は再生しない"),

  ConfigTabCardCollection: u("Card Collection", "卡面图集", "カード画像集"),
  ConfigTabMusicSource: u("Music Source", "音乐源", "音楽ソース"),
  ConfigTabMusicSelectionPresets: u("Music Selection Presets", "音乐选择预设", "音楽選択プリセット"),
  ConfigTabMusicSelectionSingle: u("Music Selection Single", "音乐选择单曲", "音楽選択（単曲）"),
  ConfigTabMusicSourceExample: u("Example", "示例曲目", "サンプル曲"),
  ConfigTabSelected: u("Selected", "正在使用", "使用中"),
  ConfigTabSelect: u("Select", "使用", "使用"),
  ConfigTabApply: u("Apply", "应用", "適用"),
  ConfigTabApplied: u("Applied", "已应用", "適用済み"),
  ConfigTabPresetDefault: u("Default", "默认", "デフォルト"),
  ConfigTabPresetDisable: u("Disable ", "禁用", "無効 "),
  ConfigTabSearchCharacter: u("Search Character", "搜索角色", "キャラクター検索"),

  GameCardSmaller: u("Card Smaller", "卡牌缩小", "カードを縮小"),
  GameCardLarger: u("Card Larger", "卡牌放大", "カードを拡大"),
  GameStartWaitingForOpponent: u("waiting for opponent...", "等待对手...", "対戦相手を待機中..."),
  GameStart: u("Start", "开始游戏", "ゲーム開始"),
  GameStop : u("Stop", "中止游戏", "ゲーム中止"),
  GameFinish : u("Finish", "结束游戏", "ゲーム終了"),
  GameRandomFill: u("Random Fill", "随机补满", "ランダム補充"),
  GameClearDeck: u("Clear Deck", "清空卡组", "デッキを空にする"),
  GameShuffleDeck: u("Shuffle Deck", "打乱卡组", "デッキをシャッフル"),
  GameFilterByDeck: u("Filter Music by Deck", "按卡组筛选音乐", "デッキで音楽を絞り込む"),
  
  GameOpponentNoOpponent: u("No Opponent", "无对手", "対戦相手なし"),
  GameOpponentCPUOpponent: u("CPU Opponent", "电脑对手", "CPU 対戦相手"),
  GameOpponentRemoteAsServer: u("PvP (as Server)", "玩家对战（作为服务器）", "対戦（サーバー側）"),
  GameOpponentRemoteAsClient: u("PvP (as Client)", "玩家对战（作为客户端）", "対戦（クライアント側）"),
  GameOpponentRemoteAsObserver: u("PvP (as Observer)", "玩家对战（作为观察者）", "対戦（観戦者）"),

  GameNextTurnOpponentWaiting: u("opponent waiting...", "对手等待中...", "対戦相手の待機中..."),
  GameNextTurnWaitingForOpponent: u("waiting for opponent...", "等待对手...", "対戦相手を待機中..."),
  GameNextTurnGameFinished: u("game finished", "游戏已结束", "ゲーム終了"),
  GameNextTurnGiveCards: u("give {givesLeft} card{plural}...", "交出 {givesLeft} 张卡牌", "{givesLeft} 枚のカードを渡す..."),
  GameNextTurnReceiveCards: u("receiving {receives} card{plural}...", "等待接收 {receives} 张卡牌", "{receives} 枚のカードを受領中..."),

  GameInstructionGiveCards: u(
    "Give {givesLeft} card{plural} to opponent, or directly click next turn to give randomly.",
    "交出 {givesLeft} 张卡牌给对手，或者直接点击下一回合以随机交出。",
    "対戦相手に {givesLeft} 枚のカードを渡してください。次のターンを直接クリックするとランダムに渡します。"
  ),
  GameInstructionReceiveCards: u(
    "You need to receive {receives} card{plural} from opponent. Please wait for opponent to give.",
    "你需要从对手处接收 {receives} 张卡牌。请等待对手交出。",
    "対戦相手から {receives} 枚のカードを受け取る必要があります。相手が渡すのを待ってください。"
  ),
  GameInstructionReceiveCardsCPU: u(
    "You need to receive {receives} card{plural} from CPU opponent when moving to next turn.",
    "当你进入下一回合时，你将从电脑对手处接收 {receives} 张卡牌。",
    "次のターンに進むと、CPU 対戦相手から {receives} 枚のカードを受け取ります。"
  ),
  GameInstructionObserverGive: u(
    "Player {giver} is giving {givesLeft} card{plural} to Player {receiver}.",
    "玩家 {giver} 需要交出 {givesLeft} 张卡牌给 玩家 {receiver}。",
    "プレイヤー {giver} がプレイヤー {receiver} に {givesLeft} 枚のカードを渡しています。"
  ),

  GameConnectShareCodeInstruction: u(
    "Share this code with your friend to let them join your game. If multiple non-observer clients connect, the game will be a melee game. Retry if generation exceeds 10s.",
    "将此代码分享给你的朋友以让他们加入你的游戏。如果有多个非观战者客户端连接，游戏将变为混战模式。若生成时间超过10秒请重试。",
    "このコードを友達に共有すると、ゲームに参加できます。観戦者以外のクライアントが複数接続すると、乱戦モードになります。生成に10秒以上かかる場合は再試行してください。"
  ),
  GameConnectEnterCodeInstruction: u(
    "Enter the share code provided by your friend to join their game:",
    "输入你的朋友提供的分享代码以加入他们的游戏：",
    "友達から提供された共有コードを入力してゲームに参加してください："
  ),
  GameConnectionGeneratingId: u(
    "Generating connection ID...",
    "正在生成连接ID...",
    "接続 ID を生成中..."
  ),
  GameConnectionRetryGeneration: u(
    "Retry Generation",
    "重试生成",
    "生成を再試行"
  ),
  GameConnectionRegenerate: u(
    "Regenerate",
    "重新生成",
    "再生成"
  ),
  GameConnectionCopyToClipboard: u(
    "Copy to Clipboard",
    "复制到剪贴板",
    "クリップボードにコピー"
  ),
  GameConnectionCopyClientLink: u(
    "Copy Client Link",
    "复制玩家链接",
    "クライアントリンクをコピー"
  ),
  GameConnectionCopyObserverLink: u(
    "Copy Observer Link",
    "复制观战链接",
    "観戦リンクをコピー"
  ),
  GameConnectionConnect: u(
    "Connect",
    "连接",
    "接続"
  ),
  GameConnectionMyName: u(
    "Your name to display to other player(s):",
    "向其他玩家展示的你的名称：",
    "他のプレイヤーに表示するあなたの名前："
  ),
  GameConnectAsObserver: u(
    "Switch to Observer",
    "切换为观察者",
    "観戦者に切り替え"
  ),
  GameConnectAsClient: u(
    "Switch to Client Player",
    "切换为客户端玩家",
    "クライアントプレイヤーに切り替え"
  ),
  GamePlayer: u("Player", "玩家", "プレイヤー"),
  GameOpponent: u("Opponent", "对手", "対戦相手"),
  GameObserver: u("Observer", "观察者", "観戦者"),
  GameObserversList: u("Observer{plural}", "观察者", "観戦者"),


  GameModeTraditional: u("Classic Mode", "传统模式", "クラシックモード"),
  GameModeNonTraditional: u("Leisure Mode", "休闲模式", "レジャーモード"),
  GameModeTraditionalDescription: u(
    "Classic Mode: Wrong picks make you receive cards from the opponent. You win by emptying your deck first.",
    "经典模式：犯错会让你从对手那里接收卡牌。你需要先清空你的卡组才能获胜。",
    "クラシックモード：間違えると対戦相手からカードを受け取ります。先にデッキを空にした方が勝利します。"
  ),
  GameModeNonTraditionalDescription: u(
    "Leisure Mode: Wrong picks are ignored. You win by collecting more cards.",
    "休闲模式：犯错会被忽略。清空全场卡牌时获得更多卡牌的一方获胜。",
    "レジャーモード：間違えても無視されます。より多くのカードを集めた方が勝利します。"
  ),

  GameOpponentSettingTitle: u("Opponent Setting", "对手设置", "対戦相手の設定"),
  GameOpponentSettingReactionTime: u("Reaction Speed (s)", "反应速度（秒）", "反応速度（秒）"),
  GameOpponentSettingReactionBase: u("Base", "基础", "基本"),
  GameOpponentSettingReactionPerDoubling: u("Per doubling", "每翻倍", "倍増ごと"),
  GameOpponentSettingReactionStdDev: u("Variability", "波动", "変動"),
  GameOpponentSettingMistakeRate: u("Mistake Rate (%)", "失误率（%）", "ミス率（%）"),
  GameOpponentSettingMistakeBase: u("Base", "基础", "基本"),
  GameOpponentSettingMistakePerDoubling: u("Per doubling", "每翻倍", "倍増ごと"),
  GameOpponentSettingHintFullDeck: u(
    "Full deck ({cards} cards):",
    "满场（{cards} 张）：",
    "満杯（{cards} 枚）："
  ),
  GameOpponentSettingHintLastCard: u("Last card:", "最后一张：", "最後の1枚："),
  GameOpponentSettingHintValue: u(
    "{time}s +/- {deviation}s, {mistake}% mistake",
    "{time} 秒 +/- {deviation} 秒，失误 {mistake}%",
    "{time} 秒 +/- {deviation} 秒、ミス {mistake}%"
  ),
  GameOpponentPresetEasy: u("Easy", "简单", "イージー"),
  GameOpponentPresetNormal: u("Normal", "普通", "ノーマル"),
  GameOpponentPresetHard: u("Hard", "困难", "ハード"),
  GameOpponentPresetLunatic: u("Lunatic", "狂气", "ルナティック"),

  GameUnusedCards: u("Unused Cards", "未使用卡牌", "未使用カード"),
  
  GameParticipantsTitle: u("Participants", "参与者", "参加者"),
  GameParticipantsYou: u("You", "你", "あなた"),
  GameMessageParticipants: u("Participants in current room", "当前房间的参与者", "現在のルームの参加者"),
  GameParticipantsServer: u("Server Player", "服务器玩家", "サーバープレイヤー"),
  GameScore: u("Score", "得分", "スコア"),

  ChatMessageHint: u("Type a message to chat...", "输入消息以聊天...", "チャットメッセージを入力..."),
  ChatMessageSenderSystem: u("System", "系统", "システム"),
  ChatMessagePeerConnectionError: u("Connection error", "连接错误", "接続エラー"),
  ChatMessageConnectedToServer: u("Connected to server.", "已连接到服务器。", "サーバーに接続しました。"),
  ChatMessageConnectedFromClient: u("Client {clientName} connected.", "客户端 {clientName} 已连接。", "クライアント {clientName} が接続しました。"),
  ChatMessageConnectedFromObserver: u("Observer {clientName} connected.", "观察者 {clientName} 已连接。", "観戦者 {clientName} が接続しました。"),
  ChatMessageClientDisconnected: u("Disconnected from client {clientName}.", "已与客户端 {clientName} 断开连接。", "クライアント {clientName} との接続を切断しました。"),
  ChatMessageServerDisconnected: u("Disconnected from server.", "已与服务器断开连接。", "サーバーとの接続を切断しました。"),

}

export { Localization, GetLocalizedString, setLocale };

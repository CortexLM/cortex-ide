/**
 * Icon mapping from solid-icons (Feather, VS Code, Tabler, Bootstrap) to Font Awesome Pro
 * 
 * Font Awesome Pro Kit: kit-a943e80cf4-desktop
 * Style: Light (300 weight)
 * Total icons: 4,701
 */

// =============================================================================
// FEATHER ICONS (Fi) -> Font Awesome
// =============================================================================
export const featherToFA: Record<string, string> = {
  // Chevrons / Arrows
  'FiChevronRight': 'chevron-right',
  'FiChevronLeft': 'chevron-left',
  'FiChevronDown': 'chevron-down',
  'FiChevronUp': 'chevron-up',
  'FiChevronsUp': 'angles-up',
  'FiChevronsDown': 'angles-down',
  'FiChevronsLeft': 'angles-left',
  'FiChevronsRight': 'angles-right',
  'FiArrowRight': 'arrow-right',
  'FiArrowLeft': 'arrow-left',
  'FiArrowUp': 'arrow-up',
  'FiArrowDown': 'arrow-down',
  'FiArrowUpRight': 'arrow-up-right',
  'FiArrowDownLeft': 'arrow-down-left',
  'FiArrowUpLeft': 'arrow-up-left',
  'FiArrowDownRight': 'arrow-down-right',
  'FiArrowUpCircle': 'circle-arrow-up',
  'FiArrowDownCircle': 'circle-arrow-down',
  'FiArrowLeftCircle': 'circle-arrow-left',
  'FiArrowRightCircle': 'circle-arrow-right',
  'FiCornerDownRight': 'turn-down-right',
  'FiCornerDownLeft': 'turn-down-left',
  'FiCornerUpRight': 'turn-up-right',
  'FiCornerUpLeft': 'turn-up-left',

  // Actions
  'FiX': 'xmark',
  'FiCheck': 'check',
  'FiPlus': 'plus',
  'FiMinus': 'minus',
  'FiSearch': 'magnifying-glass',
  'FiRefreshCw': 'rotate',
  'FiRefreshCcw': 'rotate-left',
  'FiRotateCw': 'rotate-right',
  'FiRotateCcw': 'rotate-left',
  'FiTrash': 'trash',
  'FiTrash2': 'trash',
  'FiEdit': 'pen',
  'FiEdit2': 'pen',
  'FiEdit3': 'pen-to-square',
  'FiCopy': 'copy',
  'FiClipboard': 'clipboard',
  'FiSave': 'floppy-disk',
  'FiDownload': 'download',
  'FiUpload': 'upload',
  'FiShare': 'share',
  'FiShare2': 'share-nodes',
  'FiSend': 'paper-plane',
  'FiMove': 'up-down-left-right',
  'FiMoreHorizontal': 'ellipsis',
  'FiMoreVertical': 'ellipsis-vertical',
  'FiFilter': 'filter',
  'FiSliders': 'sliders',
  'FiMaximize': 'maximize',
  'FiMaximize2': 'maximize',
  'FiMinimize': 'minimize',
  'FiMinimize2': 'minimize',
  'FiZoomIn': 'magnifying-glass-plus',
  'FiZoomOut': 'magnifying-glass-minus',
  'FiCrosshair': 'crosshairs',
  'FiTarget': 'bullseye',
  'FiSkipForward': 'forward-step',
  'FiSkipBack': 'backward-step',

  // Files & Folders
  'FiFile': 'file',
  'FiFileText': 'file-lines',
  'FiFilePlus': 'file-plus',
  'FiFileMinus': 'file-minus',
  'FiFolder': 'folder',
  'FiFolderPlus': 'folder-plus',
  'FiFolderMinus': 'folder-minus',
  'FiFolderOpen': 'folder-open',
  'FiArchive': 'box-archive',
  'FiPackage': 'box',
  'FiBox': 'box',
  'FiImage': 'image',

  // UI Elements
  'FiMenu': 'bars',
  'FiGrid': 'grid',
  'FiList': 'list',
  'FiLayout': 'table-columns',
  'FiSidebar': 'sidebar',
  'FiColumns': 'columns',
  'FiLayers': 'layer-group',
  'FiSquare': 'square',
  'FiCircle': 'circle',
  'FiTriangle': 'triangle',
  'FiStar': 'star',
  'FiHeart': 'heart',
  'FiBookmark': 'bookmark',
  'FiFlag': 'flag',
  'FiTag': 'tag',
  'FiHash': 'hashtag',
  'FiAtSign': 'at',

  // Media Controls
  'FiPlay': 'play',
  'FiPause': 'pause',
  'FiStop': 'stop',
  'FiRewind': 'backward',
  'FiFastForward': 'forward',
  'FiVolume': 'volume',
  'FiVolume1': 'volume-low',
  'FiVolume2': 'volume-high',
  'FiVolumeX': 'volume-xmark',
  'FiMic': 'microphone',
  'FiMicOff': 'microphone-slash',
  'FiVideo': 'video',
  'FiVideoOff': 'video-slash',
  'FiCamera': 'camera',
  'FiCameraOff': 'camera-slash',

  // Communication
  'FiMessageSquare': 'message',
  'FiMessageCircle': 'comment',
  'FiMail': 'envelope',
  'FiInbox': 'inbox',
  'FiBell': 'bell',
  'FiBellOff': 'bell-slash',
  'FiPhone': 'phone',
  'FiPhoneCall': 'phone-volume',
  'FiPhoneOff': 'phone-slash',
  'FiPhoneIncoming': 'phone-arrow-down-left',
  'FiPhoneOutgoing': 'phone-arrow-up-right',
  'FiPhoneMissed': 'phone-missed',

  // User & People
  'FiUser': 'user',
  'FiUsers': 'users',
  'FiUserPlus': 'user-plus',
  'FiUserMinus': 'user-minus',
  'FiUserCheck': 'user-check',
  'FiUserX': 'user-xmark',

  // Security & Privacy
  'FiLock': 'lock',
  'FiUnlock': 'lock-open',
  'FiKey': 'key',
  'FiShield': 'shield',
  'FiShieldOff': 'shield-slash',
  'FiEye': 'eye',
  'FiEyeOff': 'eye-slash',

  // Development & Code
  'FiCode': 'code',
  'FiTerminal': 'terminal',
  'FiGitBranch': 'code-branch',
  'FiGitCommit': 'code-commit',
  'FiGitMerge': 'code-merge',
  'FiGitPullRequest': 'code-pull-request',
  'FiGithub': 'github',
  'FiCpu': 'microchip',
  'FiServer': 'server',
  'FiDatabase': 'database',
  'FiHardDrive': 'hard-drive',
  'FiCloud': 'cloud',
  'FiCloudOff': 'cloud-slash',
  'FiDownloadCloud': 'cloud-arrow-down',
  'FiUploadCloud': 'cloud-arrow-up',
  'FiBug': 'bug',
  'FiTool': 'wrench',
  'FiSettings': 'gear',
  'FiCog': 'gear',
  'FiCommand': 'command',
  'FiActivity': 'wave-pulse',
  'FiZap': 'bolt',

  // Navigation & Location
  'FiHome': 'house',
  'FiMap': 'map',
  'FiMapPin': 'location-dot',
  'FiNavigation': 'location-arrow',
  'FiCompass': 'compass',
  'FiGlobe': 'globe',
  'FiExternalLink': 'arrow-up-right-from-square',
  'FiLink': 'link',
  'FiLink2': 'link',

  // Status & Alerts
  'FiInfo': 'circle-info',
  'FiAlertCircle': 'circle-exclamation',
  'FiAlertTriangle': 'triangle-exclamation',
  'FiAlertOctagon': 'octagon-exclamation',
  'FiCheckCircle': 'circle-check',
  'FiXCircle': 'circle-xmark',
  'FiHelpCircle': 'circle-question',
  'FiLoader': 'spinner',

  // Time & Calendar
  'FiClock': 'clock',
  'FiWatch': 'watch',
  'FiCalendar': 'calendar',
  'FiSunrise': 'sunrise',
  'FiSunset': 'sunset',
  'FiSun': 'sun',
  'FiMoon': 'moon',

  // Commerce
  'FiDollarSign': 'dollar-sign',
  'FiCreditCard': 'credit-card',
  'FiShoppingCart': 'cart-shopping',
  'FiShoppingBag': 'bag-shopping',
  'FiGift': 'gift',
  'FiPercent': 'percent',

  // Media & Documents
  'FiBook': 'book',
  'FiBookOpen': 'book-open',
  'FiPaperclip': 'paperclip',
  'FiPrinter': 'print',
  'FiType': 'font',
  'FiBold': 'bold',
  'FiItalic': 'italic',
  'FiUnderline': 'underline',
  'FiAlignLeft': 'align-left',
  'FiAlignCenter': 'align-center',
  'FiAlignRight': 'align-right',
  'FiAlignJustify': 'align-justify',

  // Toggles
  'FiToggleLeft': 'toggle-off',
  'FiToggleRight': 'toggle-on',

  // Misc
  'FiAnchor': 'anchor',
  'FiAward': 'award',
  'FiBattery': 'battery-full',
  'FiBatteryCharging': 'battery-bolt',
  'FiBriefcase': 'briefcase',
  'FiCoffee': 'mug-hot',
  'FiDroplet': 'droplet',
  'FiFeather': 'feather',
  'FiPenTool': 'pen-fancy',
  'FiMonitor': 'desktop',
  'FiSmartphone': 'mobile',
  'FiTablet': 'tablet',
  'FiWifi': 'wifi',
  'FiWifiOff': 'wifi-slash',
  'FiTrendingUp': 'arrow-trend-up',
  'FiTrendingDown': 'arrow-trend-down',
  'FiBarChart': 'chart-bar',
  'FiBarChart2': 'chart-column',
  'FiPieChart': 'chart-pie',
  'FiTable': 'table',
};

// =============================================================================
// VS CODE ICONS (Vs) -> Font Awesome
// =============================================================================
export const vsCodeToFA: Record<string, string> = {
  // Debug
  'VsDebug': 'bug',
  'VsDebugAlt': 'bug',
  'VsDebugStart': 'play',
  'VsDebugStop': 'stop',
  'VsDebugRestart': 'rotate',
  'VsDebugPause': 'pause',
  'VsDebugStepOver': 'arrow-right',
  'VsDebugStepInto': 'arrow-down',
  'VsDebugStepOut': 'arrow-up',
  'VsDebugContinue': 'play',
  'VsDebugConsole': 'terminal',
  'VsDebugStackframe': 'layer-group',
  'VsDebugBreakpoint': 'circle',
  'VsDebugBreakpointLog': 'circle-dot',

  // Files
  'VsFile': 'file',
  'VsFileBinary': 'file-binary',
  'VsFileCode': 'file-code',
  'VsFileMedia': 'file-image',
  'VsFilePdf': 'file-pdf',
  'VsFileZip': 'file-zipper',
  'VsFolder': 'folder',
  'VsFolderOpened': 'folder-open',

  // Symbols
  'VsSymbolClass': 'cube',
  'VsSymbolMethod': 'function',
  'VsSymbolField': 'tag',
  'VsSymbolVariable': 'box',
  'VsSymbolInterface': 'circle-nodes',
  'VsSymbolEnum': 'list-ol',
  'VsSymbolEnumMember': 'list',
  'VsSymbolConstant': 'lock',
  'VsSymbolFunction': 'function',
  'VsSymbolProperty': 'tag',
  'VsSymbolEvent': 'bolt',
  'VsSymbolOperator': 'plus-minus',
  'VsSymbolNamespace': 'folder-tree',
  'VsSymbolPackage': 'box',
  'VsSymbolModule': 'cube',
  'VsSymbolMisc': 'shapes',

  // Terminal types
  'VsTerminal': 'terminal',
  'VsTerminalBash': 'terminal',
  'VsTerminalCmd': 'terminal',
  'VsTerminalPowershell': 'terminal',
  'VsTerminalLinux': 'terminal',

  // UI
  'VsClose': 'xmark',
  'VsAdd': 'plus',
  'VsRemove': 'minus',
  'VsEdit': 'pen',
  'VsTrash': 'trash',
  'VsSearch': 'magnifying-glass',
  'VsRefresh': 'rotate',
  'VsSettings': 'gear',
  'VsGear': 'gear',
  'VsInfo': 'circle-info',
  'VsWarning': 'triangle-exclamation',
  'VsError': 'circle-xmark',
  'VsCheck': 'check',
  'VsChevronRight': 'chevron-right',
  'VsChevronDown': 'chevron-down',
  'VsChevronUp': 'chevron-up',
  'VsChevronLeft': 'chevron-left',
  'VsHistory': 'clock-rotate-left',
  'VsListTree': 'folder-tree',

  // Security
  'VsShield': 'shield',
  'VsLock': 'lock',
  'VsKey': 'key',
  'VsEye': 'eye',
  'VsEyeClosed': 'eye-slash',

  // Git/Source Control
  'VsGitCommit': 'code-commit',
  'VsGitMerge': 'code-merge',
  'VsGitBranch': 'code-branch',
  'VsGitPullRequest': 'code-pull-request',
  'VsGithub': 'code-branch',
  'VsRepo': 'folder-git',

  // Misc
  'VsReport': 'flag',
  'VsLightbulb': 'lightbulb',
  'VsCargo': 'box',
  'VsExtensions': 'puzzle-piece',
};

// =============================================================================
// TABLER ICONS (Tb) -> Font Awesome
// =============================================================================
export const tablerToFA: Record<string, string> = {
  // Symbols (for outline panel, workspace symbols)
  'TbFunction': 'function',
  'TbVariable': 'box',
  'TbBox': 'box',
  'TbBraces': 'brackets-curly',
  'TbBrackets': 'brackets-square',
  'TbCode': 'code',
  'TbHash': 'hashtag',
  'TbCircleDot': 'circle-dot',
  'TbLambda': 'lambda',
  'TbNumber': 'hashtag',
  'TbToggleRight': 'toggle-on',
  'TbToggleLeft': 'toggle-off',

  // Letter icons for symbol types
  'TbSquareLetterC': 'c', // Class
  'TbSquareLetterI': 'i', // Interface
  'TbSquareLetterE': 'e', // Enum
  'TbSquareLetterM': 'm', // Method
  'TbSquareLetterP': 'p', // Property
  'TbSquareLetterS': 's', // Struct
  'TbSquareLetterT': 't', // Type
  'TbSquareLetterN': 'n', // Namespace
  'TbSquareLetterK': 'k', // Keyword
  'TbSquareLetterF': 'f', // Field/Function
  'TbSquareLetterV': 'v', // Variable
  'TbLetterO': 'o', // Object

  // Text
  'TbRegex': 'brackets-curly',
  'TbLetterCase': 'font-case',
  'TbTextWrap': 'text-width',

  // Pins
  'TbPin': 'thumbtack',
  'TbPinFilled': 'thumbtack',
};

// =============================================================================
// BOOTSTRAP ICONS (Bs) -> Font Awesome
// =============================================================================
export const bootstrapToFA: Record<string, string> = {
  'BsPin': 'thumbtack',
  'BsPinFill': 'thumbtack',
  'BsPinAngle': 'thumbtack',
  'BsPinAngleFill': 'thumbtack',
};

// =============================================================================
// COMBINED MAP
// =============================================================================
export const iconMap: Record<string, string> = {
  ...featherToFA,
  ...vsCodeToFA,
  ...tablerToFA,
  ...bootstrapToFA,
};

/**
 * Get Font Awesome icon name from any icon library prefix
 * Also accepts direct FA names
 */
export function getIconName(name: string): string {
  // If it starts with a known prefix, look up in map
  if (name.startsWith('Fi') || name.startsWith('Vs') || name.startsWith('Tb') || name.startsWith('Bs')) {
    const mapped = iconMap[name];
    if (mapped) return mapped;
    
    // Log unmapped icons for debugging
    console.warn(`Unmapped icon: ${name}`);
    return '';
  }
  
  // Otherwise assume it's already a FA icon name
  return name;
}

/**
 * Check if an icon exists in the mapping
 */
export function hasIcon(name: string): boolean {
  if (name.startsWith('Fi') || name.startsWith('Vs') || name.startsWith('Tb') || name.startsWith('Bs')) {
    return name in iconMap;
  }
  return true; // Assume FA names exist
}

// =============================================================================
// COMMONLY USED ICONS (for preloading)
// =============================================================================
export const commonIcons = [
  'chevron-right',
  'chevron-down',
  'chevron-left',
  'chevron-up',
  'xmark',
  'check',
  'plus',
  'minus',
  'magnifying-glass',
  'folder',
  'file',
  'terminal',
  'code-branch',
  'play',
  'pause',
  'stop',
  'rotate',
  'trash',
  'pen',
  'copy',
  'spinner',
  'gear',
  'eye',
  'eye-slash',
  'globe',
  'message',
  'circle-info',
  'circle-exclamation',
  'triangle-exclamation',
  'circle-check',
];

export default iconMap;

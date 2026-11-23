/// <reference path="./lucide-icons.d.ts" />
import type { LucideIcon, LucideProps } from 'lucide-preact';
// Per-icon modules, never the root barrel (lint ban in .oxlintrc.json).
import Activity from 'lucide-preact/dist/esm/icons/activity.js';
import AlertCircle from 'lucide-preact/dist/esm/icons/circle-alert.js';
import AlertTriangle from 'lucide-preact/dist/esm/icons/triangle-alert.js';
import ArrowDown from 'lucide-preact/dist/esm/icons/arrow-down.js';
import ArrowDownUp from 'lucide-preact/dist/esm/icons/arrow-down-up.js';
import ArrowLeftRight from 'lucide-preact/dist/esm/icons/arrow-left-right.js';
import ArrowRight from 'lucide-preact/dist/esm/icons/arrow-right.js';
import ArrowUp from 'lucide-preact/dist/esm/icons/arrow-up.js';
import BarChart from 'lucide-preact/dist/esm/icons/chart-no-axes-column-increasing.js';
import Bell from 'lucide-preact/dist/esm/icons/bell.js';
import BookOpen from 'lucide-preact/dist/esm/icons/book-open.js';
import Bug from 'lucide-preact/dist/esm/icons/bug.js';
import ChartCandlestick from 'lucide-preact/dist/esm/icons/chart-candlestick.js';
import Check from 'lucide-preact/dist/esm/icons/check.js';
import CheckCircle from 'lucide-preact/dist/esm/icons/circle-check-big.js';
import CheckSquare2 from 'lucide-preact/dist/esm/icons/square-check.js';
import ChevronDown from 'lucide-preact/dist/esm/icons/chevron-down.js';
import ChevronLeft from 'lucide-preact/dist/esm/icons/chevron-left.js';
import ChevronRight from 'lucide-preact/dist/esm/icons/chevron-right.js';
import Clock from 'lucide-preact/dist/esm/icons/clock.js';
import Code from 'lucide-preact/dist/esm/icons/code.js';
import Copy from 'lucide-preact/dist/esm/icons/copy.js';
import Cpu from 'lucide-preact/dist/esm/icons/cpu.js';
import Crosshair from 'lucide-preact/dist/esm/icons/crosshair.js';
import Download from 'lucide-preact/dist/esm/icons/download.js';
import Droplet from 'lucide-preact/dist/esm/icons/droplet.js';
import Edit2 from 'lucide-preact/dist/esm/icons/pen.js';
import ExternalLink from 'lucide-preact/dist/esm/icons/external-link.js';
import FileText from 'lucide-preact/dist/esm/icons/file-text.js';
import Filter from 'lucide-preact/dist/esm/icons/filter.js';
import FunctionSquare from 'lucide-preact/dist/esm/icons/square-function.js';
import Globe from 'lucide-preact/dist/esm/icons/globe.js';
import Highlighter from 'lucide-preact/dist/esm/icons/highlighter.js';
import Image from 'lucide-preact/dist/esm/icons/image.js';
import Info from 'lucide-preact/dist/esm/icons/info.js';
import Key from 'lucide-preact/dist/esm/icons/key.js';
import Layers from 'lucide-preact/dist/esm/icons/layers.js';
import Link from 'lucide-preact/dist/esm/icons/link.js';
import Loader2 from 'lucide-preact/dist/esm/icons/loader-circle.js';
import Lock from 'lucide-preact/dist/esm/icons/lock.js';
import LogOut from 'lucide-preact/dist/esm/icons/log-out.js';
import Mail from 'lucide-preact/dist/esm/icons/mail.js';
import Maximize2 from 'lucide-preact/dist/esm/icons/maximize-2.js';
import Menu from 'lucide-preact/dist/esm/icons/menu.js';
import Moon from 'lucide-preact/dist/esm/icons/moon.js';
import MousePointer2 from 'lucide-preact/dist/esm/icons/mouse-pointer-2.js';
import Package from 'lucide-preact/dist/esm/icons/package.js';
import Palette from 'lucide-preact/dist/esm/icons/palette.js';
import Pause from 'lucide-preact/dist/esm/icons/pause.js';
import Pin from 'lucide-preact/dist/esm/icons/pin.js';
import Play from 'lucide-preact/dist/esm/icons/play.js';
import Plus from 'lucide-preact/dist/esm/icons/plus.js';
import Printer from 'lucide-preact/dist/esm/icons/printer.js';
import RefreshCw from 'lucide-preact/dist/esm/icons/refresh-cw.js';
import Save from 'lucide-preact/dist/esm/icons/save.js';
import Search from 'lucide-preact/dist/esm/icons/search.js';
import Settings from 'lucide-preact/dist/esm/icons/settings.js';
import Shield from 'lucide-preact/dist/esm/icons/shield.js';
import Sparkles from 'lucide-preact/dist/esm/icons/sparkles.js';
import SquareMousePointer from 'lucide-preact/dist/esm/icons/square-mouse-pointer.js';
import Star from 'lucide-preact/dist/esm/icons/star.js';
import Sun from 'lucide-preact/dist/esm/icons/sun.js';
import Target from 'lucide-preact/dist/esm/icons/target.js';
import Trash2 from 'lucide-preact/dist/esm/icons/trash-2.js';
import TrendingUp from 'lucide-preact/dist/esm/icons/trending-up.js';
import Upload from 'lucide-preact/dist/esm/icons/upload.js';
import Wallet from 'lucide-preact/dist/esm/icons/wallet.js';
import X from 'lucide-preact/dist/esm/icons/x.js';
import XCircle from 'lucide-preact/dist/esm/icons/circle-x.js';
import Zap from 'lucide-preact/dist/esm/icons/zap.js';
import createLucideIcon from 'lucide-preact/dist/esm/createLucideIcon.js';

/** The order book's spread: an up/down arrow between two horizontal lines (the bid and the ask).
 *  Not in Lucide, so drawn on its grid with the same stroke contract. */
const Spread = createLucideIcon('spread', [
  ['path', { d: 'M3 4h18', key: 'ask' }],
  ['path', { d: 'M3 20h18', key: 'bid' }],
  ['path', { d: 'M12 8v8', key: 'shaft' }],
  ['path', { d: 'm9 10.5 3-3 3 3', key: 'up' }],
  ['path', { d: 'm9 13.5 3 3 3-3', key: 'down' }],
]);

/** Static registry: dynamic namespace access would retain all ~1,550 Lucide modules. */
const ICONS = {
  activity: Activity,
  'alert-circle': AlertCircle,
  'arrow-down': ArrowDown,
  'arrow-down-up': ArrowDownUp,
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  'arrows-left-right': ArrowLeftRight,
  bell: Bell,
  'book-open': BookOpen,
  bug: Bug,
  'caret-down': ChevronDown,
  'caret-left': ChevronLeft,
  'caret-right': ChevronRight,
  'chart-bar': BarChart,
  'chart-candlestick': ChartCandlestick,
  check: Check,
  'check-circle': CheckCircle,
  'check-square': CheckSquare2,
  clock: Clock,
  code: Code,
  copy: Copy,
  'corners-out': Maximize2,
  cpu: Cpu,
  crosshair: Crosshair,
  cursor: MousePointer2,
  download: Download,
  droplet: Droplet,
  envelope: Mail,
  'external-link': ExternalLink,
  'file-text': FileText,
  'floppy-disk': Save,
  function: FunctionSquare,
  funnel: Filter,
  gear: Settings,
  globe: Globe,
  highlighter: Highlighter,
  image: Image,
  info: Info,
  key: Key,
  layers: Layers,
  link: Link,
  loader: Loader2,
  lock: Lock,
  'magnifying-glass': Search,
  menu: Menu,
  moon: Moon,
  package: Package,
  palette: Palette,
  pause: Pause,
  pencil: Edit2,
  pin: Pin,
  play: Play,
  plus: Plus,
  printer: Printer,
  'refresh-cw': RefreshCw,
  'selection-all': SquareMousePointer,
  shield: Shield,
  'sign-out': LogOut,
  sparkles: Sparkles,
  spread: Spread,
  star: Star,
  sun: Sun,
  target: Target,
  trash: Trash2,
  'trending-up': TrendingUp,
  upload: Upload,
  wallet: Wallet,
  warning: AlertTriangle,
  x: X,
  'x-circle': XCircle,
  zap: Zap,
} satisfies Record<string, LucideIcon>;

export interface IconProps extends Omit<LucideProps, 'size'> {
  name: string;
  size?: number | string;
  className?: string;
}

export function Icon({ name, size = 16, className, ...props }: IconProps) {
  const Component = ICONS[name as IconName];
  if (!Component) {
    console.warn(`Icon "${name}" is not registered`);
    return null;
  }
  const parsedSize = typeof size === 'number' ? size : Number.parseInt(size, 10);
  // lucide-preact reads `class`; passing only `className` leaves the glyph at its 16px default.
  return <Component size={parsedSize} {...props} {...(className ? { class: className } : {})} />;
}

export type IconName = keyof typeof ICONS;

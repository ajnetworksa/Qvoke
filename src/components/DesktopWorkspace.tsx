import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AppWindow,
  Bell,
  ChevronUp,
  Command,
  Maximize2,
  Minimize2,
  Search,
  Sparkles,
  X
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';

export interface DesktopApp {
  id: string;
  page: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  feature?: string;
  recordId?: string | null;
}

interface WorkspaceWindow {
  id: string;
  page: string;
  recordId: string | null;
  title: string;
  iconId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  z: number;
}

interface DesktopWorkspaceProps {
  apps: DesktopApp[];
  currentPage: string;
  currentRecordId: string | null;
  companyName: string;
  userName: string;
  persistenceKey: string;
  renderWindow: (page: string, recordId: string | null) => React.ReactNode;
  onNavigate: (page: string, recordId?: string | null) => void;
  onExit: () => void;
}

const routeWindowId = (page: string, recordId: string | null) =>
  `${page}:${recordId || 'root'}`;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

export const DesktopWorkspace: React.FC<DesktopWorkspaceProps> = ({
  apps,
  currentPage,
  currentRecordId,
  companyName,
  userName,
  persistenceKey,
  renderWindow,
  onNavigate,
  onExit
}) => {
  const [windows, setWindows] = useState<WorkspaceWindow[]>([]);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [launcherSearch, setLauncherSearch] = useState('');
  const [clock, setClock] = useState(new Date());
  const zRef = useRef(10);

  const appMap = useMemo(() => new Map(apps.map((app) => [app.page, app])), [apps]);
  const filteredApps = useMemo(() => {
    const q = launcherSearch.trim().toLowerCase();
    return q
      ? apps.filter((app) => `${app.title} ${app.subtitle || ''}`.toLowerCase().includes(q))
      : apps;
  }, [apps, launcherSearch]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(persistenceKey);
      if (saved) {
        const parsed = JSON.parse(saved) as WorkspaceWindow[];
        if (Array.isArray(parsed)) {
          const normalized = parsed.map((item, index) => ({
            ...item,
            x: clamp(item.x || 116, 108, window.innerWidth - 240),
            y: clamp(item.y || 24, 8, window.innerHeight - 160),
            z: index + 10
          }));
          zRef.current = normalized.length + 12;
          setWindows(normalized);
        }
      }
    } catch {
      localStorage.removeItem(persistenceKey);
    }
  }, [persistenceKey]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!launcherOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLauncherOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [launcherOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem(persistenceKey, JSON.stringify(windows));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [windows, persistenceKey]);

  useEffect(() => {
    const id = routeWindowId(currentPage, currentRecordId);
    setWindows((existing) => {
      const found = existing.find((item) => item.id === id);
      const nextZ = ++zRef.current;
      if (found) {
        return existing.map((item) => item.id === id
          ? { ...item, minimized: false, z: nextZ }
          : item);
      }

      const app = appMap.get(currentPage);
      const offset = existing.length % 6;
      const width = Math.min(1180, Math.max(720, window.innerWidth - 180));
      const height = Math.min(780, Math.max(520, window.innerHeight - 170));
      const title = currentRecordId && currentRecordId !== 'new'
        ? `${app?.title || currentPage} · ${currentRecordId}`
        : currentRecordId === 'new'
          ? `New ${app?.title || currentPage}`
          : app?.title || currentPage;

      return [...existing, {
        id,
        page: currentPage,
        recordId: currentRecordId,
        title,
        iconId: app?.id || currentPage,
        x: 116 + offset * 28,
        y: 34 + offset * 24,
        width,
        height,
        minimized: false,
        maximized: false,
        z: nextZ
      }];
    });
  }, [currentPage, currentRecordId, appMap]);

  const focusWindow = (id: string, navigate = true) => {
    const target = windows.find((item) => item.id === id);
    const nextZ = ++zRef.current;
    setWindows((items) => items.map((item) => item.id === id
      ? { ...item, minimized: false, z: nextZ }
      : item));
    if (navigate && target) onNavigate(target.page, target.recordId);
  };

  const closeWindow = (id: string) => {
    setWindows((items) => items.filter((item) => item.id !== id));
  };

  const patchWindow = (id: string, patch: Partial<WorkspaceWindow>) => {
    setWindows((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const startDrag = (event: React.PointerEvent, windowItem: WorkspaceWindow) => {
    if (windowItem.maximized || (event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    focusWindow(windowItem.id, false);
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = windowItem.x;
    const originY = windowItem.y;

    const move = (pointer: PointerEvent) => {
      patchWindow(windowItem.id, {
        x: clamp(originX + pointer.clientX - startX, 0, window.innerWidth - 220),
        y: clamp(originY + pointer.clientY - startY, 0, window.innerHeight - 100)
      });
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };

  const launch = (app: DesktopApp) => {
    setLauncherOpen(false);
    setLauncherSearch('');
    const recordId = app.recordId || null;
    const id = routeWindowId(app.page, recordId);
    const existingWindow = windows.find((item) => item.id === id);
    if (existingWindow) {
      focusWindow(id, false);
    } else {
      const offset = windows.length % 6;
      const nextZ = ++zRef.current;
      setWindows((items) => [...items, {
        id,
        page: app.page,
        recordId,
        title: recordId === 'new' ? `New ${app.title}` : app.title,
        iconId: app.id,
        x: 116 + offset * 28,
        y: 34 + offset * 24,
        width: Math.min(1180, Math.max(720, window.innerWidth - 180)),
        height: Math.min(780, Math.max(520, window.innerHeight - 170)),
        minimized: false,
        maximized: false,
        z: nextZ
      }]);
    }
    onNavigate(app.page, recordId);
  };

  return (
    <div className="desktop-workspace" data-testid="desktop-workspace">
      <div className="desktop-workspace__backdrop" />

      <header className="desktop-menubar liquid-glass">
        <div className="flex items-center gap-2 min-w-0">
          <div className="desktop-brand-mark"><Sparkles className="w-4 h-4" /></div>
          <div className="min-w-0">
            <strong className="block text-xs text-white truncate">{companyName}</strong>
            <span className="block text-[9px] text-white/55 uppercase tracking-wider">Desktop workspace</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="desktop-menubar__button" onClick={() => setLauncherOpen(true)} title="Open launcher">
            <Command className="w-4 h-4" />
            <span className="hidden sm:inline">Launcher</span>
          </button>
          <NotificationBell />
          <button className="desktop-menubar__button" onClick={onExit} title="Return to standard ERP">
            <AppWindow className="w-4 h-4" />
            <span className="hidden sm:inline">Standard ERP</span>
          </button>
        </div>
      </header>

      <div className="desktop-icons" aria-label="Workspace applications">
        {apps.slice(0, 9).map((app) => {
          const Icon = app.icon;
          return (
            <button key={app.id} onDoubleClick={() => launch(app)} onClick={() => launch(app)} className="desktop-icon-button">
              <span className="desktop-icon-button__icon liquid-glass"><Icon className="w-6 h-6" /></span>
              <span>{app.title}</span>
            </button>
          );
        })}
      </div>

      <div className="desktop-window-layer">
        {windows.filter((item) => !item.minimized).map((item) => {
          const app = apps.find((candidate) => candidate.id === item.iconId) || appMap.get(item.page);
          const Icon = app?.icon || AppWindow;
          const isFocused = item.z === Math.max(...windows.map((candidate) => candidate.z));
          return (
            <section
              key={item.id}
              className={`desktop-window ${item.maximized ? 'desktop-window--maximized' : ''} ${isFocused ? 'desktop-window--focused' : ''}`}
              style={item.maximized ? { zIndex: item.z } : {
                zIndex: item.z,
                left: item.x,
                top: item.y,
                width: item.width,
                height: item.height
              }}
              onPointerDown={() => focusWindow(item.id, false)}
            >
              <div className="desktop-window__titlebar liquid-glass" onPointerDown={(event) => startDrag(event, item)}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="desktop-window__app-icon"><Icon className="w-3.5 h-3.5" /></span>
                  <span className="truncate text-xs font-semibold text-white/90">{item.title}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => patchWindow(item.id, { minimized: true })} title="Minimize"><Minimize2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => patchWindow(item.id, { maximized: !item.maximized })} title={item.maximized ? 'Restore' : 'Maximize'}><Maximize2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => closeWindow(item.id)} title="Close"><X className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="desktop-window__content">
                {renderWindow(item.page, item.recordId)}
              </div>
            </section>
          );
        })}
      </div>

      {launcherOpen && (
        <div className="desktop-launcher-layer" onMouseDown={() => setLauncherOpen(false)}>
          <section className="desktop-launcher liquid-glass" onMouseDown={(event) => event.stopPropagation()}>
            <div className="desktop-launcher__search">
              <Search className="w-4 h-4" />
              <input autoFocus value={launcherSearch} onChange={(event) => setLauncherSearch(event.target.value)} placeholder="Search applications…" />
              <kbd>Esc</kbd>
            </div>
            <div className="desktop-launcher__grid">
              {filteredApps.map((app) => {
                const Icon = app.icon;
                return (
                  <button key={app.id} onClick={() => launch(app)}>
                    <span><Icon className="w-5 h-5" /></span>
                    <strong>{app.title}</strong>
                    <small>{app.subtitle}</small>
                  </button>
                );
              })}
            </div>
            <footer>
              <span>{userName}</span>
              <span>{companyName}</span>
            </footer>
          </section>
        </div>
      )}

      <footer className="desktop-taskbar liquid-glass">
        <button className={`desktop-start-button ${launcherOpen ? 'is-active' : ''}`} onClick={() => setLauncherOpen((open) => !open)} title="Applications">
          <Sparkles className="w-5 h-5" />
        </button>
        <div className="desktop-taskbar__apps">
          {windows.map((item) => {
            const app = apps.find((candidate) => candidate.id === item.iconId) || appMap.get(item.page);
            const Icon = app?.icon || AppWindow;
            return (
              <button key={item.id} className={item.minimized ? '' : 'is-open'} onClick={() => focusWindow(item.id)} title={item.title}>
                <Icon className="w-4 h-4" />
                <span>{item.title}</span>
                {item.minimized && <ChevronUp className="w-3 h-3 opacity-60" />}
              </button>
            );
          })}
        </div>
        <div className="desktop-taskbar__status">
          <Bell className="w-3.5 h-3.5 opacity-60" />
          <div>
            <strong>{clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
            <span>{clock.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default DesktopWorkspace;

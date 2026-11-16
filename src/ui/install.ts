import type { Settings } from '../meta/settings';

// "Add to home screen" prompt. Android/desktop Chrome fires `beforeinstallprompt` (we keep it and show our own
// sheet with an Install button); iOS has no such event, so there we show the manual "Share -> Add to Home Screen" steps.
// Never shown when the game already runs as an installed app, or for a week after "Not now".

const WEEK = 7 * 24 * 3600 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.startsWith('android-app://')
  );
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

const SHARE_ICON =
  '<svg class="share" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';

export class InstallPrompt {
  private deferred: BeforeInstallPromptEvent | null = null;
  private sheet = $('install');
  private text = $('installText');
  private btn = $<HTMLButtonElement>('installBtn');
  private later = $<HTMLButtonElement>('installLater');
  private menuBtn = $<HTMLButtonElement>('installMenuBtn');

  /** `canShow` says whether the player is somewhere it is polite to interrupt (the menu, not mid-run). */
  constructor(
    private settings: Settings,
    private persist: () => void,
    private canShow: () => boolean,
  ) {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault(); // keep it for our own button
      this.deferred = e as BeforeInstallPromptEvent;
      this.refreshMenuButton();
      window.setTimeout(() => this.maybeShow(), 1500);
    });
    window.addEventListener('appinstalled', () => {
      this.settings.installed = true;
      this.persist();
      this.hide();
      this.refreshMenuButton();
    });
    this.btn.addEventListener('click', () => void this.onInstall());
    this.later.addEventListener('click', () => {
      this.settings.installDismissedAt = Date.now();
      this.persist();
      this.hide();
    });
    this.menuBtn.addEventListener('click', () => this.maybeShow(true));
    this.refreshMenuButton();
    if (isIOS()) window.setTimeout(() => this.maybeShow(), 2000);
  }

  /** Can the game be installed right now (and has it not been already)? */
  get available(): boolean {
    return !isStandalone() && !this.settings.installed && (isIOS() || this.deferred !== null);
  }

  private refreshMenuButton() {
    this.menuBtn.style.display = this.available ? '' : 'none';
  }

  /** Show the sheet unless installed, recently dismissed or the player is busy. `force` = the player asked for it. */
  maybeShow(force = false) {
    this.refreshMenuButton();
    if (!this.available) return;
    if (!force && Date.now() - this.settings.installDismissedAt < WEEK) return;
    if (!this.canShow()) return;
    if (this.deferred) {
      this.text.textContent = 'Play full screen from your home screen, even offline.';
      this.btn.textContent = 'Install';
    } else {
      this.text.innerHTML = `On iPhone: tap ${SHARE_ICON} <b>Share</b>, then <b>Add to Home Screen</b>. (Use Safari if you don't see it.)`;
      this.btn.textContent = 'Got it';
    }
    this.sheet.classList.add('show');
  }

  hide() {
    this.sheet.classList.remove('show');
  }

  private async onInstall() {
    if (!this.deferred) {
      // iOS: nothing to trigger, the player follows the steps. Ask again in a week in case they did not.
      this.settings.installDismissedAt = Date.now();
      this.persist();
      this.hide();
      return;
    }
    const ev = this.deferred;
    this.deferred = null;
    this.hide();
    try {
      await ev.prompt();
      const { outcome } = await ev.userChoice;
      if (outcome === 'accepted') {
        this.settings.installed = true;
      } else {
        this.settings.installDismissedAt = Date.now();
      }
      this.persist();
    } catch {
      /* the browser refused to show it: leave things as they were */
    }
    this.refreshMenuButton();
  }
}

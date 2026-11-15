// Store-app bridge for the game: Full Game purchase and rewarded ads (shared BIRCO module),
// the phone's share sheet for Online VS invites, and a full-screen status bar.
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { StatusBar } from '@capacitor/status-bar';
import { installBircoStore } from '../../birco/native/monetize.js';
import cfg from '../monetization.json';

installBircoStore(cfg);

// The app WebView has no navigator.share, so SHARE INVITE LINK uses the native share sheet.
if (Capacitor.isNativePlatform()) {
  navigator.share = (d) => Share.share({ title: d.title, text: d.text, url: d.url, dialogTitle: 'Invite a friend' });
  StatusBar.hide().catch(() => {});
}

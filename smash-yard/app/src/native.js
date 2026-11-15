// Store-app bridge for Smash Yard: Apple / Google one-time "Full Game" purchase, full-screen status bar.
// Same purchase code as Knockout Zoo (product id differs). No ads SDK, no analytics, no tracking.
import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { StatusBar } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

const ID = 'smashyard_full_game';
const T = PURCHASE_TYPE.INAPP;
const good = (p) => p.productIdentifier === ID && (Capacitor.getPlatform() !== 'android' || p.purchaseState === '1' || p.purchaseState == null);
const KEY = 'smash-yard-full-game';
const remember = (ok) => { try { if (ok) localStorage.setItem(KEY, '1'); } catch (e) {} return ok; };

if (Capacitor.isNativePlatform()) {
  window.SYN = {
    platform: Capacitor.getPlatform(),
    async price() {
      const { products } = await NativePurchases.getProducts({ productIdentifiers: [ID], productType: T });
      return products && products[0] ? products[0].priceString : null;
    },
    async buy() {
      const t = await NativePurchases.purchaseProduct({ productIdentifier: ID, productType: T, quantity: 1 });
      return remember(!!t && good({ ...t, productIdentifier: t.productIdentifier || ID }));
    },
    async owned() {
      // the store is the source of truth; the saved flag only covers starting the app offline
      try { const { purchases } = await NativePurchases.getPurchases({ productType: T }); return remember((purchases || []).some(good)); }
      catch (e) { try { return localStorage.getItem(KEY) === '1'; } catch (x) { return false; } }
    },
    async restore() {
      await NativePurchases.restorePurchases();
      return this.owned();
    },
  };
  StatusBar.hide().catch(() => {});
  addEventListener('load', () => setTimeout(() => SplashScreen.hide().catch(() => {}), 300));
}

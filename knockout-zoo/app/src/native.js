// Store-app bridge: Apple / Google in-app purchase for the Full Game, native share sheet, full-screen status bar.
import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { StatusBar } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Share } from '@capacitor/share';

const ID = 'knockoutzoo_full_game';
const T = PURCHASE_TYPE.INAPP;
const good = p => p.productIdentifier === ID && (Capacitor.getPlatform() !== 'android' || p.purchaseState === '1' || p.purchaseState == null);

window.KZN = {
  native: Capacitor.isNativePlatform(),
  platform: Capacitor.getPlatform(),
  store: Capacitor.getPlatform() === 'ios' ? 'App Store' : 'Google Play',
  async price() {
    const { products } = await NativePurchases.getProducts({ productIdentifiers: [ID], productType: T });
    return products && products[0] ? products[0].priceString : null;
  },
  async buy() {
    const t = await NativePurchases.purchaseProduct({ productIdentifier: ID, productType: T, quantity: 1 });
    return !!t && good({ ...t, productIdentifier: t.productIdentifier || ID });
  },
  async owned() {
    const { purchases } = await NativePurchases.getPurchases({ productType: T });
    return (purchases || []).some(good);
  },
  async restore() {
    await NativePurchases.restorePurchases();
    return this.owned();
  },
};

// TEXT A FRIEND uses Capacitor.Plugins.Share (the app WebView has no navigator.share)
if (window.KZN.native && window.Capacitor) (window.Capacitor.Plugins = window.Capacitor.Plugins || {}).Share = Share;

if (window.KZN.native) {
  StatusBar.hide().catch(() => {});
  // the app is already full screen, so the web FULL button is not needed
  const st = document.createElement('style'); st.textContent = '#bFull{display:none!important}'; document.head.appendChild(st);
  addEventListener('load', () => setTimeout(() => SplashScreen.hide().catch(() => {}), 300));
}

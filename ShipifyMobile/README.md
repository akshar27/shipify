# Shipify mobile (iOS and Android)

One React Native codebase (Expo SDK 54) for both platforms. It talks to the same backend as the website.

**What it does:** sign up with the terms gate, ID verification upload, send a package (create, pay with Stripe Checkout, show the
handover code, confirm or report a problem, rate), and carry packages (post a trip, see paid packages along the route, accept,
enter the handover code to finish).

## Run it on your phone

1. Start the backend (`cd backend && npm start`), on the same Wi-Fi as your phone.
2. `cd ShipifyMobile && npm install && npm start`
3. Install **Expo Go** from the App Store / Play Store and scan the QR code.

The app finds the backend by itself in development: it uses the address of the computer serving the bundle, port 5050. To point it
somewhere else (staging, production) set `EXPO_PUBLIC_API_URL=https://api.yourdomain.com`.

`npm run web` runs the same app in a browser, handy for quick checks (no secure storage, no address lookup there).

## Tests

```
npm test    # 65 Jest tests: logic, auth state, every screen's behaviour, and the login / terms gating
```

CI also bundles the app for iOS and Android on every PR.

## Putting it in the stores

Needs an Apple Developer account ($99/year) and a Google Play developer account ($25 once), plus a real HTTPS API URL.

```
npm i -g eas-cli && eas login
eas build --profile preview --platform all     # installable test builds (set the real API URL in eas.json first)
eas build --profile production --platform all
eas submit --platform all
```

Change `com.shipify.app` (in `app.json`) to an identifier you own before the first build; it cannot be changed later.
Apple's review will want a privacy policy URL (the website has one, but it is still a draft: see `docs/phase1-security.md`) and a
demo account. Payment goes through Stripe Checkout in an in-app browser; Apple generally allows this for real-world services, but check
the current App Store guidelines before submitting.

## Known limits

- Packages and trips are matched only if the address could be turned into coordinates. That uses the phone's own geocoder
  (`expo-location`); an address it cannot find is reported on the trip screen, and a delivery without coordinates is never matched.
- No push notifications and no in-app chat yet. People get status emails; the links in them open the website.
- Admin tools (payouts, disputes) are web only.
- Not yet run on a physical device or simulator (none was available when this was written): it was exercised in the browser build
  against the real backend and through the Jest suite, and both native bundles compile.

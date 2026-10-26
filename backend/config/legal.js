// The rules every user agrees to. One source for the server (what it enforces), the API (/api/legal/rules) and the screens
// (what people read), so they cannot drift apart.
//
// CHANGING THE RULES: edit the text or the list, then bump TERMS_VERSION. Everyone is then asked to accept again before they can
// create or take a delivery. Have the Terms and Privacy pages reviewed by a lawyer before real use.
const env = require("./env");

exports.TERMS_VERSION = "2026-10-v1";

exports.PROHIBITED = [
  { id: "money", title: "Money and valuables", detail: "Cash, cheques, gift cards, securities, jewellery, precious metals, or anything else that is effectively money." },
  { id: "value", title: "Anything over the value limit", detail: "Items worth more than the declared-value limit shown when you create a delivery." },
  { id: "drugs", title: "Medication and drugs", detail: "Prescription or controlled medication, recreational drugs, and anything illegal to possess where it travels." },
  { id: "weapons", title: "Weapons", detail: "Firearms, ammunition, knives, fireworks, explosives, and anything that looks like a weapon." },
  { id: "hazard", title: "Hazardous items", detail: "Flammable, toxic, corrosive or pressurised items, aerosols, and loose batteries." },
  { id: "perishable", title: "Food, drink and liquids", detail: "Perishable food, alcohol, tobacco and vapes, and any liquid that could leak." },
  { id: "living", title: "Living things", detail: "Live animals, plants, and anything biological." },
  { id: "identity", title: "Identity documents and cards", detail: "Passports, ID cards, bank or credit cards, keys, and anything that identifies a person or gives access to their accounts." },
  { id: "illegal", title: "Illegal or restricted goods", detail: "Stolen or counterfeit goods, anything illegal to send, and anything that needs a customs declaration or licence for the route." },
];

exports.TRAVELER_RULES = [
  "You may refuse any package you are not comfortable carrying. Say no before you accept it, and tell support if something looks wrong.",
  "Do not open the package. Check only that it matches the description the sender gave.",
  "Never carry an item on the prohibited list, even if the sender asks you to or says it is fine.",
  "Hand it over only to the person who gives you the handover code, and enter that code in the app.",
];

exports.rules = () => ({
  termsVersion: exports.TERMS_VERSION,
  currency: env.PAYMENT_CURRENCY,
  maxItemValueCents: env.MAX_ITEM_VALUE_CENTS,
  prohibited: exports.PROHIBITED,
  travelerRules: exports.TRAVELER_RULES,
  // Shown on the legal pages. When unset the pages say so loudly instead of showing a made-up name.
  companyName: env.COMPANY_NAME || null,
  supportEmail: env.SUPPORT_EMAIL || null,
});

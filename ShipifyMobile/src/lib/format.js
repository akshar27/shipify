export const money = (cents, currency = 'usd') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: String(currency).toUpperCase() }).format((cents || 0) / 100);

/** What a sender sees for a delivery: a label, a colour tone and one sentence on what happens next. */
export function senderStatus(d) {
  if (d.status === 'refunded' || d.paymentStatus === 'refunded') return { label: 'Refunded', tone: 'neutral', hint: 'Your payment was refunded.' };
  if (d.status === 'pending' && d.paymentStatus !== 'paid') return { label: 'Awaiting payment', tone: 'warn', hint: 'Pay to make this visible to travelers.' };
  switch (d.status) {
    case 'pending': return { label: 'Finding a traveler', tone: 'info', hint: "Paid. We'll notify you when a traveler accepts." };
    case 'accepted': return { label: 'Traveler assigned', tone: 'info', hint: 'Give the handover code to the recipient when the package arrives.' };
    case 'in-transit': return { label: 'On the way', tone: 'info', hint: 'Give the handover code to the recipient when the package arrives.' };
    case 'delivered': return { label: 'Delivered: confirm', tone: 'warn', hint: 'Confirm it arrived, or report a problem.' };
    case 'confirmed': return { label: 'Completed', tone: 'good', hint: 'All done.' };
    case 'disputed': return { label: 'Under review', tone: 'bad', hint: 'An admin is looking into the problem you reported.' };
    default: return { label: d.status, tone: 'neutral', hint: '' };
  }
}

/** Which actions a sender can take on a delivery, in the order they are shown. */
export function senderActions(d, { rated = false } = {}) {
  if (d.status === 'refunded' || d.paymentStatus === 'refunded') return [];
  if (d.status === 'pending' && d.paymentStatus !== 'paid') return ['pay'];
  if (d.status === 'accepted' || d.status === 'in-transit') return ['code', 'report'];
  if (d.status === 'delivered') return ['confirm', 'report'];
  if (d.status === 'confirmed' && !rated) return ['rate'];
  return [];
}

export const isMine = (d, userId) => d.travelerId === userId;

export const CARRYING = ['accepted', 'in-transit'];

export const SIZES = ['small', 'medium', 'large'];

/** Quick departure choices (a date picker is not needed for the MVP). */
export const departureOptions = (now = new Date()) => {
  const at = (days) => { const d = new Date(now); d.setDate(d.getDate() + days); d.setHours(9, 0, 0, 0); return d; };
  return [
    { label: 'Today', date: new Date(now.getTime() + 60 * 60 * 1000) },
    { label: 'Tomorrow', date: at(1) },
    { label: 'In 2 days', date: at(2) },
    { label: 'In a week', date: at(7) },
  ];
};

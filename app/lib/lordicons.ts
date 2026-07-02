// Real, verified Lordicon animation sources on cdn.lordicon.com (their public embed CDN —
// CORS: *). An earlier pass used assets under media.lordicon.com, which is Lordicon's own
// site-chrome host and sends `Access-Control-Allow-Origin: https://lordicon.com`, so those
// silently failed to load from any other origin. Everything below was re-verified to resolve
// with a permissive CORS header before being wired in.
//
// No account/paid catalog search was available, so these are icons independently confirmed
// (via their Lottie "nm" field, not just a label someone else attached) to be real and
// semantically close, rather than picks from Lordicon's full paid search. Where no reasonable
// match existed (folder, sun, moon, qr code, pause/play, preview/eye), the original static
// icon was left in place instead of forcing a misleading substitute.
export const LORD_ICON = {
  // "wired-outline-489-rocket-space" — stand-in for cloud-upload (no open upload/cloud asset found).
  rocket: 'https://cdn.lordicon.com/fttvwdlw.json',
  // "system-solid-117-bolt"
  bolt: 'https://cdn.lordicon.com/sbrtyqxj.json',
  // "wired-flat-1140-error"
  warning: 'https://cdn.lordicon.com/akqsdstj.json',
  // "system-regular-31-check"
  checkmark: 'https://cdn.lordicon.com/oqdmuxru.json',
  // "161-trending-flat-outline" — mirrored via CSS for back/left arrows.
  arrowRight: 'https://cdn.lordicon.com/zmkotitn.json',
  // "system-regular-715-spinner-horizontal-dashed-circle" — refresh/retry/upload-in-progress.
  spinner: 'https://cdn.lordicon.com/ktsahwvc.json',
  // "25-error-cross-outline"
  cross: 'https://cdn.lordicon.com/rmkpgtpt.json',
  // "system-solid-99-copy" — also used for "copy link" style actions (no open chain-link asset found).
  copy: 'https://cdn.lordicon.com/iykgtsbt.json',
  // "system-regular-39-trash"
  trash: 'https://cdn.lordicon.com/wpyrrmcq.json',
  // "system-solid-114-edit-pencil-rename"
  pencil: 'https://cdn.lordicon.com/gwlusjdu.json',
  // "system-solid-12-arrow-down" — stand-in for download (no open tray+arrow asset found).
  download: 'https://cdn.lordicon.com/xcrjfuzb.json',
} as const;

export type LordIconName = keyof typeof LORD_ICON;

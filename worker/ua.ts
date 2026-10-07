// ponytail: regex UA parsing, good enough for a personal dashboard; swap for ua-parser-js if numbers start to matter.
export const isBot = (ua: string) =>
  !ua || /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|quora link|whatsapp|telegram|discord|skype|headless|lighthouse|curl|wget|python|node-fetch|axios|go-http/i.test(ua)

export function parseUA(ua: string) {
  const device = /ipad|tablet|(android(?!.*mobile))/i.test(ua) ? 'Tablet' : /mobi|iphone|ipod|android/i.test(ua) ? 'Mobile' : 'Desktop'
  const os =
    /iphone|ipad|ipod/i.test(ua) ? 'iOS'
    : /android/i.test(ua) ? 'Android'
    : /mac os x|macintosh/i.test(ua) ? 'macOS'
    : /windows/i.test(ua) ? 'Windows'
    : /cros/i.test(ua) ? 'ChromeOS'
    : /linux/i.test(ua) ? 'Linux' : 'Other'
  // In-app browsers first: that's where link-in-bio traffic actually comes from.
  const browser =
    /instagram/i.test(ua) ? 'Instagram'
    : /fban|fbav/i.test(ua) ? 'Facebook'
    : /musical_ly|bytedance|tiktok/i.test(ua) ? 'TikTok'
    : /twitter/i.test(ua) ? 'X'
    : /linkedinapp/i.test(ua) ? 'LinkedIn'
    : /edg\//i.test(ua) ? 'Edge'
    : /opr\/|opera/i.test(ua) ? 'Opera'
    : /firefox|fxios/i.test(ua) ? 'Firefox'
    : /chrome|crios/i.test(ua) ? 'Chrome'
    : /safari/i.test(ua) ? 'Safari' : 'Other'
  return { device, os, browser }
}

export const refHost = (ref: string | null, self: string) => {
  if (!ref) return 'Direct'
  try {
    const h = new URL(ref).hostname.replace(/^www\./, '')
    if (h === self) return 'Direct'
    if (/(^|\.)(t\.co|x\.com|twitter\.com)$/.test(h)) return 'x.com'
    if (/instagram\.com$/.test(h)) return 'instagram.com'
    if (/(^|\.)(l\.)?facebook\.com$|fb\.me$/.test(h)) return 'facebook.com'
    if (/linkedin\.com$|lnkd\.in$/.test(h)) return 'linkedin.com'
    if (/google\./.test(h)) return 'google'
    return h
  } catch { return 'Direct' }
}

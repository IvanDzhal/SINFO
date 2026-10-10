const MID: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z',
  и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ю: 'iu', я: 'ia',
}

const START: Record<string, string> = { є: 'ye', ї: 'yi', й: 'y', ю: 'yu', я: 'ya' }

export function translit(text: string) {
  let out = ''
  ;[...text.trim().toLowerCase()].forEach((ch, i) => {
    if ("'’ʼь".includes(ch)) return
    out += (i === 0 ? START[ch] : undefined) ?? MID[ch] ?? (/[a-z0-9]/.test(ch) ? ch : '')
  })
  return out
}

export function makeLogin(firstName: string, lastName: string) {
  const first = translit(firstName)[0] ?? ''
  const last = translit(lastName.replace(/[\s-]+/g, ''))
  return (first + last).toUpperCase()
}
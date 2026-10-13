const MID: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z',
  и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ю: 'iu', я: 'ia', ы: 'y', э: 'e', ё: 'e', ъ: '',
}
const START: Record<string, string> = { є: 'ye', ї: 'yi', й: 'y', ю: 'yu', я: 'ya' }

// назва категорії → читабельний ключ для адреси (prodazh-posluh)
export function categorySlug(name: string): string {
  const chars = [...name.trim().toLowerCase()]
  let out = ''
  chars.forEach((ch, i) => {
    if ("'’ʼ`ь".includes(ch)) return
    const prev = chars[i - 1]
    const atStart = i === 0 || !/[a-z0-9а-яіїєґъыэё]/.test(prev)
    out += (atStart ? START[ch] : undefined) ?? MID[ch] ?? (/[a-z0-9]/.test(ch) ? ch : '-')
  })
  return out.replace(/-+/g, '-').replace(/^-|-$/g, '') || 'category'
}

// параметр адреси (slug або старий id) → id категорії
export function resolveCategoryId(
  param: string | null,
  cats: { id: string; name: string }[],
): string | null {
  if (!param) return null
  return cats.find((c) => c.id === param || categorySlug(c.name) === param)?.id ?? null
}

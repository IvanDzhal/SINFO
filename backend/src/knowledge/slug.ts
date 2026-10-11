const MID: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z',
  и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ю: 'iu', я: 'ia', ы: 'y', э: 'e', ё: 'e', ъ: '',
};
const START: Record<string, string> = { є: 'ye', ї: 'yi', й: 'y', ю: 'yu', я: 'ya' };
const RESERVED = ['new', 'edit'];

export function slugify(title: string): string {
  const chars = [...title.trim().toLowerCase()];
  let out = '';
  chars.forEach((ch, i) => {
    if ("'’ʼ`ь".includes(ch)) return;
    const prev = chars[i - 1];
    const atStart = i === 0 || !/[a-z0-9а-яіїєґъыэё]/.test(prev);
    out += (atStart ? START[ch] : undefined) ?? MID[ch] ?? (/[a-z0-9]/.test(ch) ? ch : '-');
  });
  const slug = out.replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60).replace(/-$/, '');
  if (!slug) return 'material';
  return RESERVED.includes(slug) ? `${slug}-article` : slug;
}

export async function uniqueSlug(
  exists: (slug: string) => Promise<boolean>,
  title: string,
): Promise<string> {
  const base = slugify(title);
  if (!(await exists(base))) return base;
  for (let n = 2; n <= 50; n++) {
    const candidate = `${base}-${n}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}
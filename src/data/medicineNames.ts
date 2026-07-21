const normalize = (value: string) =>
  value
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[^а-яa-z0-9]+/gi, '')

export const commonMedicineNames = [
  'Ацикловир', 'Актовегин', 'Аллохол', 'Алмагель', 'Амброксол', 'Амлодипин',
  'Амоксициллин', 'Амоксиклав', 'Анальгин', 'Анаприлин', 'Арбидол', 'Аркоксиа',
  'Аскорбиновая кислота', 'Аспаркам', 'Аспирин', 'Аторвастатин', 'Афобазол',
  'АЦЦ', 'Баралгин', 'Бетагистин', 'Бисопролол', 'Валериана', 'Валидол',
  'Валсартан', 'Витамин D3', 'Вольтарен', 'Габапентин', 'Гексорал', 'Глицин',
  'Де-Нол', 'Дексаметазон', 'Детралекс', 'Диклофенак', 'Дротаверин', 'Дюфастон',
  'Железо', 'Зиртек', 'Ибупрофен', 'Ингавирин', 'Индапамид', 'Итомед',
  'Кальций', 'Канефрон', 'Капотен', 'Кардиомагнил', 'Кетанов', 'Кеторол',
  'Кларитин', 'Клопидогрел', 'Корвалол', 'Креон', 'Левомеколь', 'Левотироксин',
  'Лизиноприл', 'Линекс', 'Лоперамид', 'Лоратадин', 'Лориста', 'Лосартан',
  'Магний B6', 'Мезим', 'Мелатонин', 'Мелоксикам', 'Метопролол', 'Метформин',
  'Мильгамма', 'Мирамистин', 'Мовалис', 'Моксонидин', 'Монурал', 'Мукалтин',
  'Найз', 'Небиволол', 'Нимесил', 'Но-шпа', 'Нольпаза', 'Нурофен',
  'Омепразол', 'Панкреатин', 'Пантопразол', 'Парацетамол', 'Персен',
  'Преднизолон', 'Престариум', 'Рабепразол', 'Ребамипид', 'Розувастатин',
  'Сальбутамол', 'Смекта', 'Спазмалгон', 'Супрастин', 'Терафлю', 'Тизин',
  'Тримедат', 'Урсосан', 'Фенибут', 'Фенистил', 'Фестал', 'Флуконазол',
  'Фосфалюгель', 'Фурацилин', 'Фуросемид', 'Цетрин', 'Цитрамон', 'Эналаприл',
  'Энтерол', 'Энтеросгель', 'Эриус', 'Эссенциале', 'Эутирокс', 'Эзомепразол',
] as const

export function findMedicineNameSuggestions(
  query: string,
  extraNames: string[] = [],
  limit = 6
): string[] {
  const needle = normalize(query)
  if (needle.length < 2) return []

  const names = Array.from(new Set([...extraNames, ...commonMedicineNames]))
  const scored = names
    .map((name) => {
      const normalized = normalize(name)
      const starts = normalized.startsWith(needle)
      const contains = normalized.includes(needle)
      if (!contains) return null
      return { name, score: starts ? 0 : 1, length: normalized.length }
    })
    .filter((item): item is { name: string; score: number; length: number } => Boolean(item))
    .sort((a, b) => a.score - b.score || a.length - b.length || a.name.localeCompare(b.name, 'ru-RU'))

  return scored.slice(0, limit).map((item) => item.name)
}

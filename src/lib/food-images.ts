import "server-only";

// Free food + drink photography: TheMealDB and TheCocktailDB (public test
// key "1", no signup). Used as a poster background when the restaurant's own
// site has no usable imagery.
//
// Resolution order, most specific first:
//   1. the dish itself        ("Spaghetti alla Carbonara" → that photo)
//   2. a drink, by name       (Negroni, Aperol Spritz → TheCocktailDB)
//   3. a dish from its family, chosen by a stable hash of the item name, so
//      Cacio e Pepe and Bucatini don't share one stock photo
// Results are cached per query for the life of the process.

type Family = { re: RegExp; meal?: { category?: string; search?: string }; drink?: string };

const FAMILIES: Family[] = [
  { re: /pizza|margherita|marinara|calzone/i, meal: { search: "pizza" } },
  { re: /tiramis|dessert|gelato|cannoli|panna|cake|torta|affogato/i, meal: { category: "Dessert" } },
  {
    re: /(cacio|bucatini|tagliatelle|amatriciana|carbonara|pasta|ragu|ragù|spaghetti|penne|lasagn|gnocchi|linguine|fettuc|rigatoni|pappardelle|orecchiette)/i,
    meal: { category: "Pasta" },
  },
  { re: /(burrata|caesar|salad|insalata|caprese|greens)/i, meal: { search: "salad" } },
  { re: /(branzino|salmon|fish|sea bass|tuna|shrimp|prawn|calamari|cod|halibut)/i, meal: { category: "Seafood" } },
  { re: /(arancini|risotto|rice|paella)/i, meal: { search: "risotto" } },
  { re: /(focaccia|bread|bruschetta|garlic|toast|crostini)/i, meal: { category: "Side" } },
  { re: /(steak|beef|bistecca|ribeye|burger|short rib)/i, meal: { category: "Beef" } },
  { re: /(chicken|pollo|parm)/i, meal: { category: "Chicken" } },
  { re: /(pork|porchetta|sausage|salsiccia)/i, meal: { category: "Pork" } },
  { re: /(lamb|agnello)/i, meal: { category: "Lamb" } },
  { re: /(soup|zuppa|minestrone|bisque)/i, meal: { search: "soup" } },
  // drinks
  { re: /negroni/i, drink: "negroni" },
  { re: /spritz|aperol/i, drink: "aperol spritz" },
  { re: /margarita/i, drink: "margarita" },
  { re: /mojito/i, drink: "mojito" },
  { re: /martini/i, drink: "martini" },
  { re: /old fashioned/i, drink: "old fashioned" },
  { re: /(chianti|wine|vino|rosso|bianco|prosecco|champagne|glass)/i, drink: "wine" },
  { re: /(beer|lager|ipa|birra)/i, drink: "beer" },
  { re: /(espresso|coffee|latte|cappuccino)/i, drink: "coffee" },
];

const cache = new Map<string, string[]>();

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function thumbs(key: string, url: string, pick: (d: unknown) => string[]): Promise<string[]> {
  if (cache.has(key)) return cache.get(key)!;
  try {
    const list = pick(await getJson(url)).filter(Boolean);
    cache.set(key, list);
    return list;
  } catch {
    cache.set(key, []);
    return [];
  }
}

const MEALDB = "https://www.themealdb.com/api/json/v1/1";
const COCKTAILDB = "https://www.thecocktaildb.com/api/json/v1/1";
type Meals = { meals?: Array<{ strMealThumb?: string }> | null };
type Drinks = { drinks?: Array<{ strDrinkThumb?: string }> | null };
const mealThumbs = (d: unknown) => ((d as Meals).meals ?? []).map((m) => m.strMealThumb ?? "");
const drinkThumbs = (d: unknown) => ((d as Drinks).drinks ?? []).map((m) => m.strDrinkThumb ?? "");

/** Stable, well-spread index for a string (FNV-1a). */
export function stableIndex(s: string, n: number): number {
  let h = 0x811c9dc5;
  for (const ch of s.toLowerCase()) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return n > 0 ? h % n : 0;
}

export async function resolveFoodImageUrl(item: string): Promise<string | null> {
  const name = item.replace(/\(.*?\)/g, "").trim();
  const family = FAMILIES.find((f) => f.re.test(name));

  // Drinks: TheCocktailDB by name, then the family query.
  if (family?.drink) {
    const exact = await thumbs(`d:${name}`, `${COCKTAILDB}/search.php?s=${encodeURIComponent(name)}`, drinkThumbs);
    if (exact.length) return exact[0];
    const fam = await thumbs(`d:${family.drink}`, `${COCKTAILDB}/search.php?s=${encodeURIComponent(family.drink)}`, drinkThumbs);
    return fam.length ? fam[stableIndex(name, fam.length)] : null;
  }

  // 1. The dish itself.
  const exact = await thumbs(`m:${name}`, `${MEALDB}/search.php?s=${encodeURIComponent(name)}`, mealThumbs);
  if (exact.length) return exact[0];
  if (!family?.meal) return null;

  // 2. A dish from its family, spread by name so siblings differ.
  const { category, search } = family.meal;
  const fam = category
    ? await thumbs(`c:${category}`, `${MEALDB}/filter.php?c=${encodeURIComponent(category)}`, mealThumbs)
    : await thumbs(`m:${search}`, `${MEALDB}/search.php?s=${encodeURIComponent(search!)}`, mealThumbs);
  return fam.length ? fam[stableIndex(name, fam.length)] : null;
}

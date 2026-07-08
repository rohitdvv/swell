import "server-only";

// Free food photography via TheMealDB (public test key "1", no signup).
// Used as a poster background when the restaurant's own site has no usable
// imagery. Cached per query for the life of the process.

const QUERY_MAP: Array<[RegExp, string]> = [
  [/pizza|margherita|marinara/i, "pizza"],
  [/tiramis|dessert|gelato|cannoli|panna|cake|torta/i, "tiramisu"],
  [/(cacio|bucatini|tagliatelle|amatriciana|carbonara|pasta|ragu|spaghetti|penne|lasagn|gnocchi|linguine)/i, "pasta"],
  [/(burrata|caesar|salad|insalata|caprese|greens)/i, "salad"],
  [/(branzino|salmon|fish|sea|tuna|shrimp|prawn|calamari)/i, "fish"],
  [/(arancini|risotto|rice|paella)/i, "rice"],
  [/(focaccia|bread|bruschetta|garlic|toast)/i, "bread"],
  [/(steak|beef|bistecca|ribeye|burger)/i, "beef"],
  [/(chicken|pollo|parm)/i, "chicken"],
  [/(soup|zuppa|minestrone|bisque)/i, "soup"],
];

const cache = new Map<string, string | null>();

export async function resolveFoodImageUrl(item: string): Promise<string | null> {
  const q = QUERY_MAP.find(([re]) => re.test(item))?.[1];
  if (!q) return null;
  if (cache.has(q)) return cache.get(q)!;
  try {
    const res = await fetch(
      `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) throw new Error("bad");
    const data = (await res.json()) as { meals?: Array<{ strMealThumb?: string }> };
    const url = data.meals?.[0]?.strMealThumb ?? null;
    cache.set(q, url);
    return url;
  } catch {
    cache.set(q, null);
    return null;
  }
}

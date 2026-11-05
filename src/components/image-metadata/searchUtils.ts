import { CATEGORIES, type Category, type MetadataRow } from "./metadataUtils";

export function searchMetadata(rows: MetadataRow[], query: string, category: Category | "All") {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = rows.filter(row => {
    const text = `${row.category} ${row.label} ${row.tag} ${row.value}`.toLowerCase();
    return terms.every(term => text.includes(term));
  });
  const counts = Object.fromEntries(CATEGORIES.map(value => [value, matches.filter(row => row.category === value).length])) as Record<Category, number>;
  return { rows: category === "All" ? matches : matches.filter(row => row.category === category), counts, total: matches.length };
}
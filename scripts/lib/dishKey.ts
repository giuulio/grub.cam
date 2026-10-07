/** Normalised dish name used to match the same dish across days: "Roast  Potatoes " ≡ "roast potatoes". */
export function dishKey(name: string): string {
  return name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

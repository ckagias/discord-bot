export function emptyToNull(value: FormDataEntryValue | null): string | null {
  const str = (value ?? "").toString().trim();
  return str === "" ? null : str;
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

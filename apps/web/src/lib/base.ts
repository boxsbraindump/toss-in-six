/** 静态资源前缀：GitHub Pages 部署在子路径下时为 "/toss-in-six"，本地为空 */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function asset(path: string): string {
  return `${BASE}${path}`;
}

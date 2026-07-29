export function buildPagination({
  page,
  limit,
  total,
}: {
  page?: number | undefined;
  limit?: number | undefined;
  total?: number | undefined;
}): {
  page: number | null;
  limit: number | null;
  total: number;
  pages: number | null;
} {
  if (page === undefined && limit === undefined) {
    return { page: null, limit: null, total: total ?? 0, pages: null };
  }

  const resolvedPage = page ?? 1;
  const resolvedLimit = limit ?? 10;
  const resolvedTotal = total ?? 0;

  return {
    page: resolvedPage,
    limit: resolvedLimit,
    total: resolvedTotal,
    pages: Math.ceil(resolvedTotal / resolvedLimit),
  };
}

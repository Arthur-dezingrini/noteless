/** Skeleton exibido durante a navegação; permite prefetch parcial das rotas dinâmicas. */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Carregando">
      <div className="h-7 w-64 rounded bg-line" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-card bg-white" />
        ))}
      </div>
      <div className="h-80 rounded-card bg-white" />
    </div>
  );
}

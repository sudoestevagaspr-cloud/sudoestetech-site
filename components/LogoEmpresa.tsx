// Logo da empresa ou, sem logo, um quadrado com as iniciais nas cores do site.
// O nome da empresa sempre aparece ao lado, então a imagem é decorativa (alt vazio).

export function LogoEmpresa({
  logoUrl,
  iniciais,
  tamanho = 48,
}: {
  logoUrl: string | null;
  iniciais: string;
  tamanho?: 48 | 64;
}) {
  const medida = tamanho === 64 ? "size-16 text-xl" : "size-12 text-base";
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        width={tamanho}
        height={tamanho}
        loading="lazy"
        decoding="async"
        className={`${medida} flex-none rounded-xl bg-white object-contain p-1`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${medida} grid flex-none place-items-center rounded-xl border-[1.5px] border-ciano bg-borda font-extrabold tracking-wide text-ciano`}
    >
      {iniciais}
    </span>
  );
}

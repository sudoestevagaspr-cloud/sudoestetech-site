import { ImageResponse } from "next/og";
import { lerVaga } from "@/lib/dados";
import { MONTSERRAT_600, MONTSERRAT_800 } from "@/lib/fontes-previa";

// Imagem da prévia ao compartilhar a vaga no WhatsApp e no Instagram:
// cargo, empresa e logo nas cores do site.

export const alt = "Vaga de TI no Sudoeste do Paraná";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Como a página da vaga: montada na primeira visita e guardada em cache.
export const revalidate = false;
export async function generateStaticParams() {
  return [];
}

const LOGO_DO_SITE = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI3MiIgaGVpZ2h0PSI3MiIgdmlld0JveD0iLTM2IC0zNiA3MiA3MiI+CiAgPGNpcmNsZSBjeD0iMCIgY3k9IjAiIHI9IjM0IiBmaWxsPSIjMEIxRjNBIi8+CiAgPHBvbHlnb24gcG9pbnRzPSItMTUsLTI4IC04LjUsLTI4IC0xLC04IC01LC04IiBmaWxsPSIjMjJEM0VFIi8+CiAgPHBvbHlnb24gcG9pbnRzPSI4LjUsLTI4IDE1LC0yOCA1LC04IDEsLTgiIGZpbGw9IiMwRUE1RTkiLz4KICA8cmVjdCB4PSItMTMiIHk9Ii04IiB3aWR0aD0iMjYiIGhlaWdodD0iMzMiIHJ4PSI0IiBmaWxsPSIjRjhGQUZDIi8+CiAgPHBhdGggZD0iTS05IC04IEg5IEE0IDQgMCAwIDEgMTMgLTQgVjEgSC0xMyBWLTQgQTQgNCAwIDAgMSAtOSAtOCBaIiBmaWxsPSIjMjJEM0VFIi8+CiAgPHJlY3QgeD0iLTgiIHk9IjUiIHdpZHRoPSIxNiIgaGVpZ2h0PSIxMCIgcng9IjEuNSIgZmlsbD0iIzFFMjkzQiIvPgogIDxyZWN0IHg9Ii0yIiB5PSIxNSIgd2lkdGg9IjQiIGhlaWdodD0iMyIgZmlsbD0iIzFFMjkzQiIvPgogIDxyZWN0IHg9Ii01IiB5PSIxOCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjIuNSIgcng9IjEiIGZpbGw9IiMxRTI5M0IiLz4KICA8Y2lyY2xlIGN4PSIwIiBjeT0iMCIgcj0iMzUiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzIyRDNFRSIgc3Ryb2tlLXdpZHRoPSIyIi8+Cjwvc3ZnPgo=";

function bytesDaFonte(base64: string): ArrayBuffer {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes.buffer;
}

/** O gerador da imagem só entende PNG e JPEG; logo em outro formato vira as iniciais. */
async function logoComoDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const resposta = await fetch(url);
    const tipo = resposta.headers.get("content-type") ?? "";
    if (!resposta.ok || !/^image\/(png|jpeg)/.test(tipo)) return null;
    const bytes = new Uint8Array(await resposta.arrayBuffer());
    let binario = "";
    for (let i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i]);
    return `data:${tipo.split(";")[0]};base64,${btoa(binario)}`;
  } catch {
    return null;
  }
}

export default async function ImagemDaVaga({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vaga = await lerVaga(slug);
  const logo = vaga ? await logoComoDataUri(vaga.logoUrl) : null;
  const cargo = vaga?.cargo ?? "Vagas de TI no Sudoeste do Paraná";
  const tamanhoDoCargo = cargo.length > 60 ? 52 : cargo.length > 35 ? 60 : 68;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0B1F3A",
          color: "#F1F5F9",
          fontFamily: "Montserrat",
          padding: "64px 72px",
          borderBottom: "16px solid #22D3EE",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          {vaga &&
            (logo ? (
              <img
                src={logo}
                alt=""
                width={150}
                height={150}
                style={{ borderRadius: 24, background: "#FFFFFF", objectFit: "contain", padding: 8 }}
              />
            ) : (
              <div
                style={{
                  width: 150,
                  height: 150,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 24,
                  border: "4px solid #22D3EE",
                  background: "#1E3A5F",
                  color: "#22D3EE",
                  fontSize: 60,
                  fontWeight: 800,
                }}
              >
                {vaga.iniciais}
              </div>
            ))}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
            <div style={{ display: "flex", fontSize: tamanhoDoCargo, fontWeight: 800, color: "#FFFFFF", lineHeight: 1.1 }}>
              {cargo}
            </div>
            {vaga && (
              <div style={{ display: "flex", fontSize: 38, fontWeight: 600, color: "#94A3B8" }}>{vaga.empresaNome}</div>
            )}
          </div>
        </div>

        {vaga && (
          <div style={{ display: "flex", gap: 16 }}>
            {[vaga.local, vaga.nivelNome].map((texto) => (
              <div
                key={texto}
                style={{
                  display: "flex",
                  padding: "10px 26px",
                  borderRadius: 999,
                  border: "3px solid #22D3EE",
                  fontSize: 30,
                  fontWeight: 600,
                }}
              >
                {texto}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={LOGO_DO_SITE} alt="" width={72} height={72} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 32, fontWeight: 800, color: "#FFFFFF" }}>Sudoeste Tech</div>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 600, color: "#22D3EE" }}>
              Vagas de TI no Sudoeste do Paraná
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Montserrat", data: bytesDaFonte(MONTSERRAT_800), weight: 800, style: "normal" },
        { name: "Montserrat", data: bytesDaFonte(MONTSERRAT_600), weight: 600, style: "normal" },
      ],
    },
  );
}

import { useState, useMemo, useEffect } from "react";
import Cards from "../components/cards";
import baseDados from "../data/baseDados.json";
import { MdContentCopy } from "react-icons/md";
import { FiEye, FiEyeOff, FiSearch } from "react-icons/fi";
import { normalizeText } from "../utils/text";

export default function DataFieldList() {
  const [copiado, setCopiado] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [campoAtivo, setCampoAtivo] = useState<number | null>(null);
  const [imagemAtiva, setImagemAtiva] = useState<string | null>(null);
  const [openImagem, setOpenImagem] = useState(false);
  const [fade, setFade] = useState<"in" | "out" | null>(null);

  useEffect(() => {
    if (!openImagem) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenImagem(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [openImagem]);

  // ====== ORDENAR ======
  const listaOrdenada = useMemo(() => {
    return [...baseDados].sort((a, b) =>
      normalizeText(a.label).localeCompare(normalizeText(b.label)),
    );
  }, []);

  // ====== FILTRAR ======
  const dadosFiltrados = useMemo(() => {
    if (!search) return listaOrdenada;

    const termo = normalizeText(search);
    return listaOrdenada.filter((item) =>
      normalizeText(item.label).includes(termo),
    );
  }, [search, listaOrdenada]);

  // ==========================
  //   VISUALIZAÇÃO COM ANIMAÇÃO
  // ==========================
  function toggleVisualizacao(index: number, img: string) {
    if (campoAtivo === index) {
      setFade("out");
      setTimeout(() => {
        setCampoAtivo(null);
        setImagemAtiva(null);
      }, 200);
      return;
    }

    if (imagemAtiva) {
      setFade("out");

      setTimeout(() => {
        setCampoAtivo(index);
        setImagemAtiva(img);
        setFade("in");
      }, 200);

      return;
    }

    setCampoAtivo(index);
    setImagemAtiva(img);
    setFade("in");
  }

  // ==========================
  // COPY
  // ==========================
  function copyVariaveis(value: string, index: number) {
    navigator.clipboard.writeText(value);
    setCopiado(String(index));
    setTimeout(() => setCopiado(null), 1000);
  }

  // ==========================
  // RESETAR AO DIGITAR  (com animação)
  // ==========================
  function handleSearch(value: string) {
    setSearch(value);

    if (imagemAtiva) {
      setFade("out");
      setTimeout(() => {
        setCampoAtivo(null);
        setImagemAtiva(null);
      }, 200);
    }
  }

  return (
    <>
      {openImagem && (
        <div
          className="fixed inset-0 z-999 flex items-center justify-center bg-black/70 backdrop-blur-md cursor-pointer"
          onClick={() => setOpenImagem(false)}
        >
          {/* Conteúdo do modal */}
          <div
            className="relative flex flex-col items-center gap-5 cursor-default fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {imagemAtiva && (
              <img
                src={imagemAtiva}
                alt="Pré-visualização"
                className="max-w-[90vw] max-h-[80vh] object-contain rounded-md shadow-lg"
              />
            )}

            <p className="text-[#f6a821] font-semibold select-none">
              Clique fora da imagem para fechar.
            </p>
          </div>
        </div>
      )}

      <Cards
        title="Campos de Dados Disponíveis"
        search={
          <div className="relative w-80">
            <FiSearch
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]"
              fontSize={15}
            />
            <input
              type="text"
              className="bg-[#13151a] border border-[#2a2f3a] rounded-[9px] text-[#e7e9ee] text-sm w-full py-2.5 pl-9 pr-3 outline-none focus:border-[#f6a821]"
              placeholder="Buscar Variáveis..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        }
      >
        <div className="grid grid-cols-[0.50fr_1fr] gap-4 w-full items-start">
          {/* LISTA */}
          <div className="space-y-1.5 h-[700px] overflow-y-scroll p-2 pr-3 custom-scrollbar">
            {dadosFiltrados.length === 0 && (
              <p className="text-xs p-2 text-[#7b828f] uppercase">
                Nenhum resultado encontrado
              </p>
            )}

            {dadosFiltrados.map((item, index) => {
              const ativo = campoAtivo === index;
              return (
                <div
                  key={item.value}
                  className={`relative flex justify-between items-center gap-3 px-3 py-2.5 rounded-[9px] transition duration-150 border ${ativo ? "bg-[#f6a821]/[0.12] border-[#f6a821]" : "border-[#222730] hover:bg-[#20252f]"}`}
                >
                  <p className="text-[12.5px] uppercase font-semibold tracking-[0.4px] text-[#e7e9ee] max-w-[260px]">
                    {item.label}
                  </p>

                  <div className="flex items-center gap-1">
                    {/* VISUALIZAR */}
                    <button
                      className="w-7 h-7 flex items-center justify-center rounded-[7px] cursor-pointer text-[#6b7280] hover:text-[#f6a821] hover:bg-[#262b35] transition"
                      onClick={() => toggleVisualizacao(index, item.imagem)}
                    >
                      {ativo ? (
                        <FiEye fontSize={16} />
                      ) : (
                        <FiEyeOff fontSize={16} />
                      )}
                    </button>

                    {/* COPIAR */}
                    <button
                      onClick={() => copyVariaveis(item.value, index)}
                      className="w-7 h-7 flex items-center justify-center rounded-[7px] cursor-pointer text-[#6b7280] hover:text-[#f6a821] hover:bg-[#262b35] transition"
                    >
                      <MdContentCopy fontSize={17} />
                    </button>
                  </div>

                  {copiado === String(index) && (
                    <span className="absolute right-20 top-1/2 -translate-y-1/2 text-xs text-[#f6a821]">
                      Copiado!
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* PRÉ-VISUALIZAÇÃO */}
          <div className="h-[700px]">
            <div className="h-full p-5 text-[#7b828f] items-center justify-center bg-[#13151a] border border-[#242a34] rounded-xl flex flex-col">
              {imagemAtiva ? (
                <div
                  className={`flex flex-col gap-5 items-center transition-opacity duration-300 ${
                    fade === "in"
                      ? "opacity-100"
                      : fade === "out"
                        ? "opacity-0"
                        : "opacity-0"
                  }`}
                >
                  <p className="text-[#f6a821] text-sm text-center">
                    Representação visual do cadastro do produto no sistema ATAK
                  </p>

                  <img
                    src={imagemAtiva}
                    alt="Pré-visualização"
                    className="max-w-full max-h-[600px] object-contain cursor-pointer rounded-md"
                    onClick={() => setOpenImagem(true)}
                  />
                </div>
              ) : (
                <p className="flex flex-col justify-center items-center text-center gap-2 transition-opacity duration-300 opacity-70">
                  Referência visual da variável no sistema
                  <span className="italic text-[#5a616d] text-sm w-full flex gap-2 justify-center items-center">
                    Clique no ícone
                    <FiEyeOff fontSize={16} />
                    para visualizar aqui.
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>
      </Cards>
    </>
  );
}

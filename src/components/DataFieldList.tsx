import { useState, useMemo } from "react";
import Cards from "../components/cards";
import baseDados from "../data/baseDados.json";
import { MdContentCopy } from "react-icons/md";
import { FiEye, FiEyeOff } from "react-icons/fi";

export default function DataFieldList() {
  const [copiado, setCopiado] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [campoAtivo, setCampoAtivo] = useState<number | null>(null);
  const [imagemAtiva, setImagemAtiva] = useState<string | null>(null);
  const [openImagem, setOpenImagem] = useState(false)
  const [fade, setFade] = useState<"in" | "out" | null>(null);

  // ====== NORMALIZAR ======
  const normalizeText = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  // ====== ORDENAR ======
  const listaOrdenada = useMemo(() => {
    return [...baseDados].sort((a, b) =>
      normalizeText(a.label).localeCompare(normalizeText(b.label))
    );
  }, []);

  // ====== FILTRAR ======
  const dadosFiltrados = useMemo(() => {
    if (!search) return listaOrdenada;

    const termo = normalizeText(search);
    return listaOrdenada.filter(item =>
      normalizeText(item.label).includes(termo)
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
          className="fixed inset-0 z-999 flex items-center justify-center bg-black/70 backdrop-blur-md cursor-pointer" onClick={() => setOpenImagem(false)} >
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

            <p className="text-amber-300 font-semibold select-none">
              Clique fora da imagem para fechar.
            </p>
          </div>
        </div>
      )}

      <Cards
        title="Campos de Dados Disponíveis"
        seach={
          <div className="bg-gray-900 border-gray-700">
            <input
              type="text"
              className="bg-gray-800 rounded-tr-md border-gray-600 text-white text-sm font-light w-sm py-2 px-3 shadow-xs outline-none"
              placeholder="Buscar Variáveis..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        }
      >
        <div className="flex gap-3.5 w-full">
          {/* LISTA */}
          <div className="space-y-1 h-[700px] w-[580px] overflow-y-scroll p-2 custom-scrollbar">
            {dadosFiltrados.length === 0 && (
              <p className="text-xs p-2 text-gray-400 uppercase">
                Nenhum resultado encontrado
              </p>
            )}

            {dadosFiltrados.map((item, index) => (
              <div
                key={index}
                className="relative flex justify-between items-center p-3 rounded-lg hover:bg-gray-800 transition duration-150 border-b border-gray-800 w-[360px]"
              >
                <p className="text-[11px] uppercase font-medium text-yellow-400 max-w-55">
                  {item.label}
                </p>

                <div className="flex items-center gap-2">
                  {/* VISUALIZAR */}
                  <button
                    className="cursor-pointer hover:text-yellow-400"
                    onClick={() => toggleVisualizacao(index, item.imagem)}
                  >
                    {campoAtivo === index ? (
                      <FiEye fontSize={17} />
                    ) : (
                      <FiEyeOff fontSize={17} />
                    )}
                  </button>

                  {/* COPIAR */}
                  <button
                    onClick={() => copyVariaveis(item.value, index)}
                    className="cursor-pointer hover:text-yellow-400"
                  >
                    <MdContentCopy fontSize={20} />
                  </button>
                </div>

                {copiado === String(index) && (
                  <span className="absolute right-17 top-1/2 -translate-y-1/2 text-xs text-yellow-400">
                    Copiado!
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* PRÉ-VISUALIZAÇÃO */}
          <div className="w-full">
            <div className="h-full p-5 text-gray-500 items-center justify-center border border-gray-600 rounded-br-lg flex flex-col">
              {imagemAtiva ? (
                <div
                  className={`flex flex-col gap-5 items-center transition-opacity duration-300 ${fade === "in"
                    ? "opacity-100"
                    : fade === "out"
                      ? "opacity-0"
                      : "opacity-0"
                    }`}
                >
                  <p className="text-yellow-400">
                    Representação visual do cadastro do produto no sistema ATAK
                  </p>

                  <img
                    src={imagemAtiva}
                    alt="Pré-visualização"
                    className="max-w-full max-h-[650px] object-contain cursor-pointer"
                    onClick={() => setOpenImagem(true)}
                  />
                </div>
              ) : (
                <p className="flex flex-col justify-center items-center text-center gap-2 transition-opacity duration-300 opacity-70">
                  Referência visual da variável no sistema
                  <span className="italic text-gray-600 text-sm w-full flex gap-2">
                    Clique no ícone
                    <FiEyeOff fontSize={17} />
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

import { Upload, Download } from "lucide-react";
import Cards from "../components/cards";
import { useRef, useState } from "react";
import { IoIosAddCircle, IoIosRemoveCircle } from "react-icons/io";

interface InputNovo {
  id: number;
  nomeDoArquivo: string;
  conteudo: string;
  nomeImagem: string;
}

export default function CardCompiladorImg() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nomeArquivoOriginal, setNomeArquivoOriginal] = useState("");
  const [conteudoOriginal, setConteudoOriginal] = useState("");
  const [inputsNovos, setInputsNovos] = useState<InputNovo[]>([]);
  const [comentario, setComentario] = useState("");

  // Ler arquivo .txt
  function lerArquivo(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  // Ler arquivo original
  async function handleFileOriginalChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setNomeArquivoOriginal(file.name);
      const texto = await lerArquivo(file);
      setConteudoOriginal(texto);
    }
  }

  // Criar novo input
  function createInputs() {
    setInputsNovos(prev => [
      ...prev,
      { id: Date.now(), nomeDoArquivo: "", conteudo: "", nomeImagem: "" }
    ]);
  }

  // Atualizar nome da imagem digitado pelo usuário
  function atualizarNomeImagem(id: number, valor: string) {
    setInputsNovos(prev =>
      prev.map(input =>
        input.id === id ? { ...input, nomeImagem: valor } : input
      )
    );
  }

  // Ler arquivo novo
  async function handleChangeNovoInput(id: number, file?: File) {
    if (!file) return;

    const texto = await lerArquivo(file);

    setInputsNovos(prev =>
      prev.map(input =>
        input.id === id
          ? { ...input, nomeDoArquivo: file.name, conteudo: texto }
          : input
      )
    );
  }

  function baixarArquivoFinal() {
    const algumInputSemNome = inputsNovos.some(
      input => !input.nomeImagem || input.nomeImagem.trim() === ""
    );

    if (!fileInputRef.current?.files?.length) {
      alert("Selecione o arquivo original antes de continuar.");
      return;
    }
    if (inputsNovos.length === 0) {
      alert("É necessário adicionar pelo menos uma nova imagem.");
      return;
    }
    if (!comentario.trim()) {
      alert("Comentário obrigatório. Por favor, preencha.");
      return;
    }
    if (algumInputSemNome) {
      alert("Preencha a chamada de todas as imagens adicionadas.");
      return;
    }

    let textoFinal = conteudoOriginal.trim() + "\n\n";
    textoFinal += `/////////////////////////// ${comentario.trim()} ///////////////////////////\n\n`;
    inputsNovos.forEach(input => {
      const blocosDG = input.conteudo.match(/~DG[\s\S]*?(?=\^XA|$)/g);
      if (blocosDG) {
        blocosDG.forEach(bloco => {
          let blocoLimpo = bloco.trim();
          blocoLimpo = blocoLimpo.replace(
            /~DG[^,]+/,
            `~DG${input.nomeImagem}`
          );
          textoFinal += blocoLimpo + "\n\n";
        });
      }
    });

    const blob = new Blob([textoFinal], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ATUALIZADO_${fileInputRef.current?.files?.[0].name}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 select-none">
      <Cards
        title="Campilador de arquivos"
        seach={
          <>
            <div className="flex gap-1 items-center">
              <label htmlFor="comentarioLabel" className="text-gray-200">Comentário dentro do arquivo:</label>
              <input
                type="text"
                id="comentarioLabel"
                className="flex items-center justify-between py-1 px-2 bg-gray-800 border rounded-sm border-gray-700 hover:bg-gray-700 transition text-[12px] font-light outline-none text-gray-200"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1">
              <IoIosAddCircle
                fontSize={25}
                className="cursor-pointer text-gray-200 hover:text-gray-300 active:scale-90"
                onClick={createInputs}
              />
              <IoIosRemoveCircle
                fontSize={25}
                className="cursor-pointer text-gray-200 hover:text-gray-300 active:scale-90"
                onClick={() => setInputsNovos(prev => prev.slice(0, -1))}
              />
            </div>
          </>
        }
      >
        <div className="flex flex-col gap-6 w-full">
          {/* Input original */}
          <div className="flex flex-row items-end gap-5">
            <div className="flex flex-col gap-2 w-full">
              <label className="text-sm font-semibold text-gray-200">
                Arquivo original (produção)
              </label>

              <div className="flex justify-between gap-5">
                <label className="flex items-center justify-between p-3 bg-gray-800 rounded-md border border-gray-700 cursor-pointer hover:bg-gray-700 transition w-full">
                  <span className="flex text-[13px] items-center gap-2 text-gray-200">
                    <Upload className="w-5 h-5 text-gray-400" />
                    {nomeArquivoOriginal || "Selecionar arquivo"}
                  </span>

                  <input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileOriginalChange}
                  />
                </label>

                <button
                  onClick={baixarArquivoFinal}
                  className="w-full md:w-[270px] px-5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md flex items-center justify-center gap-2 transition shadow-md text-[14px] cursor-pointer"
                >
                  <Download className="w-5 h-5" />
                  Baixar Modificado
                </button>
              </div>
            </div>
          </div>

          {/* Inputs dinâmicos */}
          <div className="flex flex-col gap-4 bg-gray-900/40 rounded-bl-lg p-4 border border-gray-700 h-80 overflow-y-scroll custom-scrollbar">

            {inputsNovos.map(input => (
              <div key={input.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-200">
                    Arquivo imagens novas
                  </label>
                  <div className="flex items-center gap-1 text-[13px]">
                    <label>Chamada da imagem:</label>
                    <input
                      type="text"
                      className="py-1 text-[12px] font-light outline-none text-gray-200 border-b bg-transparent"
                      value={input.nomeImagem}
                      onChange={(e) => atualizarNomeImagem(input.id, e.target.value)}
                    />
                  </div>
                </div>

                <label className="flex items-center justify-between p-3 bg-gray-800 rounded-md border border-gray-700 cursor-pointer hover:bg-gray-700 transition text-[13px] mt-1">
                  <span className="flex items-center gap-2 text-gray-200">
                    <Upload className="w-5 h-5 text-gray-400" />
                    {input.nomeDoArquivo || "Selecionar arquivo"}
                  </span>

                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) =>
                      handleChangeNovoInput(input.id, e.target.files?.[0])
                    }
                  />
                </label>
              </div>
            ))}
          </div>
        </div>
      </Cards>
    </div>
  );
}

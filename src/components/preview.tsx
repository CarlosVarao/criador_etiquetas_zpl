import React, { useState, useEffect, useCallback, useRef } from "react";
import Cards from "./cards";
import { SyncLoader } from "react-spinners";
import DropdownSearch from "./DropdownSearch";

interface Variable {
  id: string;
  originalValue: string;
  value: string;
  index: number;
  x: number;
  y: number;
  type: 'image' | 'barcode';
  isChecked?: boolean;
  imageName?: string;
}

const imageVariableRegex = /(\^FO(\d+),(\d+).*?)(\^XG([A-Z]+),)/gs;
const barcodeVariableRegex = /\^FT(\d+),(\d+)\^BE[A-Z],(\d+),[A-Z],[A-Z]\^FD(.*?)\^FS/gs;

const generateUniqueId = () => Math.random().toString(36).substring(2, 9);

const extractImageDefinitions = (content: string): string => {
  const imageDefRegex = /~DG[\s\S]*?\^XA/;
  const match = content.match(imageDefRegex);
  return match ? match[0] : "";
};

const getImageDefinitionByName = (imageDefinitions: string, imageName: string): string => {
  const escapedImageName = imageName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(~DG${escapedImageName}[\\s\\S]*?(?=~DG|\\^XA|\\^XZ))`, 'i');
  const match = imageDefinitions.match(regex);
  return match ? match[1] : "";
};

const extractVariables = (content: string): Variable[] => {
  const variables: Variable[] = [];
  let globalIndex = 0;

  const imageMatches = Array.from(content.matchAll(imageVariableRegex));
  imageMatches.forEach((match) => {
    const imageName = match[5] || "";
    variables.push({
      id: generateUniqueId(),
      x: parseInt(match[2], 10),
      y: parseInt(match[3], 10),
      originalValue: match[5] || "",
      value: match[5] || "",
      index: globalIndex++,
      type: 'image',
      isChecked: false,
      imageName: imageName,
    });
  });

  const barcodeMatches = Array.from(content.matchAll(barcodeVariableRegex));
  barcodeMatches.forEach((match) => {
    variables.push({
      id: generateUniqueId(),
      x: parseInt(match[1], 10),
      y: parseInt(match[2], 10),
      originalValue: match[4] || "",
      value: match[4] || "",
      index: globalIndex++,
      type: 'barcode',
    });
  });

  const barcodes = variables.filter(v => v.type === 'barcode')
    .sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });

  const images = variables.filter(v => v.type === 'image')
    .sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });

  const sortedVariables = [...barcodes, ...images];
  sortedVariables.forEach((v, i) => v.index = i);

  return sortedVariables;
};

const reorderPrnContent = (content: string): string => {
  const lines = content.split('\n');
  const mnyIndex = lines.findIndex(line => line.includes('^MNY'));

  if (mnyIndex === -1) {
    return content;
  }

  const xgLines: string[] = [];
  const otherLines: string[] = [];

  lines.forEach((line, index) => {
    if (index <= mnyIndex) {
      otherLines.push(line);
    } else if (line.includes('^XG')) {
      xgLines.push(line);
    } else {
      otherLines.push(line);
    }
  });

  const insertIndex = mnyIndex + 1;
  const result = [
    ...otherLines.slice(0, insertIndex),
    ...xgLines,
    ...otherLines.slice(insertIndex),
  ];

  return result.join('\n');
};

const useDebounce = (callback: (...args: unknown[]) => void, delay: number) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return useCallback(
    (...args: unknown[]) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => callback(...args), delay);
    },
    [callback, delay]
  );
};

const useImageDimensions = () => {
  const [imageRect, setImageRect] = useState<DOMRect | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const updateDimensions = useCallback(() => {
    if (imgRef.current) {
      setImageRect(imgRef.current.getBoundingClientRect());
    }
  }, []);

  useEffect(() => {
    window.addEventListener("resize", updateDimensions);
    window.addEventListener("scroll", updateDimensions);
    return () => {
      window.removeEventListener("resize", updateDimensions);
      window.removeEventListener("scroll", updateDimensions);
    };
  }, [updateDimensions]);

  return { imgRef, imageRect, updateDimensions };
};

interface LabelOverlayProps {
  variables: Variable[];
  activeVariableId: string | null;
  imageRect: DOMRect | null;
  dpmm: number;
  width: number;
  height: number;
}

const LabelOverlay: React.FC<LabelOverlayProps> = ({
  variables,
  activeVariableId,
  imageRect,
  dpmm,
  width,
  height,
}) => {
  if (!activeVariableId || !imageRect || imageRect.width === 0) return null;

  const activeVariable = variables.find((v) => v.id === activeVariableId);
  if (!activeVariable) return null;

  const dpi = dpmm * 25.4;
  const scaleX = imageRect.width / (width * dpi);
  const scaleY = imageRect.height / (height * dpi);

  let leftPx, topPx;

  if (activeVariable.type === 'barcode') {
    leftPx = (activeVariable.x) * scaleX;
    topPx = (activeVariable.y - 50) * scaleY;
  } else {
    leftPx = (activeVariable.x - 13) * scaleX;
    topPx = (activeVariable.y + 75) * scaleY;
  }

  return (
    <div className="absolute z-999 pointer-events-none flex items-center justify-center min-w-5 min-h-5 px-1 py-[3px]
    rounded-md font-bold text-[12px] text-black whitespace-nowrap bg-[rgba(255,230,0,0.45)] border-2 border-black
    shadow-[0_0_10px_rgba(0,0,0,0.6)] "
      style={{
        top: topPx,
        left: leftPx,
      }}
    >
      <span className="bg-yellow-400 text-black px-1.5 py-px rounded text-[10px] shadow">
        X
      </span>
    </div>
  );
};

const cleanZplForDownload = (zpl: string, variables: Variable[], imageDefinitions: string) => {
  let cleaned = zpl;

  cleaned = cleaned.replace(
    /\^FD(.*?)\^FS/gs,
    (p1) => `^FD${p1.replace(/_5f/g, "_")}^FS`
  );
  cleaned = cleaned.replace(/\^XA\s*\^ID.*?\^FS\s*\^XZ\s*/gs, "");
  cleaned = cleaned.replace(/~DG[\s\S]*?\^XA/gs, "^XA");
  cleaned = cleaned.replace(/(\^BE[A-Z],\d+,)N(,[A-Z])/g, '$1Y$2');

  const checkedImageNames = variables
    .filter(v => v.type === 'image' && v.isChecked && v.imageName)
    .map(v => v.imageName!.trim());

  if (checkedImageNames.length > 0) {
    let imageDefinitionsToInsert = "\n";

    const uniqueCheckedImageNames = Array.from(new Set(checkedImageNames));

    uniqueCheckedImageNames.forEach(imageName => {
      const definition = getImageDefinitionByName(imageDefinitions, imageName);
      if (definition) {
        imageDefinitionsToInsert += definition.replace(/[\^XA\^XZ]/g, '') + "\n";
      }
    });

    if (imageDefinitionsToInsert.trim()) {
      // Insere logo após o ^XA e antes do ^PRB^FS.
      // Modificado para casar especificamente com ^XA^PRB^FS para manter as definições em cima dessa sequência.
      const insertionPointRegex = /(\^XA)(\^PRB\^FS)/;

      if (cleaned.match(insertionPointRegex)) {
        cleaned = cleaned.replace(insertionPointRegex,
          (_, xa, prbfs) => `${xa}${imageDefinitionsToInsert}${prbfs}`
        );
      } else if (cleaned.includes('^XA')) {
        // Fallback: Se tiver ^XA mas não tiver ^PRB^FS, insere logo após o primeiro ^XA
        cleaned = cleaned.replace(/(\^XA)/, `$1${imageDefinitionsToInsert}`);
      }
    }
  }

  return cleaned;
};


export default function Preview() {
  const [originalContent, setOriginalContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [variables, setVariables] = useState<Variable[]>([]);
  const [activeVariableId, setActiveVariableId] = useState<string | null>(null);
  const [variaveis, setVariaveis] = useState(false);
  const [searchVariaveis, setSearchVariaveis] = useState<
    Record<string, string>
  >({});
  const [imageDefinitions, setImageDefinitions] = useState<string>("");

  const { imgRef, imageRect, updateDimensions } = useImageDimensions();

  const variableRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dpmm, setDpmm] = useState(8);
  const [width, setWidth] = useState(4);
  const [height, setHeight] = useState(6);

  const [previewUrl, setPreviewUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setVariableRef = useCallback(
    (node: HTMLDivElement | null, id: string) => {
      if (node) variableRefs.current.set(id, node);
      else variableRefs.current.delete(id);
    },
    []
  );

  const handleFocus = (id: string) => {
    setActiveVariableId(id);
    const node = variableRefs.current.get(id);
    node?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const generateZplWithCurrentValues = useCallback(() => {
    if (!originalContent || variables.length === 0) return "";

    let result = originalContent;

    const imageVarsMap = new Map(
      variables.filter(v => v.type === 'image').map(v => [v.originalValue, v])
    );

    const barcodeVarsMap = new Map(
      variables.filter(v => v.type === 'barcode').map(v => [v.originalValue, v])
    );

    result = result.replace(/\^XG(.*?)(?=,)/gs, (match, captured) => {
      const v = imageVarsMap.get(captured);
      return v && v.value ? `^XG${v.value}` : match;
    });

    result = result.replace(/(\^FT\d+,\d+\^BE[A-Z],\d+,[A-Z],[A-Z]\^FD)(.*?)(\^FS)/gs, (match, prefix, fdValue, suffix) => {
      const v = barcodeVarsMap.get(fdValue);
      if (!v || !v.value) return match;
      return `${prefix}${v.value}${suffix}`;
    });

    return result;
  }, [originalContent, variables]);

  const renderLabelPreview = useCallback(async () => {
    const zpl = generateZplWithCurrentValues();
    if (!zpl) return;

    const apiUrl = `https://api.labelary.com/v1/printers/${dpmm}dpmm/labels/${width}x${height}/0/`;

    setIsLoading(true);
    setError(null);
    setPreviewUrl("");

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Accept: "image/png",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: zpl,
      });

      if (!response.ok) throw new Error(await response.text());

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setVariaveis(true);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Erro desconhecido ao gerar imagem";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [dpmm, width, height, generateZplWithCurrentValues]);

  const debouncedRenderPreview = useDebounce(renderLabelPreview, 500);

  useEffect(() => {
    if (originalContent) debouncedRenderPreview();
  }, [variables, dpmm, width, height, originalContent, debouncedRenderPreview]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);
    setActiveVariableId(null);

    const reader = new FileReader();

    reader.onload = (e) => {
      const rawContent = e.target?.result as string;
      const reorderedContent = reorderPrnContent(rawContent);

      const imgDefs = extractImageDefinitions(rawContent);
      setImageDefinitions(imgDefs);

      setOriginalContent(reorderedContent);
      setVariables(extractVariables(reorderedContent));
    };

    reader.onerror = () => {
      setError("Erro ao ler o arquivo.");
      setOriginalContent("");
      setVariables([]);
    };

    reader.readAsText(file);
  };

  const handleVariableChange = (id: string, valor: string) => {
    setSearchVariaveis((prev) => ({
      ...prev,
      [id]: valor,
    }));

    setVariables((prev) =>
      prev.map((v) => (v.id === id ? { ...v, value: valor } : v))
    );
  };

  const handleCheckboxChange = (id: string, checked: boolean) => {
    setVariables((prev) =>
      prev.map((v) => {
        if (v.id === id) {
          if (checked && v.imageName) {
            const imageDefinition = getImageDefinitionByName(imageDefinitions, v.imageName);
            console.log(`Checkbox marcado para: ${v.imageName}`);
            console.log(`Definição da imagem:\n${imageDefinition}`);
          }
          return { ...v, isChecked: checked };
        }
        return v;
      })
    );
  };

  const handleSubmit = () => {
    const zpl = generateZplWithCurrentValues();
    if (!zpl) return setError("Nada para processar.");

    const finalContent = cleanZplForDownload(zpl, variables, imageDefinitions);

    const fileExtension = fileName.split(".").pop();
    const newFileName = fileName.replace(
      `.${fileExtension}`,
      `-MODIFICADO.${fileExtension}`
    );

    const blob = new Blob([finalContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = newFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setError(null);
  };

  return (
    <>
      <div className="w-full mb-12">
        <h2 className="text-xl font-bold text-gray-200 px-2 mb-2">
          Pré-visualização
        </h2>
        <div className="flex flex-col  gap-8">
          <div className="flex gap-6 space-y-6">
            <div className="w-full flex justify-between flex-col gap-5 m-0">
              <div className="min-h-[400px] flex items-center justify-center bg-gray-800 border-2 border-gray-600 rounded-xl shadow-xl overflow-hidden custom-scrollbar">
                {isLoading ? (
                  <SyncLoader color="#f0b100" />
                ) : error && !previewUrl ? (
                  <p className="text-red-400 p-8 text-center">{error}</p>
                ) : previewUrl ? (
                  <div className="w-full h-[700px] flex items-center justify-center relative overflow-auto">
                    <div className="relative inline-block border border-gray-600 shadow-2xl">
                      <img
                        ref={imgRef}
                        src={previewUrl}
                        onLoad={updateDimensions}
                        alt="Etiqueta ZPL"
                        className="block max-w-full max-h-[680px]"
                      />
                      <LabelOverlay
                        variables={variables}
                        activeVariableId={activeVariableId}
                        imageRect={imageRect}
                        dpmm={dpmm}
                        width={width}
                        height={height}
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-gray-700/50 transition-colors"
                  >
                    <p className="text-gray-500 italic p-6">
                      Carregue um arquivo ZPL.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <Cards title="Configuração (Tamanho deve bater com o ZPL)">
                  <div className="flex flex-wrap justify-around">
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-gray-400 block">
                        DPMM:
                      </label>
                      <input
                        type="text"
                        value={dpmm}
                        onChange={(e) => setDpmm(Number(e.target.value))}
                        className="w-20 text-center bg-gray-700 border border-gray-600 rounded text-white"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-gray-400 block">
                        Largura (pol):
                      </label>
                      <input
                        type="text"
                        value={width}
                        onChange={(e) => setWidth(Number(e.target.value))}
                        className="w-20 text-center bg-gray-700 border border-gray-600 rounded text-white"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-gray-400 block">
                        Altura (pol):
                      </label>
                      <input
                        type="text"
                        value={height}
                        onChange={(e) => setHeight(Number(e.target.value))}
                        className="w-20 text-center bg-gray-700 border border-gray-600 rounded text-white"
                      />
                    </div>
                  </div>
                </Cards>
              </div>
            </div>

            <div className="flex flex-col w-[70%] justify-between gap-6">
              <Cards title="Variáveis">
                <div
                  className={`transition-all duration-500 ease-in-out overflow-hidden ${variaveis
                    ? "max-h-[800px] opacity-100"
                    : "max-h-0 opacity-0"
                    }`}
                >
                  {variaveis && (
                    <div className={`flex flex-col overflow-y-scroll pr-3 custom-scrollbar gap-4 ${variables.length < 4 ? "min-h-[530px]" : "max-h-[530px]"
                      }`}>
                      {variables.map((v, index) => (
                        <div
                          key={v.id}
                          ref={(node) => setVariableRef(node, v.id)}
                          className={`flex flex-col space-y-1 p-3 rounded-lg border cursor-pointer ${v.id === activeVariableId
                            ? "border-yellow-600 bg-yellow-700/30"
                            : "border-gray-700 bg-gray-800"
                            }`}
                          onClick={() => handleFocus(v.id)}
                        >
                          <label className="text-xs font-bold text-yellow-500 flex justify-between">
                            <span>
                              {v.type === 'image' ? '🖼️ IMAGEM' : '📊 CÓDIGO DE BARRAS'} {index + 1}
                            </span>

                            <p className="text-[9px] text-gray-500">
                              <span className="mr-1">Posição</span>
                              <span>
                                (X: {v.x} | Y: {v.y})
                              </span>
                            </p>
                          </label>
                          <div className="flex justify-between items-center gap-4 overflow-visible">
                            {v.type === 'image' && (
                              <input
                                type="checkbox"
                                checked={v.isChecked || false}
                                onChange={(e) => handleCheckboxChange(v.id, e.target.checked)}
                                className="w-5 h-5 cursor-pointer accent-yellow-500"
                              />
                            )}
                            <input
                              type="text"
                              value={searchVariaveis[v.id] || ""}
                              placeholder={v.type === 'barcode' ? 'Ex: 123456789012' : 'Insira a variável'}
                              onChange={(e) =>
                                handleVariableChange(v.id, e.target.value)
                              }
                              onFocus={() => handleFocus(v.id)}
                              onBlur={() => setActiveVariableId(null)}
                              className="h-10 uppercase px-2 w-full truncate bg-gray-900 border text-[11px] border-gray-600 rounded text-white focus:border-yellow-600 outline-none"
                            />
                            <DropdownSearch
                              onSelect={(value) =>
                                handleVariableChange(v.id, value)
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Cards>

              <Cards title="Upload Arquivo" seach={fileInputRef.current?.files?.[0]?.name}>
                <label className="h-full flex flex-col items-center justify-center text-sm p-4 border-2 border-dashed border-yellow-400 rounded cursor-pointer hover:bg-gray-800">
                  <span className="text-yellow-400 font-semibold">
                    Carregar ZPL
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={handleSubmit}
                  className="mt-4 w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded"
                >
                  Baixar Modificado
                </button>
              </Cards>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

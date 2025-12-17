import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Cards from "./cards";
import { SyncLoader } from "react-spinners";
import DropdownSearch from "./DropdownSearch";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface Variable {
  id: string;
  originalValue: string;
  value: string;
  index: number;
  x: number;
  y: number;
  type: 'image' | 'barcode' | 'text';
  isChecked?: boolean;
  imageName?: string;
}

interface LabelConfig {
  dpmm: number;
  width: number;
  height: number;
}

interface LabelOverlayProps {
  variables: Variable[];
  activeVariableId: string | null;
  imageRect: DOMRect | null;
  config: LabelConfig;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEBOUNCE_DELAY = 500;
const DEFAULT_CONFIG: LabelConfig = { dpmm: 8, width: 5, height: 6 };

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const generateUniqueId = (): string =>
  Math.random().toString(36).substring(2, 9);

const sortByPosition = (a: Variable, b: Variable): number => {
  if (a.y !== b.y) return a.y - b.y;
  return a.x - b.x;
};

// ============================================================================
// ZPL PROCESSING FUNCTIONS
// ============================================================================

const extractImageDefinitions = (content: string): string => {
  const regex = /~DG[\s\S]*?\^XA/;
  const match = content.match(regex);
  return match?.[0] ?? "";
};

const getImageDefinitionByName = (
  imageDefinitions: string,
  imageName: string
): string => {
  const escapedName = imageName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(~DG${escapedName}[\\s\\S]*?(?=~DG|\\^XA|\\^XZ))`, 'i');
  const match = imageDefinitions.match(regex);
  return match?.[1] ?? "";
};

const extractVariables = (content: string): Variable[] => {
  const variables: Variable[] = [];
  let globalIndex = 0;

  // Regex patterns
  const imageRegex = /(\^FO(\d+),(\d+).*?)(\^XG([A-Z]+),)/gs;
  const barcodeRegex = /\^FT(\d+),(\d+)\^BE[A-Z],(\d+),[A-Z],[A-Z]\^FD(.*?)\^FS/gs;
  const allFdRegex = /\^FT(\d+),(\d+).*?\^FD(.*?)\^FS/gs;

  // Extract images
  const imageMatches = Array.from(content.matchAll(imageRegex));
  imageMatches.forEach((match) => {
    const imageName = match[5] || "";
    variables.push({
      id: generateUniqueId(),
      x: parseInt(match[2], 10),
      y: parseInt(match[3], 10),
      originalValue: imageName,
      value: imageName,
      index: globalIndex++,
      type: 'image',
      isChecked: false,
      imageName,
    });
  });

  // Extract barcodes (track positions)
  const barcodePositions = new Set<string>();
  const barcodeMatches = Array.from(content.matchAll(barcodeRegex));
  barcodeMatches.forEach((match) => {
    const x = parseInt(match[1], 10);
    const y = parseInt(match[2], 10);
    barcodePositions.add(`${x},${y}`);

    variables.push({
      id: generateUniqueId(),
      x,
      y,
      originalValue: match[4] || "",
      value: match[4] || "",
      index: globalIndex++,
      type: 'barcode',
    });
  });

  // Extract ALL ^FD...^FS (skip barcode positions)
  const allFdMatches = Array.from(content.matchAll(allFdRegex));
  allFdMatches.forEach((match) => {
    const x = parseInt(match[1], 10);
    const y = parseInt(match[2], 10);
    const posKey = `${x},${y}`;

    // Skip if it's a barcode position
    if (!barcodePositions.has(posKey)) {
      variables.push({
        id: generateUniqueId(),
        x,
        y,
        originalValue: match[3] || "",
        value: match[3] || "",
        index: globalIndex++,
        type: 'text',
      });
    }
  });

  // Sort by type and position
  const barcodes = variables.filter(v => v.type === 'barcode').sort(sortByPosition);
  const images = variables.filter(v => v.type === 'image').sort(sortByPosition);
  const texts = variables.filter(v => v.type === 'text').sort(sortByPosition);

  const sorted = [...barcodes, ...images, ...texts];
  sorted.forEach((v, i) => v.index = i);

  return sorted;
};

const reorderPrnContent = (content: string): string => {
  const lines = content.split('\n');
  const mnyIndex = lines.findIndex(line => line.includes('^MNY'));

  if (mnyIndex === -1) return content;

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
  return [
    ...otherLines.slice(0, insertIndex),
    ...xgLines,
    ...otherLines.slice(insertIndex),
  ].join('\n');
};

const cleanZplForDownload = (
  zpl: string,
  variables: Variable[],
  imageDefinitions: string
): string => {
  let cleaned = zpl;

  cleaned = cleaned.replace(/\^FD(.*?)\^FS/gs, (match) => match.replace(/_5f/g, "_"));
  cleaned = cleaned.replace(/\^XA\s*\^ID.*?\^FS\s*\^XZ\s*/gs, "");
  cleaned = cleaned.replace(/~DG[\s\S]*?\^XA/gs, "^XA");
  cleaned = cleaned.replace(/(\^BE[A-Z],\d+,)N(,[A-Z])/g, '$1Y$2');

  const checkedImages = variables.filter(
    v => v.type === 'image' && v.isChecked && v.imageName
  );

  if (checkedImages.length > 0) {
    let imageDefinitionsToInsert = "\n";

    const uniqueChecked = Array.from(new Set(checkedImages.map(v => v.id)))
      .map(id => checkedImages.find(v => v.id === id)!);

    uniqueChecked.forEach(v => {
      const originalName = v.imageName!.trim();
      const newName = v.value.trim();

      let definition = getImageDefinitionByName(imageDefinitions, originalName);

      if (definition) {
        definition = definition.replace(`~DG${originalName}`, `~DG${newName}`);
        imageDefinitionsToInsert += definition.replace(/\^(XA|XZ)/g, '') + "\n";
      }
    });

    if (imageDefinitionsToInsert.trim()) {
      const insertRegex = /(\^XA)(\^PRB\^FS)/;

      if (cleaned.match(insertRegex)) {
        cleaned = cleaned.replace(insertRegex, (_, xa, prbfs) =>
          `${xa}${imageDefinitionsToInsert}${prbfs}`
        );
      } else if (cleaned.includes('^XA')) {
        cleaned = cleaned.replace(/(\^XA)/, `$1${imageDefinitionsToInsert}`);
      }
    }
  }

  return cleaned;
};

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

const useDebounce = (callback: (...args: any[]) => void, delay: number) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return useCallback(
    (...args: any[]) => {
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
    const events = ['resize', 'scroll'];
    events.forEach(event => window.addEventListener(event, updateDimensions));

    return () => {
      events.forEach(event => window.removeEventListener(event, updateDimensions));
    };
  }, [updateDimensions]);

  return { imgRef, imageRect, updateDimensions };
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const LabelOverlay: React.FC<LabelOverlayProps> = ({
  variables,
  activeVariableId,
  imageRect,
  config,
}) => {
  const activeVariable = useMemo(
    () => variables.find((v) => v.id === activeVariableId),
    [variables, activeVariableId]
  );

  if (!activeVariableId || !imageRect || imageRect.width === 0 || !activeVariable) {
    return null;
  }

  const dpi = config.dpmm * 25.4;
  const scaleX = imageRect.width / (config.width * dpi);
  const scaleY = imageRect.height / (config.height * dpi);

  let position = { left: 0, top: 0 };

  if (activeVariable.type === 'barcode') {
    position = { left: activeVariable.x * scaleX, top: (activeVariable.y - 50) * scaleY };
  } else if (activeVariable.type === 'text') {
    position = { left: (activeVariable.x - 30) * scaleX, top: (activeVariable.y - 40) * scaleY };
  } else {
    position = { left: (activeVariable.x - 13) * scaleX, top: (activeVariable.y + 75) * scaleY };
  }

  return (
    <div
      className="absolute z-50 pointer-events-none flex items-center justify-center min-w-5 min-h-5 px-1 py-[3px] font-bold text-[12px] text-black whitespace-nowra"
      style={position}
    >
      <span className="bg-[red] text-white px-1  text-[10px] shadow">
        X
      </span>
    </div>
  );
};

const VariableItem: React.FC<{
  variable: Variable;
  index: number;
  isActive: boolean;
  value: string;
  onFocus: () => void;
  onChange: (value: string) => void;
  onCheckboxChange: (checked: boolean) => void;
  onSelect: (value: string) => void;
  setRef: (node: HTMLDivElement | null) => void;
}> = ({
  variable,
  index,
  isActive,
  value,
  onFocus,
  onChange,
  onCheckboxChange,
  onSelect,
  setRef
}) => {
    let icon = '📊';
    let label = 'CÓDIGO DE BARRAS';
    let placeholder = 'Ex: 123456789012';
    let shouldUppercase = true;

    if (variable.type === 'image') {
      icon = '🖼️';
      label = 'IMAGEM';
      placeholder = 'Insira a variável';
    } else if (variable.type === 'text') {
      icon = '📝';
      label = 'TEXTO';
      placeholder = 'Insira o texto';
      shouldUppercase = false;
    }

    return (
      <div
        ref={setRef}
        className={`flex flex-col space-y-1 p-3 rounded-lg border cursor-pointer transition-colors ${isActive
          ? "border-yellow-600 bg-yellow-700/30"
          : "border-gray-700 bg-gray-800 hover:border-gray-600"
          }`}
        onClick={onFocus}
      >
        <label className="text-xs font-bold text-yellow-500 flex justify-between">
          <span>
            {icon} {label} {index + 1}
          </span>
          <p className="text-[9px] text-gray-500">
            <span className="mr-1">Posição</span>
            <span>(X: {variable.x} | Y: {variable.y})</span>
          </p>
        </label>

        <div className="flex justify-between items-center gap-4 overflow-visible">
          {variable.type === 'image' && (
            <input
              type="checkbox"
              checked={variable.isChecked || false}
              onChange={(e) => onCheckboxChange(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 cursor-pointer accent-yellow-500"
              aria-label="Incluir definição da imagem"
            />
          )}

          <input
            type="text"
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(shouldUppercase ? e.target.value.toUpperCase() : e.target.value)}
            onFocus={onFocus}
            onClick={(e) => e.stopPropagation()}
            className={`h-10 px-2 w-full truncate bg-gray-900 border text-[11px] border-gray-600 rounded text-white focus:border-yellow-600 outline-none transition-colors ${shouldUppercase ? 'uppercase' : ''
              }`}
          />

          <DropdownSearch onSelect={onSelect} />
        </div>
      </div>
    );
  };

const ImageZoom: React.FC<{ src: string; active: boolean }> = ({ src, active }) => {
  const [zoomStyle, setZoomStyle] = useState<React.CSSProperties>({
    display: "none",
  });

  // Aumente o ZOOM para pelo menos 2 para ver o efeito de ampliação
  const ZOOM = 2;
  const LENS_SIZE = 200;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;

    setZoomStyle({
      display: "block",
      position: "fixed",
      left: e.clientX - LENS_SIZE / 2,
      top: e.clientY - LENS_SIZE / 2,
      width: LENS_SIZE,
      height: LENS_SIZE,
      backgroundImage: `url(${src})`,
      backgroundRepeat: "no-repeat",
      backgroundSize: `${rect.width * ZOOM}px ${rect.height * ZOOM}px`,
      backgroundPosition: `${xPercent}% ${yPercent}%`,
      pointerEvents: "none",
      borderRadius: "8px",
    });
  };

  const handleMouseLeave = () => {
    setZoomStyle({ display: "none" });
  };

  if (!active) return null;

  return (
    <div
      className="absolute inset-0 z-80 cursor-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="fixed border-2 border-yellow-500 shadow-2xl z-50 bg-gray-900 overflow-hidden"
        style={zoomStyle}
      />
    </div>
  );
};


// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Preview() {
  const [originalContent, setOriginalContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [variables, setVariables] = useState<Variable[]>([]);
  const [activeVariableId, setActiveVariableId] = useState<string | null>(null);
  const [showVariables, setShowVariables] = useState(false);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [imageDefinitions, setImageDefinitions] = useState("");
  const [config, setConfig] = useState<LabelConfig>(DEFAULT_CONFIG);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { imgRef, imageRect, updateDimensions } = useImageDimensions();
  const variableRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const variableMaps = useMemo(() => {
    const imageMap = new Map(
      variables.filter(v => v.type === 'image').map(v => [v.originalValue, v])
    );
    const barcodeMap = new Map(
      variables.filter(v => v.type === 'barcode').map(v => [v.originalValue, v])
    );
    const textMap = new Map(
      variables.filter(v => v.type === 'text').map(v => [v.originalValue, v])
    );
    return { imageMap, barcodeMap, textMap };
  }, [variables]);

  const setVariableRef = useCallback((node: HTMLDivElement | null, id: string) => {
    if (node) {
      variableRefs.current.set(id, node);
    } else {
      variableRefs.current.delete(id);
    }
  }, []);

  const handleFocus = useCallback((id: string) => {
    setActiveVariableId(id);
    const node = variableRefs.current.get(id);
    node?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const generateZplWithCurrentValues = useCallback(() => {
    if (!originalContent || variables.length === 0) return "";

    let result = originalContent;
    const { imageMap, barcodeMap, textMap } = variableMaps;

    // Replace images
    result = result.replace(/\^XG(.*?)(?=,)/gs, (match, captured) => {
      const v = imageMap.get(captured);
      return v?.value ? `^XG${v.value}` : match;
    });

    // Replace barcodes
    result = result.replace(
      /(\^FT\d+,\d+\^BE[A-Z],\d+,[A-Z],[A-Z]\^FD)(.*?)(\^FS)/gs,
      (match, prefix, fdValue, suffix) => {
        const v = barcodeMap.get(fdValue);
        return v?.value ? `${prefix}${v.value}${suffix}` : match;
      }
    );

    // Replace texts (avoid barcodes)
    const barcodePos = new Set<string>();
    result.replace(/\^FT(\d+),(\d+)\^BE[A-Z],\d+,[A-Z],[A-Z]\^FD.*?\^FS/gs, (m, x, y) => {
      barcodePos.add(`${x},${y}`);
      return m;
    });

    result = result.replace(
      /\^FT(\d+),(\d+)(.*?\^FD)(.*?)(\^FS)/gs,
      (match, x, y, middlePart, fdValue, fsPart) => {
        if (barcodePos.has(`${x},${y}`)) return match;
        const v = textMap.get(fdValue);
        return v?.value ? `^FT${x},${y}${middlePart}${v.value}${fsPart}` : match;
      }
    );

    return result;
  }, [originalContent, variables, variableMaps]);

  const renderLabelPreview = useCallback(async () => {
    const zpl = generateZplWithCurrentValues();
    if (!zpl) return;

    const apiUrl = `https://api.labelary.com/v1/printers/${config.dpmm}dpmm/labels/${config.width}x${config.height}/0/`;

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
      setShowVariables(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido ao gerar imagem";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [config, generateZplWithCurrentValues]);

  const debouncedRenderPreview = useDebounce(renderLabelPreview, DEBOUNCE_DELAY);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);
    setActiveVariableId(null);
    setVariableValues({});

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
  }, []);

  const handleVariableChange = useCallback((id: string, value: string) => {
    setVariableValues((prev) => ({ ...prev, [id]: value }));
    setVariables((prev) => prev.map((v) => (v.id === id ? { ...v, value } : v)));
  }, []);

  const handleCheckboxChange = useCallback((id: string, checked: boolean) => {
    setVariables((prev) =>
      prev.map((v) => {
        if (v.id === id) {
          if (checked && v.imageName) {
            const def = getImageDefinitionByName(imageDefinitions, v.imageName);
            console.log(`✓ Checkbox marcado: ${v.imageName}`);
            console.log(`Definição:\n${def}`);
          }
          return { ...v, isChecked: checked };
        }
        return v;
      })
    );
  }, [imageDefinitions]);

  const handleSubmit = useCallback(() => {
    const zpl = generateZplWithCurrentValues();
    if (!zpl) {
      setError("Nada para processar.");
      return;
    }

    const finalContent = cleanZplForDownload(zpl, variables, imageDefinitions);

    // 🔥 FORÇA SEMPRE .zpl
    const baseName = fileName.replace(/\.[^/.]+$/, "");
    const newFileName = `${baseName}.zpl`;

    const blob = new Blob([finalContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = newFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setError(null);
  }, [generateZplWithCurrentValues, variables, imageDefinitions, fileName]);


  const handleConfigChange = useCallback((key: keyof LabelConfig, value: number) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    if (originalContent) debouncedRenderPreview();
  }, [variables, config, originalContent, debouncedRenderPreview]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="w-full mb-12">
      <h2 className="text-xl font-bold text-gray-200 px-2 mb-2">
        Pré-visualização
      </h2>

      <div className="flex flex-col gap-8">
        <div className="flex gap-6 space-y-6">
          <div className="w-full flex justify-between flex-col gap-5 m-0">
            <div className="min-h-[400px] flex items-center justify-center bg-gray-800 border-2 border-gray-600 rounded-xl shadow-xl overflow-hidden custom-scrollbar">
              {isLoading ? (
                <SyncLoader color="#f0b100" />
              ) : error && !previewUrl ? (
                <p className="text-red-400 p-8 text-center">{error}</p>
              ) : previewUrl ? (
                <div className="w-full h-[700px] flex items-center justify-center relative overflow-hidden">
                  <div className="relative inline-block border border-gray-600 shadow-2xl">

                    {/* COMPONENTE DE ZOOM ADICIONADO AQUI */}
                    <ImageZoom src={previewUrl} active={!isLoading && !!previewUrl} />

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
                      config={config}
                    />
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-gray-700/50 transition-colors"
                >
                  <p className="text-gray-500 italic p-6">Carregue um arquivo ZPL.</p>
                </div>
              )}
            </div>

            <div>
              <Cards title="Configuração (Tamanho deve bater com o ZPL)">
                <div className="flex flex-wrap justify-around gap-4">
                  {[
                    { label: 'DPMM', key: 'dpmm' as const, value: config.dpmm },
                    { label: 'Largura (pol)', key: 'width' as const, value: config.width },
                    { label: 'Altura (pol)', key: 'height' as const, value: config.height },
                  ].map(({ label, key, value }) => (
                    <div key={key} className="flex items-center gap-1">
                      <label className="text-xs text-gray-400 block">{label}:</label>
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => handleConfigChange(key, Number(e.target.value))}
                        className="w-20 text-center bg-gray-700 border border-gray-600 rounded text-white focus:border-yellow-600 outline-none"
                      />
                    </div>
                  ))}
                </div>
              </Cards>
            </div>
          </div>

          <div className="flex flex-col w-[70%] justify-between gap-6">
            <Cards title="Variáveis">
              <div className={`transition-all duration-500 ease-in-out overflow-hidden ${showVariables ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"}`}>
                {showVariables && (
                  <div className={`flex flex-col overflow-y-scroll pr-3 custom-scrollbar gap-4 ${variables.length < 4 ? "min-h-[530px]" : "max-h-[530px]"}`}>
                    {variables.map((variable, index) => (
                      <VariableItem
                        key={variable.id}
                        variable={variable}
                        index={index}
                        isActive={variable.id === activeVariableId}
                        value={variableValues[variable.id] || ""}
                        onFocus={() => handleFocus(variable.id)}
                        onChange={(value) => handleVariableChange(variable.id, value)}
                        onCheckboxChange={(checked) => handleCheckboxChange(variable.id, checked)}
                        onSelect={(value) => handleVariableChange(variable.id, value)}
                        setRef={(node) => setVariableRef(node, variable.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Cards>

            <Cards title="Upload Arquivo" seach={fileInputRef.current?.files?.[0]?.name}>
              <label className="h-full flex flex-col items-center justify-center text-sm p-4 border-2 border-dashed border-yellow-400 rounded cursor-pointer hover:bg-gray-800 transition-colors">
                <span className="text-yellow-400 font-semibold">Carregar ZPL</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zpl,.prn,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                  aria-label="Carregar arquivo ZPL"
                />
              </label>

              <button
                onClick={handleSubmit}
                disabled={!originalContent}
                className="mt-4 w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded transition-colors"
              >
                Baixar Modificado
              </button>
            </Cards>
          </div>
        </div>
      </div>
    </div>
  );
}
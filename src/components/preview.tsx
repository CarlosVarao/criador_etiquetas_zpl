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

const cp850Map: Record<string, string> = {
  'á': '_a0', 'é': '_82', 'í': '_a1', 'ó': '_a2', 'ú': '_a3',
  'â': '_83', 'ê': '_88', 'ô': '_93', 'ã': '_c6', 'õ': '_e4',
  'ç': '_87', 'à': '_85', 'è': '_8a', 'ì': '_8d', 'ò': '_95', 'ù': '_97',
  'Á': '_b5', 'É': '_90', 'Í': '_d6', 'Ó': '_e0', 'Ú': '_e9',
  'Â': '_b6', 'Ê': '_d2', 'Ô': '_e2', 'Ã': '_c7', 'Õ': '_e5',
  'Ç': '_80', 'À': '_b7', 'È': '_d4', 'Ì': '_de', 'Ò': '_e3', 'Ù': '_eb',
  '°': '_f8'
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const generateUniqueId = (): string => Math.random().toString(36).substring(2, 9);

const convertToCP850 = (text: string): string => {
  let result = text;
  for (const [char, code] of Object.entries(cp850Map)) {
    result = result.replace(new RegExp(char, 'g'), code);
  }
  return result;
};

// ============================================================================
// ZPL PROCESSING FUNCTIONS
// ============================================================================

const extractImageDefinitions = (content: string): string => {
  const regex = /~DG[\s\S]*?\^XA/;
  const match = content.match(regex);
  return match?.[0] ?? "";
};

const getImageDefinitionByName = (imageDefinitions: string, imageName: string): string => {
  const escapedName = imageName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(~DG${escapedName}[\\s\\S]*?(?=~DG|\\^XA|\\^XZ))`, 'i');
  const match = imageDefinitions.match(regex);
  return match?.[1] ?? "";
};

const extractVariables = (content: string): Variable[] => {
  const variables: Variable[] = [];

  // Aceita qualquer caractere exceto vírgula após o ^XG
  const imageRegex = /\^FO(\d+),(\d+).*?\^XG([^,]+),/gs;
  // Regex para Barcodes (Suporta ^BE e ^BC)
  const barcodeRegex = /\^FT(\d+),(\d+)\^(?:BE|BC)[A-Z],.*?\^FD(.*?)\^FS/gs;
  // Regex para Textos (Evita campos que contenham comandos de barcode)
  const textRegex = /\^FT(\d+),(\d+)(?:(?!\^(?:BE|BC)).)*?\^FD(.*?)\^FS/gs;

  for (const match of content.matchAll(imageRegex)) {
    variables.push({
      id: generateUniqueId(),
      x: parseInt(match[1], 10), y: parseInt(match[2], 10),
      originalValue: match[3], value: match[3],
      index: 0, type: 'image', isChecked: false, imageName: match[3],
    });
  }

  const barcodePositions = new Set<string>();
  for (const match of content.matchAll(barcodeRegex)) {
    const x = parseInt(match[1], 10), y = parseInt(match[2], 10);
    barcodePositions.add(`${x},${y}`);
    variables.push({
      id: generateUniqueId(),
      x, y,
      originalValue: match[3], value: match[3],
      index: 0, type: 'barcode',
    });
  }

  for (const match of content.matchAll(textRegex)) {
    const x = parseInt(match[1], 10), y = parseInt(match[2], 10);
    if (!barcodePositions.has(`${x},${y}`)) {
      variables.push({
        id: generateUniqueId(),
        x, y,
        originalValue: match[3], value: match[3],
        index: 0, type: 'text',
      });
    }
  }

  const sorted = [
    ...variables.filter(v => v.type === 'barcode'),
    ...variables.filter(v => v.type === 'image'),
    ...variables.filter(v => v.type === 'text')
  ];

  sorted.forEach((v, i) => v.index = i);
  return sorted;
};

const reorderPrnContent = (content: string): string => {
  const lines = content.split('\n');
  const mnyIndex = lines.findIndex(line => line.includes('^MNY'));
  if (mnyIndex === -1) return content;
  const xgLines = lines.filter(line => line.includes('^XG'));
  const otherLines = lines.filter((line, idx) => idx <= mnyIndex || !line.includes('^XG'));
  return [...otherLines.slice(0, mnyIndex + 1), ...xgLines, ...otherLines.slice(mnyIndex + 1)].join('\n');
};

const cleanZplForDownload = (zpl: string, variables: Variable[], imageDefinitions: string): string => {
  let cleaned = zpl;
  cleaned = cleaned.replace(/(?<!\^FH)\^FD/g, "^FH^FD");
  cleaned = cleaned.replace(/\^FD(.*?)\^FS/gs, (match) => match.replace(/_5f/g, "_"));
  cleaned = cleaned.replace(/\^XA\s*\^ID.*?\^FS\s*\^XZ\s*/gs, "");
  cleaned = cleaned.replace(/~DG[\s\S]*?\^XA/gs, "^XA");

  // Modifica apenas o ^BE para Y (EAN-13)
  cleaned = cleaned.replace(/(\^BE[A-Z],\d+,)N(,[A-Z])/g, '$1Y$2');

  const checkedImages = variables.filter(v => v.type === 'image' && v.isChecked && v.imageName);
  if (checkedImages.length > 0) {
    let imageDefsToInsert = "\n";
    const uniqueChecked = Array.from(new Set(checkedImages.map(v => v.imageName))).map(name => checkedImages.find(v => v.imageName === name)!);
    uniqueChecked.forEach(v => {
      let definition = getImageDefinitionByName(imageDefinitions, v.imageName!);
      if (definition) {
        definition = definition.replace(`~DG${v.imageName}`, `~DG${v.value}`);
        imageDefsToInsert += definition.replace(/\^(XA|XZ)/g, '') + "\n";
      }
    });
    cleaned = cleaned.replace(/(\^XA)/, `$1${imageDefsToInsert}`);
  }
  return cleaned;
};

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

const useDebounce = (callback: (...args: any[]) => void, delay: number) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);
  return useCallback((...args: any[]) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => callback(...args), delay);
  }, [callback, delay]);
};

const useImageDimensions = () => {
  const [imageRect, setImageRect] = useState<DOMRect | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const updateDimensions = useCallback(() => { if (imgRef.current) setImageRect(imgRef.current.getBoundingClientRect()); }, []);
  useEffect(() => {
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [updateDimensions]);
  return { imgRef, imageRect, updateDimensions };
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const LabelOverlay: React.FC<LabelOverlayProps> = ({ variables, activeVariableId, imageRect, config }) => {
  const activeVar = useMemo(() => variables.find(v => v.id === activeVariableId), [variables, activeVariableId]);
  if (!activeVariableId || !imageRect || !activeVar) return null;
  const dpi = config.dpmm * 25.4;
  const scaleX = imageRect.width / (config.width * dpi);
  const scaleY = imageRect.height / (config.height * dpi);
  let pos = { left: activeVar.x * scaleX, top: activeVar.y * scaleY };
  if (activeVar.type === 'barcode') { pos.left -= 18 * scaleX; pos.top -= 50 * scaleY; }
  else if (activeVar.type === 'text') { pos.left -= 20 * scaleX; pos.top -= 20 * scaleY; }
  else { pos.top += 75 * scaleY; }
  return (
    <div className="absolute z-50 pointer-events-none flex items-center justify-center font-bold text-black" style={{ ...pos }}>
      <span className="bg-[red] text-white px-1 text-[10px] shadow">X</span>
    </div>
  );
};

const VariableItem: React.FC<{
  variable: Variable; index: number; isActive: boolean; value: string;
  onFocus: () => void; onChange: (value: string) => void;
  onCoordChange: (coord: 'x' | 'y', val: number) => void;
  onCheckboxChange: (checked: boolean) => void; onSelect: (value: string) => void;
  setRef: (node: HTMLDivElement | null) => void;
}> = ({ variable, index, isActive, value, onFocus, onChange, onCoordChange, onCheckboxChange, onSelect, setRef }) => {
  const isImg = variable.type === 'image', isBc = variable.type === 'barcode';
  // Função para concatenar ao invés de substituir
  const handleDropdownSelect = (selectedValue: string) => {
    const newValue = value + selectedValue;
    onSelect(isImg || isBc ? newValue.toUpperCase() : newValue);
  };
  return (
    <div ref={setRef} onClick={onFocus} className={`flex flex-col space-y-1 p-3 rounded-lg border cursor-pointer transition-colors ${isActive ? "border-yellow-600 bg-yellow-700/30" : "border-gray-700 bg-gray-800 hover:border-gray-600"}`}>
      <div className="text-xs font-bold text-yellow-500 flex justify-between items-center">
        <span>{isImg ? '🖼️ IMAGEM' : isBc ? '📊 BARRAS' : '📝 TEXTO'} {index + 1}</span>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-gray-500">X:</span>
            <input type="text" value={variable.x} onChange={e => onCoordChange('x', parseInt(e.target.value) || 0)} className="w-15 py-1 text-center bg-gray-900 border border-gray-700 rounded text-white text-[10px] outline-none" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-gray-500">Y:</span>
            <input type="text" value={variable.y} onChange={e => onCoordChange('y', parseInt(e.target.value) || 0)} className="w-15 py-1 text-center bg-gray-900 border border-gray-700 rounded text-white text-[10px] outline-none" />
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center gap-3">
        <div className="flex items-center gap-2 w-full">
          {isImg && <input type="checkbox" checked={variable.isChecked} onChange={e => onCheckboxChange(e.target.checked)} onClick={e => e.stopPropagation()} className="w-5 h-5 accent-yellow-500" />}
          <input type="text" value={value} onChange={e => onChange(isImg || isBc ? e.target.value.toUpperCase() : e.target.value)} onFocus={onFocus} onClick={e => e.stopPropagation()} className="h-10 px-2 w-full bg-gray-900 border text-[11px] border-gray-600 rounded text-white focus:border-yellow-600 outline-none" />
        </div>
        <DropdownSearch onSelect={handleDropdownSelect} />
      </div>
    </div>
  );
};

const ImageZoom: React.FC<{ active: boolean; targetRef: React.RefObject<HTMLDivElement | null> }> = ({ active, targetRef }) => {
  const [zoomStyle, setZoomStyle] = useState<React.CSSProperties>({ display: "none" });
  if (!active) return null;
  return (
    <div
      className="absolute inset-0 z-80 cursor-crosshair"
      onMouseMove={(e) => {
        if (!targetRef.current) return;
        const rect = targetRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setZoomStyle({
          display: "block",
          position: "fixed",
          left: e.clientX + 25,
          top: e.clientY - 125,
          width: 250,
          height: 250,
          backgroundColor: "#111827",
          backgroundImage: `url(${targetRef.current.querySelector('img')?.src})`,
          backgroundSize: `${rect.width * 2}px ${rect.height * 2}px`,
          backgroundPosition: `${x}% ${y}%`,
          pointerEvents: "none",
          borderRadius: "12px",
          border: "2px solid #f0b100",
          boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.5)",
          zIndex: 999
        });
      }}
      onMouseLeave={() => setZoomStyle({ display: "none" })}
    >
      <div style={zoomStyle} />
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
  const [isDragging, setIsDragging] = useState(false);

  const { imgRef, imageRect, updateDimensions } = useImageDimensions();
  const containerRef = useRef<HTMLDivElement>(null);
  const variableRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = e.target?.result as string;
      const reordered = reorderPrnContent(raw);
      const extracted = extractVariables(reordered);
      const initial: Record<string, string> = {};
      extracted.forEach(v => initial[v.id] = v.value);
      setImageDefinitions(extractImageDefinitions(raw));
      setOriginalContent(reordered);
      setVariables(extracted);
      setVariableValues(initial);
    };
    reader.readAsText(file);
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const generateZplWithCurrentValues = useCallback(() => {
    if (!originalContent || variables.length === 0) return "";
    let result = originalContent;

    const barcodes = variables.filter(v => v.type === 'barcode');
    const images = variables.filter(v => v.type === 'image');
    const texts = variables.filter(v => v.type === 'text');

    let bcIdx = 0, imgIdx = 0, txtIdx = 0;
    const barcodePos = new Set<string>();

    // Procure por esta parte dentro da generateZplWithCurrentValues:
    result = result.replace(/\^FO(\d+),(\d+)(.*?\^XG)([^,]+),/gs, (m, _, __, mid) => {
      const v = images[imgIdx++];
      return v ? `^FO${v.x},${v.y}${mid}${v.value},` : m;
    });


    // 2. Atualiza Barcodes (Suporta ^BE e ^BC)
    result = result.replace(/\^FT(\d+),(\d+)(\^(?:BE|BC)[A-Z],.*?\^FD)(.*?)(\^FS)/gs, (m, x, y, prefix, _, fsPart) => {
      const v = barcodes[bcIdx++];
      if (v) {
        barcodePos.add(`${x},${y}`);
        return `^FT${v.x},${v.y}${prefix}${convertToCP850(v.value)}${fsPart}`;
      }
      return m;
    });

    // 3. Atualiza Textos (Usando _ para o que não é usado)
    result = result.replace(/\^FT(\d+),(\d+)(.*?)(\^FD)(.*?)(\^FS)/gs, (m, x, y, middle, _, __, fsPart) => {
      if (barcodePos.has(`${x},${y}`)) return m;
      const v = texts[txtIdx++];
      if (!v) return m;
      const hasFH = middle.includes('^FH');
      return `^FT${v.x},${v.y}${hasFH ? middle : middle + '^FH'}^FD${convertToCP850(v.value)}${fsPart}`;
    });

    return result;
  }, [originalContent, variables]);

  const renderLabelPreview = useCallback(async () => {
    const zpl = generateZplWithCurrentValues();
    if (!zpl) return;
    let previewZpl = zpl;
    if (imageDefinitions) {
      previewZpl = previewZpl.replace(/~DG[\s\S]*?\^XA/gs, "^XA");
      let allDefs = imageDefinitions;
      variables.filter(v => v.type === 'image').forEach(v => {
        if (v.imageName) allDefs = allDefs.replace(new RegExp(`~DG${v.imageName}`, 'g'), `~DG${v.value}`);
      });
      previewZpl = previewZpl.replace('^XA', `${allDefs}\n^XA`);
    }
    setIsLoading(true); setError(null);
    try {
      const resp = await fetch(`https://api.labelary.com/v1/printers/${config.dpmm}dpmm/labels/${config.width}x${config.height}/0/`, {
        method: "POST", headers: { Accept: "image/png", "Content-Type": "application/x-www-form-urlencoded" }, body: previewZpl
      });
      if (!resp.ok) throw new Error(await resp.text());
      setPreviewUrl(URL.createObjectURL(await resp.blob()));
      setShowVariables(true);
    } catch (err: any) { setError(err.message); } finally { setIsLoading(false); }
  }, [config, variables, imageDefinitions, generateZplWithCurrentValues]);

  const debouncedRenderPreview = useDebounce(renderLabelPreview, DEBOUNCE_DELAY);

  const handleVariableChange = (id: string, value: string) => {
    setVariableValues(p => ({ ...p, [id]: value }));
    setVariables(p => p.map(v => v.id === id ? { ...v, value } : v));
  };

  const handleCoordChange = (id: string, coord: 'x' | 'y', val: number) => {
    setVariables(prev => prev.map(v => v.id === id ? { ...v, [coord]: val } : v));
  };

  const handleSubmit = useCallback(() => {
    const zpl = generateZplWithCurrentValues();
    if (!zpl) return;
    const final = cleanZplForDownload(zpl, variables, imageDefinitions);
    const blob = new Blob([final], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `${fileName.replace(/\.[^/.]+$/, "")}.zpl`;
    link.click(); URL.revokeObjectURL(url);
  }, [generateZplWithCurrentValues, variables, imageDefinitions, fileName]);

  useEffect(() => { if (originalContent) debouncedRenderPreview(); }, [variables, config, originalContent, debouncedRenderPreview]);

  return (
    <div className="w-full mb-12">
      <h2 className="text-xl font-bold text-gray-200 px-2 mb-2">Editor de ZPL</h2>
      <div className="flex flex-col gap-8">
        <div className="flex gap-6 space-y-6">
          <div className="w-full flex justify-between flex-col gap-5">
            <div
              ref={containerRef}
              className={`min-h-[400px] flex items-center justify-center border-2 rounded-xl shadow-xl overflow-hidden relative transition-all ${isDragging ? "border-yellow-500 bg-gray-700/50 scale-[1.01]" : "border-gray-600 bg-gray-800"}`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files?.[0]; if (file) processFile(file); }}
            >
              {isLoading ? <SyncLoader color="#f0b100" /> : error && !previewUrl ? <p className="text-red-400">{error}</p> : previewUrl ? (
                <div className="w-full h-[700px] flex items-center justify-center relative overflow-hidden">
                  <ImageZoom active={!!previewUrl} targetRef={containerRef} />
                  <div className="relative inline-block border border-gray-600 shadow-2xl">
                    <img ref={imgRef} src={previewUrl} onLoad={updateDimensions} alt="Etiqueta" className="block max-w-full max-h-[680px]" />
                    <LabelOverlay variables={variables} activeVariableId={activeVariableId} imageRect={imageRect} config={config} />
                  </div>
                </div>
              ) : (
                <div onClick={() => fileInputRef.current?.click()} className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-6 text-gray-500 italic text-center">
                  <p>{isDragging ? "Solte para carregar" : "Clique ou arraste um arquivo ZPL aqui."}</p>
                </div>
              )}
            </div>

            <Cards title="Configuração">
              <div className="flex flex-wrap justify-around gap-4">
                {[{ l: 'DPMM', k: 'dpmm' }, { l: 'Largura', k: 'width' }, { l: 'Altura', k: 'height' }].map(i => (
                  <div key={i.k} className="flex items-center gap-1">
                    <label className="text-xs text-gray-400">{i.l}:</label>
                    <input type="number" value={(config as any)[i.k]} onChange={e => setConfig(p => ({ ...p, [i.k]: Number(e.target.value) }))} className="w-20 bg-gray-700 border border-gray-600 rounded text-white text-center" />
                  </div>
                ))}
              </div>
            </Cards>
          </div>

          <div className="flex flex-col w-[70%] justify-between gap-6">
            <Cards title="Variáveis">
              <div className={`transition-all duration-500 overflow-hidden ${showVariables ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="flex flex-col overflow-y-scroll pr-3 custom-scrollbar gap-4 max-h-[530px]">
                  {variables.map((v, i) => (
                    <VariableItem
                      key={v.id}
                      variable={v}
                      index={i}
                      isActive={v.id === activeVariableId}
                      value={variableValues[v.id] || ""}
                      onFocus={() => setActiveVariableId(v.id)}
                      onChange={val => handleVariableChange(v.id, val)}
                      onCoordChange={(coord, val) => handleCoordChange(v.id, coord, val)}
                      onCheckboxChange={c => setVariables(prev => prev.map(item => item.id === v.id ? { ...item, isChecked: c } : item))}
                      onSelect={val => handleVariableChange(v.id, val)}
                      setRef={node => node && variableRefs.current.set(v.id, node)}
                    />
                  ))}
                </div>
              </div>
            </Cards>

            <Cards title="Upload Arquivo" seach={fileName}>
              <label className={`h-full flex flex-col items-center justify-center p-4 border-2 border-dashed rounded cursor-pointer transition-colors ${isDragging ? "border-white bg-yellow-600/20" : "border-yellow-400 hover:bg-gray-800"}`}>
                <span className="text-yellow-400 font-semibold">Carregar Arquivo</span>
                <input ref={fileInputRef} type="file" accept=".zpl,.prn,.txt" onChange={handleFileChange} className="hidden" />
              </label>
              <button onClick={handleSubmit} disabled={!originalContent} className="mt-4 w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold rounded cursor-pointer">
                Baixar Modificado
              </button>
            </Cards>
          </div>
        </div>
      </div>
    </div>
  );
}
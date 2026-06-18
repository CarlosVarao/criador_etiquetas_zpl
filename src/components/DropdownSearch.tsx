import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import baseDados from "../data/baseDados.json";
import { normalizeText } from "../utils/text";

export default function DropdownSearch({
  onSelect,
}: {
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 417,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const DROPDOWN_WIDTH = 417;

  // ====== POSICIONAMENTO (flutua por cima, nunca é cortado) ======
  const updatePosition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    // alinha a borda direita do dropdown com a do botão (como no layout original)
    let left = rect.right - DROPDOWN_WIDTH;
    // mantém dentro da viewport
    left = Math.max(8, Math.min(left, window.innerWidth - DROPDOWN_WIDTH - 8));
    setCoords({ top: rect.bottom + 4, left, width: DROPDOWN_WIDTH });
  }, []);

  // recalcula ao abrir, e acompanha scroll/resize enquanto aberto
  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handler = () => updatePosition();
    window.addEventListener("scroll", handler, true); // capture: pega scroll de qualquer container
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open, updatePosition]);

  // fecha ao clicar fora / Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (dropdownRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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

  return (
    <div className="relative inline-block w-[55%]">
      {/* BOTÃO */}
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
          setSearch("");
        }}
        className="h-10 px-3 w-full items-center justify-between text-xs flex bg-[#0e1014] border border-[#242a34] rounded-lg text-[#cdd3dd] focus:border-[#f6a821] outline-none cursor-pointer hover:border-[#3a4150] transition-colors"
        type="button"
      >
        Buscar variáveis
        <svg
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="m19 9-7 7-7-7"
          />
        </svg>
      </button>

      {/* DROPDOWN — renderizado em portal, flutua por cima de tudo */}
      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            onClick={(e) => e.stopPropagation()}
            style={{ top: coords.top, left: coords.left, width: coords.width }}
            className="fixed z-[9999] bg-[#1b1f27] border border-[#2a2f3a] rounded-xl text-white shadow-2xl overflow-hidden"
          >
            {/* SEARCH */}
            <div className="border-[#262b35] p-2 bg-[#1b1f27] border-b">
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[#0e1014] border border-[#242a34] rounded-lg text-white text-sm block w-full px-2.5 py-1.5 outline-none focus:border-[#f6a821]"
                placeholder="Buscar campo..."
              />
            </div>

            {/* LISTA FILTRADA */}
            <ul className="h-50 p-2 text-sm font-medium overflow-y-auto bg-[#1b1f27] custom-scrollbar">
              {dadosFiltrados.map((item) => (
                <li
                  key={item.value}
                  onClick={() => {
                    onSelect(item.value);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <p className="text-[10px] p-2 rounded-md hover:bg-[#262b35] transition duration-150 text-[#f6a821] uppercase cursor-pointer">
                    {item.label}
                  </p>
                </li>
              ))}

              {/* NENHUM RESULTADO */}
              {dadosFiltrados.length === 0 && (
                <p className="text-[10px] p-2 text-[#7b828f] uppercase">
                  Nenhum resultado encontrado
                </p>
              )}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}

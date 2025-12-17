import { useState, useRef, useMemo } from "react";
import baseDados from "../data/baseDados.json";

export default function DropdownSearch({
  onSelect,
}: {
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative inline-block w-[55%] overflow-visible">
      {/* BOTÃO */}
      <button
        ref={buttonRef}
        onClick={() => {
          setOpen(!open);
          setSearch("");
        }}
        className="h-10 px-3 w-full items-center justify-between text-xs flex bg-gray-900 border border-gray-600 rounded text-white focus:border-yellow-600 outline-none cursor-pointer"
        type="button"
      >
        Buscar Variaveis
        <svg
          className="w-4 h-4"
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

      {/* DROPDOWN */}
      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-1 z-999 bg-gray-900 border border-gray-700 rounded-base text-white w-[417px] shadow-2xl"
        >
          {/* SEARCH */}
          <div className="border-gray-700 p-2 bg-gray-900 border-b">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-gray-800 border border-gray-600 text-white text-sm block w-full px-2.5 py-1 shadow-xs outline-none"
              placeholder="Buscar campo..."
            />
          </div>

          {/* LISTA FILTRADA */}
          <ul className="h-50 p-2 text-sm font-medium overflow-y-auto bg-gray-900 custom-scrollbar">
            {dadosFiltrados.map((item, index) => (
              <li
                key={index}
                onClick={() => {
                  onSelect(item.value);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <p className="text-[10px] p-2 hover:bg-gray-800 transition duration-150 text-amber-400 uppercase cursor-pointer">
                  {item.label}
                </p>
              </li>
            ))}

            {/* NENHUM RESULTADO */}
            {dadosFiltrados.length === 0 && (
              <p className="text-[10px] p-2 text-gray-400 uppercase">
                Nenhum resultado encontrado
              </p>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

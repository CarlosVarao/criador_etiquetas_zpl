import { useNavigate } from "react-router-dom";

interface typesProps {
  title: string;
  nameBtnNavigate: string;
  rotaNavigate: string;
}

export default function Title({ title, nameBtnNavigate, rotaNavigate }: typesProps) {
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between pb-5 border-b border-[#20242d]">
      <div className="flex items-center gap-3.5">
        <div
          className="w-[38px] h-[38px] rounded-[9px] flex items-center justify-center font-bold text-[13px] tracking-[0.5px] text-[#15171c]"
          style={{ background: "#f6a821", boxShadow: "0 4px 14px rgba(246,168,33,0.18)" }}
        >
          ZPL
        </div>
        <div>
          <p className="text-[18px] font-extrabold leading-tight tracking-tight text-[#e7e9ee]">
            {title}
          </p>
          <p className="text-[12px] text-[#7b828f] mt-0.5">
            Editor de etiquetas · Zebra Programming Language
          </p>
        </div>
      </div>

      <button
        onClick={() => navigate(`${rotaNavigate}`)}
        className="text-[#cdd3dd] text-[13px] font-medium px-4 py-2.5 bg-[#1d222b] border border-[#2c323d] rounded-[9px] cursor-pointer transition-colors hover:border-[#3a4150] hover:text-white"
      >
        {nameBtnNavigate}
      </button>
    </header>
  );
}

interface typesProps {
  title?: string;
  children?: React.ReactNode;
  search?: React.ReactNode;
}

export default function Cards({ title, children, search }: typesProps) {
  return (
    <div className="w-full relative text-[#e7e9ee]">
      <div className="bg-[#1b1f27] border border-[#2a2f3a] rounded-2xl shadow-lg [box-shadow:0_10px_30px_-12px_rgba(0,0,0,0.45)] p-5">
        <div className="mb-4 pb-3 border-b border-[#262b35] flex justify-between items-center gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-[3px] h-[15px] rounded-[2px] bg-[#f6a821] inline-block" />
            <h1 className="text-[15px] font-semibold text-[#e7e9ee]">{title}</h1>
          </div>
          <div className="text-xs text-[#6b7280] flex gap-2 items-center">{search}</div>
        </div>

        <div className="transition-all duration-300 ease-in-out">{children}</div>
      </div>
    </div>
  );
}

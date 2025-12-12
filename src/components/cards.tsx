interface typesProps {
  title?: string;
  children?: React.ReactNode;
  seach?: React.ReactNode;
}

export default function Cards({ title, children, seach }: typesProps) {
  return (
    <>
      <div className="bg-gray-900 w-full relative text-white">
        <div className="border border-[#374151] p-5 rounded-xl shadow-lg [box-shadow:0_10px_15px_-3px_rgba(0,0,0,0.2)]">
          <div className="text-xl font-bold text-gray-200 mb-3 pb-2.5 border-b border-gray-700 flex justify-between items-center">
            <h1>{title}</h1>
            <div className="text-xs text-gray-500 flex gap-2 items-center">{seach}</div>
          </div>

          <div className="transition-all duration-300 ease-in-out">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}

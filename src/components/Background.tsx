interface typesProps {
  children?: React.ReactNode;
  classNamePersonalizada?: string;
}

export default function Background({ children, classNamePersonalizada }: typesProps) {
  return (
    <div
      className={`min-h-screen w-full text-[#e7e9ee] px-8 py-7 ${classNamePersonalizada ?? ""}`}
      style={{
        background:
          "radial-gradient(125% 80% at 72% -12%, #1b2029 0%, #15171c 52%)",
      }}
    >
      <div className="max-w-[1400px] mx-auto flex flex-col h-full gap-6">
        {children}
      </div>
    </div>
  );
}

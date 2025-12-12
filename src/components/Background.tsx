interface typesProps {
  children?: React.ReactNode,
  classNamePersonalizada?: string,
}

export default function Background({ children, classNamePersonalizada }: typesProps) {
  return (
    <div className={`bg-gray-900 h-full w-full text-white p-4 ${classNamePersonalizada}`}>
      <div className="max-w-7xl mx-auto flex flex-col h-full">{children}</div>
    </div>
  );
}

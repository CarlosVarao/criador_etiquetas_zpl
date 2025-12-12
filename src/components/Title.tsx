import { useNavigate } from "react-router-dom";

interface typesProps {
  title: string,
  nameBtnNavigate: string,
  rotaNavigate: string
}

export default function Title({ title, nameBtnNavigate, rotaNavigate }: typesProps) {
  const navigate = useNavigate()

  return (
    <>
      <div className="text-4xl font-extrabold text-yellow-500 text-center flex justify-between mb-5">
        <p>{title}</p>
        <button className="text-gray-200 text-sm font-semibold p-3 border border-gray-700 rounded-md cursor-pointer hover:bg-gray-800 " onClick={() => navigate(`${rotaNavigate}`)}>{nameBtnNavigate}</button>
      </div>
    </>
  );
}

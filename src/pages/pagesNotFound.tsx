import { Frown } from 'lucide-react';
import Background from "../components/Background";
import { useNavigate } from "react-router-dom"

export default function PagesNotFound() {
  const navigate = useNavigate()

  return (
    <Background classNamePersonalizada="min-h-screen flex items-center p-4 justify-center">
      <div className="flex flex-col items-center justify-center text-center w-full max-w-xl px-4 h-full gap-2">

        <div className="flex flex-col items-center gap-2">
          <Frown className="w-20 h-20 text-red-500 mx-auto mb-4 animate-pulse" />
          <h1 className="text-5xl font-extrabold text-white tracking-widest mb-3">404</h1>
          <div className="bg-red-600 px-3 py-1.5 text-xs font-medium rounded-full text-white inline-block shadow-lg uppercase">
            Ops! Erro
          </div>
        </div>

        <p className="text-2xl font-semibold text-gray-200 mt-4 mb-4">
          Página não encontrada
        </p>

        <p className="text-gray-400 text-sm sm:text-base mb-8 max-w-md">
          Parece que você tentou acessar uma rota que não existe.
        </p>

        <button className="text-gray-200 text-sm font-semibold p-3 border border-gray-700 rounded-md cursor-pointer hover:bg-gray-800 " onClick={() => navigate("/")}>Voltar para a Home</button>

        <div className="mt-10 text-sm text-gray-500">
          Desenvolvido por Carlos varão
        </div>

      </div>
    </Background >
  );
}

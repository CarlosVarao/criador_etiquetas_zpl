import Background from "../components/Background";
import Title from "../components/Title";
import CardCompiladorImg from "../components/CardCompiladorImg";

export default function pagesCriadorImagens() {
  return (
    <Background classNamePersonalizada="h-screen">
      <Title title="Editar IMG" nameBtnNavigate="Pagina anterior" rotaNavigate="/" />
      <div className="h-full flex  flex-col justify-center">
        <CardCompiladorImg />
      </div>
    </Background >
  )
}
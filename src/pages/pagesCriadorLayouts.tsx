
import Background from "../components/Background";
import Title from "../components/Title";
import Preview from "../components/preview";
import DataFieldList from "../components/DataFieldList";

export default function pagesCriadorLayouts() {
  return (
    <Background>
      <Title title="Editar ZPL" nameBtnNavigate="Compilador de imagens" rotaNavigate="CompiladorImagens" />
      <Preview />
      <DataFieldList />
    </Background>
  )
}
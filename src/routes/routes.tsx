// routes.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import PagesCriadorLayouts from "../pages/pagesCriadorLayouts";
import PagesCriadorImagens from "../pages/pagesCriadorImagens";
import PagesNotFound from "../pages/pagesNotFound";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota pública */}
        <Route path="/" element={<PagesCriadorLayouts />} />
        <Route path="CompiladorImagens" element={<PagesCriadorImagens />} />
        <Route path="*" element={<PagesNotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

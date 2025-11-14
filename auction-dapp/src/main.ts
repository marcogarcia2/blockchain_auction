import { initDetailPage } from "./pages/detail";
import { initExplorerPage } from "./pages/explorer";

const bootstrap = () => {
  const pageType = document.body?.dataset.page;

  if (pageType === "explorer") {
    initExplorerPage();
    return;
  }

  if (pageType === "detail") {
    initDetailPage();
    return;
  }

  console.warn("Tipo de página desconhecido. Verifique o atributo data-page do <body>.");
};

document.addEventListener("DOMContentLoaded", bootstrap);

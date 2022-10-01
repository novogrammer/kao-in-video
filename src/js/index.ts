import { SrcAlphaSaturateFactor } from "three";
import App from "./App";


window.addEventListener("load",()=>{
  const startElement=document.querySelector(".c-start") as HTMLDivElement;
  startElement.addEventListener("click",()=>{
    window.app=new App();
    startElement.classList.add("c-start--hidden");  
  });
  if (process.env.NODE_ENV !== 'production') {
    startElement.click();

  }
});

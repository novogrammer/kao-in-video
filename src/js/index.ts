import { SrcAlphaSaturateFactor } from "three";
import App from "./App";


window.addEventListener("load",()=>{
  const startElement=document.querySelector(".c-start");
  startElement.addEventListener("click",()=>{
    window.app=new App();
    startElement.classList.add("c-start--hidden");  
  });
});

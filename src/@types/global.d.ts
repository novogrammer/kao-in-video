import type App from "../js/App";
import type RecorderApp from "../js/RecorderApp";
declare global{
  interface Window{
    app?:App;
    recorderApp?:RecorderApp;
    relRoot:string;
  }
}
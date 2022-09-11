import type App from "../App";
import type RecorderApp from "../RecorderApp";
declare global{
  interface Window{
    app:App;
    recorderApp:RecorderApp;
    relRoot:string;
  }
}
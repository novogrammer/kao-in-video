import type App from "../App";
declare global{
  interface Window{
    app:App;
  }
}
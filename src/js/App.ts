import "@tensorflow/tfjs-backend-webgl";
import { setWasmPaths, version_wasm } from "@tensorflow/tfjs-backend-wasm";

import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";

import * as faceMesh from "@mediapipe/face_mesh";

import "../css/style.scss";
import { Face } from "@tensorflow-models/face-landmarks-detection";
import Player from "./Player";
import { IS_PRODUCTION, IS_REFINE_LANDMARKS, VIDEO_HEIGHT, VIDEO_PARAMS_LIST, VIDEO_WIDTH, WEBCAM_HEIGHT, WEBCAM_WIDTH } from "./constants";

import Stats from "stats.js";
import { drawFace } from "./face_utils";

setWasmPaths(`${window.relRoot}lib/@tensorflow/tfjs-backend-wasm@${version_wasm}/dist/`);

console.log(`version_wasm: ${version_wasm}`);

console.log(`faceMesh`,faceMesh);
// console.log(`faceMesh.VERSION: ${faceMesh.VERSION}`);

console.log(`faceLandmarksDetection:`, faceLandmarksDetection);

import * as THREE from "three";




export default class App{
  webcam:HTMLVideoElement;
  debugCanvas:HTMLCanvasElement;
  debugContext2d:CanvasRenderingContext2D;
  canvas:HTMLCanvasElement;
  setupPromise:Promise<void>;
  detector:faceLandmarksDetection.FaceLandmarksDetector|null=null;
  player:Player|null=null;
  currentVideoIndex:number=0;
  stats:Stats|null=null;
  isDebug:boolean=!IS_PRODUCTION;
  renderer:THREE.WebGLRenderer;

  constructor(){
    this.webcam=document.querySelector(".p-app__webcam");
    this.debugCanvas=document.querySelector(".p-app__debug-view");
    this.debugContext2d=this.debugCanvas.getContext("2d");
    this.canvas=document.querySelector(".p-app__view");

    {
      this.canvas.width=VIDEO_WIDTH;
      this.canvas.height=VIDEO_HEIGHT;
      const renderer=new THREE.WebGLRenderer({
        canvas:this.canvas,
      });
      renderer.outputEncoding=THREE.sRGBEncoding;
      this.renderer=renderer;
    }

    this.setupPromise=this.setupAsync();
    this.updateVideo(0);
  }
  updateVideo(index:number){
    if(index<VIDEO_PARAMS_LIST.length){
      console.log(`updateVideo(${index})`);
      this.currentVideoIndex=index;
      const previousPlayer=this.player;
      this.player=new Player(this.renderer,this.webcam,this.canvas,this.onPlayerEnded.bind(this),VIDEO_PARAMS_LIST[this.currentVideoIndex]);
      if(previousPlayer){
        previousPlayer.destroy();
      }
    }
  }
  setupStats(){
    this.stats=new Stats();
    this.stats.dom.style.display=this.isDebug? "block":"none";
    const appElement=document.querySelector(".p-app");
    appElement.appendChild(this.stats.dom);
  }
  async setupVideoAsync(){
    const video=document.createElement("video");
    video.playsInline=true;
    video.muted=true;
  }
  async setupWebcamAsync(){
    if(!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)){
      throw new Error("no getUserMedia");
    }
    const mediaStream=await navigator.mediaDevices.getUserMedia({
      audio:false,
      video:{
        facingMode: "user",
        width:WEBCAM_WIDTH,
        height:WEBCAM_HEIGHT,
      }
    });
    this.webcam.srcObject=mediaStream;
    this.webcam.play();

  }
  async setupDetectorAsync(){
    const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;

    try{

      const detector = await faceLandmarksDetection.createDetector(model, {
        runtime: "mediapipe",
        // solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
        solutionPath: window.relRoot+'lib/@mediapipe/face_mesh',
        refineLandmarks:IS_REFINE_LANDMARKS,
      });

      this.detector=detector;
    }catch(error){
      this.detector=null;
      console.error(error);
    }
    
  }
  toggleDebug(){
    this.isDebug=!this.isDebug;

    this.stats.dom.style.display=this.isDebug? "block":"none";
  }
  toggleFullscreen(){
    if (!document.fullscreenElement) {
      const appElement=document.querySelector(".p-app");
      appElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }

  }
  setupEvents(){
    // const animateAsync=async()=>{
    //   await this.onTickAsync();
    //   requestAnimationFrame(animateAsync);
    // }
    // animateAsync();

    let onTickPromise:Promise<void>|null=null;
    this.renderer.setAnimationLoop((time:number,frame:XRFrame)=>{

      const previousOnTickPromise=onTickPromise;
      onTickPromise=(async ()=>{
        await previousOnTickPromise;
        if(!this.stats){
          throw new Error("this.stats is null");
        }
          this.stats.begin();
        await this.onTickAsync();
        this.stats.end();
  
      })();
  
  
    });

    const fullscreenElement=document.querySelector(".c-button--fullscreen") as HTMLElement;
    fullscreenElement.addEventListener("click",()=>{
      this.toggleFullscreen();
    });
    const debugElement=document.querySelector(".c-button--debug") as HTMLElement;
    debugElement.addEventListener("click",()=>{
      this.toggleDebug();
    });

    window.addEventListener("keydown", this.onKeyDown.bind(this));

    const uiElement=document.querySelector(".p-app__ui") as HTMLElement;
    uiElement.style.display="block";

    this.canvas.addEventListener("webglcontextlost",()=>{
      console.log("this.canvas webglcontextlost");
    });
    this.canvas.addEventListener("webglcontextrestored",()=>{
      console.log("this.canvas webglcontextrestored");
    });
    this.debugCanvas.addEventListener("webglcontextlost",()=>{
      console.log("this.debugCanvas webglcontextlost");
    });
    this.debugCanvas.addEventListener("webglcontextrestored",()=>{
      console.log("this.debugCanvas webglcontextrestored");
    });

  }
  async setupAsync(){
    this.setupStats();
    await this.setupWebcamAsync();
    await this.setupDetectorAsync();
    await this.setupVideoAsync();
    this.setupEvents();
  }
  async onTickAsync(){
    if(!this.webcam.srcObject){
      console.log("this.webcam.srcObject is null");
      return;

    }else{
      this.debugCanvas.width=this.webcam.videoWidth;
      this.debugCanvas.height=this.webcam.videoHeight;
      this.debugContext2d.drawImage(this.webcam,0,0);
    }
    if(this.detector){
      let faces:Face[]|null = null;
      try{
        faces = await this.detector.estimateFaces(this.webcam,{
          flipHorizontal: false,
        });
        if(faces){

          for(let face of faces){
            drawFace(this.debugContext2d,face);
          }
          this.player.updateFaceMaterialList(faces);
        }else{
          console.log("faces is null");
        }

        await this.player.onTickAsync();
        
      }catch(error){
        this.detector.dispose();
        this.detector=null;
        console.error(error);
      }
    }
  }
  onPlayerEnded(){
    console.log("onPlayerEnded");

    const nextVideoIndex=(this.currentVideoIndex+1)%VIDEO_PARAMS_LIST.length;
    this.updateVideo(nextVideoIndex);
  }
  onKeyDown(event: KeyboardEvent){
    switch (event.key) {
      case "d":
        this.toggleDebug();
        break;
      case "f":
        this.toggleFullscreen();
        break;
      default:
        // DO NOTHING
        break;
    }

  }
}
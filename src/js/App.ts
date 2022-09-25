import "@tensorflow/tfjs-backend-webgl";
import { setWasmPaths, version_wasm } from "@tensorflow/tfjs-backend-wasm";

import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";

import * as faceMesh from "@mediapipe/face_mesh";

import "../css/style.scss";
import { Face } from "@tensorflow-models/face-landmarks-detection";
import Player from "./Player";
import { WEBCAM_HEIGHT, WEBCAM_WIDTH } from "./constants";

setWasmPaths(`${window.relRoot}lib/@tensorflow/tfjs-backend-wasm@${version_wasm}/dist/`);

console.log(`version_wasm: ${version_wasm}`);

console.log(`faceMesh`,faceMesh);
console.log(`faceMesh.VERSION: ${faceMesh.VERSION}`);

console.log(`faceLandmarksDetection:`, faceLandmarksDetection);


interface videoParams{
  src:string,
}

const videoParamsList=[
  {
    url:`${window.relRoot}movie/kari.mp4`,
  }
];

export default class App{
  webcam:HTMLVideoElement;
  canvas:HTMLCanvasElement;
  context2d:CanvasRenderingContext2D;
  setupPromise:Promise<void>;
  detector:faceLandmarksDetection.FaceLandmarksDetector|null;
  player:Player;
  handleVideoFrameCallback:number|null=null;

  constructor(){
    this.webcam=document.querySelector(".p-app__webcam");
    this.canvas=document.querySelector(".p-app__view");
    this.context2d=this.canvas.getContext("2d");
    this.detector=null;
    this.player=new Player(this.webcam,videoParamsList[0]);
    this.setupPromise=this.setupAsync();
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
        refineLandmarks:true,
      });

      this.detector=detector;
    }catch(error){
      this.detector=null;
      console.error(error);
    }
    
  }
  setupEvents(){
    // const animateAsync=async()=>{
    //   await this.onTickAsync();
    //   requestAnimationFrame(animateAsync);
    // }
    // animateAsync();
    if(!("requestVideoFrameCallback" in this.webcam)){
      throw new Error("no requestVideoFrameCallback");
    }

    if(this.handleVideoFrameCallback!=null){
      this.webcam.cancelVideoFrameCallback(this.handleVideoFrameCallback);
      this.handleVideoFrameCallback=null;
    }
    this.handleVideoFrameCallback=this.webcam.requestVideoFrameCallback(this.onRequestVideoFrame.bind(this));

  }
  async setupAsync(){
    await this.setupWebcamAsync();
    await this.setupDetectorAsync();
    await this.setupVideoAsync();
    this.setupEvents();
  }
  drawFace(face:Face){
    this.context2d.save();
    this.context2d.strokeStyle="#f00";
    this.context2d.strokeRect(face.box.xMin,face.box.yMin,face.box.width,face.box.height);
    this.context2d.strokeStyle="#f0f";
    this.context2d.beginPath();
    for(let [fromIndex,toIndex] of faceMesh.FACEMESH_TESSELATION){
      const from=face.keypoints[fromIndex];
      const to=face.keypoints[toIndex];
      this.context2d.moveTo(from.x,from.y);
      this.context2d.lineTo(to.x,to.y);
    }
    this.context2d.stroke();
    

    
    this.context2d.restore();
  }
  async onRequestVideoFrame(now: DOMHighResTimeStamp, metadata: VideoFrameMetadata) {
    this.handleVideoFrameCallback=this.webcam.requestVideoFrameCallback(this.onRequestVideoFrame.bind(this));

    await this.onTickAsync();
  }
  async onTickAsync(){
    if(!this.webcam.srcObject){
      console.log("this.webcam.srcObject is null");
      return;

    }else{
      this.canvas.width=this.webcam.videoWidth;
      this.canvas.height=this.webcam.videoHeight;
      this.context2d.drawImage(this.webcam,0,0);
    }
    if(this.detector){
      let faces:Face[]|null = null;
      try{
        faces = await this.detector.estimateFaces(this.webcam,{
          flipHorizontal: false,
        });
        for(let face of faces){
          this.drawFace(face);
        }
        this.player.updateFaceMaterialList(faces);
        
      }catch(error){
        this.detector.dispose();
        this.detector=null;
        console.error(error);
      }
    }
  }
}
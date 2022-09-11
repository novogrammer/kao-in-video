import "@tensorflow/tfjs-backend-webgl";
import { setWasmPaths, version_wasm } from "@tensorflow/tfjs-backend-wasm";

import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";

import * as faceMesh from "@mediapipe/face_mesh";

import "./style.scss";
import { Face } from "@tensorflow-models/face-landmarks-detection";

setWasmPaths(`${window.relRoot}lib/@tensorflow/tfjs-backend-wasm@${version_wasm}/dist/`);

console.log(`version_wasm: ${version_wasm}`);

console.log(`faceMesh`,faceMesh);
console.log(`faceMesh.VERSION: ${faceMesh.VERSION}`);

console.log(`faceLandmarksDetection:`, faceLandmarksDetection);

const VIDEO_WIDTH=256;
const VIDEO_HEIGHT=256;

export default class App{
  video:HTMLVideoElement;
  canvas:HTMLCanvasElement;
  context2d:CanvasRenderingContext2D;
  setupPromise:Promise<void>;
  detector:faceLandmarksDetection.FaceLandmarksDetector|null;
  constructor(){
    this.video=document.querySelector(".app__video");
    this.canvas=document.querySelector(".app__view");
    this.context2d=this.canvas.getContext("2d");
    this.detector=null;
    this.setupPromise=this.setupAsync();
  }
  async setupVideoAsync(){
    if(!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)){
      throw new Error("no getUserMedia");
    }
    const mediaStream=await navigator.mediaDevices.getUserMedia({
      audio:false,
      video:{
        facingMode: "user",
        width:VIDEO_WIDTH,
        height:VIDEO_HEIGHT,
      }
    });
    this.video.srcObject=mediaStream;
    this.video.play();

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
    const animateAsync=async()=>{
      await this.onTickAsync();
      requestAnimationFrame(animateAsync);
    }
    animateAsync();
  }
  async setupAsync(){
    await this.setupVideoAsync();
    await this.setupDetectorAsync();
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
  async onTickAsync(){
    if(this.video.srcObject){
      this.canvas.width=this.video.videoWidth;
      this.canvas.height=this.video.videoHeight;
      this.context2d.drawImage(this.video,0,0);

    }
    if(this.detector){
      let faces:Face[]|null = null;
      try{
        faces = await this.detector.estimateFaces(this.video,{
          flipHorizontal: false,
        });
        for(let face of faces){
          this.drawFace(face);
        }
        
      }catch(error){
        this.detector.dispose();
        this.detector=null;
        console.error(error);
      }
    }
  }
}